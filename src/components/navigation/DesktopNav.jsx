"use client";
import { Home, Archive, ChevronRight, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navigationSection } from "@/lib/notes";
import TagLinks from "@/components/notes/TagLinks";
import Image from "next/image";
import LogoutButton from "@/components/auth/LogoutButton";

function DesktopNav({ tags, username, notes }) {
  const activeClasses = "bg-primary-light text-link";
  const normalClasses = "text-text-secondary";
  const pathName = usePathname();
  const section = navigationSection(pathName, useSearchParams(), notes);
  const isSettings = section === "setting";
  const isAllNotes = section === "allnotes";
  const isArchived = section === "archived";

  return (
    <aside className="flex h-screen min-w-0 flex-col bg-surface-secondary px-4 py-5">
      {/* Logo */}
      <header className="mb-7 ml-4 shrink-0">
        <Image className="app-logo shrink-0" src="/next.svg" width={100} height={100} alt="Logo" />
      </header>

      {/* Main Links */}
      <nav className="shrink-0 space-y-2">
        <Link href="/allnotes" aria-current={isAllNotes ? "page" : undefined}>
          <div
            className={`
              flex w-full items-center justify-between
              rounded-lg px-3 py-3
              text-sm transition-all
              ${
                isAllNotes
                  ? activeClasses
                  : normalClasses
              }
            `}
          >
            <span className="flex items-center gap-2">
              <Home
                size={18}
                className={
                  isAllNotes
                    ? "text-link"
                    : "text-text-muted"
                }
              />
              All Notes
            </span>

            <ChevronRight size={18} />
          </div>
        </Link>

        <Link href="/archived" aria-current={isArchived ? "page" : undefined}>
          <div
            className={`
              flex w-full items-center justify-between gap-2
              rounded-lg px-3 py-3
              text-sm font-medium transition-all
              ${isArchived ? activeClasses : normalClasses}
            `}
          >
            <span className="flex items-center gap-2">
              <Archive
                size={18}
                className={
                  isArchived
                    ? "text-link"
                    : "text-text-muted"
                }
              />
              Archived Notes
            </span>

            <ChevronRight size={18} />
          </div>
        </Link>
        <Link href="/setting" aria-current={isSettings ? "page" : undefined} className={"flex items-center gap-2 rounded-lg px-3 py-3 text-sm hover:bg-secondary " + (isSettings ? activeClasses : normalClasses)}>
          <Settings size={18} aria-hidden="true" /> Settings
        </Link>
      </nav>

      {/* TagLinks */}
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto border-t border-border pt-4">
        <h2 className="mb-4 px-2 text-sm text-text-muted">TagLinks</h2>

        <div className="space-y-2">
          <TagLinks tags={tags} />
        </div>
      </div>
      <div className="mt-4 border-t border-border pt-4"><p className="px-3 mb-2 text-sm text-text-muted truncate">{username}</p><LogoutButton /></div>
    </aside>
  );
}

export default DesktopNav;
