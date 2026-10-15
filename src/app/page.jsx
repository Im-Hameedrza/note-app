import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";

export default async function Home() {
  await requireUser();
  redirect("/allnotes");
}
