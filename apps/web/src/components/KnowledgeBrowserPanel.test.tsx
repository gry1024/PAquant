import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { KnowledgeBrowserPanel } from "./KnowledgeBrowserPanel";
import fixtureData from "../fixtures/paquant-demo.json";
import type { WorkbenchFixture } from "../lib/workbenchTypes";

const fixture = fixtureData as WorkbenchFixture;

test("knowledge case cards render a structured visual pattern diagram", () => {
  render(<KnowledgeBrowserPanel knowledge={fixture.knowledge} />);

  expect(screen.getByLabelText("Brooks 知识浏览器")).toBeInTheDocument();
  expect(screen.getByText("教材目录")).toBeInTheDocument();
  expect(screen.getByText("知识图谱")).toBeInTheDocument();
  expect(screen.getByLabelText("概念关系")).toBeInTheDocument();
  expect(screen.getByLabelText("术语表")).toBeInTheDocument();
  expect(screen.getAllByText("信号K线").length).toBeGreaterThan(1);
  expect(screen.getByText("Signal Bar")).toBeInTheDocument();
  expect(screen.getAllByText("交易区间").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/上下文先于形态/).length).toBeGreaterThan(1);
  expect(screen.getByLabelText("形态图解")).toBeInTheDocument();
  expect(screen.getByText("推动1")).toBeInTheDocument();
  expect(screen.getByText("推动2")).toBeInTheDocument();
  expect(screen.getByText("推动3")).toBeInTheDocument();
  expect(within(screen.getByLabelText("形态图解")).getByText(/通道过冲/)).toBeInTheDocument();
});
