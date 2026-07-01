import {
  Activity,
  BookOpen,
  Bot,
  Play,
  Square,
  UsersRound
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChartPanel } from "./ChartPanel";
import { JournalPanel } from "./JournalPanel";
import { KnowledgeBrowserPanel } from "./KnowledgeBrowserPanel";
import { OrdersPanel } from "./OrdersPanel";
import { PerformanceStrip } from "./PerformanceStrip";
import { TradeReplayPanel } from "./TradeReplayPanel";
import { TraderRosterPanel } from "./TraderRosterPanel";
import { TraderPanel } from "./TraderPanel";
import {
  formatMarketCount,
  formatMarketMode,
  formatSourceLabel,
  traderDisplayName
} from "../lib/displayText";
import type {
  AgentAction,
  Candle,
  ChartObject,
  LiveMarketQuote,
  LiveMarketSource,
  ModelProviderChoice,
  SimulatedOrder,
  TraderProfile,
  WorkbenchFixture
} from "../lib/workbenchTypes";

export interface RunStep {
  id: "market" | "model" | "tools" | "order";
  label: string;
  detail: string;
  status: "pending" | "running" | "done" | "failed";
}

type RunStatus = "idle" | "running" | "executing" | "completed" | "failed";
type QuoteTick = { direction: "up" | "down"; delta: number };
type WorkspaceView = "workbench" | "traders" | "knowledge";
type TradeMarkerObject = Extract<ChartObject, { kind: "trade_marker" }>;

const DEFAULT_CHART_WINDOW_SIZE = 72;

const workspaceViews: Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof Activity;
}> = [
  { id: "workbench", label: "1 主界面", icon: Activity },
  { id: "traders", label: "2 AI交易员图谱", icon: UsersRound },
  { id: "knowledge", label: "3 价格行为知识库", icon: BookOpen }
];

interface WorkbenchProps {
  fixture: WorkbenchFixture;
  traderProfiles: TraderProfile[];
  modelProviders: ModelProviderChoice[];
  onStartAgentRun: (
    traderId: string,
    modelProvider: string,
    market: {
      source?: LiveMarketSource;
      quote?: LiveMarketQuote;
      candles: Candle[];
    }
  ) => Promise<WorkbenchFixture>;
  sourceLabel?: string;
}

export function Workbench({
  fixture,
  traderProfiles,
  modelProviders,
  onStartAgentRun,
  sourceLabel
}: WorkbenchProps) {
  const [activeTraderId, setActiveTraderId] = useState(
    fixture.meta?.traderId ?? traderProfiles[0]?.id ?? "brooks-generalist"
  );
  const [selectedProviderId, setSelectedProviderId] = useState(
    modelProviders.find((provider) => provider.available)?.id ?? modelProviders[0]?.id ?? "deepseek"
  );
  const [agentFixture, setAgentFixture] = useState<WorkbenchFixture | null>(null);
  const [activeView, setActiveView] = useState<WorkspaceView>("workbench");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runError, setRunError] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<RunStep[]>(() => idleRunSteps());
  const [visibleActionCount, setVisibleActionCount] = useState(0);
  const [isOrderVisible, setIsOrderVisible] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const previousQuotePriceRef = useRef<number | null>(null);
  const [quoteTick, setQuoteTick] = useState<QuoteTick | null>(null);
  const [replayCandleCount, setReplayCandleCount] = useState(
    Math.min(DEFAULT_CHART_WINDOW_SIZE, fixture.candles.length)
  );
  const [chartWindowSize, setChartWindowSize] = useState(
    Math.min(DEFAULT_CHART_WINDOW_SIZE, fixture.candles.length)
  );
  const [chartWindowEndIndex, setChartWindowEndIndex] = useState(
    Math.min(DEFAULT_CHART_WINDOW_SIZE, fixture.candles.length)
  );
  const activeTrader = useMemo(
    () => traderProfiles.find((profile) => profile.id === activeTraderId) ?? traderProfiles[0],
    [activeTraderId, traderProfiles]
  );
  const selectedProvider = useMemo(
    () => modelProviders.find((provider) => provider.id === selectedProviderId) ?? modelProviders[0],
    [modelProviders, selectedProviderId]
  );
  const visibleAgentFixture = agentFixture
    ? stagedWorkbenchFixture(
        keepCurrentMarketContext(agentFixture, fixture),
        visibleActionCount,
        isOrderVisible,
        runStatus === "completed"
      )
    : null;
  const visibleFixture = visibleAgentFixture ?? idleWorkbenchFixture(fixture);
  const chartFixture = useMemo(
    () => withOrderChartMarkers(visibleFixture),
    [visibleFixture]
  );
  const totalCandleCount = fixture.candles.length;
  const boundedReplayCandleCount = Math.min(
    Math.max(replayCandleCount, 1),
    totalCandleCount
  );
  const firstReplayCount = ((agentFixture ?? fixture).tradeReplay[0]?.barIndex ?? 8) + 1;
  const latest = fixture.candles[boundedReplayCandleCount - 1] ?? fixture.candles.at(-1);
  const trade = visibleAgentFixture?.trades.at(0);
  const activeTraderName = traderDisplayName(activeTrader);
  const modelLabel = selectedProvider
    ? `${selectedProvider.name} / ${selectedProvider.model}`
    : "未配置模型 API";
  const dataSource = fixture.meta?.dataSource;
  const liveQuote = fixture.meta?.quote;
  const quotePrice = liveQuote?.price ?? latest?.close ?? 0;
  const bid = liveQuote?.bid;
  const ask = liveQuote?.ask;
  const spread = bid != null && ask != null ? Math.max(ask - bid, 0) : null;
  const quoteTickClass = quoteTick ? ` quote-${quoteTick.direction}` : "";
  const marketModeLabel = formatMarketMode(dataSource);
  const marketCountLabel = formatMarketCount(dataSource, fixture.candles.length);
  const hasActionableMarket =
    Boolean(dataSource && !dataSource.isMock) && totalCandleCount >= 20;
  const providerModelLabel = agentFixture
    ? `${agentFixture.analysis.modelUsage.provider} / ${agentFixture.analysis.modelUsage.model}`
    : modelLabel;
  const isAgentBusy = runStatus === "running" || runStatus === "executing";
  const canStartAgent = !isAgentBusy && hasActionableMarket;
  const showAuditStack = Boolean(visibleAgentFixture?.orders.length);

  useEffect(() => {
    if (!Number.isFinite(quotePrice)) {
      return;
    }
    const previousQuotePrice = previousQuotePriceRef.current;
    if (previousQuotePrice != null && previousQuotePrice !== quotePrice) {
      setQuoteTick({
        direction: quotePrice > previousQuotePrice ? "up" : "down",
        delta: Math.abs(round2(quotePrice - previousQuotePrice))
      });
    }
    previousQuotePriceRef.current = quotePrice;
  }, [quotePrice]);

  useEffect(() => {
    setReplayCandleCount(totalCandleCount);
    setChartWindowSize((count) => Math.min(Math.max(count, 1), totalCandleCount));
    setChartWindowEndIndex(totalCandleCount);
  }, [totalCandleCount]);

  useEffect(() => {
    if (!isStreaming) {
      return;
    }
    const timer = window.setInterval(() => {
      setReplayCandleCount((count) => {
        const next = Math.min(totalCandleCount, count + 1);
        setChartWindowEndIndex(next);
        if (next >= totalCandleCount) {
          window.clearInterval(timer);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, totalCandleCount]);

  useEffect(() => {
    if (runStatus !== "executing" || !agentFixture) {
      return;
    }

    const actionTotal = agentFixture.agentActions.length;
    if (visibleActionCount < actionTotal) {
      const timer = window.setTimeout(() => {
        setVisibleActionCount((count) => {
          const next = Math.min(actionTotal, count + 1);
          setRunSteps(executingRunSteps(agentFixture, modelLabel, next, false));
          return next;
        });
      }, 320);
      return () => window.clearTimeout(timer);
    }

    if (!isOrderVisible) {
      const timer = window.setTimeout(() => {
        setIsOrderVisible(true);
        setRunStatus("completed");
        setRunSteps(completedRunSteps(agentFixture, modelLabel));
      }, 620);
      return () => window.clearTimeout(timer);
    }
  }, [agentFixture, isOrderVisible, modelLabel, runStatus, visibleActionCount]);

  async function handleStartAgentRun() {
    setRunStatus("running");
    setRunError(null);
    setAgentFixture(null);
    setIsStreaming(false);
    setReplayCandleCount(totalCandleCount);
    setChartWindowEndIndex(totalCandleCount);
    setVisibleActionCount(0);
    setIsOrderVisible(false);
    setRunSteps(startedRunSteps(fixture.candles.length, modelLabel));
    try {
      const run = await onStartAgentRun(activeTraderId, selectedProviderId, {
        source: fixture.meta?.dataSource,
        quote: fixture.meta?.quote,
        candles: fixture.candles
      });
      const contextualRun = keepCurrentMarketContext(run, fixture);
      const focusWindow = chartFocusWindowForRun(
        withOrderChartMarkers(contextualRun),
        totalCandleCount
      );
      setAgentFixture(contextualRun);
      setVisibleActionCount(0);
      setIsOrderVisible(false);
      if (focusWindow) {
        setChartWindowSize(focusWindow.windowSize);
        setChartWindowEndIndex(focusWindow.windowEndIndex);
      }
      setRunStatus("executing");
      setRunSteps(executingRunSteps(contextualRun, modelLabel, 0, false));
    } catch (error) {
      setRunStatus("failed");
      setRunError(formatRunError(error));
      setVisibleActionCount(0);
      setIsOrderVisible(false);
      setRunSteps(failedRunSteps());
    }
  }

  function handleToggleStream() {
    if (!isStreaming) {
      setReplayCandleCount((count) => {
        const replayStart = Math.min(Math.max(firstReplayCount, 1), totalCandleCount);
        const next = count >= totalCandleCount ? replayStart : Math.min(totalCandleCount, count + 1);
        setChartWindowEndIndex(next);
        return next;
      });
    }
    setIsStreaming((current) => !current);
  }

  return (
    <main className="workbench-shell">
      <aside className="app-rail" aria-label="PAquant 主导航">
        <div className="rail-mark">PA</div>
        {workspaceViews.map((view) => {
          const Icon = view.icon;
          const isActive = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              className={isActive ? "nav-button active" : "nav-button"}
              aria-pressed={isActive}
              onClick={() => setActiveView(view.id)}
            >
              <Icon size={18} strokeWidth={1.9} />
              <span>{view.label}</span>
            </button>
          );
        })}
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <div className="brand-block">
            <h1>PAquant 黄金交易终端</h1>
            <div className="market-line">
              <span>XAUUSD</span>
              <span>5分钟</span>
              <span>{marketModeLabel}</span>
              <span>CloudBase：paquant</span>
            </div>
          </div>
          <div className="status-strip" aria-label="行情状态">
            <span>
              <Activity size={15} /> {activeTraderName}
            </span>
            {sourceLabel ? <span className="source-pill">{sourceLabel}</span> : null}
            {dataSource ? (
              <span className="source-pill" title={dataSource.label}>
                {formatSourceLabel(dataSource)}
              </span>
            ) : null}
            <span>{marketCountLabel}</span>
          </div>
        </header>

        {activeView === "workbench" ? (
        <section className="terminal-main">
          <section className="chart-column" aria-label="原生K线图表区">
            <section className="quote-board" aria-label="实时价格窗口">
              <div className={`quote-primary${quoteTickClass}`}>
                <span>实时价格</span>
                <strong>{quotePrice.toFixed(2)}</strong>
                <em>{liveQuote?.providerSymbol ?? "XAUUSD"}</em>
                {quoteTick ? (
                  <em
                    className={`quote-tick-delta ${quoteTick.direction}`}
                    aria-label="价格跳动方向"
                  >
                    {quoteTick.direction === "up" ? "↑" : "↓"}{" "}
                    {quoteTick.direction === "up" ? "+" : "-"}
                    {quoteTick.delta.toFixed(2)}
                  </em>
                ) : null}
              </div>
              <div className="quote-cell">
                <span>买价</span>
                <strong>{formatNullablePrice(bid)}</strong>
              </div>
              <div className="quote-cell">
                <span>卖价</span>
                <strong>{formatNullablePrice(ask)}</strong>
              </div>
              <div className="quote-cell">
                <span>点差</span>
                <strong>{spread == null ? "—" : spread.toFixed(2)}</strong>
              </div>
              <div className="quote-cell">
                <span>更新时间</span>
                <strong>{formatQuoteTime(liveQuote?.timestamp)}</strong>
              </div>
            </section>

            <ChartPanel
              fixture={chartFixture}
              visibleCandleCount={boundedReplayCandleCount}
              chartWindowSize={chartWindowSize}
              chartWindowEndIndex={chartWindowEndIndex}
              isStreaming={isStreaming}
              onToggleStream={handleToggleStream}
              onResetReplay={() => {
                setReplayCandleCount(firstReplayCount);
                setChartWindowEndIndex(firstReplayCount);
              }}
              onStepBack={() =>
                setReplayCandleCount((count) => {
                  const next = Math.max(1, count - 1);
                  setChartWindowEndIndex((end) => Math.min(end, next));
                  return next;
                })
              }
              onStepForward={() =>
                setReplayCandleCount((count) => {
                  const next = Math.min(totalCandleCount, count + 1);
                  setChartWindowEndIndex(next);
                  return next;
                })
              }
              onPanLeft={() =>
                setChartWindowEndIndex((end) =>
                  Math.max(Math.min(chartWindowSize, boundedReplayCandleCount), end - Math.max(6, Math.floor(chartWindowSize / 2)))
                )
              }
              onPanRight={() =>
                setChartWindowEndIndex((end) =>
                  Math.min(boundedReplayCandleCount, end + Math.max(6, Math.floor(chartWindowSize / 2)))
                )
              }
              onShowLatest={() => {
                setReplayCandleCount(totalCandleCount);
                setChartWindowEndIndex(totalCandleCount);
              }}
              onShowAll={() => {
                setReplayCandleCount(totalCandleCount);
                setChartWindowSize(boundedReplayCandleCount);
                setChartWindowEndIndex(boundedReplayCandleCount);
              }}
              onZoomIn={() => setChartWindowSize((count) => Math.max(12, Math.floor(count * 0.72)))}
              onZoomOut={() =>
                setChartWindowSize((count) => Math.min(boundedReplayCandleCount, count + 18))
              }
              onWindowEndChange={(endIndex) => {
                const minEndIndex = Math.min(chartWindowSize, totalCandleCount);
                const nextEndIndex = Math.min(
                  totalCandleCount,
                  Math.max(minEndIndex, Math.round(endIndex))
                );
                setReplayCandleCount(totalCandleCount);
                setChartWindowEndIndex(nextEndIndex);
              }}
              onViewportChange={({ windowSize, windowEndIndex }) => {
                const boundedWindowSize = Math.min(
                  boundedReplayCandleCount,
                  Math.max(1, Math.round(windowSize))
                );
                setChartWindowSize(boundedWindowSize);
                setChartWindowEndIndex(
                  Math.min(
                    boundedReplayCandleCount,
                    Math.max(boundedWindowSize, Math.round(windowEndIndex))
                  )
                );
              }}
              onSetWindowPreset={(preset) => {
                const nextVisibleCount = totalCandleCount;
                const nextWindowSize =
                  preset === "all"
                    ? nextVisibleCount
                    : preset === "latest"
                      ? Math.min(DEFAULT_CHART_WINDOW_SIZE, nextVisibleCount)
                      : Math.min(preset, nextVisibleCount);
                setReplayCandleCount(nextVisibleCount);
                setChartWindowSize(nextWindowSize);
                setChartWindowEndIndex(nextVisibleCount);
              }}
            />
          </section>

          <aside className="ai-column" aria-label="AI 交易员执行区">
            <section className="agent-control-strip" aria-label="AI 交易员控制">
              <label className="model-select">
                <span>AI交易员</span>
                <select
                  aria-label="AI 交易员"
                  value={activeTraderId}
                  onChange={(event) => setActiveTraderId(event.target.value)}
                  disabled={isAgentBusy}
                >
                  {traderProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {traderDisplayName(profile)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="model-select">
                <span>模型 API</span>
                <select
                  aria-label="模型 API"
                  value={selectedProviderId}
                  onChange={(event) => setSelectedProviderId(event.target.value)}
                  disabled={isAgentBusy}
                >
                  {modelProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} / {provider.model}
                      {provider.available ? "" : "（未配置 key）"}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="agent-run-button"
                onClick={handleStartAgentRun}
                disabled={!canStartAgent}
              >
                <Bot size={15} />
                {isAgentBusy
                  ? "AI交易员执行中"
                  : hasActionableMarket
                    ? "启动 AI 交易员"
                    : "等待实时行情"}
              </button>
              <span className={`agent-run-state ${runStatus}`}>{formatRunStatus(runStatus)}</span>
              <span className="model-api-readout">模型 API：{providerModelLabel}</span>
              <span className="trader-count-readout">策略库：{traderProfiles.length} 名 Brooks setup 交易员</span>
              {!hasActionableMarket ? (
                <span className="agent-market-gate">AI 交易员需要完整 5 分钟 K 线历史</span>
              ) : null}
              {runError ? <span className="agent-run-error">{runError}</span> : null}
            </section>

            <TraderPanel
              analysis={visibleAgentFixture?.analysis ?? null}
              actions={visibleAgentFixture?.agentActions ?? []}
              runSteps={runSteps}
              traderName={activeTraderName}
              modelLabel={providerModelLabel}
              tradeReason={visibleAgentFixture?.orders[0]?.reason}
            />

            {showAuditStack && visibleAgentFixture ? (
              <section className="ai-audit-stack" aria-label="模拟交易审计">
                <OrdersPanel orders={visibleAgentFixture.orders} trades={visibleAgentFixture.trades} />
                <TradeReplayPanel
                  steps={visibleAgentFixture.tradeReplay}
                  snapshots={visibleAgentFixture.tradeSnapshots}
                />
                <PerformanceStrip
                  equityCurve={visibleAgentFixture.equityCurve}
                  summary={visibleAgentFixture.performanceSummary}
                  trade={trade}
                />
                <JournalPanel entries={visibleAgentFixture.journal} />
              </section>
            ) : (
              <section className="data-panel idle-panel">
                <div className="panel-heading">
                  {isStreaming ? <Square size={16} /> : <Play size={16} />}
                  等待 AI 指令
                </div>
                <p>
                  现在只播放行情。必须点击启动后，AI 才会调用模型、执行绘图工具、
                  标注入场止损止盈，并写入交易计划。
                </p>
              </section>
            )}
          </aside>
        </section>
        ) : activeView === "traders" ? (
          <section className="product-view trader-atlas-view" aria-label="AI交易员图谱">
            <TraderRosterPanel
              profiles={traderProfiles}
              activeTraderId={activeTraderId}
              onSelect={setActiveTraderId}
            />
            <section className="trader-atlas-detail" aria-label="AI交易员绩效与策略">
              <div className="panel-heading">
                <UsersRound size={16} />
                当前交易员
              </div>
              <div className="trader-profile-hero">
                <div>
                  <span className="eyebrow">策略画像</span>
                  <h2>{activeTraderName}</h2>
                  <p>{activeTrader?.persona ?? "等待交易员档案加载"}</p>
                </div>
                <div className="strategy-stat">
                  <span>胜率</span>
                  <strong>
                    {activeTrader ? `${(activeTrader.performance.winRate * 100).toFixed(0)}%` : "—"}
                  </strong>
                </div>
                <div className="strategy-stat">
                  <span>最大回撤</span>
                  <strong>{activeTrader ? activeTrader.performance.maxDrawdown.toFixed(1) : "—"}</strong>
                </div>
                <div className="strategy-stat">
                  <span>权益</span>
                  <strong>{activeTrader ? activeTrader.performance.equity.toFixed(0) : "—"}</strong>
                </div>
              </div>
              <div className="atlas-grid">
                <article>
                  <span className="eyebrow">交易策略</span>
                  <p>
                    {activeTrader
                      ? `${activeTrader.preferredSetups.join("、")}；${activeTrader.riskStyle}`
                      : "价格行为结构识别、风险先行、只在用户启动后执行。"}
                  </p>
                </article>
                <article>
                  <span className="eyebrow">实盘记录</span>
                  <p>{activeTrader?.recentAction ?? "暂无最近动作"}</p>
                </article>
                <article>
                  <span className="eyebrow">收益曲线</span>
                  <div className="mini-equity-curve" aria-label="收益曲线">
                    {(visibleFixture.equityCurve.length
                      ? visibleFixture.equityCurve
                      : [
                          { equity: 100000 },
                          { equity: activeTrader?.performance.equity ?? 100000 }
                        ]
                    )
                      .slice(-12)
                      .map((point, index) => (
                        <span
                          key={`${point.equity}-${index}`}
                          style={{ height: `${Math.max(12, Math.min(92, point.equity / 1200))}%` }}
                        />
                      ))}
                  </div>
                </article>
                <article>
                  <span className="eyebrow">共同知识策略</span>
                  <p>
                    {activeTrader?.sharedKnowledgeSummary ??
                      "所有交易员共享价格行为基础、风险控制、止损止盈标注和审计日志约束。"}
                  </p>
                  {activeTrader?.sharedKnowledgeFiles?.length ? (
                    <div className="agent-source-list" aria-label="共通知识文件">
                      {activeTrader.sharedKnowledgeFiles.map((path) => (
                        <code key={path}>{path}</code>
                      ))}
                    </div>
                  ) : null}
                </article>
              </div>
            </section>
          </section>
        ) : (
          <section className="product-view knowledge-base-view" aria-label="阿尔布鲁克斯价格行为学知识库">
            <KnowledgeBrowserPanel knowledge={visibleFixture.knowledge} />
          </section>
        )}
      </section>
    </main>
  );
}

function idleWorkbenchFixture(fixture: WorkbenchFixture): WorkbenchFixture {
  return {
    ...fixture,
    agentActions: [],
    chartObjects: fixture.chartObjects.filter((object) => object.kind !== "trade_marker"),
    orders: [],
    trades: [],
    tradeSnapshots: [],
    tradeReplay: [],
    equityCurve: [],
    journal: []
  };
}

function keepCurrentMarketContext(run: WorkbenchFixture, current: WorkbenchFixture): WorkbenchFixture {
  return {
    ...run,
    candles: current.candles,
    chartObjects: mergeContextChartObjects(current.chartObjects, run.chartObjects),
    meta: {
      ...run.meta,
      source: run.meta?.source ?? current.meta?.source ?? "api",
      symbol: current.meta?.symbol ?? run.meta?.symbol ?? "XAUUSD",
      timeframe: current.meta?.timeframe ?? run.meta?.timeframe ?? "5m",
      traderId: run.meta?.traderId ?? current.meta?.traderId ?? "brooks-generalist",
      dataSource: current.meta?.dataSource ?? run.meta?.dataSource,
      quote: current.meta?.quote ?? run.meta?.quote
    }
  };
}

function mergeContextChartObjects(
  currentObjects: WorkbenchFixture["chartObjects"],
  runObjects: WorkbenchFixture["chartObjects"]
) {
  const runIds = new Set(runObjects.map((object) => object.id));
  const contextObjects = currentObjects.filter(
    (object) => isLiveStructureObject(object) && !runIds.has(object.id)
  );
  return [...contextObjects, ...runObjects];
}

function stagedWorkbenchFixture(
  fixture: WorkbenchFixture,
  visibleActionCount: number,
  isOrderVisible: boolean,
  isCompleted: boolean
): WorkbenchFixture {
  if (isCompleted) {
    return fixture;
  }
  const actions = fixture.agentActions.slice(0, visibleActionCount);
  const visibleObjectIds = collectVisibleChartObjectIds(actions, isOrderVisible, fixture.chartObjects);
  return {
    ...fixture,
    agentActions: actions,
    chartObjects: fixture.chartObjects.filter((object) => visibleObjectIds.has(object.id)),
    orders: isOrderVisible ? fixture.orders : [],
    trades: isOrderVisible ? fixture.trades : [],
    tradeSnapshots: isOrderVisible ? fixture.tradeSnapshots : [],
    tradeReplay: isOrderVisible ? fixture.tradeReplay : [],
    equityCurve: isOrderVisible ? fixture.equityCurve : [],
    journal: isOrderVisible ? fixture.journal : []
  };
}

function collectVisibleChartObjectIds(
  actions: AgentAction[],
  isOrderVisible: boolean,
  objects: ChartObject[]
) {
  const ids = new Set(
    actions
      .map((action) => action.chartObjectId)
      .filter((id): id is string => Boolean(id))
  );
  for (const object of objects) {
    if (isLiveStructureObject(object)) {
      ids.add(object.id);
    }
  }
  if (isOrderVisible) {
    for (const object of objects) {
      if (object.kind === "trade_marker") {
        ids.add(object.id);
      }
    }
  }
  return ids;
}

function isLiveStructureObject(object: ChartObject) {
  return object.id.includes("structure-") && object.kind !== "trade_marker";
}

function chartFocusWindowForRun(run: WorkbenchFixture, totalCandleCount: number) {
  const tradeIndexes = [
    ...run.chartObjects
      .filter((object) => object.kind === "trade_marker")
      .flatMap(chartObjectIndexes),
    ...run.tradeReplay
      .filter((step) => step.orderId)
      .map((step) => step.barIndex),
    ...run.orders.map((order) => orderMarkerTimeIndex(run, order.id, order.entry))
  ].filter((index) => index >= 0);
  const indexes = tradeIndexes.length
    ? tradeIndexes
    : run.chartObjects.flatMap(chartObjectIndexes).filter((index) => index >= 0);
  if (!indexes.length || totalCandleCount <= 0) {
    return null;
  }
  const windowSize = Math.min(DEFAULT_CHART_WINDOW_SIZE, totalCandleCount);
  const minIndex = Math.min(...indexes);
  const maxIndex = Math.max(...indexes);
  const centerIndex = Math.round((minIndex + maxIndex) / 2);
  const centeredEnd = centerIndex + Math.ceil(windowSize / 2);
  const windowEndIndex = Math.min(
    totalCandleCount,
    Math.max(windowSize, centeredEnd)
  );
  return { windowSize, windowEndIndex };
}

function withOrderChartMarkers(fixture: WorkbenchFixture): WorkbenchFixture {
  if (!fixture.orders.length) {
    return fixture;
  }
  const expectedMarkers = new Map<string, TradeMarkerObject>();
  for (const order of fixture.orders) {
    const timeIndex = orderMarkerTimeIndex(fixture, order.id, order.entry);
    const markerEndIndex = order.execution_plan
      ? Math.min(fixture.candles.length - 1, order.execution_plan.signal_bar_index + 8)
      : Math.min(fixture.candles.length - 1, timeIndex + 8);
    const safeId = safeChartObjectId(order.id);
    const candidates: TradeMarkerObject[] = [
      {
        kind: "trade_marker",
        id: `${safeId}-entry-marker`,
        label: `入场 ${order.entry.toFixed(2)} | 仓位 ${order.quantity}`,
        time_index: timeIndex,
        start_index: timeIndex,
        end_index: markerEndIndex,
        price: order.entry,
        marker_type: "entry",
        quantity: order.quantity,
        reason: order.execution_plan
          ? `订单类型 ${order.order_type}；${order.execution_plan.trigger_condition}；仓位 ${order.quantity}`
          : order.reason
      },
      {
        kind: "trade_marker",
        id: `${safeId}-stop-marker`,
        label: `止损 ${order.stop.toFixed(2)} | 仓位 ${order.quantity}`,
        time_index: timeIndex,
        start_index: timeIndex,
        end_index: markerEndIndex,
        price: order.stop,
        marker_type: "stop",
        quantity: order.quantity,
        reason: `止损 ${order.stop.toFixed(2)} 是本笔 ${formatOrderTypeForReason(order.order_type)} 的失效价。`
      },
      {
        kind: "trade_marker",
        id: `${safeId}-target-marker`,
        label: `止盈 ${order.target.toFixed(2)} | 仓位 ${order.quantity}`,
        time_index: markerEndIndex,
        start_index: timeIndex,
        end_index: markerEndIndex,
        price: order.target,
        marker_type: "target",
        quantity: order.quantity,
        reason: `止盈 ${order.target.toFixed(2)} 是本笔订单的 2R 目标价。`
      }
    ];
    for (const marker of candidates) {
      expectedMarkers.set(tradeMarkerKey(marker), marker);
    }
  }

  const existingMarkerKeys = new Set<string>();
  const chartObjects = fixture.chartObjects.map((object) => {
    if (object.kind !== "trade_marker") {
      return object;
    }
    const key = tradeMarkerKey(object);
    existingMarkerKeys.add(key);
    const expected = expectedMarkers.get(key);
    return expected ? { ...object, ...expected, id: object.id } : object;
  });
  const missingMarkers = [...expectedMarkers.values()].filter(
    (marker) => !existingMarkerKeys.has(tradeMarkerKey(marker))
  );
  return {
    ...fixture,
    chartObjects: [...chartObjects, ...missingMarkers]
  };
}

function orderMarkerTimeIndex(fixture: WorkbenchFixture, orderId: string, entryPrice?: number) {
  const order = fixture.orders.find((candidate) => candidate.id === orderId);
  if (order?.execution_plan) {
    return clampInteger(order.execution_plan.signal_bar_index, 0, fixture.candles.length - 1);
  }
  const exactOrderStep =
    fixture.tradeReplay.find((step) => step.orderId === orderId && step.stage === "execution") ??
    fixture.tradeReplay.find((step) => step.orderId === orderId);
  if (exactOrderStep) {
    return clampInteger(exactOrderStep.barIndex, 0, fixture.candles.length - 1);
  }
  if (entryPrice != null) {
    const priceIndex = nearestCandleIndexForPrice(fixture.candles, entryPrice);
    if (priceIndex != null) {
      return priceIndex;
    }
  }
  const fallbackStep =
    fixture.tradeReplay.find((step) => step.stage === "execution") ??
    fixture.tradeReplay.find((step) => step.orderId);
  return clampInteger(fallbackStep?.barIndex ?? fixture.candles.length - 1, 0, fixture.candles.length - 1);
}

function nearestCandleIndexForPrice(candles: Candle[], price: number): number | null {
  if (!candles.length || !Number.isFinite(price)) {
    return null;
  }
  let bestIndex = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  candles.forEach((candle, index) => {
    const distance =
      price < candle.low
        ? candle.low - price
        : price > candle.high
          ? price - candle.high
          : 0;
    const tieBreaker = Math.abs((candle.open + candle.close) / 2 - price) * 0.001;
    const score = distance + tieBreaker;
    if (score < bestDistance) {
      bestDistance = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function tradeMarkerKey(object: TradeMarkerObject) {
  return `${object.marker_type}:${object.price.toFixed(2)}`;
}

function safeChartObjectId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "order";
}

function clampInteger(value: number, min: number, max: number) {
  return Math.min(Math.max(Math.round(value), min), max);
}

function chartObjectIndexes(object: ChartObject): number[] {
  if (object.kind === "trendline") {
    return object.anchors.map((anchor) => anchor.time_index);
  }
  if (object.kind === "channel") {
    return [
      ...object.base.anchors.map((anchor) => anchor.time_index),
      object.parallel_anchor.time_index
    ];
  }
  if (object.kind === "range_box") {
    return [object.start_index, object.end_index];
  }
  if (object.kind === "fibonacci") {
    return [object.start.time_index, object.end.time_index];
  }
  if (object.kind === "measured_move") {
    return [
      object.start.time_index,
      object.end.time_index,
      object.projected_from.time_index,
      object.projected_from.time_index + 16
    ];
  }
  if (object.kind === "three_push") {
    return object.pushes.map((anchor) => anchor.time_index);
  }
  if (object.kind === "trade_marker") {
    return [object.start_index ?? object.time_index, object.time_index, object.end_index ?? object.time_index];
  }
  return [];
}

function formatOrderTypeForReason(value: SimulatedOrder["order_type"]) {
  return value === "stop_limit" ? "stop-limit 订单" : `${value} 订单`;
}

function idleRunSteps(): RunStep[] {
  return [
    { id: "market", label: "读取行情", detail: "等待用户启动 AI 交易员", status: "pending" },
    { id: "model", label: "调用模型 API", detail: "未开始", status: "pending" },
    { id: "tools", label: "执行绘图工具", detail: "未开始", status: "pending" },
    { id: "order", label: "下单策略", detail: "未开始", status: "pending" }
  ];
}

function startedRunSteps(candleCount: number, modelLabel: string): RunStep[] {
  return [
    { id: "market", label: "读取行情", detail: `已读取 ${candleCount} 根 XAU 5分钟K线`, status: "done" },
    { id: "model", label: "调用模型 API", detail: modelLabel, status: "running" },
    { id: "tools", label: "执行绘图工具", detail: "等待模型返回工具调用", status: "pending" },
    { id: "order", label: "下单策略", detail: "等待风险参数", status: "pending" }
  ];
}

function completedRunSteps(run: WorkbenchFixture, modelLabel: string): RunStep[] {
  const tools = run.agentActions.map((action) => action.tool).join("、") || "无工具调用";
  const order = run.orders[0];
  return [
    { id: "market", label: "读取行情", detail: `已读取 ${run.candles.length} 根 XAU 5分钟K线`, status: "done" },
    { id: "model", label: "调用模型 API", detail: modelLabel, status: "done" },
    { id: "tools", label: "执行绘图工具", detail: tools, status: "done" },
    {
      id: "order",
      label: "下单策略",
      detail: order
        ? `入场 ${order.entry.toFixed(2)} / 止损 ${order.stop.toFixed(2)} / 止盈 ${order.target.toFixed(2)} / 仓位 ${order.quantity}`
        : "本轮没有下单",
      status: "done"
    }
  ];
}

function executingRunSteps(
  run: WorkbenchFixture,
  modelLabel: string,
  visibleActionCount: number,
  isOrderVisible: boolean
): RunStep[] {
  const actionTotal = run.agentActions.length;
  const visibleTools = run.agentActions
    .slice(0, visibleActionCount)
    .map((action) => action.tool)
    .join("、");
  const order = run.orders[0];
  return [
    { id: "market", label: "读取行情", detail: `已读取 ${run.candles.length} 根 XAU 5分钟K线`, status: "done" },
    { id: "model", label: "调用模型 API", detail: modelLabel, status: "done" },
    {
      id: "tools",
      label: "执行绘图工具",
      detail: visibleTools
        ? `已执行 ${visibleActionCount}/${actionTotal}：${visibleTools}`
        : "模型已返回，准备执行绘图工具",
      status: visibleActionCount >= actionTotal ? "done" : "running"
    },
    {
      id: "order",
      label: "下单策略",
      detail: isOrderVisible && order
        ? `入场 ${order.entry.toFixed(2)} / 止损 ${order.stop.toFixed(2)} / 止盈 ${order.target.toFixed(2)} / 仓位 ${order.quantity}`
        : visibleActionCount >= actionTotal
          ? "正在提交模拟订单、标注止损止盈和仓位"
          : "等待绘图工具执行完毕",
      status: isOrderVisible ? "done" : visibleActionCount >= actionTotal ? "running" : "pending"
    }
  ];
}

function failedRunSteps(): RunStep[] {
  return [
    { id: "market", label: "读取行情", detail: "已读取行情", status: "done" },
    { id: "model", label: "调用模型 API", detail: "执行失败", status: "failed" },
    { id: "tools", label: "执行绘图工具", detail: "未执行", status: "pending" },
    { id: "order", label: "下单策略", detail: "未生成", status: "pending" }
  ];
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function formatNullablePrice(value?: number) {
  return value == null ? "—" : value.toFixed(2);
}

function formatQuoteTime(timestamp?: string) {
  if (!timestamp) {
    return "—";
  }
  return new Date(timestamp).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatRunStatus(status: RunStatus) {
  if (status === "idle") {
    return "等待启动";
  }
  if (status === "running") {
    return "运行中";
  }
  if (status === "executing") {
    return "执行中";
  }
  if (status === "completed") {
    return "已完成";
  }
  return "失败";
}

function formatRunError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("requires full 5m candle history") || message.includes("完整 5 分钟 K 线")) {
    return "AI 交易员需要完整 5 分钟 K 线历史后，才能思考、绘图或提交模拟订单。";
  }
  return message || "AI 交易员运行失败";
}
