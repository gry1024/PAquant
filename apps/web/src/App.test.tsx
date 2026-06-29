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
  expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  expect(screen.getByText(/Simulated orders/i)).toBeInTheDocument();
});
