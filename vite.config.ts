import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

type FakeRow = Record<string, unknown>;
type FakeCloudByUser = Map<string, Map<string, FakeRow[]>>;
const fakeCloudByUser: FakeCloudByUser = new Map();

function getUserTableRows(userId: string, table: string): FakeRow[] {
  const userTables = fakeCloudByUser.get(userId) ?? new Map<string, FakeRow[]>();
  if (!fakeCloudByUser.has(userId)) fakeCloudByUser.set(userId, userTables);
  const rows = userTables.get(table) ?? [];
  if (!userTables.has(table)) userTables.set(table, rows);
  return rows;
}

function toComparable(value: unknown): string {
  return value == null ? "" : String(value);
}

function applyEqFilters(rows: FakeRow[], filters: Array<{ column: string; value: unknown }>): FakeRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((filter) => toComparable(row[filter.column]) === toComparable(filter.value)),
  );
}

function applyInFilters(
  rows: FakeRow[],
  filters: Array<{ column: string; values: unknown[] }>,
): FakeRow[] {
  if (filters.length === 0) return rows;
  return rows.filter((row) =>
    filters.every((filter) => {
      const rowValue = toComparable(row[filter.column]);
      return filter.values.some((value) => toComparable(value) === rowValue);
    }),
  );
}

function applyOrder(rows: FakeRow[], orderBy?: { column: string; ascending: boolean }): FakeRow[] {
  if (!orderBy) return rows;
  const direction = orderBy.ascending ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = toComparable(a[orderBy.column]);
    const right = toComparable(b[orderBy.column]);
    if (left < right) return -1 * direction;
    if (left > right) return 1 * direction;
    return 0;
  });
}

function applyRange(rows: FakeRow[], range?: { from: number; to: number }): FakeRow[] {
  if (!range) return rows;
  return rows.slice(range.from, range.to + 1);
}

function parseConflictColumns(onConflict?: string): string[] {
  if (!onConflict) return ["id"];
  return onConflict
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);
}

function upsertRows(tableRows: FakeRow[], rows: FakeRow[], onConflict?: string): void {
  const conflictColumns = parseConflictColumns(onConflict);
  for (const row of rows) {
    const conflictValues = conflictColumns.map((column) => toComparable(row[column]));
    const existingIndex = tableRows.findIndex((existing) =>
      conflictColumns.every((column, index) => toComparable(existing[column]) === conflictValues[index]),
    );
    if (existingIndex >= 0) {
      tableRows[existingIndex] = { ...tableRows[existingIndex], ...row };
    } else {
      tableRows.push({ ...row });
    }
  }
}

export default defineConfig({
  server: {
    middlewareMode: false,
  },
  plugins: [
    {
      name: "outflow-fake-supabase-dev-endpoint",
      configureServer(server) {
        server.middlewares.use("/__fake_supabase__", async (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end("Method not allowed");
            return;
          }

          let body = "";
          await new Promise<void>((resolve) => {
            req.on("data", (chunk) => {
              body += String(chunk);
            });
            req.on("end", () => resolve());
          });

          const payload = JSON.parse(body) as {
            table: string;
            operation: "select" | "upsert" | "delete" | "reset" | "seed" | "inspect";
            selectOptions?: { count?: "exact"; head?: boolean };
            eqFilters?: Array<{ column: string; value: unknown }>;
            inFilters?: Array<{ column: string; values: unknown[] }>;
            orderBy?: { column: string; ascending: boolean };
            range?: { from: number; to: number };
            upsertRows?: FakeRow[];
            onConflict?: string;
          };

          try {
            if (payload.operation === "reset") {
              fakeCloudByUser.clear();
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ data: null, error: null }));
              return;
            }

            const filters = payload.eqFilters ?? [];
            const inFilters = payload.inFilters ?? [];
            const userIdFilter = filters.find((filter) => filter.column === "user_id");
            const userId = userIdFilter ? toComparable(userIdFilter.value) : "";
            const rows = userId ? getUserTableRows(userId, payload.table) : [];

            if (payload.operation === "upsert" || payload.operation === "seed") {
              const inputRows = payload.upsertRows ?? [];
              const rowsByUser = new Map<string, FakeRow[]>();
              for (const row of inputRows) {
                const rowUserId = toComparable(row.user_id);
                if (!rowUserId) continue;
                const bucket = rowsByUser.get(rowUserId) ?? [];
                bucket.push(row);
                rowsByUser.set(rowUserId, bucket);
              }
              for (const [rowUserId, userRows] of rowsByUser.entries()) {
                const targetRows = getUserTableRows(rowUserId, payload.table);
                upsertRows(targetRows, userRows, payload.onConflict);
              }
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ data: inputRows, error: null }));
              return;
            }

            if (payload.operation === "delete") {
              const before = rows.length;
              const matches = applyEqFilters(rows, filters);
              const matchIds = new Set(matches.map((row) => JSON.stringify(row)));
              const kept = rows.filter((row) => !matchIds.has(JSON.stringify(row)));
              rows.length = 0;
              rows.push(...kept);
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ data: [], error: null, count: before - rows.length }));
              return;
            }

            if (payload.operation === "select" || payload.operation === "inspect") {
              const filtered = applyInFilters(applyEqFilters(rows, filters), inFilters);
              const ordered = applyOrder(filtered, payload.orderBy);
              const ranged = applyRange(ordered, payload.range);
              const isHead = payload.selectOptions?.head === true;
              const count = payload.selectOptions?.count === "exact" ? filtered.length : null;
              res.setHeader("content-type", "application/json");
              res.end(JSON.stringify({ data: isHead ? null : ranged, error: null, count }));
              return;
            }

            res.statusCode = 400;
            res.end(JSON.stringify({ data: null, error: { message: "Unknown operation" } }));
          } catch (error) {
            res.statusCode = 500;
            res.setHeader("content-type", "application/json");
            const message = error instanceof Error ? error.message : "Unknown fake supabase error";
            res.end(JSON.stringify({ data: null, error: { message } }));
          }
        });
      },
    },
    react(),
    VitePWA({
      injectRegister: false,
      registerType: "prompt",
      includeAssets: [
        "outflow-wordmark.svg",
        "apple-touch-icon.png",
      ],
      manifest: {
        id: "/",
        name: "Outflow",
        short_name: "Outflow",
        description:
          "A calm, local-first spending tracker for mindful manual expense tracking.",
        theme_color: "#0d111a",
        background_color: "#0d111a",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        globPatterns: ["**/*.{js,css,html,ico,png,webp,json,woff2}"],
        navigateFallback: "/index.html",
        runtimeCaching: [],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  preview: {
    allowedHosts: ["mortally-unless-reentry.ngrok-free.dev"],
  },
});
