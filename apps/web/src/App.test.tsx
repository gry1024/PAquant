import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the PAquant trading workstation", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: /PAquant XAU workstation/i })).toBeInTheDocument();
  expect(screen.getAllByText("Brooks Generalist").length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Always-in/i).length).toBeGreaterThan(0);
  expect(screen.getByTestId("chart-host")).toBeInTheDocument();
  expect(screen.getByText(/Simulated orders/i)).toBeInTheDocument();
});
