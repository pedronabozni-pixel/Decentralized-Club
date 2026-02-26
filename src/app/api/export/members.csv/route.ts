import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const users = await db.user.findMany({
    include: {
      subscription: {
        include: {
          plan: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const lines = ["name,email,role,blocked,plan,status,renewalDate"];

  for (const user of users) {
    const row = [
      user.name ?? "",
      user.email,
      user.role,
      String(user.isBlocked),
      user.subscription?.plan.name ?? "",
      user.subscription?.status ?? "",
      user.subscription?.renewalDate?.toISOString() ?? ""
    ]
      .map((v) => `\"${String(v).replaceAll('"', '""')}\"`)
      .join(",");

    lines.push(row);
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=members.csv"
    }
  });
}
