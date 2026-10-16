import "server-only";
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";
import { StorageError, validateDatabase } from "./storage-schema.mjs";

export function createBlobStorage({
  token = process.env.BLOB_READ_WRITE_TOKEN,
  pathname = process.env.BLOB_DATABASE_PATH || "notes/database.json",
  sdk = { get, put },
  attempts = 5,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
} = {}) {
  if (!token?.trim())
    throw new StorageError(
      "Persistent storage is unavailable. Configure BLOB_READ_WRITE_TOKEN.",
    );
  if (!/^[a-zA-Z0-9_/-]+\.json$/.test(pathname) || pathname.includes(".."))
    throw new StorageError("Invalid Blob database pathname.");
  const options = { token, access: "private" };
  const uploadOptions = {
    ...options,
    addRandomSuffix: false,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  };

  async function snapshot() {
    const response = await sdk.get(pathname, { ...options, useCache: false });
    if (!response)
      throw new StorageError(
        "Database is not initialized. Run the private migration command.",
      );
    if (response.statusCode !== 200 || !response.stream || !response.blob.etag)
      throw new StorageError("Database could not be read safely.");
    let database;
    try {
      database = await new Response(response.stream).json();
    } catch {
      throw new StorageError(
        "Stored database is invalid. Restore a verified backup.",
      );
    }
    const etag = response.blob.etag.replace(/^W\//, "").replace(/^"|"$/g, "");

    return {
      database: validateDatabase(database),
      etag,
    };
  }

  return {
    snapshot,
    async read() {
      return (await snapshot()).database;
    },
    async update(update) {
      for (let attempt = 0; attempt < attempts; attempt++) {
        const { database, etag } = await snapshot();
        // Callbacks may run again. No email, cookies or other external effects here.
        const result = await update(database);
        validateDatabase(database);
        try {
          await sdk.put(pathname, JSON.stringify(database) + "\n", {
            ...uploadOptions,
            allowOverwrite: true,
            ifMatch: etag,
          });
          return result;
        } catch (error) {
          // Unknown failures may have committed remotely. Never blindly replay them.
          if (!(error instanceof BlobPreconditionFailedError))
            throw new StorageError(
              "Storage write failed. Refresh to check whether your change was saved.",
            );
          if (attempt + 1 === attempts)
            throw new StorageError(
              "Storage is busy. Refresh and retry your change.",
              409,
            );
          await wait(
            Math.min(25 * 2 ** attempt, 200) + Math.floor(Math.random() * 25),
          );
        }
      }
    },
    async initialize(database) {
      validateDatabase(database);
      // Atomic create-only upload, even if another operator seeds concurrently.
      await sdk.put(pathname, JSON.stringify(database) + "\n", {
        ...uploadOptions,
        allowOverwrite: false,
      });
    },
    async replace(database, etag) {
      validateDatabase(database);
      if (!etag) throw new StorageError("Recovery requires an ETag.");
      await sdk.put(pathname, JSON.stringify(database) + "\n", {
        ...uploadOptions,
        allowOverwrite: true,
        ifMatch: etag,
      });
    },
  };
}
