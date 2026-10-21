import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5175",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
      args: ["--no-sandbox"],
    },
  },
  projects: [
    {
      name: "desktop",
      testMatch: "app.spec.ts",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile",
      testMatch: "app.spec.ts",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "accounts-desktop",
      testMatch: "accounts.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:5176",
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: "accounts-mobile",
      testMatch: "accounts.spec.ts",
      use: {
        baseURL: "http://127.0.0.1:5176",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: [
    {
      command: "npm run dev -- --port 5175",
      env: {
        VITE_SUPABASE_URL: "",
        VITE_SUPABASE_PUBLISHABLE_KEY: "",
        VITE_SUPABASE_ANON_KEY: "",
      },
      url: "http://127.0.0.1:5175",
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -- --port 5176",
      url: "http://127.0.0.1:5176",
      reuseExistingServer: false,
      env: {
        VITE_SUPABASE_URL: "https://nutria-auth-test.supabase.co",
        VITE_SUPABASE_PUBLISHABLE_KEY: "public-test-key",
        VITE_SUPABASE_ANON_KEY: "",
      },
    },
  ],
});
