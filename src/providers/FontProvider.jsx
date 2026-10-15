"use client";

import { createContext, useContext, useState } from "react";
import { FONT_COOKIE, normalizeFont } from "@/lib/font";
import { savePreference } from "@/lib/preferences";

const FontContext = createContext(null);
export function useFont() { return useContext(FontContext); }

export default function FontProvider({ initialFont, children }) {
  const [font, setFont] = useState(initialFont);

  function changeFont(value) {
    const nextFont = normalizeFont(value);
    savePreference(FONT_COOKIE, nextFont);
    document.documentElement.dataset.font = nextFont;
    setFont(nextFont);
  }

  return (
    <FontContext.Provider value={{ font, changeFont }}>
      {children}
    </FontContext.Provider>
  );
}
