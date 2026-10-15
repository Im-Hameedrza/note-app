"use client";
import { useState } from "react";
import { Tag, Clock, Pencil } from "lucide-react";
import NoteEditor from "@/components/notes/NoteEditor";

export default function NoteDetails({ note }) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(note);
  if (editing) return <NoteEditor initialNote={saved} onCancel={() => setEditing(false)} onSaved={updated => { setSaved(updated); setEditing(false); }} />;
  return <article className="min-w-0 [overflow-wrap:anywhere] px-2 py-6 sm:px-6">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
      <h1 className="min-w-0 text-xl font-bold">{saved.title}</h1>
      <button type="button" onClick={() => setEditing(true)} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-link hover:bg-surface-secondary"><Pencil size={16} aria-hidden="true" />Edit Note</button>
    </div>
    <div className="mb-6 space-y-5 text-text-secondary">
      <div className="flex"><span className="flex w-28 shrink-0 items-center gap-3"><Tag size={16} />Tags</span><span className="min-w-0">{saved.tags.join(", ")}</span></div>
      <div className="flex"><span className="flex w-28 shrink-0 items-center gap-3"><Clock size={16} />Last edited</span><time dateTime={saved.lastEdited}>{new Date(saved.lastEdited).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</time></div>
    </div>
    <hr className="mb-5 border-border" />
    <p className="whitespace-pre-wrap text-sm leading-6">{saved.content}</p>
  </article>;
}
