import { defineConfig, devices } from "@playwright/test";

const configuredPlaywrightPort = process.env.PLAYWRIGHT_PORT ?? "3000";
const parsedPlaywrightPort = Number(configuredPlaywrightPort);
const playwrightPort =
  /^\d+$/.test(configuredPlaywrightPort) &&
  Number.isInteger(parsedPlaywrightPort) &&
  parsedPlaywrightPort > 0 &&
  parsedPlaywrightPort <= 65_535
    ? configuredPlaywrightPort
    : "3000";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${playwrightPort}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run dev -- --hostname 127.0.0.1 --port ${playwrightPort}`,
    url: `http://127.0.0.1:${playwrightPort}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
