import Image from "next/image";
import DesktopNav from "@/components/navigation/DesktopNav";
import BottomNav from "@/components/navigation/BottomNav";
import TabletNav from "@/components/navigation/TabletNav";
import LogoutButton from "@/components/auth/LogoutButton";
import { getNotes } from "@/lib/server/notes";
import { requireUser } from "@/lib/server/session";

export default async function AppLayout({ children }) {
  const user = await requireUser();
  const notes = await getNotes();
  const tags = [...new Set(notes.flatMap((note) => note.tags))];

  return (
    <main className="min-h-screen bg-background lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:h-screen lg:overflow-hidden">
      <div className="hidden bg-surface-secondary lg:block">
        <DesktopNav tags={tags} username={user.username} notes={notes} />
      </div>
      <div className="block min-[560px]:hidden"><BottomNav notes={notes} /></div>
      <div className="hidden min-[560px]:block lg:hidden"><TabletNav notes={notes} /></div>
      <div className="min-w-0 min-h-0">
        <div className="p-4 bg-surface-secondary lg:hidden flex items-center justify-between gap-3">
          <Image className="app-logo shrink-0" src="/next.svg" width={70} height={70} alt="logo" />
          <span className="truncate text-sm text-text-secondary">{user.username}</span>
          <LogoutButton />
        </div>
        {children}
      </div>
    </main>
  );
}
