"use client";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

function GoBackButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="flex lg:hidden items-center gap-1 text-text-muted"
    >
      <ChevronLeft size={18} />

      <span className="text-sm">Go Back</span>
    </button>
  );
}

export default GoBackButton;
