import { Plus } from "lucide-react";
import Link from "next/link";

function CreateNoteButton() {
  return (
    <Link
      href="/add"
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 font-medium text-on-primary shadow-sm transition-all hover:bg-primary-hover active:scale-[0.98] lg:flex lg:text-[12px] xl:text-[16px]"
    >
      <Plus size={22} />
      Create New Note
    </Link>
  );
}

export default CreateNoteButton;
