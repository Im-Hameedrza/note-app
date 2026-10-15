import { Settings } from "lucide-react";
import Link from "next/link";
export default function SettingsButton() {
  return <Link href="/setting" aria-label="Settings" className="flex size-11 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-secondary"><Settings size={28} aria-hidden="true" /></Link>;
}
