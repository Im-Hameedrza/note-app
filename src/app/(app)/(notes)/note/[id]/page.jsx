import { notFound } from "next/navigation";
import { getNotes } from "@/lib/server/notes";
import NoteDetails from "@/components/notes/NoteDetails";
export default async function SingleNote({ params }) {
  const { id } = await params;
  const note = (await getNotes()).find(item => String(item.id) === id);
  if (!note) notFound();
  return <NoteDetails key={`${note.id}:${note.lastEdited}`} note={note} />;
}
