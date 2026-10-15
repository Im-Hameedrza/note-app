"use client";

import { usePathname, useSearchParams } from "next/navigation";
import NotesList from "@/components/notes/NotesList";
import CreateNoteButton from "@/components/notes/CreateNoteButton";

export default function NotesSidebar({ notes }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdding = pathname === "/add";
  const isViewingNote = pathname.startsWith("/note/");
  const isSearching = pathname === "/search" ||
    (isViewingNote && searchParams.has("q"));
  const query = (searchParams.get("q") || "").trim();

  return (
    <div
      className={`lg:border-r lg:border-border px-5 lg:h-full lg:min-h-0 flex-col gap-x-2 ${isAdding || isViewingNote ? "hidden lg:flex" : "flex"}`}
    >
      <div className="py-4">
        <CreateNoteButton />
      </div>
      {isAdding && (
        <div
          className="shrink-0 rounded-md bg-surface-secondary px-2 py-2 text-[18px] font-bold"
          aria-current="page"
        >
          Untitled Note
        </div>
      )}
      {isSearching && !query ? (
        <p className="text-sm text-text-muted py-4">
          Enter a title, content, or tag above to search all notes.
        </p>
      ) : (
        <NotesList notes={notes} searchQuery={isSearching ? query : undefined} />
      )}
    </div>
  );
}
