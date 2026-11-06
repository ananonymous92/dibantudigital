import "server-only";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Resolves the public origin URL (e.g. `https://dibantudigital.id` or `http://localhost:3000`)
 * from the active HTTP request headers (`X-Forwarded-Host` / `Host` and `X-Forwarded-Proto`).
 * This guarantees OAuth `redirect_uri` always matches the exact domain where the user's
 * session cookie is stored, even if `APP_URL` in `.env` was left on a default value.
 */
export async function getPublicBaseUrl(): Promise<string> {
  const configured = env().APP_URL.replace(/\/$/, "");
  try {
    const h = await headers();
    const rawHost = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0]?.trim();
    if (rawHost && !rawHost.startsWith("0.0.0.0")) {
      const isLocal = rawHost.startsWith("localhost") || rawHost.startsWith("127.0.0.1");
      const defaultProto = isLocal ? "http" : "https";
      const proto = (h.get("x-forwarded-proto") || defaultProto).split(",")[0]?.trim() || defaultProto;
      return `${proto}://${rawHost}`;
    }
  } catch {
    // Fallback to configured APP_URL when called outside a request scope
  }
  return configured;
}
