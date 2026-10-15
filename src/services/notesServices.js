async function notesRequest(path = "", options = {}) {
  const response = await fetch("/api/notes" + path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "The server returned an invalid response. Please try again.",
    );
  }
  if (!response.ok) {
    const error = new Error(
      data.message || "Could not update the note. Please try again.",
    );
    error.errors = data.errors || {};
    throw error;
  }
  if (
    !data ||
    typeof data !== "object" ||
    (options.method !== "DELETE" &&
      (!["string", "number"].includes(typeof data.id) ||
        typeof data.title !== "string" ||
        !Array.isArray(data.tags)))
  ) {
    throw new Error("The server returned an invalid note. Please try again.");
  }
  return data;
}
export function isArchived(id, value) {
  return notesRequest(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ isArchived: value }),
  });
}
export function createNoteApi(note, requestId) {
  return notesRequest("", {
    method: "POST",
    headers: { "Idempotency-Key": requestId },
    body: JSON.stringify(note),
  });
}
export function updateNoteApi(id, note) {
  return notesRequest(`/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(note),
  });
}
export function deleteNoteApi(id) {
  return notesRequest(`/${encodeURIComponent(id)}`, { method: "DELETE" });
}
