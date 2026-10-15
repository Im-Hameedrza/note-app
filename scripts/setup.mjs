import { copyFile, chmod } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Explicit local setup only: existing databases and environment files are preserved.
export async function setupProject(directory = process.cwd()) {
  const results = [];
  for (const [source, destination] of [["db.example.json", "db.json"], [".env.example", ".env.local"]]) {
    try {
      await copyFile(path.join(directory, source), path.join(directory, destination), constants.COPYFILE_EXCL);
      await chmod(path.join(directory, destination), 0o600);
      results.push({ file: destination, created: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      results.push({ file: destination, created: false });
    }
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const { file, created } of await setupProject()) {
    console.log(`${created ? "Created" : "Kept existing"} ${file}`);
  }
}
