import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

/** A route that requires *any* signed-in user. */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/learning",
  "/analytics",
  "/revision",
  "/notes",
  "/projects",
  "/interview",
  "/settings",
  "/admin",
] as const;

/** Routes a signed-in user should be bounced away from. */
export const AUTH_ONLY_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
] as const;

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAuthOnlyPath(pathname: string): boolean {
  return AUTH_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
};

/**
 * Returns the authenticated user, or `null`.
 *
 * The user id always comes from the signed session token. It is never read from
 * request parameters, form fields or headers, which is what keeps one user's
 * requests from acting on another user's data.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role ?? "USER",
  };
}

/** Returns the authenticated user or throws an Unauthorized error for handlers. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

/** Returns the authenticated user or throws Forbidden when not an admin. */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new ForbiddenError();
  }
  return user;
}

/** Server Component helper: redirects to /login when signed out. */
export async function requireUserPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Server Component helper: redirects non-admins away from /admin. */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await requireUserPage();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export class UnauthorizedError extends Error {
  readonly status = 401;
  constructor(message = "You must be signed in to do that.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "You do not have access to this resource.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  readonly status = 404;
  constructor(message = "The requested resource was not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ValidationError extends Error {
  readonly status = 422;
  constructor(
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}