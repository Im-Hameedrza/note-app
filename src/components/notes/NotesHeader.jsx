"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { navigationSection, routeTag } from "@/lib/notes";
import SearchBar from "@/components/notes/SearchBar";
import SettingsButton from "@/components/navigation/SettingsButton";

export default function NotesHeader({ notes }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = (searchParams.get("q") || "").trim();
  const isSearching = pathname === "/search" ||
    (pathname.startsWith("/note/") && searchParams.has("q"));

  const section = navigationSection(pathname, searchParams, notes);
  const tag = routeTag(pathname, searchParams);
  const heading = tag !== null ? `Notes tagged: ${tag}` : section === "archived" ? "Archived Notes" : pathname === "/add" ? "Create Note" : "All Notes";

  return (
    <header className={`col-span-2 p-4 border-b border-border gap-4 lg:flex lg:justify-between lg:items-center ${isSearching ? "flex flex-col lg:flex-row" : "hidden"}`}>
      <h2 className="text-2xl font-black min-w-0 break-words lg:truncate" title={isSearching && query ? `Search results for: ${query}` : undefined}>
        {isSearching
          ? query ? `Search results for: "${query}"` : "Search Notes"
          : heading}
      </h2>
      <div className="flex items-center gap-4 w-full lg:w-auto shrink-0">
        <SearchBar />
        {isSearching && (
          <Link href="/allnotes" className="text-sm text-link whitespace-nowrap underline">
            Clear search
          </Link>
        )}
        <div className="hidden lg:block"><SettingsButton /></div>
      </div>
    </header>
  );
}
