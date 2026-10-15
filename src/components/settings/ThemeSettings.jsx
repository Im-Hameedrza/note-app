"use client";

import { Sun, Moon, Check } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

const options = [
  {
    value: "light",
    label: "Light Mode",
    description: "A bright, clear workspace.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark Mode",
    description: "A softer view in low light.",
    icon: Moon,
  },
];
export default function ThemeSettings() {
  const { theme, changeTheme } = useTheme();
  return (
    <fieldset aria-describedby="theme-description">
      <legend className="text-xl font-semibold">Theme</legend>
      <p id="theme-description" className="mt-1 text-sm text-text-secondary">
        Choose how the application looks.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {options.map(({ value, label, description, icon: Icon }) => (
          <label key={value} className="relative cursor-pointer">
            <input
              type="radio"
              name="theme"
              value={value}
              checked={theme === value}
              onChange={() => changeTheme(value)}
              className="peer sr-only"
            />
            <span className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-secondary peer-checked:border-primary peer-checked:bg-primary-light peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              <Icon
                size={24}
                className="shrink-0 text-text-secondary"
                aria-hidden="true"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{label}</span>
                <span className="mt-1 block text-sm text-text-secondary">
                  {description}
                </span>
              </span>
              <Check
                size={20}
                className={
                  theme === value ? "shrink-0 text-link" : "invisible shrink-0"
                }
                aria-hidden="true"
              />
            </span>
          </label>
        ))}
      </div>
      <p role="status" className="mt-4 text-sm text-text-muted">
        {theme === "dark" ? "Dark" : "Light"} mode is selected. Your preference
        is saved automatically.
      </p>
    </fieldset>
  );
}
