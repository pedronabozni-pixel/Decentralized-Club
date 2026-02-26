import { NextRequest, NextResponse } from "next/server";
import { processKirvanoWebhook, verifyKirvanoSignature } from "@/lib/kirvano";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-kirvano-signature");

  if (!verifyKirvanoSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody);
    const result = await processKirvanoWebhook(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Kirvano webhook error", error);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
