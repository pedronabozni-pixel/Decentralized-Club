import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [starter, pro] = await Promise.all([
    prisma.plan.upsert({
      where: { kirvanoProductId: "kirvano_starter" },
      update: {},
      create: {
        name: "Starter",
        priceCents: 9900,
        kirvanoProductId: "kirvano_starter",
        permissionsJson: {
          dailyUpdates: true,
          analyses: ["MACRO", "TECNICA"],
          videosModules: ["base"]
        }
      }
    }),
    prisma.plan.upsert({
      where: { kirvanoProductId: "kirvano_pro" },
      update: {},
      create: {
        name: "Pro",
        priceCents: 19900,
        kirvanoProductId: "kirvano_pro",
        permissionsJson: {
          dailyUpdates: true,
          analyses: ["MACRO", "TECNICA", "NARRATIVAS", "INSTITUCIONAL", "EUA"],
          videosModules: ["base", "advanced", "institutional"]
        }
      }
    })
  ]);

  const passwordHash = await bcrypt.hash("Admin@12345", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@decentralized.club" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@decentralized.club",
      passwordHash,
      role: Role.ADMIN
    }
  });

  await prisma.subscription.upsert({
    where: { userId: admin.id },
    update: { planId: pro.id, status: "ACTIVE" },
    create: {
      userId: admin.id,
      planId: pro.id,
      status: "ACTIVE",
      kirvanoTransactionId: "seed_admin_tx",
      renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    }
  });

  await prisma.dailyUpdate.upsert({
    where: { slug: "fechamento-mercado-seed" },
    update: {
      content: "Atualização educacional diária sem promessa de rentabilidade.",
      publishedAt: new Date()
    },
    create: {
      title: "Fechamento do Mercado",
      slug: "fechamento-mercado-seed",
      content: "Atualização educacional diária sem promessa de rentabilidade.",
      publishedAt: new Date(),
      createdById: admin.id
    }
  });

  await prisma.analysis.upsert({
    where: { slug: "ciclo-macro-atual-seed" },
    update: {
      content: "Análise educacional focada em contexto macroeconômico.",
      publishedAt: new Date()
    },
    create: {
      title: "Ciclo Macro Atual",
      slug: "ciclo-macro-atual-seed",
      category: "MACRO",
      content: "Análise educacional focada em contexto macroeconômico.",
      publishedAt: new Date(),
      createdById: admin.id
    }
  });

  const existingVideo = await prisma.video.findFirst({
    where: { title: "Introdução ao Plano Estratégico", createdById: admin.id }
  });

  if (!existingVideo) {
    await prisma.video.create({
      data: {
        title: "Introdução ao Plano Estratégico",
        module: "base",
        provider: "YOUTUBE",
        videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        publishedAt: new Date(),
        requiredPlanId: starter.id,
        createdById: admin.id
      }
    });
  }

  console.log("Seed finalizado.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
