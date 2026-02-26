import crypto from "crypto";
import { SubscriptionStatus } from "@prisma/client";
import { db } from "@/lib/db";

type KirvanoEventType =
  | "pagamento_aprovado"
  | "assinatura_ativa"
  | "cancelamento"
  | "reembolso"
  | "falha_pagamento";

export type KirvanoPayload = {
  event_id: string;
  event_type: KirvanoEventType;
  customer: {
    email: string;
    name?: string;
    id?: string;
  };
  transaction: {
    id: string;
    status: string;
    renewal_date?: string;
  };
  subscription: {
    status: string;
    product_id: string;
  };
};

export function verifyKirvanoSignature(rawBody: string, signature?: string | null) {
  const secret = process.env.KIRVANO_WEBHOOK_SECRET;
  if (!secret || !signature) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (digest.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function mapStatus(eventType: KirvanoEventType): SubscriptionStatus {
  if (eventType === "pagamento_aprovado" || eventType === "assinatura_ativa") return SubscriptionStatus.ACTIVE;
  if (eventType === "cancelamento") return SubscriptionStatus.CANCELED;
  if (eventType === "reembolso") return SubscriptionStatus.REFUNDED;
  if (eventType === "falha_pagamento") return SubscriptionStatus.PAYMENT_FAILED;
  return SubscriptionStatus.PENDING;
}

export async function processKirvanoWebhook(payload: KirvanoPayload) {
  const existing = await db.webhookEvent.findUnique({ where: { externalId: payload.event_id } });
  if (existing) return { ignored: true };

  const status = mapStatus(payload.event_type);

  const plan = await db.plan.findUnique({
    where: { kirvanoProductId: payload.subscription.product_id }
  });

  if (!plan) {
    await db.webhookEvent.create({
      data: {
        provider: "kirvano",
        eventType: payload.event_type,
        externalId: payload.event_id,
        payloadJson: payload as unknown as object,
        status: "unknown_plan"
      }
    });
    return { ignored: true, reason: "unknown_plan" };
  }

  const user = await db.user.upsert({
    where: { email: payload.customer.email },
    update: {
      name: payload.customer.name,
      kirvanoCustomerId: payload.customer.id
    },
    create: {
      email: payload.customer.email,
      name: payload.customer.name,
      passwordHash: crypto.randomBytes(32).toString("hex"),
      kirvanoCustomerId: payload.customer.id
    }
  });

  const renewalDate = payload.transaction.renewal_date ? new Date(payload.transaction.renewal_date) : null;

  await db.subscription.upsert({
    where: { userId: user.id },
    update: {
      planId: plan.id,
      status,
      renewalDate,
      kirvanoTransactionId: payload.transaction.id,
      canceledAt: status === SubscriptionStatus.CANCELED ? new Date() : null
    },
    create: {
      userId: user.id,
      planId: plan.id,
      status,
      renewalDate,
      kirvanoTransactionId: payload.transaction.id,
      canceledAt: status === SubscriptionStatus.CANCELED ? new Date() : null
    }
  });

  await db.user.update({
    where: { id: user.id },
    data: {
      isBlocked: status === SubscriptionStatus.CANCELED || status === SubscriptionStatus.PAYMENT_FAILED
    }
  });

  await db.webhookEvent.create({
    data: {
      provider: "kirvano",
      eventType: payload.event_type,
      externalId: payload.event_id,
      payloadJson: payload as unknown as object,
      status: "processed"
    }
  });

  return { ignored: false };
}
