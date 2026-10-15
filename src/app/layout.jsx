import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import ThemeProvider from "@/providers/ThemeProvider";
import FontProvider from "@/providers/FontProvider";
import { FONT_COOKIE, normalizeFont } from "@/lib/font";
import { THEME_COOKIE, normalizeTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata = {
  title: "Note App",
  description: "Your personal notes, organized.",
};

export default async function RootLayout({ children }) {
  const preferences = await cookies();
  const theme = normalizeTheme(preferences.get(THEME_COOKIE)?.value);
  const font = normalizeFont(preferences.get(FONT_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme} data-font={font} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider initialTheme={theme}>
          <FontProvider initialFont={font}>{children}</FontProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
