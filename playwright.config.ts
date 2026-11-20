import { defineConfig, devices } from '@playwright/test';
import process from 'node:process';

const PORT = 4173;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npx vite build && npm run preview -- --host 127.0.0.1 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.e2e\.ts/,
    },
    // Playwright's Firefox build cannot launch on this macOS version; CI runs it.
    ...(process.env.CI
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            testIgnore: /mobile\.e2e\.ts/,
          },
        ]
      : []),
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      testIgnore: /mobile\.e2e\.ts/,
    },
    { name: 'mobile', use: { ...devices['Pixel 5'] }, testMatch: /mobile\.e2e\.ts/ },
  ],
});
