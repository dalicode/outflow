import { useState } from "react";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import LoadingOverlay from "../../components/ui/LoadingOverlay";

interface DangerZoneProps {
  onClearAll: () => Promise<void>;
}

export default function DangerZone({ onClearAll }: DangerZoneProps) {
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [isReloading, setIsReloading] = useState(false);

  const handleClose = () => {
    setIsClearModalOpen(false);
    setDeleteConfirm("");
  };

  const triggerReload = () => {
    setIsReloading(true);
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  return (
    <>
      <Card title="Danger Zone" className="border-theme-danger/30">
        <p className="text-xs text-theme-muted mb-2">
          Permanently delete all expenses, categories, fixed expenses, snapshots,
          and settings. This cannot be undone.
        </p>
        <button onClick={() => setIsClearModalOpen(true)} className="btn-danger-sm">
          Clear All Data
        </button>
      </Card>

      <Modal
        isOpen={isClearModalOpen}
        onClose={handleClose}
        title="Clear All Data"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-theme-muted">
            This will permanently delete{" "}
            <strong className="text-theme-text">everything</strong> — expenses,
            categories, fixed expenses, snapshots, and settings. This action
            cannot be undone.
          </p>
          <label className="flex flex-col gap-1 text-xs text-theme-muted">
            Type{" "}
            <span className="font-mono text-theme-danger">DELETE</span> to
            confirm
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="input-theme px-3 py-2 text-sm"
              autoFocus
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={async () => {
                if (deleteConfirm !== "DELETE") return;
                await onClearAll();
                handleClose();
                triggerReload();
              }}
              disabled={deleteConfirm !== "DELETE"}
              className="flex-1 bg-theme-danger hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium py-2 rounded-theme-small transition-opacity"
            >
              Clear Everything
            </button>
            <button onClick={handleClose} className="btn-cancel-sm">
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <LoadingOverlay
        isOpen={isReloading}
        message="Deleting…"
        subMessage="Refreshing app…"
      />
    </>
  );
}
