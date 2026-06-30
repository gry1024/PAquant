import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const styles = readFileSync("src/styles.css", "utf-8");
const chartPanelSource = readFileSync("src/components/ChartPanel.tsx", "utf-8");
const workbenchSource = readFileSync("src/components/Workbench.tsx", "utf-8");

test("workstation theme is white, product-navigation first, and trading-chart focused", () => {
  expect(styles).toMatch(/--shell:\s*#f6f8fb;/);
  expect(styles).toMatch(/--panel:\s*#ffffff;/);
  expect(styles).toMatch(/\.native-chart-host\s*\{[^}]*background:\s*#ffffff;/s);
  expect(styles).toMatch(/\.native-price-chart/);
  expect(styles).toMatch(/\.native-price-chart \.trade-price-line/);
  expect(styles).toMatch(/\.app-rail/);
  expect(styles).toMatch(/\.nav-button/);
  expect(styles).toMatch(/\.product-view/);
  expect(styles).toMatch(/\.trader-atlas-view/);
  expect(styles).toMatch(/\.knowledge-base-view/);
  expect(styles).not.toMatch(/\.tool-rail\s*\{/);
  expect(chartPanelSource).toContain("NativePriceChart");
  expect(chartPanelSource).toContain("native-chart-host");
  expect(chartPanelSource).not.toMatch(/lightweight-charts|createChart|<canvas/i);
  expect(workbenchSource).toContain('aria-label="原生K线图表区"');
});
