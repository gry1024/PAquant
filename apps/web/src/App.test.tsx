import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  vi.useRealTimers();
});

test("renders market data first and runs the AI trader only after user starts it", async () => {
  render(<App />);

  expect(
    await screen.findByRole("heading", { name: /PAquant XAU workstation/i })
  ).toBeInTheDocument();
  expect(screen.getAllByText("Brooks Generalist").length).toBeGreaterThan(0);
  expect(screen.getByText("Fixture fallback")).toBeInTheDocument();
  expect(screen.getByText("AI trader roster")).toBeInTheDocument();
  expect(screen.getByText("Always-In Trend Trader")).toBeInTheDocument();
  expect(screen.getByText("Wedge/Reversal Specialist")).toBeInTheDocument();
  expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  expect(screen.getByText("AI trader idle")).toBeInTheDocument();
  expect(screen.queryByText("Tool actions")).not.toBeInTheDocument();
  expect(screen.queryByText(/Simulated orders/i)).not.toBeInTheDocument();
  expect(screen.getByLabelText("Model API")).toHaveValue("mock");
  expect(screen.getByText("Last price")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start data stream/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Start AI trader/i })).toBeInTheDocument();
  expect(screen.getByText("Knowledge browser")).toBeInTheDocument();
  expect(screen.getByText("Case cards")).toBeInTheDocument();
  expect(screen.getByText("Reasoning playbooks")).toBeInTheDocument();
  expect(screen.getByText("Source mapping")).toBeInTheDocument();
  expect(screen.getByText("Bar 24/72")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Start data stream/i }));
  await waitFor(() => expect(screen.getByText("Bar 25/72")).toBeInTheDocument());

  fireEvent.click(screen.getByRole("button", { name: /Start AI trader/i }));

  expect(await screen.findByText("Tool actions")).toBeInTheDocument();
  expect(screen.getByText("draw_channel")).toBeInTheDocument();
  expect(screen.getByText("measure_deviation")).toBeInTheDocument();
  expect(screen.getByText(/Model API: mock/i)).toBeInTheDocument();
  expect(screen.getByText(/Position size 1/i)).toBeInTheDocument();
  expect(screen.getByText(/Trade reason/i)).toBeInTheDocument();
  expect(screen.getByText(/Entry 2310.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Stop 2305.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Target 2320.00/i)).toBeInTheDocument();
  expect(screen.getByText(/Simulated orders/i)).toBeInTheDocument();
  expect(screen.getByText("Trade replay")).toBeInTheDocument();
  expect(screen.getByText("Pre-entry")).toBeInTheDocument();
  expect(screen.getByText("Execution")).toBeInTheDocument();
  expect(screen.getByText("Post-trade review")).toBeInTheDocument();
  expect(screen.getByText("MFE")).toBeInTheDocument();
  expect(screen.getByText("MAE")).toBeInTheDocument();
  expect(screen.getByText("Max DD")).toBeInTheDocument();
  expect(screen.getByText("Setup stats")).toBeInTheDocument();
  expect(screen.getByText("Fill")).toBeInTheDocument();
  expect(screen.getByText("LIMIT")).toBeInTheDocument();
  expect(screen.getByText(/Snapshot 0-12/i)).toBeInTheDocument();
  expect(screen.getByText("Knowledge refs")).toBeInTheDocument();
  expect(screen.getByText(/M15/i)).toBeInTheDocument();
  expect(screen.getByText(/H1/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Reset replay/i }));
  expect(screen.getByText("Bar 9/72")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Next bar/i }));
  expect(screen.getByText("Bar 10/72")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Wedge\/Reversal Specialist/i }));

  expect(within(screen.getByLabelText("AI trader analysis")).getByText(
    "Wedge/Reversal Specialist"
  )).toBeInTheDocument();
});
