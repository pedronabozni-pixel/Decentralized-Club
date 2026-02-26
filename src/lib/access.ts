import { Role, SubscriptionStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export async function requireMemberSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user) redirect("/login");

  if (session.user.isBlocked) redirect("/login?error=bloqueado");

  if (session.user.subscriptionStatus !== SubscriptionStatus.ACTIVE && session.user.role !== Role.ADMIN) {
    redirect("/login?error=assinatura");
  }

  return session;
}

export async function requireAdminSession() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== Role.ADMIN) {
    redirect("/login?error=admin");
  }

  return session;
}
