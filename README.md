# Outflow

A personal expense tracker that runs entirely in the browser. Data is stored in IndexedDB (via Dexie) and persists across page refreshes.

## Tech Stack

- **React 18** — UI with hooks
- **Dexie 4** — IndexedDB wrapper for local persistence
- **Tailwind CSS 3** — utility-first styling
- **Vite 6** — dev server and build tool

## File Structure

```
src/
  StorageService.js   # Dexie DB: getAll, add, update, remove
  ExpenseForm.jsx     # Modal form for adding expenses
  ExpenseTable.jsx    # Data grid with inline edit and delete
  App.jsx             # Root: wires state, filter, monthly summary
  main.jsx            # React entry point
  index.css           # Tailwind directives
```

## Features

- Add expenses via a **+** button (modal form)
- Fields: Date, Category, Description, Amount
- Input validation (amount required and positive)
- Inline edit any row — click **Edit**, change values, click **Save**
- Delete any row
- Total spending shown above the table
- Filter by category (pill buttons)
- Monthly summary cards (newest month first)
- Data persists after page refresh (IndexedDB)

## Run Locally

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```
