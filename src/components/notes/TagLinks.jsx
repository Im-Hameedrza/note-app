"use client";
import { Tag } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { routeTag, tagHref } from "@/lib/notes";
export default function TagLinks({ tags }) {
  const selected = routeTag(usePathname(), useSearchParams());
  return tags.map(tag => <Link key={tag} href={tagHref(tag)} aria-current={selected === tag ? "page" : undefined}
    className={"flex w-full items-center gap-3 rounded-lg border-b border-border-light px-3 py-2.5 text-sm font-medium hover:bg-surface-secondary lg:border-none " + (selected === tag ? "bg-primary-light text-link" : "text-text-secondary")}>
    <Tag size={18} className="shrink-0" aria-hidden="true" /><span className="min-w-0 [overflow-wrap:anywhere]">{tag}</span>
  </Link>);
}
