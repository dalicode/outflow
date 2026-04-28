# Outflow — Agent Context

## Overview

Outflow is a personal finance tracking dashboard. Users log expenses, set income/savings targets, define fixed expenses, and view analytics — all running in the browser with IndexedDB persistence.

## Tech Stack

- React 18 + TypeScript (strict mode)
- Vite 6
- Tailwind CSS 3
- Dexie 4 (IndexedDB wrapper)
- Recharts (charts)
- Vitest + Testing Library + happy-dom (tests)
- Supabase (optional sync, not required for local use)

## Build & Test

```bash
npm run build    # must pass before finishing
npx vitest run   # must pass before finishing
npm run dev      # localhost:5173
```

## Architecture Decisions

### Financial Data Flow

All financial calculations live in `src/utils/financeEngine.ts` (pure, no side effects). UI components fetch data, build a `FinanceEngineData` bag, and call engine functions.

### Monthly Value Resolution Order

For income and savings rate per month:

```
1. Snapshot (frozen historical value) ← highest priority
2. Active schedule (future projection, pre-materialization)
3. Global setting (monthlyIncome / savingsRate)
```

### Snapshot System

There are three snapshot tables:

| Table | Stores | Created By |
|-------|--------|------------|
| `fixedExpenseSnapshots` | Per-expense, per-month frozen amounts | User adds/updates fixed expense; backfill; schedule materialization |
| `incomeSnapshots` | Per-month frozen income | User saves income; backfill; schedule materialization |
| `savingsSnapshots` | Per-month frozen savings rate | User saves savings rate; backfill; schedule materialization |

Snapshots are **first-write-wins** (idempotent). Current month is overwritable; past months are frozen.

### Schedule System

Schedules (`schedules` table) automate future changes to income, savings rate, and fixed expenses.

| Phase | Condition | DB State | Behavior |
|-------|-----------|----------|----------|
| Upcoming | Effective date > current month | `isActive: true` | Editable. `applySchedules()` projects value. |
| Current | Effective date == current month | `isActive: true` | Materialized on app startup → snapshot written, global updated, schedule archived. |
| Archived | Effective date < current month | `isActive: false` | Read-only. Value frozen in snapshot. |

`StorageService.materializePendingSnapshots()` runs once on app startup (called in `App.tsx`). It iterates all active schedules, writes snapshots for effective months, updates global settings/definitions, and archives the schedule (`isActive: false`).

### Backfill Historical Data

The backfill modal (`BackfillHistoricalDataModal`) lets users batch-configure past years:
- Per-year income/savings ranges (e.g. Jan-Mar: $5000, Apr-Dec: $5500)
- Per-year fixed expense definitions
- **Replace** mode: clears all snapshots for year, writes new ones
- **Merge** mode: upserts snapshots for months in backfill range, leaves others untouched

Backfill only writes **snapshots** (not the old `yearlyIncomeOverrides` / `yearlySavingsOverrides` settings, which have been removed).

### Encrypted Backup Export/Import

Backups are exported as **`.ofb` files** (Outflow Backup) with the following pipeline:

```
JSON string → gzip (CompressionStream) → AES-256-GCM encryption → envelope
```

Key derivation: PBKDF2 with SHA-256, 100K iterations, 16-byte random salt.  
Envelope format: `{ version: 1, format: "gzip+aes", salt, iv, ciphertext }` (all base64).

**Payload structure (inside the encrypted envelope or plain JSON):**
```json
{
  "meta": {
    "exportedAt": "2026-04-28T16:20:00.000Z",
    "appVersion": "1.0.0",
    "dbVersion": 7,
    "format": "outflow-backup",
    "recordCounts": { "expenses": 342, "categories": 8, ... },
    "userEmail": "user@example.com"
  },
  "data": { "expenses": [...], "categories": [...] }
}
```

- `dbVersion` is checked on import. If backup DB version > current app DB version, a **blocking warning modal** is shown before proceeding.
- Legacy flat-format backups (no `meta`/`data` wrapper) are still supported for backward compatibility.

**Version bumping (package.json):**

The `appVersion` in backup metadata is auto-synced from `package.json`. Bump the version when the backup format changes:

| Change | Bump | Example |
|--------|------|---------|
| New backup field / new table in export | Minor (`1.0.0` → `1.1.0`) | Added `userEmail` to metadata |
| Backup structure change / breaking table schema change | Major (`1.0.0` → `2.0.0`) | Changed from flat JSON to `{ meta, data }` |
| Bug fix, no format change | Patch (`1.0.0` → `1.0.1`) | Fixed export filename |
| Pure UI changes | No bump | Button styling only |

**Auto-password (Supabase users):**
- When logged in, the app checks `profiles.backup_password` in Supabase
- If found → auto-uses it for silent export
- If not found → prompts user with "Remember for future backups" checkbox
- Logged-out users always get the password prompt

**Import backward compatibility:**
- `.ofb` encrypted files → password modal → decrypt → import
- Legacy plain `.json` files → import directly (no password needed)
- Unrecognized format → error

### Fixed Expenses

- `fixedExpenses` table = live definitions
- `fixedExpenseSnapshots` table = frozen historical amounts
- `isArchived: true` = excluded from current/future budgets, but historical snapshots remain

## Critical File Map

| File | Purpose |
|------|---------|
| `src/utils/financeEngine.ts` | Pure financial engine: `getMonthlyFinancialSummary`, `getYearFinancialSummary`, `getYearVariableGrid`, `getBackfillPreviewTimeline`, `applySchedules`, `resolveMonthlyValues` |
| `src/services/storageService.ts` | Dexie DB layer, all CRUD, snapshot helpers, schedule materialization, export/import |
| `src/types/index.ts` | Domain types: `Expense`, `FixedExpense`, `FixedExpenseSnapshot`, `IncomeSnapshot`, `SavingsSnapshot`, `Schedule`, `FinanceEngineData`, etc. |
| `src/context/settingsContext.tsx` | Theme, currency formatting, settings persistence |
| `src/context/authContext.tsx` | Optional Supabase auth |
| `src/hooks/useLocalData.ts` | `useExpenses`, `useCategories` hooks |
| `src/features/summary/SummaryPage.tsx` | Monthly budget view: income form, savings form, fixed expenses, pie chart with click breakdown |
| `src/features/analytics/AnalyticsPage.tsx` | Year analytics: summary strip, charts, data table |
| `src/features/dashboard/Dashboard.tsx` | Month-by-month expense tracker with financial summary |
| `src/features/settings/SettingsPage.tsx` | Settings: theme, currency, backfill trigger, schedule list (active + archived) |
| `src/features/settings/BackfillHistoricalDataModal.tsx` | Multi-year backfill config modal |
| `src/features/settings/ScheduleModal.tsx` | Add/edit schedule modal. Past-effective schedules are read-only. |
| `src/components/charts/ChartComponent.tsx` | Reusable pie chart with `onSliceClick` |
| `src/components/ui/Card.tsx` | 3-variant card system |
| `src/components/layout/Navbar.tsx` | Collapsible sidebar, mobile FAB |

## Coding Conventions

- **Arrow functions** for callbacks, event handlers, inline functions
- **Regular `function` declarations** for exported hooks, providers, top-level sub-components
- **No `@ts-nocheck`** directives
- **No `/` opacity modifiers** on `text-theme-*` or `border-theme-*` — use separate `opacity-*` class
- **Theme tokens only** — no hardcoded colors
- **All params typed**, explicit return types on exported functions
- **No `@ts-nocheck` or `@ts-ignore`** directives anywhere in the codebase

## Database Schema (Dexie v7)

```
expenses: ++id, date, category, categoryId
categories: ++id, name
fixedExpenses: ++id
fixedExpenseSnapshots: ++id, [fixedExpenseId+year+month], year, month
incomeSnapshots: ++id, [year+month], year, month
savingsSnapshots: ++id, [year+month], year, month
schedules: ++id, type, effectiveYear, effectiveMonth, isActive, targetId
settings: key
syncQueue: ++id, table, timestamp
```

## Known Behaviors / Edge Cases

- Recharts tooltips render in a portal where CSS custom properties don't cascade — custom `CustomTooltip` component with explicit hex values is required
- Extension errors ("Federated Credential Management API") in browser console are not app bugs
- IndexedDB name is `Outflow`
- `monthlyIncomeSetAt` and `savingsRateSetAt` settings track when globals were first established
- Past schedules are read-only; to change future values, create a new schedule

## What To Do Next

If starting a new session:

1. Read this file first
2. Run `npm run build` and `npx vitest run` to verify state
3. Check `src/utils/financeEngine.ts` for any financial logic changes
4. Check `src/services/storageService.ts` for any DB/schema changes
5. Check `src/types/index.ts` for type changes
