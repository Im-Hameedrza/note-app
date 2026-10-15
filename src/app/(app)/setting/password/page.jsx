import AuthForm from "@/components/auth/AuthForm";
import { requireUser } from "@/lib/server/session";

export const metadata = { title: "Change Password | Note App" };

export default async function PasswordPage() {
  const user = await requireUser();

  return (
    <div className="max-w-md">
      <AuthForm action="forgot-password" initialUsername={user.username} variant="settings" />
    </div>
  );
}
