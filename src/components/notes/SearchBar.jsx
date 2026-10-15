"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";

  function handleSearch(event) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const search = String(formData.get("search") || "").trim();

    if (!search) {
      toast.error("Enter a title, some content, or a tag to search.");
      return;
    }

    // Keep the search in the URL so it survives refresh and browser Back.
    const params = new URLSearchParams({ q: search });
    router.push(`/search?${params.toString()}`);
  }

  return (
    <form
      role="search"
      onSubmit={handleSearch}
      className="border-2 border-border flex w-full lg:w-60 xl:w-80 gap-4 items-center py-2 px-4 rounded-2xl focus-within:border-primary"
    >
      <input
        key={query}
        name="search"
        type="search"
        defaultValue={query}
        aria-label="Search notes by title, content, or tags"
        className="bg-transparent min-w-0 w-full focus:outline-0"
        placeholder="Search by title, content, or tags..."
      />
      <button
        type="submit"
        aria-label="Search notes"
        className="shrink-0 text-text-muted hover:text-link rounded focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Search size={20} aria-hidden="true" />
      </button>
    </form>
  );
}

export default SearchBar;
