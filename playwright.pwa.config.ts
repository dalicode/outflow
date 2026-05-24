import { defineConfig, devices } from '@playwright/test'

const PWA_E2E_PORT = process.env.PWA_E2E_PORT ?? '4173'

export default defineConfig({
  testDir: './e2e',
  testMatch: /pwa-update\.spec\.ts$/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: `http://localhost:${PWA_E2E_PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium-pwa',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: 'npm run e2e:pwa:server',
    url: `http://localhost:${PWA_E2E_PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
