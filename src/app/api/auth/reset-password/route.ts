import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const bodySchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8)
});

export async function POST(req: NextRequest) {
  const json = await req.json();
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash }
  });

  return NextResponse.json({ ok: true });
}
