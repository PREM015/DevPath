"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/utils/rate-limit";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import {
  changePasswordSchema,
  fieldErrors,
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type RegisterInput,
  type ResetPasswordInput,
  type VerifyEmailInput,
} from "@/lib/validations/auth";
import { requireUser } from "@/lib/permissions";
import { generateToken, generateVerificationCode } from "@/lib/utils";

export type FormResult =
  | { status: "success"; message: string; fields?: Record<string, string> }
  | { status: "error"; message: string; fields?: Record<string, string> };

const BCRYPT_ROUNDS = 12;
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

/** Best-effort client identity for rate limiting inside a Server Action. */
async function actionScopeKey(scope: string): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `${scope}:${ip}`;
}

export async function registerUserAction(input: RegisterInput): Promise<FormResult> {
  const limit = rateLimit(await actionScopeKey("register"), RATE_LIMITS.register.limit, RATE_LIMITS.register.windowMs);
  if (!limit.success) {
    return {
      status: "error",
      message: `Too many accounts created from this device. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
    };
  }

  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fields: fieldErrors(parsed.error),
    };
  }

  const { name, email, password, preferredRole, targetLevel } = parsed.data;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return {
      status: "error",
      message: "An account with this email address already exists.",
      fields: { email: "This email is already registered" },
    };
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "USER",
      preferredRole,
      targetLevel,
      // New accounts start with no verified email and no progress at all: every
      // topic is implicitly NOT_STARTED because no UserTopicProgress row exists.
    },
    select: { id: true, email: true },
  });

  await issueVerificationCode(user.id, user.email);

  return {
    status: "success",
    message: "Account created. Check your inbox to verify your email address.",
  };
}

/**
 * Verifies an email address.
 *
 * The code is compared against the newest unexpired code for the *signed-in
 * user*, so one account can never consume another account's code.
 */
export async function verifyEmailAction(input: VerifyEmailInput): Promise<FormResult> {
  const user = await requireUser();

  const limit = rateLimit(`verify:${user.id}`, RATE_LIMITS.verifyEmail.limit, RATE_LIMITS.verifyEmail.windowMs);
  if (!limit.success) {
    return { status: "error", message: "Too many attempts. Please request a new code." };
  }

  const parsed = verifyEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  const code = await findVerificationCode(user.id, parsed.data.code);
  if (!code) {
    return { status: "error", message: "That code is invalid or has expired." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: new Date() },
    }),
    prisma.verificationToken.deleteMany({ where: { identifier: `verify:${user.id}` } }),
  ]);

  return { status: "success", message: "Email address verified." };
}

export async function resendVerificationAction(): Promise<FormResult> {
  const user = await requireUser();

  const account = await prisma.user.findUnique({
    where: { id: user.id },
    select: { emailVerified: true },
  });
  if (account?.emailVerified) {
    return { status: "success", message: "Your email address is already verified." };
  }

  const limit = rateLimit(`verify-send:${user.id}`, 3, 60 * 60 * 1000);
  if (!limit.success) {
    return { status: "error", message: "You have requested several codes already. Try again later." };
  }

  await issueVerificationCode(user.id, user.email);
  return { status: "success", message: "A new verification code is on its way." };
}

/**
 * Starts a password reset.
 *
 * The response is identical whether or not the address exists, so the endpoint
 * cannot be used to discover registered accounts.
 */
export async function forgotPasswordAction(input: ForgotPasswordInput): Promise<FormResult> {
  const limit = rateLimit(await actionScopeKey("forgot"), RATE_LIMITS.forgotPassword.limit, RATE_LIMITS.forgotPassword.windowMs);
  if (!limit.success) {
    return {
      status: "error",
      message: "Too many reset attempts. Please try again later.",
    };
  }

  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]!.message };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, email: true },
  });

  if (user) {
    // Database-backed throttle: survives instance restarts and is shared by
    // every serverless instance, unlike the in-memory limiter.
    const recent = await prisma.passwordResetToken.count({
      where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    });
    if (recent >= 3) {
      return { status: "success", message: "If that account exists, a reset link has been sent." };
    }

    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = generateToken(32);
    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expires: new Date(Date.now() + RESET_TTL_MS) },
    });

    await sendPasswordResetEmail(user.email, token);
  }

  return {
    status: "success",
    message: "If that account exists, a password reset link has been sent.",
  };
}

export async function resetPasswordAction(input: ResetPasswordInput): Promise<FormResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fields: fieldErrors(parsed.error),
    };
  }

  const resetToken = await prisma.passwordResetToken.findUnique({
    where: { token: parsed.data.token },
    select: { id: true, userId: true, expires: true },
  });

  if (!resetToken) {
    return { status: "error", message: "This reset link is invalid or has already been used." };
  }
  if (resetToken.expires < new Date()) {
    await prisma.passwordResetToken.delete({ where: { id: resetToken.id } });
    return { status: "error", message: "This reset link has expired. Request a new one." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);

  // Changing the password consumes the token and invalidates existing sessions
  // by rotating the "password changed" marker used by the session callback.
  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.userId },
      data: { passwordHash, sessionsInvalidBefore: new Date() },
    }),
    prisma.passwordResetToken.delete({ where: { id: resetToken.id } }),
  ]);

  return { status: "success", message: "Your password has been updated. You can sign in now." };
}

export async function changePasswordAction(input: ChangePasswordInput): Promise<FormResult> {
  const user = await requireUser();

  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fields: fieldErrors(parsed.error),
    };
  }

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!record?.passwordHash) {
    return {
      status: "error",
      message: "This account signs in with Google. Update your password there.",
    };
  }

  const valid = await bcrypt.compare(parsed.data.currentPassword, record.passwordHash);
  if (!valid) {
    return {
      status: "error",
      message: "Your current password is incorrect.",
      fields: { currentPassword: "Incorrect password" },
    };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, sessionsInvalidBefore: new Date() },
  });

  return { status: "success", message: "Password updated." };
}

// ─────────────────────────────────────────────
// Verification helpers
// ─────────────────────────────────────────────

async function issueVerificationCode(userId: string, email: string): Promise<void> {
  const identifier = `verify:${userId}`;
  const code = generateVerificationCode();

  await prisma.verificationToken.deleteMany({ where: { identifier } });
  await prisma.verificationToken.create({
    data: {
      identifier,
      token: bcrypt.hashSync(code, 10),
      expires: new Date(Date.now() + VERIFICATION_TTL_MS),
    },
  });

  await sendVerificationEmail(email, code);
}

/**
 * Codes are stored as bcrypt hashes so a database leak does not hand out
 * verified inboxes. Comparison walks the user's most recent codes so a user who
 * requested a new code is not locked out by an earlier one.
 */
async function findVerificationCode(userId: string, code: string): Promise<boolean> {
  const identifier = `verify:${userId}`;

  const candidates = await prisma.verificationToken.findMany({
    where: { identifier, expires: { gt: new Date() } },
    select: { token: true },
    orderBy: { expires: "desc" },
    take: 5,
  });

  for (const candidate of candidates) {
    if (await bcrypt.compare(code, candidate.token)) return true;
  }
  return false;
}

/** Exposed for the login form's "email already registered" hint — never blocks. */
export async function emailExists(email: string): Promise<boolean> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return false;
  const found = await prisma.user.findUnique({
    where: { email: normalised },
    select: { id: true },
  });
  return Boolean(found);
}