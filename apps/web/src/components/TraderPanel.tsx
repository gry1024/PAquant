import {
  Brain,
  CheckCircle2,
  CircleDollarSign,
  ListChecks,
  ShieldAlert,
  Wrench
} from "lucide-react";
import type { RunStep } from "./Workbench";
import {
  formatActionOutput,
  formatBias,
  translateText
} from "../lib/displayText";
import type { AgentAction, Analysis, KeyLevel } from "../lib/workbenchTypes";

interface TraderPanelProps {
  analysis: Analysis | null;
  actions: AgentAction[];
  runSteps: RunStep[];
  traderName: string;
  modelLabel: string;
  tradeReason?: string;
}

export function TraderPanel({
  analysis,
  actions,
  runSteps,
  traderName,
  modelLabel,
  tradeReason
}: TraderPanelProps) {
  if (!analysis) {
    return (
      <section className="trader-panel" aria-label="AI 交易员分析">
        <div className="panel-heading">
          <Brain size={16} />
          等待启动
        </div>
        <section className="analysis-section trader-idle-brief">
          <h2>{traderName}</h2>
          <p>
            模型 API：{modelLabel}。只有点击启动后，AI 才会观察 XAU 5分钟K线、
            调用绘图工具、生成交易计划并写入审计轨迹。
          </p>
        </section>
        <RunStepList steps={runSteps} />
      </section>
    );
  }

  const modelUsage = analysis.modelUsage;
  const planLine = analysis.noTradeReason
    ? translateText(analysis.noTradeReason)
    : translateText(analysis.reasoningSummary);

  return (
    <section className="trader-panel" aria-label="AI 交易员分析">
      <div className="panel-heading trader-heading">
        <Brain size={16} />
        <span>{traderName}</span>
        <small>{modelUsage.provider} / {modelUsage.model}</small>
      </div>

      <RunStepList steps={runSteps} />

      <section className="model-api-strip" aria-label="模型 API">
        <div>
          <span>模型 API</span>
          <strong>{modelUsage.provider} / {modelUsage.model}</strong>
        </div>
        <div>
          <span>Token</span>
          <strong>{modelUsage.input_tokens + modelUsage.output_tokens}</strong>
        </div>
        <div>
          <span>估算成本</span>
          <strong>${modelUsage.estimated_cost_usd.toFixed(6)}</strong>
        </div>
      </section>

      <section className="structured-thinking-panel" aria-label="结构化思考">
        <div className="structured-thinking-header">
          <h2>
            <ListChecks size={14} />
            结构化思考
          </h2>
          <span>{Math.round(analysis.confidence * 100)}% 置信度</span>
        </div>
        <div className="thinking-grid">
          <ThinkingBlock
            label="1 市场上下文"
            value={translateText(analysis.marketContext)}
          />
          <ThinkingBlock
            label="2 始终在场方向"
            value={formatBias(analysis.alwaysInBias)}
            meta={`模型 API：${modelUsage.provider} / ${modelUsage.model}`}
          />
          <ThinkingBlock
            label="3 结构状态"
            value={`趋势强度：${translateText(analysis.trendStrength)}`}
            meta={`交易区间：${translateText(analysis.tradingRangeState)}`}
          />
          <ThinkingBlock
            label="4 关键价位"
            value={formatKeyLevels(analysis.keyLevels)}
          />
          <ThinkingBlock
            label="5 交易假设"
            value={translateText(analysis.setupCandidate)}
            meta={`${translateText(analysis.entryType)} / 止损 ${formatPrice(analysis.stop)} / 止盈 ${formatPrice(analysis.target)} / 仓位 ${analysis.positionSizeSuggestion}`}
          />
          <ThinkingBlock
            label="6 失效与计划"
            value={`失效条件：${translateText(analysis.invalidation)}`}
            meta={planLine}
          />
        </div>
      </section>

      <section className="analysis-section trade-thesis-section">
        <h2>交易推演</h2>
        <p>{translateText(analysis.reasoningSummary)}</p>
        <div className="thesis-grid">
          <span>
            <CircleDollarSign size={14} />
            {translateText(analysis.entryType)}
          </span>
          <span>
            <ShieldAlert size={14} />
            止损 {formatPrice(analysis.stop)}
          </span>
          <span>
            <CheckCircle2 size={14} />
            止盈 {formatPrice(analysis.target)}
          </span>
          <span>仓位 {analysis.positionSizeSuggestion}</span>
        </div>
        {tradeReason ? (
          <p className="trade-reason">
            <strong>交易理由</strong> {translateText(tradeReason)}
          </p>
        ) : null}
      </section>

      <section className="analysis-support-grid" aria-label="AI 分析支撑">
        <article className="support-card">
          <h2>知识引用</h2>
          <ul className="knowledge-ref-list">
            {analysis.knowledgeRefs.map((reference) => (
              <li key={reference.key}>
                <strong>{translateText(reference.title)}</strong>
                <span>{translateText(reference.artifactType)}</span>
                <small>{reference.sourceRefs.join(", ")}</small>
              </li>
            ))}
          </ul>
        </article>
        <article className="support-card">
          <h2>证据流</h2>
          <ol className="evidence-rail">
            {analysis.evidenceTrail.map((item) => (
              <li key={item}>{translateText(item)}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="analysis-section tool-execution-section">
        <h2>
          <Wrench size={13} />
          工具执行
        </h2>
        <ol className="action-stream">
          {actions.map((action) => (
            <li key={`${action.sequence}-${action.tool}`}>
              <span>{action.sequence}</span>
              <div>
                <strong>{action.tool}</strong>
                <small>{translateText(action.observation)}</small>
              </div>
              <em>{formatActionOutput(action)}</em>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

function ThinkingBlock({
  label,
  value,
  meta
}: {
  label: string;
  value: string;
  meta?: string;
}) {
  return (
    <article className="thinking-block">
      <h3>{label}</h3>
      <p>{value}</p>
      {meta ? <small>{meta}</small> : null}
    </article>
  );
}

function formatKeyLevels(levels: KeyLevel[]) {
  return levels
    .map((level) => `${level.price.toFixed(2)} ${translateText(level.label)}`)
    .join(" / ");
}

function formatPrice(value: number | null) {
  return value == null ? "未设定" : value.toFixed(2);
}

function RunStepList({ steps }: { steps: RunStep[] }) {
  return (
    <ol className="run-step-list" aria-label="AI执行步骤">
      {steps.map((step) => (
        <li key={step.id} className={step.status}>
          <span>{step.status === "done" ? "✓" : step.status === "running" ? "…" : step.status === "failed" ? "!" : ""}</span>
          <div>
            <strong>{step.label}</strong>
            <small>{step.detail}</small>
          </div>
        </li>
      ))}
    </ol>
  );
}
