"use client";
import { Home, Search, Archive, Tag, Settings } from "lucide-react";
import { navigationSection } from "@/lib/notes";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

function TabletNav({ notes }) {
  const navItems = [
    { to: "/allnotes", label: "Home", icon: Home },
    { to: "/search", label: "Search", icon: Search },
    { to: "/archived", label: "Archived", icon: Archive },
    { to: "/tags", label: "Tags", icon: Tag },
    { to: "/setting", label: "Settings", icon: Settings },
  ];
  const pathName = usePathname();
  const section = navigationSection(pathName, useSearchParams(), notes);
  const activeClasses = "bg-primary-light text-link";
  const normalClasses = "text-text-secondary";

  return (
    <nav className="fixed z-40 bottom-0 left-0 right-0 bg-surface border-t border-border px-11 py-4">
      <ul className="flex items-center justify-between">
        {navItems.map((item, index) => {
          const Icon = item.icon;

          return (
            <li
              key={item.to}
              className={`
                flex-1 flex justify-center
                ${index !== navItems.length - 1 ? "border-r border-border-light" : ""}
              `}
            >
              <Link
                href={item.to}
                aria-current={section === item.to.slice(1) ? "page" : undefined}
                className={`
                  w-[102px] h-[64px]
                  flex flex-col items-center justify-center gap-1
                  rounded-md
                  transition-all
                  
              ${section === item.to.slice(1) ? activeClasses : normalClasses}
                `}
              >
                <Icon size={25} strokeWidth={1.8} />
                <span className="text-sm">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default TabletNav;
