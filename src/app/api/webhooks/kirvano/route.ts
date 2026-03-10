import { NextRequest, NextResponse } from "next/server";
import { processKirvanoWebhookRaw, verifyKirvanoSignature } from "@/lib/kirvano";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-kirvano-signature");
  const token = req.headers.get("x-kirvano-token") ?? req.headers.get("authorization");

  if (!verifyKirvanoSignature(rawBody, signature, token)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const result = await processKirvanoWebhookRaw(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Kirvano webhook error", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
