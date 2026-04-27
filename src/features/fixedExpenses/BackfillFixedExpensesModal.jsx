import React, { useState, useMemo } from "react";
import Modal from "../../components/ui/Modal";
import { StorageService } from "../../services/storageService";
import { getBackfillPreviewTimeline } from "../../utils/financeEngine";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

let _idCounter = 0;
const nextId = () => `tmp-${++_idCounter}`;

function formatAmount(amount, symbol = "$", decimals = 2) {
  const n = typeof amount === "number" ? amount : parseFloat(amount);
  if (isNaN(n)) return "—";
  return `${symbol}${n.toFixed(decimals)}`;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export default function BackfillFixedExpensesModal({
  isOpen,
  onClose,
  years,
  onComplete,
  defaultIncome = "",
  defaultSavingsRate = "",
}) {
  const [items, setItems] = useState([
    { id: nextId(), name: "", amount: "", startMonth: 1, endMonth: 12 },
  ]);
  const [selectedYears, setSelectedYears] = useState(() =>
    years.length > 0 ? new Set([years[0]]) : new Set()
  );
  const [monthlyIncome, setMonthlyIncome] = useState(String(defaultIncome));
  const [incomeStartMonth, setIncomeStartMonth] = useState(1);
  const [incomeEndMonth, setIncomeEndMonth] = useState(12);
  const [savingsRate, setSavingsRate] = useState(String(defaultSavingsRate));
  const [savingsStartMonth, setSavingsStartMonth] = useState(1);
  const [savingsEndMonth, setSavingsEndMonth] = useState(12);
  const [overwrite, setOverwrite] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [resultMsg, setResultMsg] = useState("");

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { id: nextId(), name: "", amount: "", startMonth: 1, endMonth: 12 },
    ]);
  };

  const removeItem = (id) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((i) => i.id !== id)));
  };

  const updateItem = (id, patch) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const toggleYear = (y) => {
    setSelectedYears((prev) => {
      const next = new Set(prev);
      if (next.has(y)) next.delete(y);
      else next.add(y);
      return next;
    });
  };

  const selectAllYears = () => {
    setSelectedYears(new Set(years));
  };

  const validate = () => {
    const nextErrors = {};
    let hasError = false;
    items.forEach((item) => {
      const errs = [];
      if (!item.name.trim()) errs.push("Name is required.");
      const amt = parseFloat(item.amount);
      if (isNaN(amt)) errs.push("Amount must be a number.");
      else if (amt === 0) errs.push("Amount cannot be zero.");
      const sm = clamp(parseInt(item.startMonth, 10) || 1, 1, 12);
      const em = clamp(parseInt(item.endMonth, 10) || 12, 1, 12);
      if (sm > em) errs.push("Start month must be ≤ end month.");
      if (errs.length) {
        nextErrors[item.id] = errs;
        hasError = true;
      }
    });
    if (selectedYears.size === 0) {
      nextErrors._years = "Select at least one year.";
      hasError = true;
    }
    setErrors(nextErrors);
    return !hasError;
  };

  const previewTimeline = useMemo(() => {
    return getBackfillPreviewTimeline(
      items,
      { amount: monthlyIncome, startMonth: incomeStartMonth, endMonth: incomeEndMonth },
      { rate: savingsRate, startMonth: savingsStartMonth, endMonth: savingsEndMonth },
    );
  }, [items, monthlyIncome, incomeStartMonth, incomeEndMonth, savingsRate, savingsStartMonth, savingsEndMonth]);

  const handleConfirm = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // 1. Create archived fixed-expense definitions (never reuse active ones)
      const idMap = new Map(); // tempId -> real fixedExpenseId
      for (const item of items) {
        const realId = await StorageService.addArchivedFixedExpense({
          name: item.name.trim(),
          amount: parseFloat(item.amount),
        });
        idMap.set(item.id, realId);
      }

      // 2. If not overwriting, find existing snapshots to skip
      let existingKeys = new Set();
      if (!overwrite) {
        for (const year of selectedYears) {
          const snaps = await StorageService.getSnapshotsForYear(year);
          for (const s of snaps) {
            existingKeys.add(`${s.fixedExpenseId}|${s.year}|${s.month}`);
          }
        }
      }

      // 3. Generate snapshot rows in memory
      const rows = [];
      for (const item of items) {
        const fixedExpenseId = idMap.get(item.id);
        const amt = parseFloat(item.amount);
        const sm = clamp(parseInt(item.startMonth, 10) || 1, 1, 12);
        const em = clamp(parseInt(item.endMonth, 10) || 12, 1, 12);
        for (const year of selectedYears) {
          for (let m = sm; m <= em; m++) {
            const key = `${fixedExpenseId}|${year}|${m}`;
            if (!overwrite && existingKeys.has(key)) continue;
            rows.push({
              fixedExpenseId,
              year,
              month: m,
              amountSnapshot: amt,
              nameSnapshot: item.name.trim(),
            });
          }
        }
      }

      // 4. Save per-month income override if provided
      const incomeVal = parseFloat(monthlyIncome);
      const ism = clamp(incomeStartMonth, 1, 12);
      const iem = clamp(incomeEndMonth, 1, 12);
      if (!isNaN(incomeVal) && incomeVal > 0 && ism <= iem) {
        const existingOverrides = await StorageService.getSetting("yearlyIncomeOverrides", {});
        const updated = { ...existingOverrides };
        for (const y of selectedYears) {
          if (typeof updated[y] === "number") updated[y] = {};
          if (!updated[y] || typeof updated[y] !== "object") updated[y] = {};
          for (let m = ism; m <= iem; m++) updated[y][m] = incomeVal;
        }
        await StorageService.setSetting("yearlyIncomeOverrides", updated);
      }

      // 5. Save per-month savings rate override if provided
      const savingsVal = parseFloat(savingsRate);
      const ssm = clamp(savingsStartMonth, 1, 12);
      const sem = clamp(savingsEndMonth, 1, 12);
      if (!isNaN(savingsVal) && savingsVal >= 0 && ssm <= sem) {
        const existingOverrides = await StorageService.getSetting("yearlySavingsOverrides", {});
        const updated = { ...existingOverrides };
        for (const y of selectedYears) {
          if (typeof updated[y] === "number") updated[y] = {};
          if (!updated[y] || typeof updated[y] !== "object") updated[y] = {};
          for (let m = ssm; m <= sem; m++) updated[y][m] = savingsVal;
        }
        await StorageService.setSetting("yearlySavingsOverrides", updated);
      }

      // 6. Bulk upsert
      if (rows.length > 0) {
        await StorageService.bulkUpsertSnapshots(rows);
      }

      setResultMsg(`Created ${rows.length} snapshot(s) across ${selectedYears.size} year(s).`);
      onComplete?.();
    } catch (err) {
      console.error("Backfill failed:", err);
      setResultMsg(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setItems([{ id: nextId(), name: "", amount: "", startMonth: 1, endMonth: 12 }]);
    setSelectedYears(years.length > 0 ? new Set([years[0]]) : new Set());
    setMonthlyIncome(String(defaultIncome));
    setIncomeStartMonth(1);
    setIncomeEndMonth(12);
    setSavingsRate(String(defaultSavingsRate));
    setSavingsStartMonth(1);
    setSavingsEndMonth(12);
    setOverwrite(false);
    setErrors({});
    setResultMsg("");
    onClose();
  };

  const inputCls = "input-theme px-2 py-1.5 text-sm";
  const btnSecondary =
    "bg-theme-background hover:bg-theme-border text-theme-text text-xs font-medium px-2.5 py-1.5 rounded-theme-small transition-colors border border-theme-border";
  const btnPrimary =
    "bg-theme-primary hover:opacity-90 text-white text-xs font-medium px-3 py-1.5 rounded-theme-small transition-opacity";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Backfill Fixed Expenses"
      className="max-w-3xl w-[92vw] max-h-[90vh] flex flex-col"
    >
      <div className="space-y-4 overflow-y-auto pr-1">
        {/* Year selection */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
              Apply to Years
            </label>
            {years.length > 1 && (
              <button onClick={selectAllYears} className="text-xs text-theme-primary hover:opacity-80">
                Select all
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <label
                key={y}
                className={`flex items-center gap-1 text-xs px-2 py-1 rounded-theme-small border cursor-pointer transition-colors ${
                  selectedYears.has(y)
                    ? "bg-theme-primary/10 border-theme-primary text-theme-primary"
                    : "border-theme-border text-theme-muted hover:text-theme-text"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedYears.has(y)}
                  onChange={() => toggleYear(y)}
                  className="sr-only"
                />
                {y}
              </label>
            ))}
          </div>
          {errors._years && (
            <p className="text-theme-danger text-xs mt-1">{errors._years}</p>
          )}
        </div>

        {/* Monthly income override */}
        <div>
          <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-1.5">
            Monthly Income (optional)
          </label>
          <p className="text-xs text-theme-muted mb-1.5">
            Sets income for the selected months and years. Leave blank to use global income.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              placeholder="e.g. 5000"
              step="0.01"
              className={`${inputCls} w-40`}
            />
            <div className="flex items-center gap-1">
              <select
                value={incomeStartMonth}
                onChange={(e) => setIncomeStartMonth(parseInt(e.target.value, 10))}
                className={`${inputCls} w-14`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <span className="text-theme-muted text-xs">→</span>
              <select
                value={incomeEndMonth}
                onChange={(e) => setIncomeEndMonth(parseInt(e.target.value, 10))}
                className={`${inputCls} w-14`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Savings rate override */}
        <div>
          <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-1.5">
            Auto Savings % (optional)
          </label>
          <p className="text-xs text-theme-muted mb-1.5">
            Sets savings rate for the selected months and years. Leave blank to use global rate.
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              type="number"
              value={savingsRate}
              onChange={(e) => setSavingsRate(e.target.value)}
              placeholder="e.g. 20"
              step="0.1"
              min="0"
              max="100"
              className={`${inputCls} w-28`}
            />
            <div className="flex items-center gap-1">
              <select
                value={savingsStartMonth}
                onChange={(e) => setSavingsStartMonth(parseInt(e.target.value, 10))}
                className={`${inputCls} w-14`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <span className="text-theme-muted text-xs">→</span>
              <select
                value={savingsEndMonth}
                onChange={(e) => setSavingsEndMonth(parseInt(e.target.value, 10))}
                className={`${inputCls} w-14`}
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Fixed expenses list */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
            Fixed Expenses
          </label>
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="bg-theme-background rounded-theme-medium border border-theme-border p-2.5 space-y-2"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                    <input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, { name: e.target.value })}
                      placeholder="Name (e.g. Rent)"
                      className={`${inputCls} flex-1 min-w-[6rem]`}
                    />
                    <input
                      type="number"
                      value={item.amount}
                      onChange={(e) => updateItem(item.id, { amount: e.target.value })}
                      placeholder="Amount"
                      step="0.01"
                      className={`${inputCls} w-24 sm:w-28`}
                    />
                    <div className="flex items-center gap-1">
                      <select
                        value={item.startMonth}
                        onChange={(e) =>
                          updateItem(item.id, { startMonth: parseInt(e.target.value, 10) })
                        }
                        className={`${inputCls} w-14`}
                      >
                        {MONTHS.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                      <span className="text-theme-muted text-xs">→</span>
                      <select
                        value={item.endMonth}
                        onChange={(e) =>
                          updateItem(item.id, { endMonth: parseInt(e.target.value, 10) })
                        }
                        className={`${inputCls} w-14`}
                      >
                        {MONTHS.map((m, i) => (
                          <option key={m} value={i + 1}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {errors[item.id] && (
                    <div className="space-y-0.5">
                      {errors[item.id].map((err, i) => (
                        <p key={i} className="text-theme-danger text-xs">
                          {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                {items.length > 1 && (
                  <button
                    onClick={() => removeItem(item.id)}
                    className="text-theme-danger hover:opacity-80 text-sm leading-none mt-2"
                    aria-label="Remove"
                  >
                    &times;
                  </button>
                )}
              </div>
            </div>
          ))}
          <button onClick={addItem} className={btnSecondary}>
            + Add another
          </button>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-theme-muted mr-1">Quick add:</span>
          {["Rent", "Utilities", "Insurance", "Internet", "Phone"].map((preset) => (
            <button
              key={preset}
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { id: nextId(), name: preset, amount: "", startMonth: 1, endMonth: 12 },
                ])
              }
              className="text-xs px-2 py-0.5 rounded-theme-small bg-theme-primary/10 text-theme-primary hover:bg-theme-primary/20 transition-colors"
            >
              {preset}
            </button>
          ))}
        </div>

        {/* Preview — full financial timeline from engine */}
        {previewTimeline.length > 0 && items.some((i) => i.name.trim()) && (
          <div>
            <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide block mb-1.5">
              Preview
            </label>
            <div className="overflow-x-auto rounded-theme-small border border-theme-border">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-theme-background border-b border-theme-border">
                    <th className="text-left px-2 py-1.5 font-semibold text-theme-muted whitespace-nowrap sticky left-0 bg-theme-background">
                      Name
                    </th>
                    {MONTHS.map((m) => (
                      <th key={m} className="text-center px-1 py-1.5 font-semibold text-theme-muted w-10">
                        {m}
                      </th>
                    ))}
                    <th className="text-right px-2 py-1.5 font-semibold text-theme-muted whitespace-nowrap">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {/* Fixed expense rows */}
                  {items.filter((i) => i.name.trim()).map((item) => {
                    const sm = clamp(parseInt(item.startMonth, 10) || 1, 1, 12);
                    const em = clamp(parseInt(item.endMonth, 10) || 12, 1, 12);
                    const amt = parseFloat(item.amount) || 0;
                    const total = amt * (em - sm + 1);
                    return (
                      <tr key={item.id} className="border-b border-theme-border">
                        <td className="px-2 py-1.5 text-theme-text font-medium whitespace-nowrap sticky left-0 bg-theme-surface">
                          {item.name.trim()}
                        </td>
                        {Array.from({ length: 12 }, (_, m) => (
                          <td
                            key={m}
                            className={`text-center px-1 py-1.5 ${
                              m + 1 >= sm && m + 1 <= em
                                ? "text-theme-text"
                                : "text-theme-muted/40"
                            }`}
                          >
                            {m + 1 >= sm && m + 1 <= em ? formatAmount(amt) : "—"}
                          </td>
                        ))}
                        <td className="text-right px-2 py-1.5 font-semibold text-theme-primary whitespace-nowrap">
                          {formatAmount(total)}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Financial summary rows from engine */}
                  {[
                    {
                      label: "Income",
                      values: previewTimeline.map((t) => t.income),
                      cls: "text-theme-success",
                    },
                    {
                      label: "Auto Savings",
                      values: previewTimeline.map((t) => t.autoSavings),
                      cls: "text-theme-primary",
                    },
                    {
                      label: "Remaining",
                      values: previewTimeline.map((t) => t.remaining),
                      getCls: (val) =>
                        val > 0 ? "text-theme-success" : val < 0 ? "text-theme-danger" : "text-theme-text",
                    },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-theme-border bg-theme-background/50">
                      <td className="px-2 py-1.5 font-semibold whitespace-nowrap sticky left-0 bg-theme-background/50">
                        {row.label}
                      </td>
                      {row.values.map((val, m) => (
                        <td
                          key={m}
                          className={`text-center px-1 py-1.5 ${val !== 0 ? (row.getCls ? row.getCls(val) : row.cls) : "text-theme-muted/40"}`}
                        >
                          {val !== 0 ? formatAmount(val) : "—"}
                        </td>
                      ))}
                      <td className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">
                        {formatAmount(row.values.reduce((s, v) => s + v, 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Overwrite toggle */}
        <label className="flex items-center gap-1.5 text-xs text-theme-text cursor-pointer">
          <input
            type="checkbox"
            checked={overwrite}
            onChange={(e) => setOverwrite(e.target.checked)}
            className="rounded-theme-small"
          />
          Overwrite existing snapshots for same month/year
        </label>

        {resultMsg && (
          <p
            className={`text-xs ${
              resultMsg.startsWith("Error") ? "text-theme-danger" : "text-theme-success"
            }`}
          >
            {resultMsg}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-theme-border mt-3">
        <button onClick={handleClose} className={btnSecondary} disabled={saving}>
          Cancel
        </button>
        <button onClick={handleConfirm} className={btnPrimary} disabled={saving}>
          {saving ? "Saving…" : "Confirm Backfill"}
        </button>
      </div>
    </Modal>
  );
}
