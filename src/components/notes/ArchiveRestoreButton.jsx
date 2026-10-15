import { Archive, RotateCcw } from "lucide-react";

function ArchiveRestoreButton({ isArchivedPath, setShowModal, disabled }) {
  const handleShowModal = () => {
    if (!isArchivedPath) {
      return setShowModal("archive");
    }
    if (isArchivedPath) {
      return setShowModal("restore");
    }
  };

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={isArchivedPath ? "Restore Note" : "Archive Note"}
      onClick={handleShowModal}
      className="
      flex items-center justify-center gap-2
      text-text-muted
      lg:justify-start
      lg:rounded-2xl
      lg:border lg:border-border
      lg:px-5 lg:py-4
      lg:text-text-primary
      lg:hover:bg-surface-secondary
    "
    >
      {isArchivedPath ? (
        <RotateCcw size={18} className="lg:size-4" />
      ) : (
        <Archive size={18} className="lg:size-4" />
      )}

      <span className="hidden lg:block lg:text-sm lg:font-medium">
        {isArchivedPath ? "Restore Note" : "Archive Note"}
      </span>
    </button>
  );
}

export default ArchiveRestoreButton;
