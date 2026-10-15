import { NotebookPen } from "lucide-react";

export const metadata = {
  title: "Account | Note App",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-secondary px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-7 flex items-center gap-2 text-text-primary">
          <NotebookPen size={26} className="text-link" aria-hidden="true" />
          <span className="text-xl font-bold">Note App</span>
        </div>
        {children}
      </section>
    </main>
  );
}
