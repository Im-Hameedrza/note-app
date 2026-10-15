import { cookies } from "next/headers";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";
import { getResetUser } from "@/lib/server/auth";
import { RESET_COOKIE } from "@/lib/server/session";

export default async function ResetPasswordPage() {
  const token = (await cookies()).get(RESET_COOKIE)?.value;
  const user = await getResetUser(token);
  return <ResetPasswordForm initialUsername={user?.username || null} />;
}
