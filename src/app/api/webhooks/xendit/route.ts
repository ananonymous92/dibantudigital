import { NextResponse, type NextRequest } from "next/server";
import { markInvoicePaidById } from "@/app/actions/billing";

export async function POST(request: NextRequest) {
  const expectedToken = process.env.XENDIT_WEBHOOK_TOKEN?.trim();
  const callbackToken = request.headers.get("x-callback-token")?.trim();

  if (expectedToken && callbackToken !== expectedToken) {
    return NextResponse.json({ error: "Invalid callback token" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    external_id?: string;
    status?: string;
  };

  if (payload.external_id && payload.status === "PAID") {
    await markInvoicePaidById(payload.external_id);
  }

  return NextResponse.json({ received: true });
}

