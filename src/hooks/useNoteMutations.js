"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { deleteNoteApi, isArchived } from "@/services/notesServices";
export default function useNoteMutations(id, onSaved) {
  const router = useRouter();
  const busy = useRef(false);
  const [isPending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function mutate(action) {
    if (busy.current) return false;
    busy.current = true; setPending(true); setError("");
    try {
      const result = action === "delete" ? await deleteNoteApi(id) : await isArchived(id, action === "archive");
      onSaved?.(result);
      toast.success(action === "delete" ? "Note Removed" : action === "archive" ? "Note Archived" : "Note Restored");
      if (action === "delete") router.push("/allnotes");
      router.refresh();
      return true;
    } catch (failure) {
      const message = failure.message || "Could not update the note. Please try again.";
      setError(message); toast.error(message); return false;
    } finally { busy.current = false; setPending(false); }
  }
  return { handleArchive: () => mutate("archive"), handleRestore: () => mutate("restore"), handleDelete: () => mutate("delete"), isPending, error, clearError: () => setError("") };
}
