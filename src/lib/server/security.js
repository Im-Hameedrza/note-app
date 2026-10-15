import "server-only";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const deriveKey = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

export function createToken() {
  return randomBytes(32).toString("hex");
}

export function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await deriveKey(password, salt, 64, options);
  return `scrypt$131072$8$1$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, cost, blockSize, parallel, salt, key] = (storedHash || "").split("$");
  const valid = algorithm === "scrypt" && cost === "131072" &&
    blockSize === "8" && parallel === "1" &&
    /^[a-f0-9]{32}$/.test(salt || "") && /^[a-f0-9]{128}$/.test(key || "");
  // Unknown usernames still do the expensive work to reduce timing differences.
  const derived = await deriveKey(password, valid ? salt : "0".repeat(32), 64, options);
  return valid && timingSafeEqual(derived, Buffer.from(key, "hex"));
}
