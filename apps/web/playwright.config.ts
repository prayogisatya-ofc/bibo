import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60000,
  retries: 0,
  // Serial: tiap file berbagi satu bridge/mock (sesi tunggal per bridge).
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    launchOptions: {
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    },
  },
});
