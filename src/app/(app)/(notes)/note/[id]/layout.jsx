import { notFound } from "next/navigation";
import { getNotes } from "@/lib/server/notes";
import NoteActions from "@/components/notes/NoteActions";
import GoBackButton from "@/components/navigation/GoBackButton";
export default async function NoteLayout({ children, params }) {
  const { id } = await params;
  const note = (await getNotes()).find(item => String(item.id) === id);
  if (!note) notFound();
  return <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] px-4 pb-28 lg:grid-cols-[minmax(0,1fr)_180px] lg:px-0 lg:pb-0">
    <GoBackButton />
    <div className="lg:col-start-2 lg:row-span-2"><NoteActions key={`${note.id}:${note.isArchived}`} note={note} /></div>
    <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-1 lg:row-start-1">{children}</div>
  </div>;
}
