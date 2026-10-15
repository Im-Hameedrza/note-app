import "server-only";
import { storageMode } from "./storage-schema.mjs";
import { createBlobStorage } from "./blob-storage.mjs";
import { readLocalDatabase, updateLocalDatabase } from "./local-storage";

export async function readDatabase() {
  return storageMode() === "blob" ? createBlobStorage().read() : readLocalDatabase();
}

export async function updateDatabase(update) {
  return storageMode() === "blob" ? createBlobStorage().update(update) : updateLocalDatabase(update);
}
