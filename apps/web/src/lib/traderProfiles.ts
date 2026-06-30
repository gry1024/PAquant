import type { TraderProfile } from "./workbenchTypes";
import { resolveApiUrl } from "./workbenchData";

const API_TRADERS_PATH = "/traders";

const toolPermissions = [
  "find_swings",
  "draw_trendline",
  "draw_channel",
  "draw_box",
  "draw_fibonacci",
  "measure_leg",
  "compare_legs",
  "count_bars",
  "project_line",
  "measure_deviation",
  "snap_to_swing"
];

const sharedKnowledgeFiles = [
  ".agents/common/price-action-core.md",
  ".agents/common/risk-control.md"
];

const sharedKnowledgeSummary = "Shared Price Action Core / Shared Risk Control";

function agentSource(traderId: string) {
  return {
    agentFile: `.agents/traders/${traderId}.md`,
    sharedKnowledgeFiles,
    sharedKnowledgeSummary
  };
}

export const fallbackTraderProfiles: TraderProfile[] = [
  {
    id: "brooks-generalist",
    ...agentSource("brooks-generalist"),
    name: "布鲁克斯通用交易员",
    persona: "均衡型价格行为模拟交易员，先检查上下文，再给形态贴标签。",
    status: "active",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["始终在场回调", "二次入场", "突破失败", "三推"],
    riskStyle: "中等风险；上下文和交易员方程确认后使用一单位风险。",
    toolPermissions,
    knowledgePolicy: "检索概念图谱、形态档案和相似失败案例。",
    recentAction: "已复核 XAU 5 分钟信号K线计划，并提交一笔模拟 Stop 单。",
    performance: {
      equity: 10020,
      winRate: 1,
      maxDrawdown: 0,
      trades: 1,
      averageR: 2
    }
  },
  {
    id: "always-in-trend",
    ...agentSource("always-in-trend"),
    name: "始终在场趋势交易员",
    persona: "跟踪始终在场方向、趋势紧迫性、回调质量和趋势恢复。",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["始终在场回调", "微通道", "趋势恢复"],
    riskStyle: "趋势跟随；只有强上下文确认后才接受更宽止损。",
    toolPermissions,
    knowledgePolicy: "优先检索趋势、通道、始终在场和强趋势推演手册。",
    recentAction: "等待清晰的始终在场多空转换。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "second-entry",
    ...agentSource("second-entry"),
    name: "二次入场专家",
    persona: "等待 High 2 / Low 2 二次触发，只在第一次尝试失败后重新评估顺势机会。",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["High 2 回调", "Low 2 回调", "二次入场趋势恢复"],
    riskStyle: "保守；第二信号K线必须给出清晰触发价和失效价。",
    toolPermissions,
    knowledgePolicy: "优先检索二次入场、回调质量、信号K线和交易员方程档案。",
    recentAction: "等待第一次尝试失败后的 H2/L2 信号K线。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "best-trades-only",
    ...agentSource("best-trades-only"),
    name: "精选交易保守派",
    persona: "强过滤交易机会；交易员方程不足时接受不交易。",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["High 2 回调", "Low 2 回调", "主要趋势反转"],
    riskStyle: "保守；概率和回报不清晰时只用小仓位。",
    toolPermissions,
    knowledgePolicy: "检索交易员方程、信号 K 线质量和失败模式案例。",
    recentAction: "因信号质量混杂，拒绝边缘回调机会。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "trading-range-scalper",
    ...agentSource("trading-range-scalper"),
    name: "交易区间剥头皮员",
    persona: "把交易区间视为不确定状态，偏向低买高卖测试。",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["区间反向", "突破失败", "微型双顶/双底"],
    riskStyle: "剥头皮；快速退出，靠近区间中线时减仓。",
    toolPermissions,
    knowledgePolicy: "优先检索交易区间、突破失败和支撑阻力案例。",
    recentAction: "观察当前通道是否演化为成熟交易区间。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "breakout-pullback",
    ...agentSource("breakout-pullback"),
    name: "突破回调交易员",
    persona: "只在突破已经证明自己之后等待回测确认，拒绝普通回踩伪装成突破回调。",
    status: "standby",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["突破回调", "强突破跟进", "等距测量目标"],
    riskStyle: "事件驱动；仓位取决于突破跟进、回测质量和止损距离。",
    toolPermissions,
    knowledgePolicy: "优先检索突破回调、等距测量、失败突破和通道投影档案。",
    recentAction: "等待突破后续跟进确认，再接受回测入场。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "wedge-reversal",
    ...agentSource("wedge-reversal"),
    name: "楔形反转专家",
    persona: "研究三推、过冲、欠冲、动能衰减和反转风险。",
    status: "research",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["楔形反转", "三推", "最终旗形"],
    riskStyle: "反转型；需要清晰失效位和衰竭后的确认。",
    toolPermissions,
    knowledgePolicy: "优先检索楔形、三推、最终旗形和动能变化案例。",
    recentAction: "正在标记三推候选，但等待更清晰的信号 K 线。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "breakout-failure",
    ...agentSource("breakout-failure"),
    name: "突破失败交易员",
    persona: "评估突破力度、后续跟进、被套交易者和失败入场。",
    status: "research",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["突破回调", "突破失败", "等距测量"],
    riskStyle: "事件驱动；仓位取决于突破跟进和止损距离。",
    toolPermissions,
    knowledgePolicy: "优先检索突破、失败、等距测量和交易者陷阱案例。",
    recentAction: "正在比较突破跟进和等距测量目标。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "major-reversal",
    ...agentSource("major-reversal"),
    name: "主要趋势反转专家",
    persona: "等待趋势线突破、极点测试失败和强反向突破同时出现。",
    status: "research",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["主要趋势反转", "趋势线突破后测试", "反向二次入场"],
    riskStyle: "反转确认；结构完成前不提前摸顶摸底。",
    toolPermissions,
    knowledgePolicy: "优先检索主要趋势反转、楔形、最终旗形和始终在场翻转档案。",
    recentAction: "检查趋势线突破加极点测试失败是否完整。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  },
  {
    id: "final-flag",
    ...agentSource("final-flag"),
    name: "最终旗形交易员",
    persona: "观察成熟趋势末端的最终旗形失败和顺势交易者被套压力。",
    status: "research",
    symbol: "XAUUSD",
    timeframe: "5m",
    preferredSetups: ["最终旗形", "失败延续", "楔形后的反向突破"],
    riskStyle: "精选反转；等待失败延续和清晰信号K线后才提交 Stop 单。",
    toolPermissions,
    knowledgePolicy: "优先检索最终旗形、失败突破、楔形和交易者陷阱案例。",
    recentAction: "观察成熟趋势里的顺势延续失败。",
    performance: {
      equity: 10000,
      winRate: 0,
      maxDrawdown: 0,
      trades: 0,
      averageR: 0
    }
  }
];

export async function loadTraderProfiles(
  fetcher: typeof fetch = globalThis.fetch
): Promise<TraderProfile[]> {
  try {
    const response = await fetcher(resolveApiUrl(API_TRADERS_PATH));
    if (!response.ok) {
      throw new Error(`PAquant API returned ${response.status}`);
    }
    const payload = (await response.json()) as { traders?: TraderProfile[] };
    if (!payload.traders?.length) {
      throw new Error("PAquant API returned no trader profiles");
    }
    return payload.traders;
  } catch {
    return fallbackTraderProfiles;
  }
}
