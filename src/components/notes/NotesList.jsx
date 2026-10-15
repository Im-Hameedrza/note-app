"use client";

import Link from "next/link";
import { format } from "date-fns";
import { filterNotes, routeTag } from "@/lib/notes";
import { usePathname, useSearchParams } from "next/navigation";

function NotesList({ notes, searchQuery }) {
  const pathname = usePathname().replace(/^\//, "");
  const searchParams = useSearchParams();
  const isSearching = typeof searchQuery === "string";

  const category =
    pathname === "add"
      ? "allnotes"
      : pathname.startsWith("note/")
        ? searchParams.get("from") || "allnotes"
        : pathname;

  const tag = routeTag("/" + pathname, searchParams);
  const notesToShow = filterNotes(notes, { category, searchQuery, tag });

  return (
    <div
      className={`lg:overflow-y-auto lg:block pb-24 lg:pb-0 ${pathname.includes("note/") && "hidden"}`}
    >
      {isSearching && (
        <p role="status" className="text-sm text-text-secondary my-4">
          {notesToShow.length} {notesToShow.length === 1 ? "note" : "notes"}{" "}
          found
          {" for "}&ldquo;{searchQuery}&rdquo;
        </p>
      )}
      {notesToShow.length === 0 && (
        <div className="bg-surface-secondary p-3 rounded-2xl my-5">
          {isSearching
            ? "No notes match your search. Try another title, tag, or word from the content."
            : "You don't have any notes yet. Start a new note to capture your thoughts and ideas."}
        </div>
      )}
      {notesToShow.map((note) => (
        <Link
          key={note.id}
          href={`/note/${note.id}?from=${encodeURIComponent(
            isSearching
              ? note.isArchived
                ? "archived"
                : "allnotes"
              : category,
          )}${isSearching ? `&q=${encodeURIComponent(searchQuery)}` : ""}${tag !== null ? `&tag=${encodeURIComponent(tag)}` : ""}`}
          aria-current={pathname === `note/${note.id}` ? "page" : undefined}
          className={`block min-w-0 [overflow-wrap:anywhere] hover:bg-surface-secondary border-b border-border py-6 ${pathname === `note/${note.id}` ? "bg-primary-light" : ""}`}
        >
          <h3 className="text-[18px] font-bold mb-3">{note.title}</h3>

          <div className="flex gap-2 mb-3 flex-wrap">
            {(note.tags || []).map((tag) => (
              <span
                key={tag}
                className="bg-secondary text-sm px-2 py-1 rounded-md"
              >
                {tag}
              </span>
            ))}
            {isSearching && note.isArchived && (
              <span className="text-sm px-2 py-1 rounded-md bg-secondary">
                Archived
              </span>
            )}
          </div>

          {isSearching && (
            <p className="text-sm text-text-secondary line-clamp-2 mb-3">
              {note.content}
            </p>
          )}
          <p className="text-text-muted">
            {format(new Date(note.lastEdited), "MMM dd, yyyy")}
          </p>
        </Link>
      ))}
    </div>
  );
}

export default NotesList;
