import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: "list",
  timeout: 30000,
  expect: { timeout: 5000 },
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: [
        /-mobile\.spec\.ts$/,
        /pwa-update\.spec\.ts$/,
        /sync-live-supabase\.spec\.ts$/,
      ],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile",
      testMatch: /-mobile\.spec\.ts$/,
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 393, height: 851 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
  webServer: {
    command: "VITE_E2E_FAKE_SUPABASE=1 npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
