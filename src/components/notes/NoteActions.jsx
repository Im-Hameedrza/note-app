"use client";
import { useState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ArchiveRestoreButton from "@/components/notes/ArchiveRestoreButton";
import useNoteMutations from "@/hooks/useNoteMutations";
export default function NoteActions({ note }) {
  const [modal, setModal] = useState(null);
  const [archived, setArchived] = useState(note.isArchived);
  const { handleArchive, handleRestore, handleDelete, isPending, error, clearError } = useNoteMutations(note.id, saved => { if (typeof saved.isArchived === "boolean") setArchived(saved.isArchived); });
  const open = value => { clearError(); setModal(value); };
  const config = {
    archive: { title: "Archive Note", icon: Archive, description: "Are you sure you want to archive this note? You can restore it from Archived Notes anytime.", action: handleArchive },
    restore: { title: "Restore Note", icon: RotateCcw, description: "Restore this note to All Notes?", action: handleRestore },
    delete: { title: "Delete Note", icon: Trash2, description: "Are you sure you want to delete this note? This action cannot be undone.", action: handleDelete }
  };
  const selected = config[modal];
  return <div className="my-5 flex justify-center gap-6 border-border px-3 lg:my-0 lg:h-full lg:flex-col lg:justify-start lg:gap-4 lg:border-l lg:py-4">
    <ArchiveRestoreButton isArchivedPath={archived} setShowModal={open} disabled={isPending} />
    <button type="button" aria-label="Delete Note" disabled={isPending} onClick={() => open("delete")} className="flex items-center justify-center gap-2 text-text-muted disabled:opacity-50 lg:justify-start lg:rounded-2xl lg:border lg:border-border lg:px-5 lg:py-4 lg:text-text-primary lg:hover:bg-surface-secondary"><Trash2 size={18} /><span className="hidden text-sm font-medium lg:block">Delete Note</span></button>
    {selected && <ConfirmModal icon={selected.icon} title={selected.title} description={selected.description} confirmText={selected.title} variant={modal === "delete" ? "danger" : "primary"} onClose={() => setModal(null)} onConfirm={selected.action} error={error} />}
  </div>;
}
