import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Card className="animate-fade-in-up shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>Your reset link can only be used once.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<div className="h-56 animate-pulse-soft rounded-lg bg-muted" />}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}