"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createNoteApi, updateNoteApi } from "@/services/notesServices";
import { validateNote, noteFields } from "@/lib/noteValidation";

// One submission coordinator is shared by the mobile and desktop form controls.
export default function useCreateNote({ newNote, noteId, onSaved }) {
  const [isSaving, setIsSaving] = useState(false);
  const [serverErrors, setServerErrors] = useState({});
  const busy = useRef(false);
  const mounted = useRef(false);
  const attempt = useRef(null);
  const router = useRouter();
  const editing = noteId !== undefined && noteId !== null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const errors = validateNote(newNote);
  const isValid = Object.keys(errors).length === 0;

  async function handleSubmit() {
    if (!isValid || busy.current) return;
    busy.current = true;
    setIsSaving(true);
    setServerErrors({});
    const originPath = window.location.pathname;
    const fields = noteFields(newNote);
    const snapshot = JSON.stringify(fields);
    if (attempt.current?.snapshot !== snapshot)
      attempt.current = { snapshot, key: crypto.randomUUID() };
    try {
      const saved = editing
        ? await updateNoteApi(noteId, fields)
        : await createNoteApi(fields, attempt.current.key);
      if (!mounted.current || window.location.pathname !== originPath) return;
      toast.success(
        editing ? "Note updated successfully" : "Note created successfully",
      );
      onSaved?.(saved);
      if (!editing) router.push("/allnotes");
      router.refresh();
    } catch (error) {
      if (mounted.current && window.location.pathname === originPath) {
        setServerErrors(error.errors || {});
        toast.error(
          Object.values(error.errors || {})[0] ||
            error.message ||
            "Failed to save note. Please try again.",
        );
      }
    } finally {
      busy.current = false;
      if (mounted.current) setIsSaving(false);
    }
  }
  return { isSaving, isValid, errors, serverErrors, handleSubmit };
}
