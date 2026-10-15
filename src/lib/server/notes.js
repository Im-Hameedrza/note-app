import "server-only";
import { randomUUID, createHash } from "node:crypto";
import { readDatabase, updateDatabase } from "./database";
import { requireUser } from "./session";
import { sessionUser } from "./auth";
import { ApiError } from "./api";
import { validateNote, noteFields } from "../noteValidation";

export async function getNotes() {
  const user = await requireUser();
  return (await readDatabase()).notes.filter(note => note.userId === user.id);
}

export async function notesForSession(token) {
  const database = await readDatabase();
  const user = sessionUser(database, token);
  if (!user) throw new ApiError("Please sign in to continue.", 401);
  return database.notes.filter(note => note.userId === user.id);
}

function validated(input) {
  const errors = validateNote(input);
  if (Object.keys(errors).length) throw new ApiError("Please check the note fields.", 400, errors);
  return noteFields(input);
}

export async function changeNotes(token, action, input = {}, id, requestId) {
  let originalNote;
  return updateDatabase(database => {
    const user = sessionUser(database, token);
    if (!user) throw new ApiError("Please sign in to continue.", 401);
    if (action === "create") {
      const fields = validated(input);
      if (requestId && !/^[a-f0-9-]{36}$/i.test(requestId)) throw new ApiError("Invalid save request ID.");
      const fingerprint = createHash("sha256").update(JSON.stringify(fields)).digest("hex");
      database.noteRequests = (database.noteRequests || []).filter(item => item.expiresAt > Date.now());
      const previous = requestId && database.noteRequests.find(item => item.userId === user.id && item.key === requestId);
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new ApiError("This save request was already used for a different draft. Start a new save.", 409);
        const saved = database.notes.find(note => note.id === previous.noteId && note.userId === user.id);
        if (!saved) throw new ApiError("This note was already deleted. Start a new note.", 409);
        return saved;
      }
      const note = { id: randomUUID(), userId: user.id, ...fields, isArchived: false, lastEdited: new Date().toISOString() };
      database.notes.push(note);
      if (requestId) database.noteRequests.push({ key: requestId, userId: user.id, noteId: note.id, fingerprint, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
      return note;
    }
    const note = database.notes.find(item => String(item.id) === id && item.userId === user.id);
    if (!note) throw new ApiError("Note not found.", 404);
    const version = JSON.stringify(note);
    if (originalNote !== undefined && originalNote !== version) {
      throw new ApiError("This note changed during your save. Refresh before trying again.", 409);
    }
    originalNote = version;
    if (action === "delete") {
      database.notes = database.notes.filter(item => item !== note);
      return { message: "Note deleted." };
    }
    const editing = ["title", "content", "tags"].some(field => Object.hasOwn(input, field));
    if (!editing && !Object.hasOwn(input, "isArchived")) throw new ApiError("No note changes were supplied.");
    if (Object.hasOwn(input, "isArchived") && typeof input.isArchived !== "boolean") throw new ApiError("Invalid archive value.");
    if (editing) {
      // Archived notes are editable under the same ownership and validation rules.
      const fields = validated({ ...note, ...Object.fromEntries(["title", "content", "tags"].filter(field => Object.hasOwn(input, field)).map(field => [field, input[field]])) });
      if (JSON.stringify(noteFields(note)) !== JSON.stringify(fields)) {
        Object.assign(note, fields);
        note.lastEdited = new Date(Math.max(Date.now(), (Date.parse(note.lastEdited) || 0) + 1)).toISOString();
      }
    }
    if (Object.hasOwn(input, "isArchived")) note.isArchived = input.isArchived;
    return note;
  });
}
