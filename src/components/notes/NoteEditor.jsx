"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import TagsInput from "@/components/notes/TagsInput";
import NoteFormActions from "@/components/notes/NoteFormActions";
import useCreateNote from "@/hooks/useCreateNote";
import { NOTE_LIMITS } from "@/lib/noteValidation";

export default function NoteEditor({ initialNote, onCancel, onSaved }) {
  const [draft, setDraft] = useState(() => ({ title: initialNote?.title || "", content: initialNote?.content || "", tags: [...(initialNote?.tags || [])] }));
  const [touched, setTouched] = useState({});
  const router = useRouter();
  const { isSaving, isValid, errors, serverErrors, handleSubmit } = useCreateNote({ newNote: draft, noteId: initialNote?.id, onSaved });
  const update = (field, value) => { setDraft(note => ({ ...note, [field]: value })); setTouched(previous => ({ ...previous, [field]: true })); };
  const fieldError = field => touched[field] ? errors[field] : serverErrors[field];
  const actions = <NoteFormActions onSave={handleSubmit} onCancel={onCancel || (() => router.push("/allnotes"))} isValid={isValid} isSaving={isSaving} />;
  return <section aria-label={initialNote ? "Edit note" : "Create a note"} aria-busy={isSaving} className="flex min-h-[calc(100dvh-150px)] min-w-0 flex-col px-4 pb-28 min-[560px]:px-6 lg:min-h-0 lg:p-6">
    <div className="mb-3 border-b border-border lg:hidden">{actions}</div>
    <label className="mb-4 block">
      <span className="sr-only">Note title</span>
      <input aria-label="Note title" name="title" value={draft.title} disabled={isSaving} onChange={event => update("title", event.target.value)} aria-invalid={!!fieldError("title")} aria-describedby="title-hint title-error" placeholder="Enter a title..." autoComplete="off" className="w-full min-w-0 text-xl font-bold" />
      <span id="title-hint" className="mt-2 block text-xs text-text-muted">{NOTE_LIMITS.title} characters maximum</span>
      {fieldError("title") && <span id="title-error" role="alert" className="block text-sm text-danger">{fieldError("title")}</span>}
    </label>
    <TagsInput tags={draft.tags} onChange={tags => update("tags", tags)} disabled={isSaving} />
    {fieldError("tags") && <p role="alert" className="text-sm text-danger">{fieldError("tags")}</p>}
    <div className="my-4 flex flex-wrap items-center gap-3 border-b border-border pb-4 text-sm text-text-secondary"><Clock size={16} aria-hidden="true" />Last edited <span>{initialNote ? new Date(initialNote.lastEdited).toLocaleString("en-GB") : "Not yet saved"}</span></div>
    <label className="flex min-h-64 min-w-0 flex-1 flex-col">
      <span className="sr-only">Note content</span>
      <textarea aria-label="Note content" name="content" value={draft.content} disabled={isSaving} onChange={event => update("content", event.target.value)} aria-invalid={!!fieldError("content")} aria-describedby="content-hint content-error" placeholder="Start typing your note here..." className="min-h-64 w-full flex-1 resize-y py-4 text-sm leading-6" />
      <span id="content-hint" className="block text-xs text-text-muted">{NOTE_LIMITS.content} characters maximum; total request limit 128 KiB.</span>
      {fieldError("content") && <span id="content-error" role="alert" className="block text-sm text-danger">{fieldError("content")}</span>}
    </label>
    <div className="hidden lg:block">{actions}</div>
  </section>;
}
