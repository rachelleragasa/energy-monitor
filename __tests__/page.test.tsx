import { afterEach, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Home from "../app/page";

afterEach(cleanup);

test("renders the page heading", () => {
  render(<Home />);
  expect(
    screen.getByRole("heading", { level: 1, name: "Leituras de Energia" }),
  ).toBeInTheDocument();
});

test("shows the upload prompt until a spreadsheet is uploaded", () => {
  // localStorage is empty in jsdom, so `useUploaded()` reports false and the
  // overview stays gated behind the upload prompt.
  window.localStorage.clear();
  render(<Home />);
  expect(
    screen.getByText("Carregue uma folha para ver o resumo"),
  ).toBeInTheDocument();
});
