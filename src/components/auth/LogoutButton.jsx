"use client";

import { LogOut } from "lucide-react";
import useLogout from "@/hooks/useLogout";

export default function LogoutButton() {
  const { isLoading, handleLogout } = useLogout();

  return (
    <button
      onClick={handleLogout} disabled={isLoading}
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-text-secondary hover:bg-surface-secondary disabled:opacity-60"
    >
      <LogOut size={18} aria-hidden="true" />
      {isLoading ? "Signing out..." : "Log out"}
    </button>
  );
}
