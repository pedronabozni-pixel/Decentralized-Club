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

function safeCompare(a: string, b: string) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export function verifyKirvanoSignature(rawBody: string, signature?: string | null, token?: string | null) {
  const secret = process.env.KIRVANO_WEBHOOK_SECRET;
  if (!secret) return false;

  // Some Kirvano setups send a static token instead of HMAC signature.
  if (token && safeCompare(token, secret)) return true;

  if (!signature) return false;

  const hex = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const base64 = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const normalized = signature.replace(/^sha256=/i, "").trim();

  return safeCompare(normalized, hex) || safeCompare(normalized, base64);
}

function mapStatus(eventType: KirvanoEventType): SubscriptionStatus {
  if (eventType === "pagamento_aprovado" || eventType === "assinatura_ativa") return SubscriptionStatus.ACTIVE;
  if (eventType === "cancelamento") return SubscriptionStatus.CANCELED;
  if (eventType === "reembolso") return SubscriptionStatus.REFUNDED;
  if (eventType === "falha_pagamento") return SubscriptionStatus.PAYMENT_FAILED;
  return SubscriptionStatus.PENDING;
}

type KirvanoRawPayload = {
  event_id?: string;
  event_type?: string;
  event?: string;
  sale_id?: string;
  status?: string;
  created_at?: string;
  customer?: { email?: string; name?: string; id?: string };
  products?: Array<{ id?: string }>;
  transaction?: { id?: string; status?: string; renewal_date?: string };
  subscription?: { status?: string; product_id?: string };
  plan?: { next_charge_date?: string };
};

function normalizeEventType(raw?: string): KirvanoEventType | null {
  const value = (raw ?? "").trim().toUpperCase();
  if (value === "PAGAMENTO_APROVADO" || value === "COMPRA_APROVADA" || value === "SALE_APPROVED") {
    return "pagamento_aprovado";
  }
  if (value === "ASSINATURA_ATIVA" || value === "ASSINATURA_RENOVADA" || value === "SUBSCRIPTION_RENEWED") {
    return "assinatura_ativa";
  }
  if (value === "CANCELAMENTO" || value === "ASSINATURA_CANCELADA" || value === "SUBSCRIPTION_CANCELED") {
    return "cancelamento";
  }
  if (value === "REEMBOLSO" || value === "REFUND" || value === "REFUNDED") {
    return "reembolso";
  }
  if (
    value === "FALHA_PAGAMENTO" ||
    value === "COMPRA_RECUSADA" ||
    value === "ASSINATURA_ATRASADA" ||
    value === "PAYMENT_FAILED" ||
    value === "CHARGEBACK"
  ) {
    return "falha_pagamento";
  }
  return null;
}

function normalizePayload(raw: KirvanoRawPayload): KirvanoPayload | null {
  const eventType = normalizeEventType(raw.event_type ?? raw.event);
  const email = raw.customer?.email;
  const transactionId = raw.transaction?.id ?? raw.sale_id;
  const productId = raw.subscription?.product_id ?? raw.products?.[0]?.id;

  if (!eventType || !email || !transactionId || !productId) return null;

  return {
    event_id: raw.event_id ?? `${transactionId}:${eventType}:${raw.created_at ?? Date.now()}`,
    event_type: eventType,
    customer: {
      email,
      name: raw.customer?.name,
      id: raw.customer?.id
    },
    transaction: {
      id: transactionId,
      status: raw.transaction?.status ?? raw.status ?? eventType,
      renewal_date: raw.transaction?.renewal_date ?? raw.plan?.next_charge_date
    },
    subscription: {
      status: raw.subscription?.status ?? raw.status ?? eventType,
      product_id: productId
    }
  };
}

export async function processKirvanoWebhook(payload: KirvanoPayload) {
  const existing = await db.webhookEvent.findUnique({ where: { externalId: payload.event_id } });
  if (existing) return { ignored: true };

  const status = mapStatus(payload.event_type);

  let plan = await db.plan.findUnique({
    where: { kirvanoProductId: payload.subscription.product_id }
  });

  // Fallback for first setup when product ID was not mapped in admin yet.
  if (!plan) {
    plan = await db.plan.findFirst({ where: { isActive: true }, orderBy: { priceCents: "asc" } });
  }

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

export async function processKirvanoWebhookRaw(rawPayload: KirvanoRawPayload) {
  const normalized = normalizePayload(rawPayload);
  if (!normalized) return { ignored: true, reason: "invalid_payload" };
  return processKirvanoWebhook(normalized);
}
