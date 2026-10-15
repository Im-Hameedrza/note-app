"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Palette, KeyRound, Type, ChevronRight } from "lucide-react";

const items = [
  { href: "/setting/theme", label: "Theme", icon: Palette },
  { href: "/setting/password", label: "Change Password", icon: KeyRound },
  { href: "/setting/font", label: "Font", icon: Type },
];

export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="min-h-0 border-b border-border lg:overflow-y-auto lg:border-r lg:border-b-0">
      <nav aria-label="Settings menu" className="grid gap-1 p-4 sm:grid-cols-3 lg:grid-cols-1">
        {items.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={"flex min-h-12 items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors " + (isActive ? "bg-primary-light text-link" : "text-text-secondary hover:bg-secondary")}
            >
              <Icon size={20} className="shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{label}</span>
              <ChevronRight size={18} className={isActive ? "shrink-0" : "invisible shrink-0"} aria-hidden="true" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
