"use client";

function SaveButton({ handleSubmit, disabled, isSaving }) {
  return (
    <button
      type="button"
      onClick={handleSubmit}
      disabled={disabled}
      className="text-link lg:bg-primary lg:hover:bg-primary-hover lg:rounded-2xl lg:px-4 lg:py-2 lg:text-on-primary text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isSaving ? "Saving..." : "Save Note"}
    </button>
  );
}

export default SaveButton;
