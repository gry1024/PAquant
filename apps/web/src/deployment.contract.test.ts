import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

test("CloudBase static preview is deployed under /PAquant/ with matching Vite base", () => {
  const repoRoot = resolve(__dirname, "../../..");
  const cloudbase = JSON.parse(
    readFileSync(resolve(repoRoot, "cloudbaserc.json"), "utf-8")
  ) as { deployPath?: string };
  const viteConfig = readFileSync(resolve(repoRoot, "apps/web/vite.config.ts"), "utf-8");

  expect(cloudbase.deployPath).toBe("/PAquant/");
  expect(viteConfig).toContain('base: "/PAquant/"');
});
