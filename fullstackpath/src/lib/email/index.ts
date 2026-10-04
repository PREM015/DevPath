import "server-only";

import { env } from "@/lib/env";

/**
 * Transactional email.
 *
 * When `RESEND_API_KEY` is set the message is sent through the Resend HTTP API.
 * When it is not, the message is written to the server console instead, so the
 * whole verification / password-reset flow works locally and in preview
 * deployments without a paid provider or a hard dependency.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

async function sendViaResend(message: EmailMessage): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!response.ok) {
      console.error(
        `[email] Resend rejected the message (${response.status}):`,
        await response.text(),
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Failed to reach Resend:", error);
    return false;
  }
}

let warnedAboutMissingProvider = false;

/** Warns once per process when no provider is configured. */
function warnMissingProviderOnce(): void {
  if (warnedAboutMissingProvider) return;
  warnedAboutMissingProvider = true;
  if (!env.IS_PRODUCTION) return;
  console.warn(
    [
      "",
      "─────────────────────────────────────────────────────────────────",
      " ⚠️  EMAIL PROVIDER NOT CONFIGURED",
      " RESEND_API_KEY is not set, so verification and password-reset",
      " messages are NOT being delivered. They are written to this log.",
      " A user who forgets their password cannot recover the account.",
      " Set RESEND_API_KEY (and EMAIL_FROM) in the environment to fix this.",
      "─────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const sent = await sendViaResend(message);
  if (sent) return;

  warnMissingProviderOnce();

  if (env.IS_PRODUCTION && env.EMAIL_TRANSPORT === "resend") {
    console.error(
      `[email] Could not deliver "${message.subject}" to ${message.to}.`,
    );
    return;
  }

  // Development / no-provider fallback.
  console.info(
    [
      "",
      "──────────── ✉️  Outgoing email (console transport) ────────────",
      `To:      ${message.to}`,
      `Subject: ${message.subject}`,
      "",
      message.text,
      "─────────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
}

function layout(title: string, bodyHtml: string, ctaLabel?: string, ctaUrl?: string) {
  return `<!doctype html>
<html>
  <body style="margin:0;background:#0b0d14;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#e6e8ef">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#12141f;border:1px solid #262a3a;border-radius:14px;padding:32px">
          <tr><td>
            <p style="margin:0 0 4px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#8b93b0">FullStackPath</p>
            <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3">${title}</h1>
            <div style="font-size:15px;line-height:1.6;color:#b9c0d4">${bodyHtml}</div>
            ${
              ctaLabel && ctaUrl
                ? `<p style="margin:28px 0 0">
                     <a href="${ctaUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">${ctaLabel}</a>
                   </p>
                   <p style="margin:18px 0 0;font-size:12px;color:#6b7391;word-break:break-all">${ctaUrl}</p>`
                : ""
            }
            <p style="margin:32px 0 0;font-size:12px;color:#5f6784">
              If you did not request this email you can safely ignore it.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendVerificationEmail(to: string, code: string) {
  const url = `${env.APP_URL}/verify-email?code=${code}`;
  await sendEmail({
    to,
    subject: "Verify your FullStackPath email address",
    text: `Your verification code is ${code}.\n\nConfirm your email: ${url}\n\nThe code expires in 24 hours.`,
    html: layout(
      "Confirm your email address",
      `<p>Your verification code is:</p>
       <p style="font-size:32px;font-weight:700;letter-spacing:.35em;margin:20px 0;color:#fff">${code}</p>
       <p style="font-size:14px;color:#7f88a6">This code expires in 24 hours.</p>`,
      "Verify email",
      url,
    ),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${env.APP_URL}/reset-password?token=${token}`;
  await sendEmail({
    to,
    subject: "Reset your FullStackPath password",
    text: `Reset your password: ${url}\n\nThis link expires in 1 hour. If you did not request it, ignore this email.`,
    html: layout(
      "Reset your password",
      `<p>Click the button below to choose a new password. The link is valid for one hour and can only be used once.</p>`,
      "Reset password",
      url,
    ),
  });
}