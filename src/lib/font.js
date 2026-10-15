export const FONT_COOKIE = "note-app-font";

export const FONT_OPTIONS = [
  {
    value: "system",
    label: "System Default",
    description: "The familiar default used by your notes.",
    family: "Arial, Helvetica, sans-serif",
  },
  {
    value: "geist",
    label: "Geist",
    description: "A clean, modern sans-serif.",
    family: "var(--font-geist-sans), Arial, sans-serif",
  },
  {
    value: "geist-mono",
    label: "Geist Mono",
    description: "Evenly spaced letters for a focused workspace.",
    family: "var(--font-geist-mono), monospace",
  },
];

export function normalizeFont(value) {
  return FONT_OPTIONS.some((option) => option.value === value) ? value : "system";
}
