import "server-only";
import { randomUUID } from "node:crypto";
import { readDatabase, updateDatabase } from "./database";
import {
  createToken,
  hashToken,
  hashPassword,
  verifyPassword,
} from "./security";
import { validateAuth } from "../validation";
import { ApiError } from "./api";
import { getMailSettings, sendResetEmail } from "./email";

export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export const RESET_SECONDS = 15 * 60;

function validate(action, input) {
  const errors = validateAuth(action, input);
  if (Object.keys(errors).length)
    throw new ApiError("Please check your details.", 400, errors);
}

function usernameKey(username) {
  return username.trim().toLowerCase();
}

export function publicUser(user) {
  return { id: user.id, username: user.username };
}

export function sessionUser(database, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const session = database.sessions.find(
    (item) =>
      item.tokenHash === hashToken(token) && item.expiresAt > Date.now(),
  );
  return session
    ? database.users.find((user) => user.id === session.userId) || null
    : null;
}

export async function getSessionUser(token) {
  const user = sessionUser(await readDatabase(), token);
  return user ? publicUser(user) : null;
}

export function resetUser(database, token) {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) return null;
  const reset = database.passwordResets.find(
    (item) =>
      item.tokenHash === hashToken(token) && item.expiresAt > Date.now(),
  );
  return reset
    ? database.users.find((user) => user.id === reset.userId) || null
    : null;
}

export async function getResetUser(token) {
  const user = resetUser(await readDatabase(), token);
  return user ? publicUser(user) : null;
}

export { limitAttempts } from "./rateLimit";

export async function signUp(input) {
  validate("signup", input);
  const passwordHash = await hashPassword(input.password);
  return updateDatabase((database) => {
    const key = usernameKey(input.username);
    const email = input.email.trim().toLowerCase();
    if (database.users.some((user) => user.usernameKey === key)) {
      throw new ApiError("That username is already taken.", 409, {
        username: "Choose another username.",
      });
    }
    if (database.users.some((user) => user.email === email)) {
      throw new ApiError("That email address is already registered.", 409, {
        email: "Use another email or recover your account.",
      });
    }
    const user = {
      id: randomUUID(),
      username: input.username.trim(),
      usernameKey: key,
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };
    // Preserve the existing personal notes for the first account.
    if (database.users.length === 0) {
      database.notes.forEach((note) => {
        if (!note.userId) note.userId = user.id;
      });
    }
    database.users.push(user);
    return publicUser(user);
  });
}

export async function signIn(input, oldToken) {
  validate("signin", input);
  const database = await readDatabase();
  const user = database.users.find(
    (item) => item.usernameKey === usernameKey(input.username),
  );
  if (!(await verifyPassword(input.password, user?.passwordHash))) {
    throw new ApiError("Incorrect username or password.", 401);
  }
  const token = createToken();
  await updateDatabase((current) => {
    const currentUser = current.users.find((item) => item.id === user.id);
    if (
      !currentUser ||
      currentUser.passwordHash !== user.passwordHash ||
      currentUser.usernameKey !== user.usernameKey
    ) {
      throw new ApiError("Account details changed. Please sign in again.", 401);
    }
    current.sessions = current.sessions.filter(
      (item) =>
        item.expiresAt > Date.now() &&
        item.tokenHash !== hashToken(oldToken || ""),
    );
    current.sessions.push({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: Date.now() + SESSION_SECONDS * 1000,
    });
  });
  return { token, user: publicUser(user) };
}

export async function signOut(token) {
  await updateDatabase((database) => {
    database.sessions = database.sessions.filter(
      (item) => item.tokenHash !== hashToken(token || ""),
    );
  });
}

export async function requestPasswordReset(input) {
  validate("forgot-password", input);
  const settings = getMailSettings();
  const database = await readDatabase();
  const user = database.users.find(
    (item) => item.usernameKey === usernameKey(input.username),
  );
  if (!user) return;

  const token = createToken();
  const tokenHash = hashToken(token);
  await updateDatabase((current) => {
    current.passwordResets = current.passwordResets.filter(
      (item) => item.expiresAt > Date.now(),
    );
    current.passwordResets.push({
      tokenHash,
      userId: user.id,
      expiresAt: Date.now() + RESET_SECONDS * 1000,
    });
  });
  try {
    await sendResetEmail(user.email, token, settings);
  } catch {
    await updateDatabase((current) => {
      current.passwordResets = current.passwordResets.filter(
        (item) => item.tokenHash !== tokenHash,
      );
    });
    // Keep the same response for unknown accounts and failed delivery.
    // This fixed message contains no email, token, username, or SMTP credentials.
    console.error(
      "Password recovery email delivery failed. Check SMTP configuration.",
    );
  }
}

export async function resetAccount(input, token) {
  validate("reset-password", input);
  if (!(await getResetUser(token)))
    throw new ApiError(
      "This reset link is invalid or expired. Request a new one.",
      401,
    );
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;

  return updateDatabase((database) => {
    const user = resetUser(database, token);
    if (!user)
      throw new ApiError(
        "This reset link is invalid or expired. Request a new one.",
        401,
      );
    const key = usernameKey(input.username);
    if (
      database.users.some(
        (item) => item.id !== user.id && item.usernameKey === key,
      )
    ) {
      throw new ApiError("That username is already taken.", 409, {
        username: "Choose another username.",
      });
    }
    if (
      !passwordHash &&
      key === user.usernameKey &&
      input.username.trim() === user.username
    ) {
      throw new ApiError("Change your username or enter a new password.");
    }
    user.username = input.username.trim();
    user.usernameKey = key;
    if (passwordHash) user.passwordHash = passwordHash;
    user.updatedAt = new Date().toISOString();
    // One successful reset invalidates every existing session and reset link.
    database.sessions = database.sessions.filter(
      (item) => item.userId !== user.id,
    );
    database.passwordResets = database.passwordResets.filter(
      (item) => item.userId !== user.id,
    );
    return publicUser(user);
  });
}
