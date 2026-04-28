// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useSettings } from "../../context/settingsContext";

const FREQUENCIES = ["monthly", "biweekly", "weekly"];
const MULTIPLIERS = { monthly: 1, biweekly: 2.17, weekly: 4.33 };

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

export default function IncomeForm({ income, frequency, onSave }) {
  const { formatAmount, getNumberColorClass } = useSettings();
  const [showModal, setShowModal] = useState(false);
  const [amt, setAmt] = useState(income || "");
  const [freq, setFreq] = useState(frequency || "monthly");
  const [error, setError] = useState("");

  useEffect(() => {
    setAmt(income || "");
    setFreq(frequency || "monthly");
  }, [income, frequency]);

  const openModal = () => {
    setAmt(income || "");
    setFreq(frequency || "monthly");
    setError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setError("");
  };

  const submit = (e) => {
    e.preventDefault();
    if (!amt || isNaN(amt) || Number(amt) <= 0) {
      setError("Enter a positive amount.");
      return;
    }
    setError("");
    onSave({
      income: parseFloat(amt),
      frequency: freq,
      monthlyIncome: parseFloat(amt) * MULTIPLIERS[freq],
    });
    setShowModal(false);
  };

  const inputCls = "input-theme px-3 py-2 text-sm";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
          Income
        </h3>
        <button
          onClick={openModal}
          aria-label="Edit income"
          className="w-8 h-8 flex items-center justify-center rounded-theme-small text-theme-muted transition-colors focus:outline-none focus:ring-2 focus:ring-theme-primary/40"
        >
          <PencilIcon />
        </button>
      </div>
      <p className={`text-xl font-semibold text-theme-primary`}>
        {formatAmount(parseFloat(amt) || 0)}
      </p>
      <p className="text-sm text-theme-muted capitalize">
        {freq} · {formatAmount((parseFloat(amt) || 0) * MULTIPLIERS[freq])}/mo
      </p>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-10">
          <form
            onSubmit={submit}
            className="modal-theme p-6 w-full max-w-sm space-y-4"
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-theme-text">
                Edit Income
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
            <div className="flex gap-2">
              <input
                type="number"
                value={amt}
                onChange={(e) => setAmt(e.target.value)}
                placeholder="Amount"
                min="0.01"
                step="0.01"
                autoFocus
                className={`${inputCls} flex-1`}
              />
              <select
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                className={inputCls}
              >
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="flex-1 bg-theme-primary hover:opacity-90 text-white text-sm font-medium px-4 py-2 rounded-theme-medium transition-opacity"
              >
                Save
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="text-theme-muted hover:text-theme-text text-sm px-3 py-2"
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
