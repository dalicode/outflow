import Modal from "./Modal";
import ModalFooter from "./ModalFooter";
import { cn } from "../../utils/cn";

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  cancelLabel?: string;
  confirmLabel?: string;
  confirmVariant?: "default" | "destructive";
  onCancel?: () => void;
  onConfirm: () => void;
  confirmDisabled?: boolean;
  size?: "sm" | "md";
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  title,
  description,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  confirmVariant = "default",
  onCancel,
  onConfirm,
  confirmDisabled = false,
  size = "sm",
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size={size}
      footer={
        <ModalFooter>
          <button
            type="button"
            onClick={handleCancel}
            className="btn-cancel-sm flex-1"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className={cn(
              "flex-1",
              confirmVariant === "destructive"
                ? "confirm-delete-btn"
                : "summary-save-btn",
            )}
          >
            {confirmLabel}
          </button>
        </ModalFooter>
      }
    >
      {/* Content is empty since title+description handle the message */}
    </Modal>
  );
}
