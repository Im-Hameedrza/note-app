import { Suspense } from "react";
import NotesSidebar from "@/components/notes/NotesSidebar";
import NotesHeader from "@/components/notes/NotesHeader";
import { getNotes } from "@/lib/server/notes";

export default async function NoteLayout({ children }) {
  const notes = await getNotes();

  return (
    <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)] lg:grid-rows-[auto_1fr] h-screen lg:border-l lg:border-border">
      <Suspense fallback={<div className="col-span-2 p-4">Loading search...</div>}>
        <NotesHeader notes={notes} />
      </Suspense>

      <Suspense fallback={<p className="p-5">Loading notes...</p>}>
        <NotesSidebar notes={notes} />
      </Suspense>

      <section className="lg:block lg:overflow-y-auto min-h-0 min-w-0">{children}</section>
    </div>
  );
}
