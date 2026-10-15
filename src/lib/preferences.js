export const PREFERENCE_MAX_AGE = 60 * 60 * 24 * 365;

// Both preferences are available to the server before the first render.
export function savePreference(name, value) {
  document.cookie = name + "=" + value + "; Path=/; Max-Age=" + PREFERENCE_MAX_AGE + "; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
}
