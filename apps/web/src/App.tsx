import { Workbench } from "./components/Workbench";
import { fallbackTraderProfiles, loadTraderProfiles } from "./lib/traderProfiles";
import {
  fallbackModelProviders,
  loadLiveMarketPayload,
  loadModelProviders,
  loadWorkbenchFixture,
  startAgentRun
} from "./lib/workbenchData";
import type {
  Candle,
  LiveMarketPayload,
  LiveMarketQuote,
  ModelProviderChoice,
  TraderProfile,
  WorkbenchFixture
} from "./lib/workbenchTypes";
import { useEffect, useState } from "react";

const DEFAULT_VISIBLE_SPREAD = 0.7;

export default function App() {
  const [workbenchFixture, setWorkbenchFixture] = useState<WorkbenchFixture | null>(null);
  const [marketLoadError, setMarketLoadError] = useState<string | null>(null);
  const [traderProfiles, setTraderProfiles] = useState<TraderProfile[]>(fallbackTraderProfiles);
  const [modelProviders, setModelProviders] = useState<ModelProviderChoice[]>(
    fallbackModelProviders
  );
  const hasWorkbenchFixture = Boolean(workbenchFixture);

  useEffect(() => {
    let isMounted = true;

    loadWorkbenchFixture()
      .then((loadedFixture) => {
        if (isMounted) {
          setMarketLoadError(null);
          setWorkbenchFixture(alignFixtureWithQuote(loadedFixture));
        }
      })
      .catch((error) => {
        if (isMounted) {
          setMarketLoadError(error instanceof Error ? error.message : String(error));
        }
      });

    loadTraderProfiles()
      .then((profiles) => {
        if (isMounted && profiles.length) {
          setTraderProfiles(profiles);
        }
      })
      .catch(() => {
        // The fallback trader list is already mounted.
      });

    loadModelProviders()
      .then((providers) => {
        if (isMounted && providers.length) {
          setModelProviders(providers);
        }
      })
      .catch(() => {
        // The fallback provider list is already mounted.
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasWorkbenchFixture) {
      return;
    }
    let isMounted = true;
    const refreshQuote = async () => {
      try {
        const liveMarket = await loadLiveMarketPayload();
        if (!isMounted) {
          return;
        }
        setWorkbenchFixture((current) =>
          current ? mergeLiveMarketIntoFixture(current, liveMarket) : current
        );
      } catch {
        // Keep the current chart usable when a single quote refresh fails.
      }
    };
    const timer = window.setInterval(refreshQuote, 1_000);
    return () => {
      isMounted = false;
      window.clearInterval(timer);
    };
  }, [hasWorkbenchFixture]);

  if (!workbenchFixture) {
    return (
      <main className="loading-shell market-loading" aria-label="真实行情加载状态">
        <div className="loading-mark">PA</div>
        <h1>PAquant 黄金交易终端</h1>
        <p>正在连接真实行情</p>
        <small>
          {marketLoadError
            ? `真实行情暂不可用：${marketLoadError}`
            : "连接完成前不展示本地回放或模拟价格。"}
        </small>
      </main>
    );
  }

  return (
    <Workbench
      fixture={workbenchFixture}
      traderProfiles={traderProfiles}
      modelProviders={modelProviders}
      onStartAgentRun={(traderId, modelProvider, market) =>
        startAgentRun({ traderId, modelProvider, market })
      }
      sourceLabel={
        workbenchFixture.meta?.dataSource?.historyCompleteness === "historical_5m"
          ? "浏览器5分钟K线 + 实时报价"
          : workbenchFixture.meta?.source === "live"
            ? "实时行情 API"
            : "本地 API"
      }
    />
  );
}

function mergeLiveMarketIntoFixture(
  current: WorkbenchFixture,
  liveMarket: LiveMarketPayload
): WorkbenchFixture {
  const quote = withVisibleSpread(liveMarket.quote);
  const liveHasFiveMinuteCandles = hasFiveMinuteCandles(liveMarket.candles);
  const baseCandles = liveHasFiveMinuteCandles ? liveMarket.candles : current.candles;
  return {
    ...current,
    candles: alignCandlesWithQuote(baseCandles, quote),
    meta: {
      ...current.meta,
      source: current.meta?.source ?? "live",
      symbol: current.meta?.symbol ?? "XAUUSD",
      timeframe: current.meta?.timeframe ?? "5m",
      traderId: current.meta?.traderId ?? "brooks-generalist",
      quote,
      dataSource: liveHasFiveMinuteCandles
        ? liveMarket.source
        : current.meta?.dataSource ?? liveMarket.source
    }
  };
}

function alignFixtureWithQuote(fixture: WorkbenchFixture): WorkbenchFixture {
  const quote = fixture.meta?.quote ? withVisibleSpread(fixture.meta.quote) : undefined;
  if (!quote) {
    return fixture;
  }
  return {
    ...fixture,
    candles: alignCandlesWithQuote(fixture.candles, quote),
    meta: {
      ...fixture.meta,
      source: fixture.meta?.source ?? "fixture",
      symbol: fixture.meta?.symbol ?? "XAUUSD",
      timeframe: fixture.meta?.timeframe ?? "5m",
      traderId: fixture.meta?.traderId ?? "brooks-generalist",
      quote
    }
  };
}

function alignCandlesWithQuote(candles: Candle[], quote: LiveMarketQuote): Candle[] {
  if (!hasFiveMinuteCandles(candles)) {
    return candles;
  }
  const next = [...candles];
  const last = next[next.length - 1];
  next[next.length - 1] = {
    ...last,
    timestamp: quote.timestamp ?? last.timestamp,
    close: quote.price,
    high: Math.max(last.high, quote.price),
    low: Math.min(last.low, quote.price),
    body: Math.abs(quote.price - last.open),
    range: Math.max(Math.max(last.high, quote.price) - Math.min(last.low, quote.price), 0),
    close_position:
      Math.max(last.high, quote.price) === Math.min(last.low, quote.price)
        ? 0.5
        : (quote.price - Math.min(last.low, quote.price)) /
          (Math.max(last.high, quote.price) - Math.min(last.low, quote.price))
  };
  return next;
}

function withVisibleSpread(quote: LiveMarketQuote): LiveMarketQuote {
  if (quote.bid != null && quote.ask != null) {
    return quote;
  }
  const halfSpread = DEFAULT_VISIBLE_SPREAD / 2;
  return {
    ...quote,
    bid: round2(quote.price - halfSpread),
    ask: round2(quote.price + halfSpread)
  };
}

function hasFiveMinuteCandles(candles: Candle[]): boolean {
  return candles.length >= 20 && candles.every((candle) => candle.timeframe === "5m");
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
