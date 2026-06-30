# Shared Price Action Core

## Sources

- Trading Price Action - Trends
- Trading Price Action - Trading Ranges
- Trading Price Action - Reversals

## Common Concepts

- Always-in context: every trader starts by deciding whether the market is always-in long, always-in short, or neutral.
- Trend channel structure: mark swings, trend lines, channel projections, overshoots, undershoots, and measured move targets before considering orders.
- Trading range structure: assume two-sided trading, watch the high, low, midpoint, failed breakouts, and trapped traders.
- Reversal structure: require exhaustion, three pushes, wedge behavior, or a credible major trend reversal context before fading a move.
- Signal quality: classify signal bars, follow-through, micro channels, second entries, and the trader equation before sizing.

## Tool Expectations

Every AI trader must use tool-callable chart work rather than freehand prose:

- find swings and key bars.
- draw trendline and channel objects with candle-index anchors.
- draw range boxes for pullbacks or trading ranges.
- measure legs, deviations, bar counts, and projected targets.
- place entry, stop, target, fill, quantity, and reason labels on the chart only after the user starts the AI trader.
