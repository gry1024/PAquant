# Shared Risk Control

## Position Rules

- Position size must be explicit before any simulated order is submitted.
- Default position size is one unit until a tested risk engine adjusts it.
- Do not trade when the stop distance, target distance, or setup invalidation is unclear.

## Stop And Target Rules

- Every order needs an entry, stop, target, setup name, position size, and reason.
- A stop must map to a chart invalidation level, not to a vague fixed distance.
- A target must map to a measured move, prior high/low, channel line, or risk multiple.
- The chart must show stop and target markers when the simulated order appears.

## Audit Rules

- Model provider and model name must be visible in the UI.
- Observations, hypotheses, invalidation, plan, tool calls, and trade review must be recorded as auditable blocks.
- The hidden model chain of thought is never exposed; the UI shows structured summaries and evidence instead.
