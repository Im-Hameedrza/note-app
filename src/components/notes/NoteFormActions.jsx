"use client";
import SaveButton from "@/components/notes/SaveButton";
export default function NoteFormActions({ onSave, onCancel, isValid, isSaving }) {
  return <div className="flex flex-wrap items-center justify-end gap-4 border-border py-4 lg:justify-start lg:border-t">
    <button type="button" disabled={isSaving} onClick={onCancel} className="rounded-lg px-3 py-2 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-50">Cancel</button>
    <SaveButton handleSubmit={onSave} disabled={!isValid || isSaving} isSaving={isSaving} />
  </div>;
}
