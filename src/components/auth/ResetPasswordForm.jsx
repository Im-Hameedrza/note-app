"use client";

import Link from "next/link";
import AuthForm from "./AuthForm";
import useResetPasswordLink from "@/hooks/useResetPasswordLink";

export default function ResetPasswordForm({ initialUsername }) {
  const { username, isChecking, error } = useResetPasswordLink(initialUsername);

  if (isChecking) return <p role="status" className="text-text-secondary">Checking your reset link...</p>;
  if (!username) {
    return (
      <div className="space-y-5">
        <h1 className="text-2xl font-bold">Reset your account</h1>
        <p role="alert" className="border-l-2 border-danger pl-2 text-sm text-text-primary">{error}</p>
        <Link href="/auth/forgot-password" className="block text-link underline">Request a new reset link</Link>
        <Link href="/auth/signin" className="block text-link underline">Back to Sign In</Link>
      </div>
    );
  }
  return <AuthForm action="reset-password" initialUsername={username} />;
}
