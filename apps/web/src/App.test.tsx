import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("API unavailable in component test");
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("renders the PAquant trading workstation with fixture fallback", async () => {
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: /PAquant XAU workstation/i })
  ).toBeInTheDocument();
  expect(screen.getAllByText("Brooks Generalist").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Always-in/i).length).toBeGreaterThan(0);
  expect(screen.getByText("Fixture fallback")).toBeInTheDocument();
  expect(screen.getByText("AI trader roster")).toBeInTheDocument();
  expect(screen.getByText("Always-In Trend Trader")).toBeInTheDocument();
  expect(screen.getByText("Wedge/Reversal Specialist")).toBeInTheDocument();
  expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  expect(screen.getByText("Tool actions")).toBeInTheDocument();
  expect(screen.getByText("draw_channel")).toBeInTheDocument();
  expect(screen.getByText("measure_deviation")).toBeInTheDocument();
  expect(screen.getByText(/Simulated orders/i)).toBeInTheDocument();
  expect(screen.getByText("Trade replay")).toBeInTheDocument();
  expect(screen.getByText("Pre-entry")).toBeInTheDocument();
  expect(screen.getByText("Execution")).toBeInTheDocument();
  expect(screen.getByText("Post-trade review")).toBeInTheDocument();
  expect(screen.getByText("MFE")).toBeInTheDocument();
  expect(screen.getByText("MAE")).toBeInTheDocument();
  expect(screen.getByText("Max DD")).toBeInTheDocument();
  expect(screen.getByText("Setup stats")).toBeInTheDocument();
  expect(screen.getByText("Knowledge browser")).toBeInTheDocument();
  expect(screen.getByText("Case cards")).toBeInTheDocument();
  expect(screen.getByText("Reasoning playbooks")).toBeInTheDocument();
  expect(screen.getByText("Source mapping")).toBeInTheDocument();
});
