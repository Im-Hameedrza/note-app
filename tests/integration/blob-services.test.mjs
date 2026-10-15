import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import { BlobPreconditionFailedError } from "@vercel/blob";
import { createBlobStorage } from "../../src/lib/server/blob-storage.mjs";

// Inject only storage and the unused page-session helper; execute real auth,
// security, validation and notes services without a Next request context.
const mockDatabase = "data:text/javascript," + encodeURIComponent(
  "export const readDatabase = () => globalThis.__blobServiceStorage.read();" +
  "export const updateDatabase = callback => globalThis.__blobServiceStorage.update(callback);"
);
const mockSession = "data:text/javascript," + encodeURIComponent("export const requireUser = () => { throw new Error('Page session helper is not used by API service tests'); };");
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes("/src/lib/server/")) {
      if (specifier === "./database") return { url: mockDatabase, shortCircuit: true };
      if (specifier === "./session") return { url: mockSession, shortCircuit: true };
    }
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(specifier + ".js", context);
      throw error;
    }
  },
});

test("real auth/notes services retain ownership, sessions and lifecycle through Blob conditional updates", async () => {
  let json = JSON.stringify({ notes: [], users: [], sessions: [], passwordResets: [], rateLimits: [], noteRequests: [] });
  let version = 1, conflicts = 0;
  const sdk = {
    async get() { return { statusCode: 200, blob: { etag: String(version) }, stream: new Response(json).body }; },
    async put(key, body, options) {
      if (options.ifMatch !== String(version)) { conflicts++; throw new BlobPreconditionFailedError(); }
      json = body; version++;
    },
  };
  const connect = () => createBlobStorage({ token: "synthetic-only", sdk, wait: async () => {} });
  globalThis.__blobServiceStorage = connect();
  const { signUp, signIn, signOut, resetAccount, getSessionUser } = await import("../../src/lib/server/auth.js");
  const { changeNotes, notesForSession } = await import("../../src/lib/server/notes.js");
  const { hashToken } = await import("../../src/lib/server/security.js");
  const account = { username: "blob_owner", email: "blob-owner@example.test", password: "Blob testing password 123!", confirmPassword: "Blob testing password 123!" };
  const owner = await signUp(account);
  const other = { ...account, username: "blob_other", email: "blob-other@example.test" };
  await signUp(other);
  await assert.rejects(signUp(account), error => error.status === 409);
  await assert.rejects(signIn({ ...account, password: "Wrong testing password 123!" }), error => error.status === 401);
  const { token } = await signIn(account);
  const stranger = (await signIn(other)).token;
  assert.equal((await getSessionUser(token)).id, owner.id);
  const fields = { title: "Private Blob note", content: "Searchable content", tags: ["Work", "Project Alpha"] };
  const note = await changeNotes(token, "create", fields);
  assert.deepEqual(await notesForSession(stranger), []);
  await assert.rejects(changeNotes(stranger, "update", { title: "Unauthorized" }, note.id), error => error.status === 404);
  await assert.rejects(changeNotes(stranger, "delete", {}, note.id), error => error.status === 404);
  await assert.rejects(changeNotes("", "create", fields), error => error.status === 401);
  await changeNotes(token, "update", { title: "Edited title" }, note.id);
  assert.equal((await notesForSession(token))[0].title, "Edited title");
  await changeNotes(token, "update", { isArchived: true }, note.id);
  assert.equal((await notesForSession(token))[0].isArchived, true);
  await changeNotes(token, "update", { isArchived: false }, note.id);
  assert.equal((await notesForSession(token))[0].isArchived, false);

  const edits = await Promise.allSettled([
    changeNotes(token, "update", { content: "Concurrent edit one" }, note.id),
    changeNotes(token, "update", { content: "Concurrent edit two" }, note.id),
  ]);
  assert.equal(edits.filter(item => item.status === "fulfilled").length, 1);
  assert.equal(edits.find(item => item.status === "rejected").reason.status, 409);
  assert.ok(conflicts > 0);

  const requestId = "11111111-1111-4111-8111-111111111111";
  const created = await Promise.all([
    changeNotes(token, "create", fields, undefined, requestId),
    changeNotes(token, "create", fields, undefined, requestId),
  ]);
  assert.equal(created[0].id, created[1].id);
  assert.equal((await notesForSession(token)).length, 2);
  globalThis.__blobServiceStorage = connect();
  assert.equal((await notesForSession(token)).length, 2);
  await changeNotes(token, "delete", {}, note.id);
  assert.equal((await notesForSession(token)).length, 1);
  await signOut(stranger);
  await assert.rejects(notesForSession(stranger), error => error.status === 401);

  const resetToken = "c".repeat(64);
  await globalThis.__blobServiceStorage.update(db => {
    db.passwordResets.push({ tokenHash: hashToken(resetToken), userId: owner.id, expiresAt: Date.now() + 60000 });
  });
  const updated = { ...account, password: "Updated Blob password 123!", confirmPassword: "Updated Blob password 123!" };
  await resetAccount(updated, resetToken);
  await assert.rejects(notesForSession(token), error => error.status === 401);
  await assert.rejects(resetAccount(updated, resetToken), error => error.status === 401);
  const renewed = await signIn(updated);
  assert.equal((await notesForSession(renewed.token)).length, 1);
  const snapshot = JSON.parse(json);
  assert.ok(!json.includes(updated.password) && !json.includes(account.password));
  assert.ok(!json.includes(renewed.token) && !json.includes(resetToken));
  assert.match(snapshot.users[0].passwordHash, /^scrypt\$/);
});