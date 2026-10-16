import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { Compensation } from "./Compensation";

const response = (body: unknown) => ({ ok: true, json: async () => body });

describe("Compensation", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(response({ version: "comp-2026.09.29-v1", asOfDate: "2026-09-29", exchangeRateDate: "2026-09-29", assumptions: [], requestId: "test" }))
      .mockResolvedValue(response({
        calculationId: "calc-test",
        asOfDate: "2026-09-29",
        exchangeRateDate: "2026-09-29",
        assumptionsVersion: "comp-2026.09.29-v1",
        input: { mode: "compare", basis: "nominal", locations: ["beijing", "shanghai", "hong-kong"], currency: "CNY", monthlyGross: 30000, annualBonus: 60000 },
        results: [{
          location: "beijing", label: "北京", currency: "CNY", grossAnnual: 420000, bonusAnnual: 60000, mandatoryAnnual: 44100, taxAnnual: 54579, takeHomeAnnual: 321321, employerCostAnnual: 531300, effectiveTaxRate: 0.13, takeHomeRate: 0.76,
          candidateWaterfall: [{ label: "税前名义", value: 420000, kind: "base", color: "#397ea7" }, { label: "五险一金 / MPF", value: -44100, kind: "deduction", color: "#c57b45" }, { label: "个人所得税", value: -54579, kind: "deduction", color: "#c15d6f" }, { label: "税后到手", value: 321321, kind: "total", color: "#3b9b82" }],
          employerWaterfall: [{ label: "税前名义", value: 420000, kind: "base", color: "#397ea7" }, { label: "企业法定成本", value: 111300, kind: "addition", color: "#8b6ec1" }, { label: "企业总成本", value: 531300, kind: "total", color: "#3b9b82" }],
          trend: Array.from({ length: 12 }, (_, index) => ({ month: `${index + 1}月`, gross: 35000, takeHome: 26776, employerCost: 44275 }))
        }],
        requestId: "test"
      })));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders calculation cards and updates inputs", async () => {
    render(<MemoryRouter><Compensation /></MemoryRouter>);
    expect(await screen.findByText("快照 calc-test")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("月薪（税前）"), { target: { value: "35000" } });
    await waitFor(() => expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("/compensation/calculate"))).toBe(true));
    expect(screen.getByText("对比口径与假设")).toBeInTheDocument();
  });
});
