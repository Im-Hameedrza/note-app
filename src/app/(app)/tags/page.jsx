import TagLinks from "@/components/notes/TagLinks";
import { getNotes } from "@/lib/server/notes";

async function TagsPage() {
  const notes = await getNotes();
  const tags = [...new Set(notes.flatMap((note) => note.tags))];

  return (
    <div className="p-4 pb-28 lg:h-screen lg:overflow-y-auto lg:border-l lg:border-border">
      <h1 className="text-2xl font-bold py-4">TagLinks</h1>
      <TagLinks tags={tags} />
    </div>
  );
}

export default TagsPage;
