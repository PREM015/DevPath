import NextAuth from "next-auth";
import { authConfig } from "./config";

/**
 * Auth.js is configured with the JWT session strategy, so no database adapter
 * is required: every login goes through the Credentials provider (or Google
 * OAuth when configured) and the resulting session is a signed token.
 */
export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);