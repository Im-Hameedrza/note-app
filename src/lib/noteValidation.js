export const NOTE_LIMITS = { title: 200, content: 100000, tags: 30, tag: 50, bytes: 128 * 1024 };

export function validateNote(note = {}) {
  const errors = {};
  for (const field of ["title", "content"]) {
    const value = note[field];
    if (typeof value !== "string" || !value.trim()) errors[field] = `Note ${field} is required.`;
    else if (value.length > NOTE_LIMITS[field]) errors[field] = `Use no more than ${NOTE_LIMITS[field]} characters for the ${field}.`;
  }
  if (!Array.isArray(note.tags) || !note.tags.length) errors.tags = "Add at least one tag.";
  else if (note.tags.length > NOTE_LIMITS.tags) errors.tags = `Use no more than ${NOTE_LIMITS.tags} tags.`;
  else if (note.tags.some(tag => typeof tag !== "string" || !tag.trim() || tag.length > NOTE_LIMITS.tag)) {
    errors.tags = `Each tag must contain 1-${NOTE_LIMITS.tag} characters.`;
  }
  if (!Object.keys(errors).length && new TextEncoder().encode(JSON.stringify({ title: note.title, content: note.content, tags: note.tags })).length > NOTE_LIMITS.bytes) {
    errors.content = "This note exceeds the 128 KiB request limit. Shorten the content or tags, especially Unicode text.";
  }
  return errors;
}

export function noteFields(note) {
  return { title: note.title.trim(), content: note.content, tags: [...new Set(note.tags.map(tag => tag.trim()))] };
}
