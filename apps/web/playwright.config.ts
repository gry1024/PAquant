import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command:
        "uv run uvicorn paquant.api.app:create_app --factory --app-dir ../../services/api --host 127.0.0.1 --port 8000",
      url: "http://127.0.0.1:8000/healthz",
      reuseExistingServer: false,
      env: {
        PAQUANT_DB_PATH: "../../tmp/playwright-paquant.sqlite3"
      }
    },
    {
      command: "pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 920 } }
    }
  ]
});
