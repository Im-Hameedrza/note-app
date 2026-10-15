"use client";

import { Home, Search, Archive, Tag, Settings } from "lucide-react";
import { navigationSection } from "@/lib/notes";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function BottomNav({ notes }) {
  const navItems = [
    { to: "/allnotes", icon: <Home size={22} /> },
    { to: "/search", icon: <Search size={22} /> },
    { to: "/archived", icon: <Archive size={22} /> },
    { to: "/tags", icon: <Tag size={22} /> },
    { to: "/setting", icon: <Settings size={22} /> },
  ];

  const pathName = usePathname();
  const section = navigationSection(pathName, useSearchParams(), notes);

  const activeClasses = "bg-primary-light text-link";
  const normalClasses = "text-text-secondary";

  return (
    <nav className="fixed z-40 bottom-0 left-0 right-0 bg-surface border-t border-border px-4 py-3">
      <ul className="flex items-center justify-between">
        {navItems.map((item) => (
          <li key={item.to}>
            <Link
              href={item.to}
              aria-label={item.to === "/allnotes" ? "Home" : item.to.slice(1)}
              aria-current={section === item.to.slice(1) ? "page" : undefined}
              className={`w-12 h-12 flex items-center justify-center rounded-xl transition-all ${
                section === item.to.slice(1) ? activeClasses : normalClasses
              }`}
            >
              {item.icon}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default BottomNav;
