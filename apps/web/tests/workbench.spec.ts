import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { LiveMarketPayload, ModelProviderChoice, WorkbenchFixture } from "../src/lib/workbenchTypes";

const testDir = fileURLToPath(new URL(".", import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(testDir, "../src/fixtures/paquant-demo.json"), "utf-8")
) as WorkbenchFixture;

const modelProviders: ModelProviderChoice[] = [
  {
    id: "deepseek",
    name: "DeepSeek",
    model: "deepseek-chat",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    available: true,
    capabilities: {
      text: true,
      vision: false,
      structured_output: true,
      tool_calling: true,
      context_window: 64000
    }
  }
];

test.beforeEach(async ({ page }) => {
  const lastCandle = fixture.candles.at(-1)!;
  const liveMarket: LiveMarketPayload = {
    source: {
      id: "playwright_xauusd_5m_contract",
      label: "Playwright non-mock XAUUSD 5m contract feed",
      instrumentSymbol: "XAUUSD",
      instrumentKind: "spot_history",
      isSpot: true,
      isMock: false,
      historyCompleteness: "historical_5m",
      latency: "local_contract"
    },
    quote: {
      symbol: "XAUUSD",
      price: lastCandle.close,
      bid: Number((lastCandle.close - 0.35).toFixed(2)),
      ask: Number((lastCandle.close + 0.35).toFixed(2)),
      timestamp: lastCandle.timestamp,
      providerSymbol: "XAUUSD"
    },
    candles: fixture.candles
  };

  await page.route("**/api/market/xau/live", async (route) => {
    await route.fulfill({ status: 200, json: liveMarket });
  });
  await page.route("**/api/model-providers", async (route) => {
    await route.fulfill({ status: 200, json: { providers: modelProviders } });
  });
  await page.route("**/api/agent-runs", async (route) => {
    await route.fulfill({
      status: 201,
      json: {
        ...fixture,
        candles: liveMarket.candles,
        analysis: {
          ...fixture.analysis,
          modelUsage: {
            ...fixture.analysis.modelUsage,
            provider: "DeepSeek",
            model: "deepseek-chat"
          }
        },
        meta: {
          ...fixture.meta,
          source: "api",
          modelProvider: "DeepSeek",
          model: "deepseek-chat",
          startedBy: "user",
          agentStatus: "completed",
          dataSource: liveMarket.source,
          quote: liveMarket.quote
        }
      }
    });
  });
});

test("renders the live desktop trading workstation", async ({ page }) => {
  await page.goto("/PAquant/");

  await expect(page.getByRole("heading", { name: /PAquant 黄金交易终端/i })).toBeVisible();
  await expect(page.getByLabel("原生K线图表区")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("AI 交易员执行区")).toBeVisible();
  await expect(page.getByLabel("AI 交易员分析").getByText("等待启动")).toBeVisible();
  await expect(page.getByText(/策略库：\d+ 名 Brooks setup 交易员/)).toBeVisible();
  await expect(page.getByText("实时价格")).toBeVisible();
  await expect(page.getByText("点差")).toBeVisible();
  await expect(page.getByLabel("模型 API")).not.toHaveValue("mock");
  await expect(page.getByTestId("chart-host")).toBeVisible();
  await expect(page.locator(".native-price-chart")).toBeVisible();
  await expect(page.locator(".native-candle").first()).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /1 主界面/i })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /2 AI交易员图谱/i }).click();
  await expect(page.getByLabel("AI交易员图谱")).toBeVisible();
  await expect(page.getByText("始终在场趋势交易员")).toBeVisible();
  await expect(page.getByText("收益曲线")).toBeVisible();
  await page.getByRole("button", { name: /3 价格行为知识库/i }).click();
  await expect(page.getByLabel("阿尔布鲁克斯价格行为学知识库")).toBeVisible();
  await expect(page.getByText("教材目录")).toBeVisible();
  await expect(page.getByText("术语表")).toBeVisible();
  await expect(page.getByLabel("形态图解").first()).toBeVisible();
  await expect(page.getByLabel("形态图解").first().getByText("推动3")).toBeVisible();
  await expect(page.getByText(/Trading Price Action - Trends/i)).toBeVisible();
  await page.getByRole("button", { name: /1 主界面/i }).click();
  await expect(page.getByLabel("原生K线图表区")).toBeVisible();
  const desktopLayout = await page.evaluate(() => {
    const chart = document.querySelector('[aria-label="原生K线图表区"]')?.getBoundingClientRect();
    const ai = document.querySelector('[aria-label="AI 交易员执行区"]')?.getBoundingClientRect();
    const range = document.querySelector(".range-preset-strip")?.getBoundingClientRect();
    const replay = document.querySelector(".replay-controls")?.getBoundingClientRect();
    return {
      bodyScrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      chartLeft: chart?.left ?? 0,
      chartRight: chart?.right ?? 0,
      chartWidth: chart?.width ?? 0,
      aiLeft: ai?.left ?? 0,
      aiWidth: ai?.width ?? 0,
      rangeRight: range?.right ?? 0,
      replayLeft: replay?.left ?? 0
    };
  });
  expect(desktopLayout.bodyScrollHeight).toBeLessThanOrEqual(desktopLayout.viewportHeight + 4);
  expect(desktopLayout.chartWidth).toBeGreaterThan(720);
  expect(desktopLayout.aiWidth).toBeGreaterThan(360);
  expect(desktopLayout.chartLeft).toBeLessThan(desktopLayout.aiLeft);
  expect(desktopLayout.chartRight).toBeLessThanOrEqual(desktopLayout.aiLeft + 2);
  expect(desktopLayout.rangeRight).toBeLessThanOrEqual(desktopLayout.replayLeft - 12);

  const rangeButtons = page.locator(".range-preset-strip button");
  const totalCandles = (await page.locator(".replay-counter").innerText()).match(/\/(\d+)/)?.[1] ?? "";
  await rangeButtons.nth(0).click();
  await expect(page.locator(".window-counter")).toContainText("48");
  await rangeButtons.nth(2).click();
  await expect(page.locator(".window-counter")).toContainText(totalCandles);
  await rangeButtons.nth(3).click();
  await expect(page.locator(".replay-counter")).toContainText(`${totalCandles}/${totalCandles}`);
  const viewportSlider = page.getByLabel("图表视窗滑杆");
  await expect(viewportSlider).toBeVisible();
  const sliderBounds = await viewportSlider.evaluate((element) => {
    const input = element as HTMLInputElement;
    return {
      min: Number(input.min),
      max: Number(input.max),
      value: Number(input.value)
    };
  });
  expect(sliderBounds.max).toBeGreaterThanOrEqual(sliderBounds.min);
  expect(sliderBounds.value).toBe(sliderBounds.max);
  if (sliderBounds.max > sliderBounds.min) {
    const beforeSlideStats = await page.locator(".chart-stats").innerText();
    const targetWindowEnd = Math.floor((sliderBounds.min + sliderBounds.max) / 2);
    await viewportSlider.fill(String(targetWindowEnd));
    await expect(viewportSlider).toHaveValue(String(targetWindowEnd));
    await expect(page.locator(".chart-stats")).not.toHaveText(beforeSlideStats);
    await rangeButtons.nth(3).click();
    await expect(viewportSlider).toHaveValue(String(sliderBounds.max));
  }

  await expect(page.locator(".agent-run-button")).toBeEnabled({ timeout: 15_000 });
  const loadedMarket = await page.evaluate(() => {
    const quotePriceText = document.querySelector(".quote-primary strong")?.textContent?.trim() ?? "";
    const latestCloseStat = document.querySelectorAll(".chart-stats span")[1]?.textContent ?? "";
    const latestCloseText = latestCloseStat.match(/([0-9]+\.[0-9]{2})/)?.[1] ?? "";
    return {
      quotePrice: Number(quotePriceText),
      latestClose: Number(latestCloseText),
      counter: document.querySelector(".replay-counter")?.textContent ?? ""
    };
  });
  expect(loadedMarket.counter).toMatch(/\/\d+/);
  expect(loadedMarket.latestClose).toBeCloseTo(loadedMarket.quotePrice, 2);

  const initialCounter = await page.locator(".replay-counter").innerText();
  await page.locator(".stream-toggle").click();
  await expect(page.locator(".replay-counter")).not.toHaveText(initialCounter);

  await page.locator(".agent-run-button").click();
  await page.waitForFunction(() => {
    const state = document.querySelector(".agent-run-state")?.textContent;
    return state === "已完成" || state === "失败";
  });

  const runState = await page.locator(".agent-run-state").innerText();
  if (runState === "已完成") {
    await expect(page.getByLabel("AI 交易员分析").getByText("布鲁克斯通用交易员")).toBeVisible();
    await expect(page.getByRole("heading", { name: "工具执行" })).toBeVisible();
    await expect(page.locator(".model-api-readout")).toContainText(/模型 API：(?!mock)/i);
    const auditPanel = page.getByLabel("模拟交易审计");
    await expect(auditPanel.getByText("仓位", { exact: true })).toBeVisible();
    await expect(page.getByText(/交易理由/i).first()).toBeVisible();
    const orderHeader = page.locator(".table-head");
    await expect(orderHeader.getByText("入场", { exact: true })).toBeVisible();
    await expect(orderHeader.getByText("止损", { exact: true })).toBeVisible();
    await expect(orderHeader.getByText("止盈", { exact: true })).toBeVisible();
    const chartPanel = page.getByLabel("XAU 5分钟K线图");
    await expect(chartPanel.locator(".native-price-chart .trade-price-line.entry")).toHaveCount(1);
    await expect(chartPanel.locator(".native-price-chart .trade-price-line.stop")).toHaveCount(1);
    await expect(chartPanel.locator(".native-price-chart .trade-price-line.target")).toHaveCount(1);
    const orderLineWidth = await chartPanel
      .locator(".native-price-chart .trade-price-line.entry")
      .evaluate((element) => (element as SVGGraphicsElement).getBBox().width);
    expect(orderLineWidth).toBeGreaterThan(80);
    await expect(chartPanel.locator(".native-price-chart .trade-marker-label.entry")).toContainText(
      /入场 .* 仓位 1/
    );
    await expect(chartPanel.locator(".native-price-chart .trade-marker-label.stop")).toContainText(/止损 .*/);
    await expect(chartPanel.locator(".native-price-chart .trade-marker-label.target")).toContainText(/止盈 .*/);
    const postRunLayout = await page.evaluate(() => {
      const ai = document.querySelector('[aria-label="AI 交易员执行区"]') as HTMLElement | null;
      const quote = document.querySelector(".quote-board")?.getBoundingClientRect();
      const chartStage = document.querySelector(".chart-stage")?.getBoundingClientRect();
      const quotePriceText = document.querySelector(".quote-primary strong")?.textContent?.trim() ?? "";
      const latestCloseStat = document.querySelectorAll(".chart-stats span")[1]?.textContent ?? "";
      const latestCloseText = latestCloseStat.match(/([0-9]+\.[0-9]{2})/)?.[1] ?? "";
      return {
        aiScrollHeight: ai?.scrollHeight ?? 0,
        aiClientHeight: ai?.clientHeight ?? 0,
        quoteHeight: quote?.height ?? 0,
        chartStageHeight: chartStage?.height ?? 0,
        actionRows: document.querySelectorAll(".action-stream li").length,
        bodyScrollHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        quotePrice: Number(quotePriceText),
        latestClose: Number(latestCloseText)
      };
    });
    expect(postRunLayout.bodyScrollHeight).toBeLessThanOrEqual(postRunLayout.viewportHeight + 4);
    expect(postRunLayout.aiScrollHeight).toBeLessThanOrEqual(postRunLayout.aiClientHeight + 8);
    expect(postRunLayout.quoteHeight).toBeGreaterThan(52);
    expect(postRunLayout.quoteHeight).toBeLessThan(72);
    expect(postRunLayout.chartStageHeight).toBeGreaterThan(700);
    expect(postRunLayout.actionRows).toBeGreaterThanOrEqual(3);
    expect(postRunLayout.latestClose).toBeCloseTo(postRunLayout.quotePrice, 2);
  } else {
    await expect(page.locator(".agent-run-error")).toBeVisible();
    await expect(page.locator(".agent-run-error")).not.toContainText("mock");
  }

  await page.screenshot({ path: "test-results/workbench.png", fullPage: true });
});
