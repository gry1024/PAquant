import { describe, expect, test } from "vitest";
import { translateText } from "./displayText";

describe("translateText", () => {
  test("把模型常见英文可见推演转成中文", () => {
    expect(translateText("Let me start by analyzing the price action structure.")).toBe(
      "先分析当前价格行为结构。"
    );
    expect(translateText("Let me start by finding the swing points to understand the structure.")).toBe(
      "先寻找摆动点来理解当前结构。"
    );
    expect(translateText("I'll start by finding swing points to understand the structure.")).toBe(
      "先寻找摆动点来理解当前结构。"
    );
    expect(translateText("The trend is strong but the pullback may fail.")).toBe(
      "模型完成结构分析，详见工具执行和交易计划。"
    );
  });
});
