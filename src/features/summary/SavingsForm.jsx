import React, { useState, useEffect } from "react";
import { useSettings } from "../../context/settingsContext";

function PencilIcon({ className = "w-4 h-4" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

export default function SavingsForm({ savingsRate, onSave }) {
  const { getNumberColorClass } = useSettings();
  const hasValue =
    savingsRate !== null && savingsRate !== undefined && savingsRate !== "";
  const [showModal, setShowModal] = useState(false);
  const [rate, setRate] = useState(savingsRate ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    setRate(savingsRate ?? "");
  }, [savingsRate]);

  const openModal = () => {
    setRate(savingsRate ?? "");
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError("");
  };

  const submit = (e) => {
    e.preventDefault();
    const n = Number(rate);
    if (isNaN(n) || n < 0 || n > 100) {
      setError("Enter a value between 0 and 100.");
      return;
    }
    setError("");
    onSave(n);
    setShowModal(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
          Savings Goal
        </h3>
        <button
          onClick={openModal}
          aria-label="Edit savings goal"
          className="w-8 h-8 flex items-center justify-center rounded-theme-small text-theme-muted transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
        >
          <PencilIcon />
        </button>
      </div>
      <p
        className={`text-xl font-semibold ${getNumberColorClass(Number(rate) || 0)}`}
      >
        {Number(rate).toFixed(1)}%
      </p>
      <p className="text-sm text-theme-muted">
        of monthly income
      </p>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
          <form
            onSubmit={submit}
            className="modal-theme p-6 w-full max-w-sm space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-theme-text">
                Edit Savings Goal
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="text-theme-muted hover:text-theme-text text-xl leading-none"
              >
                &times;
              </button>
            </div>
            {error && <p className="text-theme-danger text-xs">{error}</p>}
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="e.g. 20"
                min="0"
                max="100"
                step="0.1"
                autoFocus
                className="input-theme px-3 py-2 text-sm w-28"
              />
              <span className="text-sm text-theme-muted">%</span>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-theme-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-theme-small transition-opacity"
              >
                Save
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="text-theme-muted hover:text-theme-text text-sm px-3 py-2 rounded-theme-small"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
