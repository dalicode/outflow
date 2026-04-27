import React from "react";

export default function Modal({ isOpen, onClose, title, children, className = "" }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-30">
      <div className={`modal-theme p-5 w-full max-w-xs space-y-4 ${className}`}>
        {title && (
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-theme-text">{title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="text-theme-muted hover:text-theme-text text-xl leading-none"
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
