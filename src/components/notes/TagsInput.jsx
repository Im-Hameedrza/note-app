"use client";
import { useState } from "react";
import CreatableSelect from "react-select/creatable";
import { NOTE_LIMITS } from "@/lib/noteValidation";

export default function TagsInput({ tags, onChange, disabled = false }) {
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");
  const option = label => ({ label, value: label });
  function handleKeyDown(event) {
    if (!["Enter", "Tab"].includes(event.key) || !inputValue.trim()) return;
    event.preventDefault();
    const tag = inputValue.trim();
    if (tags.includes(tag)) { setInputValue(""); setError(""); return; }
    if (tag.length > NOTE_LIMITS.tag) { setError(`Use no more than ${NOTE_LIMITS.tag} characters per tag.`); return; }
    if (tags.length >= NOTE_LIMITS.tags) { setError(`Use no more than ${NOTE_LIMITS.tags} tags.`); return; }
    onChange([...tags, tag]);
    setInputValue("");
    setError("");
  }
  return <div className="min-w-0">
    <CreatableSelect unstyled aria-label="Note tags" aria-invalid={!!error} aria-describedby="tag-hint tag-error"
      classNames={{
        container: () => "min-w-0 text-sm",
        control: ({ isFocused }) => "min-h-11 rounded-lg border bg-surface p-1 " + (isFocused ? "border-primary ring-2 ring-primary/25" : "border-border-strong"),
        valueContainer: () => "gap-1 px-1", input: () => "text-text-primary", placeholder: () => "text-text-muted",
        multiValue: () => "max-w-full rounded bg-secondary text-text-primary", multiValueLabel: () => "truncate px-2 py-1",
        multiValueRemove: () => "rounded px-1 hover:bg-danger-light hover:text-danger", clearIndicator: () => "p-2 text-text-secondary hover:text-danger",
        indicatorSeparator: () => "bg-border mx-1 self-stretch"
      }}
      instanceId="tags-select" inputId="tags-select-input" components={{ DropdownIndicator: null }} inputValue={inputValue}
      isClearable isMulti isDisabled={disabled} menuIsOpen={false} value={tags.map(option)}
      onChange={selected => { onChange([...new Set((selected || []).map(item => item.value.trim()))]); setError(""); }}
      onInputChange={value => { setInputValue(value); setError(""); }} onKeyDown={handleKeyDown} placeholder="Type a tag and press Enter..." />
    <p id="tag-hint" className="mt-1 text-xs text-text-muted">Up to {NOTE_LIMITS.tags} tags, {NOTE_LIMITS.tag} characters each.</p>
    <p id="tag-error" role={error ? "alert" : undefined} className="mt-1 text-sm text-danger">{error}</p>
  </div>;
}
