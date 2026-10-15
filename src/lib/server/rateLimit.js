import "server-only";
import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { isIP } from "node:net";
import { updateDatabase } from "./database";
import { hashToken } from "./security";
import { ApiError } from "./api";

const cookieName = "note_auth_client";
const signingKey = Symbol.for("note-app.auth-client-key");
globalThis[signingKey] ??= randomBytes(32);
function signature(value) {
  return createHmac("sha256", globalThis[signingKey]).update(value).digest("hex");
}
function equal(a, b) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function authClientScope(request, jar) {
  const proxySecret = process.env.AUTH_TRUSTED_PROXY_SECRET;
  if (proxySecret) {
    // The proxy must strip both incoming headers and replace them itself.
    // Never use Forwarded, X-Forwarded-For, X-Real-IP, or user-supplied usernames as client identity.
    if (proxySecret.length < 32) throw new ApiError("Authentication proxy configuration is invalid.", 503);
    if (!equal(request.headers.get("x-auth-proxy-secret") || "", proxySecret)) throw new ApiError("This request is not allowed.", 403);
    const address = request.headers.get("x-auth-client-ip") || "";
    const version = isIP(address);
    if (!version || address.includes("%")) throw new ApiError("Invalid authentication client address.", 403);
    return "ip:" + (version === 6 ? new URL(`http://[${address}]/`).hostname.toLowerCase() : address);
  }
  // Standard Next Route Handlers do not expose an authenticated socket address.
  // A signed browser identifier provides client/action throttling; account limits
  // below remain effective even if a caller deletes this cookie or changes browsers.
  const [id = "", mac = ""] = (jar.get(cookieName)?.value || "").split(".");
  if (/^[a-f0-9]{64}$/.test(id) && /^[a-f0-9]{64}$/.test(mac) && equal(mac, signature(id))) return "browser:" + hashToken(id);
  const value = randomBytes(32).toString("hex");
  jar.set(cookieName, value + "." + signature(value), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 24 * 60 * 60 });
  return "browser:" + hashToken(value);
}

export async function limitAttempts(action, account = "", clientScope, resetToken = "") {
  const clientLimits = { signup: 10, signin: 60, "forgot-password": 20, "verify-reset": 30, "reset-password": 20 };
  const keys = [{ key: hashToken(`v2:${action}:client:${clientScope}`), limit: clientLimits[action] || 15 }];
  if (["signup", "signin", "forgot-password"].includes(action) && account.trim()) {
    keys.push({ key: hashToken(`v2:${action}:account:${account.trim().toLowerCase().slice(0,254)}`), limit: action === "forgot-password" ? 5 : 15 });
  }
  if (action === "reset-password" && /^[a-f0-9]{64}$/.test(resetToken)) {
    keys.push({ key: hashToken(`v2:${action}:token:${resetToken}`), limit: 15 });
  }
  const allowed = await updateDatabase(database => {
    const now = Date.now();
    database.rateLimits = database.rateLimits.filter(item => item.expiresAt > now);
    database.sessions = database.sessions.filter(item => item.expiresAt > now);
    database.passwordResets = database.passwordResets.filter(item => item.expiresAt > now);
    if (keys.some(entry => database.rateLimits.some(item => item.key === entry.key && item.count >= entry.limit))) return false;
    for (const entry of keys) {
      const bucket = database.rateLimits.find(item => item.key === entry.key);
      if (bucket) bucket.count++;
      else database.rateLimits.push({ key: entry.key, count: 1, expiresAt: now + 15 * 60 * 1000 });
    }
    return true;
  });
  if (!allowed) throw new ApiError("Too many attempts. Try again in 15 minutes.", 429);
}
