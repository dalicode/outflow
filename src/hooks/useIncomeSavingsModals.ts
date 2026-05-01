import { useState } from "react";
import { StorageService } from "../services/storageService";
import { INCOME_FREQUENCIES, INCOME_MULTIPLIERS } from "../features/dashboard/constants";
import type { MonthlySummary } from "../types";

export function useIncomeSavingsModals(
  monthSummaries: MonthlySummary[],
  monthKeys: Array<{ year: number; month: number; name: string }>,
  onSaved: () => void,
) {
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [incomeDraft, setIncomeDraft] = useState("");
  const [incomeFreqDraft, setIncomeFreqDraft] = useState("monthly");
  const [incomeError, setIncomeError] = useState("");

  const [isSavingsModalOpen, setIsSavingsModalOpen] = useState(false);
  const [savingsDraft, setSavingsDraft] = useState("");
  const [savingsError, setSavingsError] = useState("");

  const [modalTargetMonthIndex, setModalTargetMonthIndex] = useState(0);

  const openIncomeModal = (monthIndex: number = 0) => {
    setModalTargetMonthIndex(monthIndex);
    setIncomeDraft("");
    setIncomeFreqDraft("monthly");
    setIncomeError("");
    setIsIncomeModalOpen(true);
  };

  const closeIncomeModal = () => {
    setIsIncomeModalOpen(false);
    setIncomeError("");
  };

  const submitIncome = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(incomeDraft);
    if (!incomeDraft || isNaN(parsed) || parsed <= 0) {
      setIncomeError("Enter a positive amount.");
      return;
    }
    setIncomeError("");
    persistIncomeChange(
      {
        income: parsed,
        frequency: incomeFreqDraft,
        monthlyIncome: parsed * INCOME_MULTIPLIERS[incomeFreqDraft],
      },
      modalTargetMonthIndex,
    );
    setIsIncomeModalOpen(false);
  };

  const openSavingsModal = (monthIndex: number = 0) => {
    const summary = monthSummaries[monthIndex];
    setModalTargetMonthIndex(monthIndex);
    setSavingsDraft(String(summary?.savingsRate ?? 0));
    setSavingsError("");
    setIsSavingsModalOpen(true);
  };

  const closeSavingsModal = () => {
    setIsSavingsModalOpen(false);
    setSavingsError("");
  };

  const submitSavings = (e: React.FormEvent) => {
    e.preventDefault();
    const n = Number(savingsDraft);
    if (isNaN(n) || n < 0 || n > 100) {
      setSavingsError("Enter a value between 0 and 100.");
      return;
    }
    setSavingsError("");
    persistSavingsRateChange(n, modalTargetMonthIndex);
    setIsSavingsModalOpen(false);
  };

  const persistIncomeChange = async (
    {
      income,
      frequency,
      monthlyIncome,
    }: {
      income: number;
      frequency: string;
      monthlyIncome: number;
    },
    monthIndex: number = 0,
  ) => {
    const mk = monthKeys[monthIndex];
    await StorageService.setIncomeSnapshot(
      mk.year,
      mk.month + 1,
      monthlyIncome,
    );
    const now = new Date();
    const isCurrentOrFuture =
      mk.year > now.getFullYear() ||
      (mk.year === now.getFullYear() && mk.month >= now.getMonth());
    if (isCurrentOrFuture) {
      await Promise.all([
        StorageService.setSetting("incomeAmount", income),
        StorageService.setSetting("incomeFrequency", frequency),
        StorageService.setSetting("monthlyIncome", monthlyIncome),
      ]);
    }
    onSaved();
  };

  const persistSavingsRateChange = async (
    rate: number,
    monthIndex: number = 0,
  ) => {
    const mk = monthKeys[monthIndex];
    await StorageService.setSavingsSnapshot(mk.year, mk.month + 1, rate);
    const now = new Date();
    const isCurrentOrFuture =
      mk.year > now.getFullYear() ||
      (mk.year === now.getFullYear() && mk.month >= now.getMonth());
    if (isCurrentOrFuture) {
      await StorageService.setSetting("savingsRate", rate);
    }
    onSaved();
  };

  return {
    isIncomeModalOpen,
    isSavingsModalOpen,
    incomeDraft,
    incomeFreqDraft,
    incomeError,
    savingsDraft,
    savingsError,
    modalTargetMonthIndex,
    openIncomeModal,
    closeIncomeModal,
    submitIncome,
    openSavingsModal,
    closeSavingsModal,
    submitSavings,
    setIncomeDraft,
    setIncomeFreqDraft,
    setSavingsDraft,
    INCOME_FREQUENCIES,
  };
}
