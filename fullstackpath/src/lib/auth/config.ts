import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { env } from "@/lib/env";
import type { Role } from "@/generated/prisma/enums";

/**
 * Google OAuth is optional: it is only registered when credentials exist so the
 * app works with email/password alone and never fails on a missing secret.
 */
const providers: NextAuthConfig["providers"] = [
  Credentials({
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = loginSchema.safeParse(credentials);
      if (!parsed.success) return null;

      const email = parsed.data.email.toLowerCase();
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
          image: true,
          passwordHash: true,
          role: true,
        },
      });

      // Compare against a dummy hash when the user is missing so the response
      // time does not reveal whether an email address is registered.
      if (!user?.passwordHash) {
        await bcrypt.compare(parsed.data.password, DUMMY_HASH);
        return null;
      }

      const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!valid) return null;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
        emailVerified: user.emailVerified,
      } satisfies AuthUser;
    },
  }),
];

if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: false,
    }),
  );
}

/**
 * A real bcrypt hash of a random string. Used to keep the "unknown email" path
 * as slow as the "wrong password" path.
 */
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.4vXKrk9c8HrSLkzZ5l4qMHhwKE1eNS";

export type AuthUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: Role;
  emailVerified: Date | null;
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      role: Role;
    };
  }

  interface User {
    role?: Role;
  }
}

/**
 * next-auth/jwt only re-exports @auth/core/jwt, and module augmentation does not
 * resolve through a bare re-export under the package exports map. The underlying
 * module is augmented instead, which is what next-auth itself reads.
 */
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}

declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string;
      image: string | null;
      role: Role;
    };
  }

  interface User {
    role?: Role;
  }
}

export const authConfig = {
  providers,
  secret: env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
    updateAge: 24 * 60 * 60,
  },
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
    verifyRequest: "/verify-email",
    newUser: "/register",
  },
  callbacks: {
    jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role ?? "USER";
      }
      // Refresh the role when a session update is requested, so promoting a
      // user to ADMIN takes effect without forcing a re-login.
      if (trigger === "update" && user) {
        token.role = (user as { role?: Role }).role ?? token.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      session.user.role = (token.role as Role | undefined) ?? "USER";
      return session;
    },
  },
} satisfies NextAuthConfig;