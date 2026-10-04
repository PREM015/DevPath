import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { VerifyEmailForm } from "@/features/auth/components/verify-email-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage() {
  const sessionUser = await requireUserPage();

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { emailVerified: true, email: true },
  });

  if (account?.emailVerified) redirect("/dashboard");

  return (
    <Card className="animate-fade-in-up shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Verify your email</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <VerifyEmailForm email={account?.email ?? sessionUser.email} />
        <Button asChild variant="ghost" className="w-full">
          <a href="/dashboard">Skip for now</a>
        </Button>
      </CardContent>
    </Card>
  );
}