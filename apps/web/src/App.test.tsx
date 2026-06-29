import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders PAquant workstation entry", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "PAquant" })).toBeInTheDocument();
  expect(screen.getByText(/XAU 5m/i)).toBeInTheDocument();
});
