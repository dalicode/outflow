import type { Schedule, ScheduleMaterializationNotice } from "../types";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getScheduleTypeLabel(type: Schedule["type"]): string {
  if (type === "income") return "Income";
  if (type === "savingsRate") return "Savings rate";
  if (type === "fixedExpense") return "Fixed expense";
  return "Planned expense";
}

export function buildScheduleMaterializationNotice(
  schedule: Schedule,
  options: {
    appliedAt: string;
    label?: string;
    previousValue?: number | null;
  },
): ScheduleMaterializationNotice {
  const monthLabel = `${MONTHS[schedule.effectiveMonth - 1]} ${schedule.effectiveYear}`;
  const label = options.label ?? getScheduleTypeLabel(schedule.type);
  const previousValue = options.previousValue ?? null;
  const valueLabel =
    schedule.type === "savingsRate"
      ? `${formatMoney(schedule.newValue)}%`
      : `$${formatMoney(schedule.newValue)}`;

  let summary = "";
  if (schedule.type === "expense") {
    const dateLabel = schedule.day
      ? `${MONTHS[schedule.effectiveMonth - 1]} ${schedule.day}, ${schedule.effectiveYear}`
      : monthLabel;
    summary =
      label === "Planned expense"
        ? `Planned expense of ${valueLabel} scheduled for ${dateLabel}.`
        : `${label} planned expense of ${valueLabel} scheduled for ${dateLabel}.`;
  } else if (previousValue != null) {
    const previousLabel =
      schedule.type === "savingsRate"
        ? `${formatMoney(previousValue)}%`
        : `$${formatMoney(previousValue)}`;
    summary = `${label} changed from ${previousLabel} to ${valueLabel} starting ${monthLabel}.`;
  } else {
    summary = `${label} set to ${valueLabel} starting ${monthLabel}.`;
  }

  return {
    id: `${schedule.type}-${schedule.id ?? `${schedule.effectiveYear}-${schedule.effectiveMonth}-${schedule.targetId ?? "na"}`}`,
    type: schedule.type,
    title: label,
    summary,
    effectiveYear: schedule.effectiveYear,
    effectiveMonth: schedule.effectiveMonth,
    effectiveLabel: monthLabel,
    previousValue,
    newValue: schedule.newValue,
    appliedAt: options.appliedAt,
  };
}

export function summarizeScheduleMaterializationNotices(
  notices: ScheduleMaterializationNotice[],
): string {
  if (notices.length === 0) return "";
  if (notices.length === 1) return notices[0].summary;
  return `${notices.length} scheduled updates were applied.`;
}
