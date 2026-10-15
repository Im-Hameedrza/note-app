// Shared note selection rules, independent of React, routing, and API requests.
export function filterNotes(notes, { category, searchQuery, tag } = {}) {
  const isSearching = typeof searchQuery === "string";
  const query = (searchQuery || "").trim().toLowerCase();

  let notesToShow;

  if (isSearching) {
    // Every word must appear somewhere in the title, content, or tags.
    // Lowercase makes "react" and "React" match the same notes.
    const searchWords = query.split(/\s+/).filter(Boolean);
    notesToShow = query
      ? notes.filter((note) => {
          const searchableText = [
            note.title || "",
            note.content || "",
            ...(note.tags || []),
          ]
            .join(" ")
            .toLowerCase();

          return searchWords.every((word) => searchableText.includes(word));
        })
      : [];
  } else if (typeof tag === "string") {
    notesToShow = notes.filter(note => (note.tags || []).includes(tag));
  } else if (category === "allnotes") {
    notesToShow = notes.filter((note) => note.isArchived === false);
  } else if (category === "archived") {
    notesToShow = notes.filter((note) => note.isArchived === true);
  } else {
    notesToShow = notes.filter((note) => (note.tags || []).includes(category));
  }

  return notesToShow;
}


export function tagHref(tag) { return "/tag?name=" + encodeURIComponent(tag); }
export function routeTag(pathname, params) {
  if (pathname === "/tag") return params.get("name");
  if (pathname.startsWith("/note/") && params.has("tag")) return params.get("tag");
  if (/^\/[^/]+$/.test(pathname) && !["/allnotes", "/archived", "/search", "/add", "/tags", "/setting", "/settings", "/auth"].includes(pathname)) {
    try { return decodeURIComponent(pathname.slice(1)); } catch { return null; }
  }
  return null;
}
export function navigationSection(pathname, params, notes = []) {
  if (pathname === "/setting" || pathname === "/settings" || pathname.startsWith("/setting/")) return "setting";
  if (pathname === "/search" || (pathname.startsWith("/note/") && params.has("q"))) return "search";
  if (pathname === "/tags" || routeTag(pathname, params) !== null) return "tags";
  if (pathname === "/archived") return "archived";
  if (pathname.startsWith("/note/")) {
    const selected = notes.find(note => String(note.id) === pathname.slice(6));
    return selected ? (selected.isArchived ? "archived" : "allnotes") : params.get("from") === "archived" ? "archived" : "allnotes";
  }
  return "allnotes";
}
