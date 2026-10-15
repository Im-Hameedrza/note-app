import { readFile, mkdir, open } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { createBlobStorage } from "../src/lib/server/blob-storage.mjs";
import { validateDatabase } from "../src/lib/server/storage-schema.mjs";

export async function runBlobCommand(args, storage, { backupDirectory = "backups" } = {}) {
  const [command, filename, confirmation] = args;
  if (!["validate", "import", "backup", "restore"].includes(command) || !filename) {
    throw new Error("Usage: validate|import|backup|restore FILE [--apply|--confirm-restore]");
  }
  if (command === "backup") {
    const { database } = await (storage || createBlobStorage()).snapshot();
    await writeBackup(filename, database);
    return "Private backup saved. Protect it like credentials.";
  }
  let database;
  try { database = validateDatabase(JSON.parse(await readFile(filename, "utf8"))); }
  catch { throw new Error("Input validation failed. Check JSON schema, unique IDs, ownership, timestamps and hashed credentials. No records were uploaded."); }
  if (command === "validate") return "Validation passed. No upload performed.";
  if (command === "import") {
    if (confirmation !== "--apply") return "Validation passed. Import requires --apply; nothing uploaded.";
    await (storage || createBlobStorage()).initialize(database);
    return "Import completed. Source file was not modified.";
  }
  if (confirmation !== "--confirm-restore") throw new Error("Restore requires --confirm-restore after reviewing the backup and stopping application writes.");
  storage ||= createBlobStorage();
  const current = await storage.snapshot();
  const backupFile = path.join(backupDirectory, "before-restore-" + randomUUID() + ".json");
  await writeBackup(backupFile, current.database);
  await storage.replace(database, current.etag);
  return "Restore completed after saving a private pre-restore backup.";
}

async function writeBackup(filename, database) {
  await mkdir(path.dirname(filename), { recursive: true, mode: 0o700 });
  const file = await open(filename, "wx", 0o600);
  try { await file.writeFile(JSON.stringify(database, null, 2) + "\n"); await file.sync(); }
  finally { await file.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(await runBlobCommand(process.argv.slice(2))); }
  catch { console.error("Blob operation failed. Check configuration, validation and whether the destination already exists. No database contents or credentials are logged."); process.exitCode = 1; }
}
