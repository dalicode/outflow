import React, { useState, useEffect } from "react";
import { useSettings } from "./SettingsContext";

export default function SavingsForm({ savingsRate, onSave }) {
  const { getNumberColorClass } = useSettings();
  const hasValue =
    savingsRate !== null && savingsRate !== undefined && savingsRate !== "";
  const [editing, setEditing] = useState(!hasValue);
  const [rate, setRate] = useState(savingsRate ?? "");
  const [error, setError] = useState("");

  // Sync when persisted value loads asynchronously
  useEffect(() => {
    if (hasValue) {
      setRate(savingsRate);
      setEditing(false);
    }
  }, [savingsRate]);

  const submit = (e) => {
    e.preventDefault();
    const n = Number(rate);
    if (isNaN(n) || n < 0 || n > 100) {
      setError("Enter a value between 0 and 100.");
      return;
    }
    setError("");
    onSave(n);
    setEditing(false);
  };

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
            Savings Goal
          </h3>
          <button
            onClick={() => setEditing(true)}
            className="text-theme-primary hover:opacity-80 text-sm"
          >
            Edit
          </button>
        </div>
        <p
          className={`text-xl font-semibold ${getNumberColorClass(Number(rate) || 0)}`}
        >
          {Number(rate).toFixed(1)}%
        </p>
        <p className="text-sm text-theme-muted">
          of available income after fixed expenses
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
        Savings Goal
      </h3>
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
          className="input-theme px-3 py-2 text-sm w-28"
        />
        <span className="text-sm text-theme-muted">%</span>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-theme-primary hover:opacity-90 text-white text-sm px-4 py-2 rounded-theme-small transition-opacity"
        >
          Save
        </button>
        {hasValue && (
          <button
            type="button"
            onClick={() => {
              setRate(savingsRate);
              setEditing(false);
            }}
            className="text-theme-muted hover:text-theme-text text-sm px-3 py-2 rounded-theme-small"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
