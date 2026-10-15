import "server-only";
import { open, readFile, rename, unlink, link, stat } from "node:fs/promises";
import path from "node:path";
import { hostname } from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { ApiError } from "./api";

const databasePath = process.env.DATABASE_FILE || path.join(process.cwd(), "db.json");
const queueKey = Symbol.for("note-app.database-queues");
globalThis[queueKey] ??= new Map();
const queues = globalThis[queueKey];

export async function readDatabase() {
  const database = JSON.parse(await readFile(/* turbopackIgnore: true */ databasePath, "utf8"));
  database.notes ??= [];
  database.users ??= [];
  database.sessions ??= [];
  database.passwordResets ??= [];
  database.rateLimits ??= [];
  return database;
}


function processIsDead(owner) {
  if (!owner || !Number.isSafeInteger(owner.pid) || owner.pid <= 0 || owner.host !== hostname()) return false;
  try { process.kill(owner.pid, 0); return false; }
  catch (error) { return error.code === "ESRCH"; }
}

async function recoverAbandonedLock(lockPath, candidate) {
  let claim;
  try {
    const before = await stat(lockPath);
    const text = await readFile(lockPath, "utf8");
    let owner;
    try { owner = JSON.parse(text); } catch { /* Legacy locks had no owner metadata. */ }
    if (owner) { if (!processIsDead(owner)) return; }
    else if (text.trim() || Date.now() - before.mtimeMs < 60000) return;
    // Recovery itself must have one live owner across processes. A unique claim
    // for this exact stale lock prevents two reclaimers from deleting a successor.
    // Claims are also atomically initialized and a crashed reclaimer can be bypassed
    // only after its PID is confirmed dead, never solely because it is old.
    const identity = createHash("sha256").update(`${before.ino}:${before.mtimeMs}:${text}`).digest("hex").slice(0, 32);
    for (let generation = 0; generation < 100; generation++) {
      const name = `${lockPath}.recovery-${identity}-${generation}.tmp`;
      try { await link(candidate, name); claim = name; break; }
      catch (error) {
        if (error.code === "ENOENT") return;
        if (error.code !== "EEXIST") throw error;
        let reclaimer;
        try { reclaimer = JSON.parse(await readFile(name, "utf8")); }
        catch (failure) { if (failure.code === "ENOENT") { generation--; continue; } return; }
        if (!processIsDead(reclaimer)) return;
      }
    }
    if (!claim) return;
    const current = await stat(lockPath);
    if (before.ino === current.ino && before.mtimeMs === current.mtimeMs && before.size === current.size && await readFile(lockPath, "utf8") === text) await unlink(lockPath);
  } catch (error) { if (error.code !== "ENOENT") throw error; }
  finally { if (claim) await unlink(claim).catch(() => {}); }
}

async function acquireLock(lockPath, owner) {
  const candidate = lockPath + "." + owner.token + ".tmp";
  const file = await open(candidate, "wx", 0o600);
  try { await file.writeFile(JSON.stringify(owner)); await file.sync(); }
  finally { await file.close(); }
  try {
    for (let attempt = 0; attempt < 200; attempt++) {
      try { await link(candidate, lockPath); return; }
      catch (error) {
        if (error.code !== "EEXIST") throw error;
        await recoverAbandonedLock(lockPath, candidate);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    throw new ApiError("The database is busy. Please try again.", 503);
  } finally { await unlink(candidate).catch(() => {}); }
}

export async function updateDatabase(update) {
  // Serialize contenders in this app process, including stale-lock recovery.
  const key = path.resolve(/* turbopackIgnore: true */ databasePath);
  const previous = queues.get(key) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  queues.set(key, current);
  await previous;
  const lockPath = databasePath + ".lock";
  const owner = { pid: process.pid, host: hostname(), token: randomUUID() };
  const temporaryPath = databasePath + "." + owner.token + ".tmp";
  let acquired = false;
  try {
    await acquireLock(lockPath, owner);
    acquired = true;
    const database = await readDatabase();
    const result = await update(database);
    const file = await open(temporaryPath, "wx", 0o600);
    try { await file.writeFile(JSON.stringify(database, null, 2) + "\n"); await file.sync(); }
    finally { await file.close(); }
    await rename(temporaryPath, databasePath);
    return result;
  } finally {
    try {
      await unlink(temporaryPath).catch(() => {});
      if (acquired) {
        const saved = JSON.parse(await readFile(lockPath, "utf8"));
        if (saved.token === owner.token) await unlink(lockPath);
      }
    } finally {
      release();
      if (queues.get(key) === current) queues.delete(key);
    }
  }
}
