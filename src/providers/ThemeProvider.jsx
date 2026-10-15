"use client";

import { createContext, useContext, useState } from "react";
import { Toaster } from "react-hot-toast";
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme";
import { savePreference } from "@/lib/preferences";

const ThemeContext = createContext(null);
export function useTheme() { return useContext(ThemeContext); }

export default function ThemeProvider({ initialTheme, children }) {
  const [theme, setTheme] = useState(initialTheme);
  function changeTheme(value) {
    const nextTheme = normalizeTheme(value);
    // Server HTML and client state share this preference from the first paint.
    savePreference(THEME_COOKIE, nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    setTheme(nextTheme);
  }
  return (
    <ThemeContext.Provider value={{ theme, changeTheme }}>
      {children}
      <Toaster toastOptions={{
        style: { background: "var(--surface)", color: "var(--text-primary)", border: "1px solid var(--border-strong)" },
        success: { iconTheme: { primary: "var(--color-green-500)", secondary: "var(--color-neutral-950)" } },
        error: { iconTheme: { primary: "var(--color-red-500)", secondary: "var(--color-neutral-0)" } },
      }} />
    </ThemeContext.Provider>
  );
}
