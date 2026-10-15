import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth";

export const SESSION_COOKIE = "note_session";
export const RESET_COOKIE = "note_reset";

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/signin");
  return user;
}
