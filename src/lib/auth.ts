import bcrypt from "bcryptjs";
import { Role, SubscriptionStatus } from "@prisma/client";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";

const BOOTSTRAP_USERS = [
  {
    email: "Admin@decentralized.club.com.br",
    password: "D3centr@al1iz3d@873829131894",
    role: Role.ADMIN,
    name: "Admin"
  },
  {
    email: "pedronabozni@gmail.com",
    password: "Pedro@12345",
    role: Role.USER,
    name: "Pedro Nabozni"
  }
];

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;

        const bootstrapUser = BOOTSTRAP_USERS.find(
          (item) => item.email === credentials.email && item.password === credentials.password
        );

        if (bootstrapUser) {
          const passwordHash = await bcrypt.hash(bootstrapUser.password, 10);
          await db.user.upsert({
            where: { email: bootstrapUser.email },
            update: {
              name: bootstrapUser.name,
              passwordHash,
              role: bootstrapUser.role,
              isBlocked: false
            },
            create: {
              email: bootstrapUser.email,
              name: bootstrapUser.name,
              passwordHash,
              role: bootstrapUser.role,
              isBlocked: false
            }
          });
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: { subscription: true }
        });

        if (!user) return null;

        const ok = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isBlocked: user.isBlocked,
          subscriptionStatus: user.subscription?.status ?? SubscriptionStatus.PENDING
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.isBlocked = user.isBlocked;
        token.subscriptionStatus = user.subscriptionStatus;
      }

      if (token.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          include: { subscription: true }
        });

        if (dbUser) {
          token.role = dbUser.role;
          token.isBlocked = dbUser.isBlocked;
          token.subscriptionStatus = dbUser.subscription?.status ?? SubscriptionStatus.PENDING;
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as Role) ?? Role.USER;
        session.user.isBlocked = Boolean(token.isBlocked);
        session.user.subscriptionStatus =
          (token.subscriptionStatus as SubscriptionStatus) ?? SubscriptionStatus.PENDING;
      }

      return session;
    }
  }
};
