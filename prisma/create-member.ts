import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const plan = await prisma.plan.findFirst({ where: { isActive: true }, orderBy: { priceCents: "asc" } });
  if (!plan) throw new Error("No active plan found");

  const passwordHash = await bcrypt.hash("User@12345", 10);

  const user = await prisma.user.upsert({
    where: { email: "membro@decentralized.club" },
    update: { name: "Membro Teste", passwordHash, isBlocked: false, role: "USER" },
    create: {
      name: "Membro Teste",
      email: "membro@decentralized.club",
      passwordHash,
      role: "USER",
      isBlocked: false
    }
  });

  await prisma.subscription.upsert({
    where: { userId: user.id },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      canceledAt: null
    },
    create: {
      userId: user.id,
      planId: plan.id,
      status: "ACTIVE",
      renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });

  console.log("member_ready");
}

main().finally(async () => prisma.$disconnect());
