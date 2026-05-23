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
npm run typecheck # must pass before finishing
npm run build    # must pass before finishing
npx vitest run   # must pass before finishing
npm run dev      # localhost:5173
```

## Delegation Preference

When the user explicitly says `IMPLEMENT PLAN` or otherwise clearly asks to implement an already-written plan, treat that as an explicit delegation request:
- Use the `codebase-cleanup-delegator` skill
- Delegate implementation to a `gpt-5.3-codex` worker first unless the user asks for a different model
- Keep the main thread responsible for review, preserving unrelated worktree changes, and running required verification before reporting completion

## Architecture Decisions

### Financial Data Flow

All financial calculations live in `src/utils/financeEngine.ts` (pure, no side effects). UI components fetch data, build a `FinanceEngineData` bag, and call engine functions.

### Monthly Value Resolution Order

For income and savings rate per month:

```
1. Snapshot (month-specific saved value) ← highest priority
2. Active schedule (future projection, pre-materialization)
3. Global setting (monthlyIncome / savingsRate)
```

### Snapshot System

There are three snapshot tables:

| Table | Stores | Created By |
|-------|--------|------------|
| `fixedExpenseSnapshots` | Per-expense, per-month saved amounts | Edit historical data; schedule materialization; monthly rollover |
| `incomeSnapshots` | Per-month saved income | User saves past-month income; edit historical data; schedule materialization; monthly rollover |
| `savingsSnapshots` | Per-month saved savings rate | User saves past-month savings; edit historical data; schedule materialization; monthly rollover |

Snapshots are month-specific saved values. They take precedence over live globals for that month, but users can update them later to correct past data.

### Schedule System

Schedules (`schedules` table) automate future changes to income, savings rate, and fixed expenses.

| Phase | Condition | DB State | Behavior |
|-------|-----------|----------|----------|
| Upcoming | Effective date > current month | `isActive: 1` | Editable. `applySchedules()` projects value. |
| Current | Effective date == current month | `isActive: 1` | Materialized on app startup → snapshot written, global updated, schedule archived. |
| Archived | Effective date < current month | `isActive: 0` | Read-only. Value is stored in that month’s snapshot/global materialization result. |

> **IndexedDB cannot index booleans.** `isActive` is stored as `1`/`0` (number), not `true`/`false` (boolean). Dexie queries like `.where('isActive').equals(1)` work; `.equals(true)` throws `DataError: The parameter is not a valid key`.

`StorageService.materializePendingSnapshots()` runs once on app startup (called in `App.tsx`). It iterates all active schedules, writes month-specific snapshot rows where needed, updates live global settings/definitions, and archives the schedule (`isActive: 0`).

### Edit Historical Data

The edit historical data modal (`EditHistoricalDataModal`) lets users batch-configure past years:
- Per-year income/savings ranges (e.g. Jan-Mar: $5000, Apr-Dec: $5500)
- Per-year fixed expense definitions
- **Replace** mode: clears all snapshots for year, writes new ones
- **Merge** mode: upserts snapshots for months in edit range, leaves others untouched

Edit historical data only writes **snapshots** (not the old `yearlyIncomeOverrides` / `yearlySavingsOverrides` settings, which have been removed).

**Fixed expense display:**
Edit Historical Data only shows fixed expenses that have **actual snapshots** for the selected year. No global definition data is used. If a year has no fixed expense snapshots, no fixed expenses appear in that year's tab.

**Editable month range:**
- Past years: Jan → Dec (full year)
- Current year: Jan → (current month − 1) (current month is excluded)
- If current year has 0 editable months (e.g., January), the year tab is hidden entirely

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
- `fixedExpenseSnapshots` table = month-specific saved amounts
- `isArchived: true` = excluded from current/future budgets, but existing snapshots remain

## Critical File Map

| File | Purpose |
|------|---------|
| `src/utils/financeEngine.ts` | Pure financial engine: `getMonthlyFinancialSummary`, `getYearFinancialSummary`, `getYearVariableGrid`, `getEditHistoricalDataPreviewTimeline`, `applySchedules`, `resolveMonthlyValues` |
| `src/services/storageService.ts` | Dexie DB layer, all CRUD, snapshot helpers, schedule materialization, export/import |
| `src/types/index.ts` | Domain types: `Expense`, `FixedExpense`, `FixedExpenseSnapshot`, `IncomeSnapshot`, `SavingsSnapshot`, `Schedule`, `FinanceEngineData`, etc. |
| `src/context/settingsContext.tsx` | Theme, currency formatting, settings persistence |
| `src/context/authContext.tsx` | Optional Supabase auth |
| `src/hooks/useLocalData.ts` | `useExpenses`, `useCategories` hooks |
| `src/features/summary/SummaryPage.tsx` | Monthly budget view: income form, savings form, fixed expenses, pie chart with click breakdown |
| `src/features/analytics/AnalyticsPage.tsx` | Year analytics: summary strip, charts, data table |
| `src/features/dashboard/Dashboard.tsx` | Month-by-month expense tracker with financial summary |
| `src/features/settings/SettingsPage.tsx` | Settings: theme, currency, edit historical data trigger, schedule list (active + archived) |
| `src/features/settings/EditHistoricalDataModal.tsx` | Multi-year historical data config modal |
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

### Conditional className Composition

Use the `cn()` utility (`src/utils/cn.ts`) — a thin wrapper around `clsx` + `tailwind-merge` — for all conditional className strings:

```tsx
import { cn } from "../../utils/cn";

// ✅ Good
className={cn(
  "flex items-center rounded-lg transition-colors",
  isActive
    ? "bg-theme-primary/5 text-theme-primary font-semibold"
    : "text-theme-muted hover:text-theme-text hover:bg-theme-background",
  collapsed && "justify-center"
)}

// ❌ Avoid template-literal concatenation
className={`flex items-center rounded-lg ${isActive ? "bg-theme-primary" : ""}`}
```

### Hybrid CSS Organization

We use a **hybrid approach** — Tailwind utility classes for one-offs, CSS classes for reusable patterns:

| Approach | Location | Use When |
|----------|----------|----------|
| **Tailwind inline** | JSX `className` | One-off styling, layout, spacing |
| **Global CSS class** | `src/styles/themes.css` | Pattern used by **3+ features** (e.g. `.btn-primary-sm`, `.table-header-cell`) |
| **Feature CSS class** | `src/features/{name}/{name}.css` | Pattern used by **1–2 features** only (e.g. `.category-chip`, `.analytics-tab`) |

Import feature CSS in the feature's entry component:

```tsx
// src/features/dashboard/Dashboard.tsx
import "./dashboard.css";
```

**Rules:**
- Do **not** create wrapper React components purely for styling (e.g. no `<PrimaryButton>` — use `.btn-primary-sm` or inline Tailwind).
- Do **not** use `@apply` in feature CSS files — write plain CSS.
- Global primitives in `themes.css` may use `@apply` if they bundle many Tailwind utilities.

### Tailwind vs. Custom CSS Classes

Many of our theme tokens (e.g. `bg-theme-surface`, `text-theme-primary`, `border-theme-border`) are **custom CSS classes** defined in `src/styles/themes.css` — they are **not** generated by Tailwind.

**Critical rule:** Tailwind responsive prefixes (`sm:`, `md:`, `lg:`, etc.) and modifiers (`hover:`, `focus:`, `dark:`) **only work on Tailwind utilities**. They do **not** work on custom CSS classes.

```tsx
// ❌ WRONG — sm:border-theme-border will NOT be generated by Tailwind
className="sm:border sm:border-theme-border"

// ✅ CORRECT — use the custom class directly; control the width with Tailwind
className="sm:border border-theme-border"
```

If you need a responsive or conditional version of a custom class, handle it with `cn()` / `clsx()` and a ternary or boolean:

```tsx
// ✅ CORRECT — conditional application of a custom class
className={cn(
  "border border-theme-border",
  isLarge ? "sm:max-w-3xl" : "sm:max-w-md"
)}
```

> **Remember:** If a class name does not appear in the Tailwind documentation, it is a custom class. You cannot prefix it with `sm:`, `hover:`, `dark:`, etc.

### Modal Component (`src/components/ui/Modal.tsx`)

All modals go through the shared `Modal` component. No inline modal markup.

```tsx
import Modal from "../../components/ui/Modal";

<Modal
  isOpen={boolean}
  onClose={() => void}          // called on backdrop click, ×, Escape, native back
  title="Edit Income"           // renders header on both desktop and mobile
  size="md"                    // sm | md | lg | xl | full  (default md)
>
  {children}
</Modal>
```

**Desktop (≥640px):**
- Backdrop dim `bg-black/40`, centered card
- Percentage width with max cap per `size`
- `×` close button in top-right

**Mobile (<640px):**
- `sm`, `md`, `lg`: centered card with backdrop dim (same as desktop but narrower)
- `xl`, `full`: **full-screen page** with header bar (`← Back`, title, `Cancel`), no backdrop

**Interaction:**
- Click backdrop → close
- Press `Escape` → close
- Native back button → close (via `history.pushState` / `popstate`)

**Size mapping:**

| size | Desktop width | Cap | Mobile behavior |
|------|---------------|-----|-----------------|
| `sm` | `w-[85vw]` | `max-w-sm` (384px) | Card |
| `md` | `w-[90vw]` | `max-w-md` (448px) | Card |
| `lg` | `w-[90vw]` | `max-w-lg` (512px) | Card |
| `xl` | `w-[92vw]` | `max-w-xl` (576px) | **Full-screen** |
| `full` | `w-[95vw]` | `max-w-3xl` (768px) | **Full-screen** |

## Testing Conventions

### Test Runner

- **Vitest** with `@testing-library/react` and `happy-dom`
- Run all tests: `npx vitest run`
- Watch mode: `npx vitest`

### What to test

| Category | When to add tests | Example |
|----------|-------------------|---------|
| **Pure utilities** | Always | `financeEngine.ts`, `historicalDataHelpers.ts`, `cn.ts` |
| **Reusable components** | Always | `Modal`, `Card`, `Navbar` |
| **Feature pages** | For complex user flows | `EditHistoricalDataModal` range partition logic |
| **CSS-only changes** | Optional / visual regression | Hover effects, scrollbar behavior |

### Rules

1. **Extract pure logic from components** into `src/utils/*.ts` files so it can be unit-tested without React/DOM setup. Example: `historicalDataHelpers.ts` contains all range manipulation logic extracted from `EditHistoricalDataModal.tsx`.
2. **Test behavior, not markup** — use `screen.getByRole`, `getByLabelText`, `getByText` instead of querying CSS classes or DOM structure.
3. **Mock browser APIs** (e.g., `history.pushState`, `window.addEventListener`) with `vi.fn()` or `vi.useFakeTimers()`.
4. **Test files live next to source** in `src/__tests__/*.test.{ts,tsx}`.
5. **Naming**: `describe('ComponentName', () => { it('does something', () => {}) })`.
6. **Coverage targets**: 100% of exported utility functions; key component interactions (open/close, click handlers, keyboard events).

### Example test structure

```ts
// src/__tests__/historicalDataHelpers.test.ts
import { describe, it, expect } from 'vitest'
import { findGapToFill, isFullyCovered } from '../utils/historicalDataHelpers'

describe('findGapToFill', () => {
  it('fills front gap first', () => {
    const ranges = [{ id: 'a', amount: '100', startMonth: 4, endMonth: 12 }]
    expect(findGapToFill(ranges, 12)).toEqual({ startMonth: 1, endMonth: 3 })
  })
})
```

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

## Dashboard Multi-Month View

The Dashboard supports month spans: **1M | 2M | 3M | 6M | 12M**. Larger spans are **viewport-gated** (thresholds assume the Total column is visible — the widest possible table state):

| Max Available | Min Viewport | Rationale |
|---------------|-------------|-----------|
| 3M | < 1280px | Fits on tablets and smaller laptops |
| 6M | ≥ 1280px | Fits on standard laptops (13–15") |
| 12M | ≥ 1920px | Fits on large / ultra-wide monitors |

When the window is resized below the threshold for the current span, it **auto-downgrades** to the largest available span.

**Container widths:**
- `1M–3M`: main `max-w-7xl`, card `md:max-w-3xl`
- `6M`: main `max-w-7xl`, card `md:max-w-6xl`
- `12M`: main `max-w-none` (full viewport), card `md:max-w-none`

Month columns display **chronologically** (oldest → newest, left → right) even though `monthKeys` is stored `[current, prev1, prev2, …]` internally.

## What To Do Next

If starting a new session:

1. Read this file first
2. Run `npm run build` and `npx vitest run` to verify state
3. Check `src/utils/financeEngine.ts` for any financial logic changes
4. Check `src/services/storageService.ts` for any DB/schema changes
5. Check `src/types/index.ts` for type changes
