import "server-only";
import net from "node:net";
import tls from "node:tls";
import { env } from "@/lib/env";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export function isEmailConfigured(): boolean {
  const e = env();
  return Boolean(e.RESEND_API_KEY || (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS));
}

/**
 * Send a transactional email via Resend HTTP API or SMTP (STARTTLS / implicit TLS).
 * If neither is configured yet, logs the email content to console and returns `{ sent: false }`.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; error?: string }> {
  const e = env();

  if (e.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${e.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: e.SMTP_FROM,
          to: [input.to],
          subject: input.subject,
          html: input.html,
          text: input.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[email/resend] gagal mengirim email:", res.status, body);
        return { sent: false, error: `Resend HTTP ${res.status}` };
      }
      return { sent: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menghubungi Resend API";
      console.error("[email/resend] error:", msg);
      return { sent: false, error: msg };
    }
  }

  if (e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS) {
    try {
      await sendViaSmtp({
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        user: e.SMTP_USER,
        pass: e.SMTP_PASS,
        from: e.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      });
      return { sent: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim via SMTP";
      console.error("[email/smtp] error:", msg);
      return { sent: false, error: msg };
    }
  }

  console.info(
    `[email/preview] Email belum dikonfigurasi (RESEND_API_KEY / SMTP_HOST kosong).\n` +
      `  To: ${input.to}\n  Subject: ${input.subject}\n  Body:\n${input.text}`,
  );
  return { sent: false, error: "SMTP/Resend belum dikonfigurasi" };
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim();
}

async function sendViaSmtp(opts: {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const implicitTls = opts.port === 465;
  let socket: net.Socket | tls.TLSSocket = implicitTls
    ? tls.connect({ host: opts.host, port: opts.port, servername: opts.host })
    : net.createConnection({ host: opts.host, port: opts.port });

  socket.setTimeout(15_000);

  const readResponse = (sock: net.Socket | tls.TLSSocket): Promise<{ code: number; text: string }> =>
    new Promise((resolve, reject) => {
      let buffer = "";
      const onData = (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        const lines = buffer.split("\r\n");
        // Wait until we have at least one complete line ending in \r\n
        if (!buffer.endsWith("\r\n")) return;
        const nonEmpty = lines.filter((l) => l.length > 0);
        const last = nonEmpty[nonEmpty.length - 1];
        // Final line of an SMTP response has a space at index 3 (e.g., "250 OK")
        if (last && /^\d{3} /.test(last)) {
          cleanup();
          resolve({ code: Number(last.slice(0, 3)), text: buffer });
        }
      };
      const onError = (err: Error) => {
        cleanup();
        reject(err);
      };
      const onTimeout = () => {
        cleanup();
        reject(new Error("SMTP connection timeout"));
      };
      const cleanup = () => {
        sock.off("data", onData);
        sock.off("error", onError);
        sock.off("timeout", onTimeout);
      };
      sock.on("data", onData);
      sock.on("error", onError);
      sock.on("timeout", onTimeout);
    });

  const command = async (cmd: string, expectedCodes: number[]) => {
    socket.write(cmd + "\r\n");
    const res = await readResponse(socket);
    if (!expectedCodes.includes(res.code)) {
      throw new Error(`SMTP error (${res.code}): ${res.text.trim()}`);
    }
    return res;
  };

  try {
    const greeting = await readResponse(socket);
    if (greeting.code !== 220) {
      throw new Error(`SMTP greeting gagal: ${greeting.text.trim()}`);
    }

    const ehloRes = await command(`EHLO dibantudigital.id`, [250]);

    if (!implicitTls && ehloRes.text.toUpperCase().includes("STARTTLS")) {
      await command("STARTTLS", [220]);
      socket = await new Promise<tls.TLSSocket>((resolve, reject) => {
        const secureSocket = tls.connect(
          { socket, servername: opts.host },
          () => resolve(secureSocket),
        );
        secureSocket.once("error", reject);
      });
      socket.setTimeout(15_000);
      await command(`EHLO dibantudigital.id`, [250]);
    }

    const authPlain = Buffer.from(`\u0000${opts.user}\u0000${opts.pass}`, "utf8").toString("base64");
    await command(`AUTH PLAIN ${authPlain}`, [235]);

    const fromAddr = extractEmailAddress(opts.from);
    const toAddr = extractEmailAddress(opts.to);

    await command(`MAIL FROM:<${fromAddr}>`, [250]);
    await command(`RCPT TO:<${toAddr}>`, [250, 251]);
    await command("DATA", [354]);

    const boundary = `dd_${Date.now().toString(36)}`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(opts.subject, "utf8").toString("base64")}?=`;
    const messageLines = [
      `From: ${opts.from}`,
      `To: <${toAddr}>`,
      `Subject: ${encodedSubject}`,
      `Date: ${new Date().toUTCString()}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(opts.text, "utf8").toString("base64"),
      ``,
      `--${boundary}`,
      `Content-Type: text/html; charset="UTF-8"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      Buffer.from(opts.html, "utf8").toString("base64"),
      ``,
      `--${boundary}--`,
      `.`,
    ];

    await command(messageLines.join("\r\n"), [250]);
    socket.write("QUIT\r\n");
  } finally {
    socket.destroy();
  }
}

export function buildVerificationEmail(params: {
  name: string;
  code: string;
  verifyUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `${params.code} adalah kode verifikasi DibantuDigital Anda`;
  const text = [
    `Halo ${params.name},`,
    ``,
    `Terima kasih telah mendaftar di DibantuDigital!`,
    `Kode verifikasi 6 digit Anda adalah: ${params.code}`,
    ``,
    `Atau klik link berikut untuk memverifikasi email Anda secara otomatis:`,
    params.verifyUrl,
    ``,
    `Kode ini berlaku selama 24 jam.`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="font-size: 18px; font-weight: 700; color: #2563eb; margin-bottom: 16px;">DibantuDigital</div>
      <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Verifikasi alamat email Anda</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
        Halo <strong>${escapeHtml(params.name)}</strong>, masukkan kode verifikasi 6 digit berikut di halaman verifikasi DibantuDigital:
      </p>
      <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 18px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">${params.code}</span>
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px;">
        Atau klik tombol di bawah ini untuk langsung mengaktifkan akun Anda:
      </p>
      <div style="margin: 24px 0;">
        <a href="${params.verifyUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none;">
          Verifikasi Email Sekarang
        </a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 28px;">
        Kode dan link ini berlaku selama 24 jam. Jika Anda tidak merasa mendaftar di DibantuDigital, abaikan email ini.
      </p>
    </div>
  `;

  return { subject, html, text };
}

export function buildPasswordResetEmail(params: {
  name: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  const subject = `Reset Password Akun DibantuDigital Anda`;
  const text = [
    `Halo ${params.name},`,
    ``,
    `Kami menerima permintaan untuk mereset password akun DibantuDigital Anda.`,
    `Silakan buka link berikut untuk membuat password baru (berlaku 1 jam):`,
    params.resetUrl,
    ``,
    `Jika Anda tidak meminta reset password, abaikan email ini.`,
  ].join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #0f172a; border: 1px solid #e2e8f0; border-radius: 16px;">
      <div style="font-size: 18px; font-weight: 700; color: #2563eb; margin-bottom: 16px;">DibantuDigital</div>
      <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Reset password akun Anda</h1>
      <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
        Halo <strong>${escapeHtml(params.name)}</strong>, kami menerima permintaan untuk mengatur ulang password akun DibantuDigital Anda. Klik tombol di bawah ini untuk membuat password baru:
      </p>
      <div style="margin: 24px 0;">
        <a href="${params.resetUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; font-weight: 600; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none;">
          Buat Password Baru
        </a>
      </div>
      <p style="font-size: 12px; color: #64748b; word-break: break-all;">
        Atau salin link ini ke browser Anda:<br />
        <a href="${params.resetUrl}" style="color: #2563eb;">${params.resetUrl}</a>
      </p>
      <p style="font-size: 12px; color: #94a3b8; margin-top: 28px;">
        Link ini berlaku selama 1 jam dan hanya dapat digunakan satu kali. Jika Anda tidak meminta reset password, abaikan email ini.
      </p>
    </div>
  `;

  return { subject, html, text };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

