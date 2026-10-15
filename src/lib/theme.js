export const THEME_COOKIE = "note-app-theme";
export { PREFERENCE_MAX_AGE as THEME_MAX_AGE } from "./preferences";
export function normalizeTheme(value) {
  return value === "dark" ? "dark" : "light";
}
