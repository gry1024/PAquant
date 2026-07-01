import type {
  AgentAction,
  LiveMarketSource,
  SimulatedOrder,
  TradeReplayStep,
  TraderProfile
} from "./workbenchTypes";

const traderNameById: Record<string, string> = {
  "brooks-generalist": "布鲁克斯通用交易员",
  "always-in-trend": "始终在场趋势交易员",
  "second-entry": "二次入场专家",
  "best-trades-only": "精选交易保守派",
  "trading-range-scalper": "交易区间剥头皮员",
  "breakout-pullback": "突破回调交易员",
  "wedge-reversal": "楔形反转专家",
  "breakout-failure": "突破失败交易员",
  "major-reversal": "主要趋势反转专家",
  "final-flag": "最终旗形交易员"
};

const shortTextMap = new Map<string, string>([
  ["Pre-entry", "入场前"],
  ["Plan", "交易计划"],
  ["Execution", "执行"],
  ["Outcome", "结果"],
  ["Post-trade review", "交易后复盘"],
  ["Plan created", "计划已生成"],
  ["Target reached", "止盈达成"],
  ["observing", "观察中"],
  ["pending", "等待成交"],
  ["submitted", "已提交"],
  ["triggered", "已触发"],
  ["filled", "已成交"],
  ["closed", "已结束"],
  ["canceled", "已取消"],
  ["target-hit", "触及止盈"],
  ["reviewed", "已复盘"],
  ["session low", "时段低点"],
  ["session high", "时段高点"],
  ["pullback entry zone", "回调入场区"],
  ["limit buy", "限价买入"],
  ["market buy", "市价买入"],
  ["buy", "买入"],
  ["sell", "卖出"],
  ["long", "多头"],
  ["short", "空头"],
  ["neutral", "中性"],
  ["concept", "概念"],
  ["setup_dossier", "形态档案"],
  ["case_card", "案例卡"],
  ["reasoning_playbook", "推演手册"],
  ["Wedge Reversal", "楔形反转"],
  ["Third push overshoots a broad channel", "第三次推动越过宽通道"],
  ["Wedge quality review", "楔形质量复核"],
  ["Failed Breakout", "突破失败"],
  ["Range breakout fails back inside", "区间突破失败后回到区间内"],
  ["Brooks pullback in always-in long context", "始终在场多头背景下的布鲁克斯回调"],
  ["Always-in long trend line", "始终在场多头趋势线"],
  ["Parallel channel projection", "平行通道投影"],
  ["Early pullback box", "早期回调箱体"],
  ["Swing retracement map", "摆动回撤图"]
]);

const sentenceReplacements: Array<[RegExp, string]> = [
  [/DeepSeek produced a Brooks pullback thesis after tool calls\./i, "DeepSeek 完成工具调用后，形成布鲁克斯回调交易假设。"],
  [/Let me start by analyzing the price action structure\./i, "先分析当前价格行为结构。"],
  [/Let me start by finding the swing points to understand the structure\./i, "先寻找摆动点来理解当前结构。"],
  [/I'?ll start by finding swing points to understand the structure\./i, "先寻找摆动点来理解当前结构。"],
  [/Structured Brooks decision based on context, levels, and risk\./i, "基于上下文、关键价位和风险回报的布鲁克斯结构化决策。"],
  [/XAU 5m is replaying an upward channel with pullbacks staying above the prior swing low\./i, "XAU 5 分钟正在回放上行通道，回调仍守在前一处摆动低点上方。"],
  [/moderate trend with two-sided pullbacks/i, "中等强度趋势，回调里仍有双向交易"],
  [/not a mature range; treat pullbacks as tests until a failed breakout appears/i, "尚未形成成熟交易区间；在失败突破出现前，将回调视为趋势测试。"],
  [/A break (?:beyond|below) 2305(?:\.00)? invalidates the pullback thesis and suggests (?:the other side|sellers) regained control\./i, "跌破 2305 将否定回调做多假设，并提示卖方重新掌控。"],
  [/Pullback held above the always-in trend line; trader's equation offered 5(?:\.00)? points risk(?: for|,)? (?:a )?10(?:\.00)? point(?:s)? (?:target )?reward\./i, "回调守住始终在场趋势线；交易员方程给出 5 点风险和 10 点目标回报。"],
  [/AI marked the always-in trend line, channel projection, and early pullback box before committing to a trade\./i, "AI 在承诺交易前，先标注始终在场趋势线、通道投影和早期回调箱体。"],
  [/Limit buy plan used 5 points of risk and a 2R target while the pullback held above the invalidation price\./i, "限价买入计划使用 5 点风险和 2R 目标，前提是回调守住失效价。"],
  [/Simulated limit order filled inside the pullback zone\./i, "模拟限价单在回调区内成交。"],
  [/Price reached the 2R target before touching the stop\./i, "价格先触及 2R 目标，未触及止损。"],
  [/AI review recorded MFE\/MAE and confirmed the setup behaved like a trend pullback rather than a failed breakout\./i, "AI 复盘记录了 MFE/MAE，并确认该形态更像趋势回调，而不是突破失败。"],
  [/Brooks Generalist identified a pullback in an always-in long context\./i, "布鲁克斯通用交易员识别出始终在场多头背景下的回调。"],
  [/Simulated target was reached for a 2R outcome\./i, "模拟交易触及止盈，结果为 2R。"],
  [/Found (\d+) local swing points\./i, "找到 $1 个局部摆动点。"],
  [/Snapped probe to nearest low swing\./i, "探针已吸附到最近的低点摆动。"],
  [/Lowest replay candle/i, "回放最低 K 线"],
  [/Highest replay candle/i, "回放最高 K 线"],
  [/Limit price derived from visible pullback structure/i, "限价来自可见回调结构"],
  [/Limit price near early pullback low/i, "限价靠近早期回调低点"],
  [/Best near a channel extreme, after repeated attempts and visible momentum loss\./i, "更适合出现在通道极值附近，并伴随多次尝试和明显动能衰减。"],
  [/The third push tests above the channel but momentum is weaker than the prior leg\./i, "第三次推动测试通道上沿，但动能弱于前一腿。"],
  [/Are there exactly three credible pushes\?/i, "是否正好有三次可信推动？"],
  [/Best at a prior range boundary when price breaks out then quickly returns inside\./i, "适合出现在既有区间边界，价格突破后快速回到区间内。"],
  [/Failure to hold outside the range traps breakout buyers and can create a move back toward the range middle\./i, "无法守在区间外会套住突破买方，并可能推动价格回到区间中部。"],
  [/Context checked before setup label\./i, "先检查上下文，再给形态贴标签。"],
  [/Always-in bias derived from replay swing direction\./i, "始终在场方向来自回放摆动方向。"],
  [/Model API returned tool calls that were executed by drawing tools\./i, "模型 API 返回工具调用，绘图工具已经执行。"],
  [/Retrieved Brooks refs:/i, "检索到布鲁克斯引用："],
  [/Trader's equation uses 5 points risk for 10 points reward\./i, "交易员方程使用 5 点风险换取 10 点回报。"]
];

export function traderDisplayName(profileOrId?: TraderProfile | string | null): string {
  const id = typeof profileOrId === "string" ? profileOrId : profileOrId?.id;
  if (id && traderNameById[id]) {
    return traderNameById[id];
  }
  return typeof profileOrId === "string" ? profileOrId : profileOrId?.name ?? "AI 交易员";
}

export function translateText(text?: string | null): string {
  if (!text) {
    return "";
  }
  const exact = shortTextMap.get(text);
  if (exact) {
    return exact;
  }
  const translated = sentenceReplacements.reduce(
    (current, [pattern, replacement]) => current.replace(pattern, replacement),
    text
  );
  if (isEnglishSentence(translated)) {
    return "模型完成结构分析，详见工具执行和交易计划。";
  }
  return translated;
}

function isEnglishSentence(text: string): boolean {
  return !/[\u3400-\u9fff]/.test(text) && /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(text);
}

export function formatMarketMode(source?: LiveMarketSource): string {
  if (source?.historyCompleteness === "latest_quote_only") {
    return "仅实时 XAU 现货报价，暂缺完整 5 分钟历史 K 线";
  }
  if (source?.instrumentKind === "mt5_broker") {
    return "MT5 读取 XAUUSDc 5 分钟已收盘 K 线，叠加 broker 实时报价";
  }
  if (source?.historyCompleteness === "historical_5m") {
    return "浏览器加载 XAUUSD 5 分钟历史 K 线，叠加实时报价";
  }
  if (source?.instrumentKind === "futures_proxy") {
    return "GC=F 期货代理近实时行情，非现货成交价";
  }
  if (source?.instrumentKind === "sample_replay") {
    return "本地 XAU 5 分钟回放数据，实时行情源暂不可用";
  }
  return "XAU 5 分钟实时行情";
}

export function formatSourceLabel(source?: LiveMarketSource): string {
  if (!source) {
    return "行情源待确认";
  }
  if (source.instrumentKind === "futures_proxy") {
    return "GC=F 期货代理";
  }
  if (source.instrumentKind === "mt5_broker") {
    return "MT5 XAUUSDc 5 分钟";
  }
  if (source.historyCompleteness === "latest_quote_only") {
    return "Gold API XAU/USD 实时报价";
  }
  if (source.historyCompleteness === "historical_5m") {
    return "ForexSB/Dukascopy 5 分钟 K 线";
  }
  if (source.instrumentKind === "sample_replay") {
    return "本地 XAUUSD 5 分钟回放";
  }
  return source.label;
}

export function formatMarketCount(source: LiveMarketSource | undefined, count: number): string {
  if (source?.historyCompleteness === "latest_quote_only") {
    return `${count} 条报价`;
  }
  return `${count} 根 K 线`;
}

export function formatBias(bias?: string | null): string {
  return translateText(bias ?? "neutral");
}

export function formatOrderSide(side: SimulatedOrder["side"]): string {
  return side === "buy" ? "买入" : "卖出";
}

export function formatOrderType(type: SimulatedOrder["order_type"]): string {
  const map: Record<SimulatedOrder["order_type"], string> = {
    limit: "限价",
    market: "市价",
    stop: "Stop 单",
    stop_limit: "Stop Limit"
  };
  return map[type] ?? type;
}

export function formatOrderStatus(status: string): string {
  return translateText(status);
}

export function formatReplayStage(step: TradeReplayStep): string {
  return translateText(step.title) || translateText(step.stage);
}

export function formatActionOutput(action: AgentAction): string {
  const { output } = action;
  if (typeof output.points === "number") {
    return `${output.points.toFixed(2)} 点`;
  }
  if (typeof output.bars === "number") {
    return `${output.bars} 根 K 线`;
  }
  if (Array.isArray(output.swings)) {
    return `${output.swings.length} 个摆动点`;
  }
  if (typeof output.price === "number") {
    return output.price.toFixed(2);
  }
  return action.chartObjectId ?? action.status;
}
