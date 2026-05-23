import { defineConfig, devices } from "@playwright/test";
import { loadDotEnvFile } from "./e2e/loadDotEnvFile";

loadDotEnvFile(".env.uat");

const uatPort = Number(process.env.E2E_UAT_PORT ?? "4178");
const baseURL = process.env.E2E_UAT_BASE_URL ?? `http://127.0.0.1:${uatPort}`;

const requiredEnv = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  // Keep this non-fatal so users can still run config-level checks without secrets.
  console.warn(`[playwright.uat] Missing env vars: ${missingEnv.join(", ")}`);
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: /sync-live-supabase\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  timeout: 90000,
  expect: { timeout: 15000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-live-sync",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: process.env.E2E_UAT_BASE_URL
      ? undefined
      : {
          command: `npm run dev -- --mode uat --host 127.0.0.1 --port ${uatPort}`,
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 90000,
        },
});
