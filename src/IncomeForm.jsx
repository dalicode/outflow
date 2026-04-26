import React, { useState, useEffect } from "react";
import { useSettings } from "./SettingsContext";

const FREQUENCIES = ["monthly", "biweekly", "weekly"];
const MULTIPLIERS = { monthly: 1, biweekly: 2.17, weekly: 4.33 };

export default function IncomeForm({ income, frequency, onSave }) {
  const { formatAmount, getNumberColorClass } = useSettings();
  const [editing, setEditing] = useState(!income);
  const [amt, setAmt] = useState(income || "");
  const [freq, setFreq] = useState(frequency || "monthly");
  const [error, setError] = useState("");

  useEffect(() => {
    if (income) {
      setAmt(income);
      setFreq(frequency);
      setEditing(false);
    }
  }, [income, frequency]);

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
    setEditing(false);
  };

  const inputCls = "input-theme px-3 py-2 text-sm";

  if (!editing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-widest mb-2">
            Income
          </h3>
          <button
            onClick={() => setEditing(true)}
            className="text-theme-primary hover:opacity-80 text-sm"
          >
            Edit
          </button>
        </div>
        <p
          className={`text-xl font-semibold ${getNumberColorClass(parseFloat(amt) || 0)}`}
        >
          {formatAmount(parseFloat(amt) || 0)}
        </p>
        <p className="text-sm text-theme-muted capitalize">
          {freq} · {formatAmount((parseFloat(amt) || 0) * MULTIPLIERS[freq])}/mo
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <h3 className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
        Income
      </h3>
      {error && <p className="text-theme-danger text-xs">{error}</p>}
      <div className="flex gap-2">
        <input
          type="number"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          placeholder="Amount"
          min="0.01"
          step="0.01"
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
          className="bg-theme-primary hover:opacity-90 text-white text-sm px-4 py-2 rounded-theme-medium transition-opacity"
        >
          Save
        </button>
        {income && (
          <button
            type="button"
            onClick={() => {
              setAmt(income);
              setFreq(frequency);
              setEditing(false);
            }}
            className="text-theme-muted hover:text-theme-text text-sm px-3 py-2"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
