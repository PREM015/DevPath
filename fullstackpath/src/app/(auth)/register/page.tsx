import type { Metadata } from "next";
import { RegisterForm } from "@/features/auth/components/register-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Create your account",
  description:
    "Create a free FullStackPath account to track your progress through the full stack interview roadmap.",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Card className="animate-fade-in-up shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Create your account</CardTitle>
        <CardDescription>
          Start tracking the 15-phase roadmap from your very first topic.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RegisterForm />
      </CardContent>
    </Card>
  );
}