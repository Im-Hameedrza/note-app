export class StorageError extends Error {
  constructor(message, status = 503) { super(message); this.status = status; }
}

export function normalizeDatabase(database) {
  if (!database || typeof database !== "object" || Array.isArray(database)) throw new StorageError("Invalid database structure.");
  for (const key of ["users", "notes", "sessions", "passwordResets", "rateLimits", "noteRequests"]) {
    if (!Object.hasOwn(database, key)) database[key] = [];
    if (!Array.isArray(database[key])) throw new StorageError("Invalid database collection.");
  }
  return database;
}

// Errors intentionally contain no record values, emails, hashes or tokens.
export function validateDatabase(input) {
  const db = normalizeDatabase(input);
  const fail = () => { throw new StorageError("Database validation failed. Check schema, unique IDs, ownership and credential formats.", 422); };
  const object = value => value && typeof value === "object" && !Array.isArray(value);
  const text = value => typeof value === "string" && value.length > 0;
  const id = value => text(value) || Number.isSafeInteger(value);
  const date = value => typeof value === "string" && Number.isFinite(Date.parse(value));
  const hash = value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
  const unique = (rows, field) => {
    const keys = rows.map(row => row?.[field]);
    if (new Set(keys.map(String)).size !== rows.length) fail();
  };
  for (const key of ["users", "notes", "sessions", "passwordResets", "rateLimits", "noteRequests"]) if (db[key].some(row => !object(row))) fail();
  unique(db.users, "id"); unique(db.users, "usernameKey"); unique(db.users, "email"); unique(db.notes, "id");
  const users = new Set(db.users.map(user => user.id));
  for (const user of db.users) {
    if (!object(user) || !id(user.id) || !text(user.username) ||
      user.usernameKey !== user.username.trim().toLowerCase() ||
      !text(user.email) || user.email !== user.email.trim().toLowerCase() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email) ||
      !/^scrypt\$131072\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(user.passwordHash || "") ||
      Object.hasOwn(user, "password") || !date(user.createdAt) ||
      (user.updatedAt !== undefined && !date(user.updatedAt))) fail();
  }
  for (const note of db.notes) {
    if (!object(note) || !id(note.id) || !users.has(note.userId) ||
      typeof note.title !== "string" || typeof note.content !== "string" ||
      !Array.isArray(note.tags) || note.tags.some(tag => typeof tag !== "string") ||
      typeof note.isArchived !== "boolean" || !date(note.lastEdited)) fail();
  }
  for (const collection of [db.sessions, db.passwordResets]) {
    unique(collection, "tokenHash");
    for (const item of collection) if (!object(item) || !users.has(item.userId) ||
      !hash(item.tokenHash) || !Number.isSafeInteger(item.expiresAt) ||
      Object.hasOwn(item, "token")) fail();
  }
  unique(db.rateLimits, "key");
  for (const item of db.rateLimits) if (!object(item) || !hash(item.key) ||
    !Number.isSafeInteger(item.count) || item.count < 0 || !Number.isSafeInteger(item.expiresAt)) fail();
  const requestKeys = new Set();
  for (const item of db.noteRequests) {
    const key = JSON.stringify([item?.userId, item?.key]);
    if (!object(item) || !users.has(item.userId) || !text(item.key) || !id(item.noteId) ||
      !hash(item.fingerprint) || !Number.isSafeInteger(item.expiresAt) || requestKeys.has(key)) fail();
    // Deleted notes can retain their idempotency tombstones until expiry.
    requestKeys.add(key);
  }
  return db;
}

export function storageMode(env = process.env) {
  if (env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (env.NODE_ENV === "production" || env.VERCEL === "1") {
    throw new StorageError("Persistent storage is unavailable. Configure BLOB_READ_WRITE_TOKEN.");
  }
  return "local";
}
