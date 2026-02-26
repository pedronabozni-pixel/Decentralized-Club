import { Role, SubscriptionStatus } from "@prisma/client";
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      isBlocked: boolean;
      subscriptionStatus: SubscriptionStatus;
    };
  }

  interface User {
    role: Role;
    isBlocked: boolean;
    subscriptionStatus: SubscriptionStatus;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    isBlocked?: boolean;
    subscriptionStatus?: SubscriptionStatus;
  }
}
