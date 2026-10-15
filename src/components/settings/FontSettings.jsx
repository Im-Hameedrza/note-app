"use client";

import { Check } from "lucide-react";
import { useFont } from "@/providers/FontProvider";
import { FONT_OPTIONS } from "@/lib/font";

export default function FontSettings() {
  const { font, changeFont } = useFont();
  const selected = FONT_OPTIONS.find((option) => option.value === font);

  return (
    <fieldset aria-describedby="font-description">
      <legend className="text-xl font-semibold">Font</legend>
      <p id="font-description" className="mt-1 text-sm text-text-secondary">
        Choose the font used throughout the application.
      </p>
      <div className="mt-5 grid gap-3">
        {FONT_OPTIONS.map(({ value, label, description, family }) => (
          <label key={value} className="relative cursor-pointer">
            <input
              type="radio"
              name="font"
              value={value}
              checked={font === value}
              onChange={() => changeFont(value)}
              className="peer sr-only"
            />
            <span className="flex min-h-24 items-center gap-3 rounded-xl border border-border bg-surface p-4 hover:bg-surface-secondary peer-checked:border-primary peer-checked:bg-primary-light peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary">
              <span style={{ fontFamily: family }} className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-background text-xl" aria-hidden="true">
                Aa
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold" style={{ fontFamily: family }}>{label}</span>
                <span className="mt-1 block text-sm text-text-secondary">{description}</span>
              </span>
              <Check size={20} className={font === value ? "shrink-0 text-link" : "invisible shrink-0"} aria-hidden="true" />
            </span>
          </label>
        ))}
      </div>
      <p role="status" className="mt-4 text-sm text-text-muted">
        {selected.label} is selected. Your preference is saved automatically.
      </p>
    </fieldset>
  );
}
