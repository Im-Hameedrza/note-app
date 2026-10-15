import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SettingsSidebar from "@/components/settings/SettingsSidebar";

export default function SettingsLayout({ children }) {
  return (
    <div className="min-h-full bg-background pb-28 lg:grid lg:h-screen lg:grid-cols-[250px_minmax(0,1fr)] lg:grid-rows-[auto_minmax(0,1fr)] lg:border-l lg:border-border lg:pb-0">
      <header className="flex min-h-[77px] items-center justify-between gap-4 border-b border-border px-5 py-4 lg:col-span-2 lg:px-4">
        <h1 className="text-2xl font-bold">Settings</h1>
        <Link href="/allnotes" className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-text-secondary hover:bg-secondary">
          <ArrowLeft size={18} aria-hidden="true" />
          Back to notes
        </Link>
      </header>
      <SettingsSidebar />
      <section aria-label="Settings content" className="min-h-0 min-w-0 px-5 py-6 sm:px-8 lg:overflow-y-auto">
        <div className="max-w-2xl">{children}</div>
      </section>
    </div>
  );
}
