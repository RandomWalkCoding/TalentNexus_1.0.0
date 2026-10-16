import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BenchmarkStructure, CompetitivenessReport, LevelMapping } from "@hr-console/contracts";
import { BenchmarkStructurePage, LevelBenchmarkPage, CompetitivenessPage } from "./BenchmarkPages";
import * as api from "./benchmark-api";

const mapping: LevelMapping = { id: "29100000-0000-4000-8000-000000000001", company: "Northstar AI", role: "产品经理", location: "beijing", series: "P", externalLevel: "Product 3", candidateLevels: ["P3", "P4"], confidence: 82, evidenceUrl: "https://jobs.example.com", rationale: "职责证据", status: "pending", selectedLevel: null, version: 1, updatedAt: "2026-10-10T00:00:00.000Z", history: [] };
const structure: BenchmarkStructure = { snapshotId: "29000000-0000-4000-8000-000000000001", calculationVersion: "v1", filters: { asOfDate: "2026-10-14", metric: "totalCash" }, minimumSampleCount: 3, source: "seed", samples: [], requestId: "test", groups: [{ location: "beijing", currency: "CNY", levelCode: "P4", role: "产品经理", series: "P", sampleCount: 1, eligibleCount: 1, insufficient: true, p25: null, p50: null, p75: null, sampleDate: "2026-10-10", totalCash: 100, employerCost: null, missing: ["股权年化估值"], components: [{ key: "equity", label: "股权年化估值", amount: null, share: null }] }] };

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("benchmark pages", () => {
  it("shows loading, sparse data and exports the rendered structure snapshot", async () => {
    vi.spyOn(api, "getStructure").mockResolvedValue(structure);
    const download = vi.spyOn(api, "exportBenchmark").mockImplementation(() => undefined);
    render(<MemoryRouter><BenchmarkStructurePage /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("正在读取");
    expect(await screen.findByText(/数据不足：未达到/)).toBeInTheDocument();
    expect(screen.getByText(/缺失项/)).toHaveTextContent("股权年化估值");
    fireEvent.click(screen.getByRole("button", { name: "导出结构快照" }));
    expect(download).toHaveBeenCalledWith(structure);
  });
  it("handles dependency failure with retry and empty state", async () => {
    vi.spyOn(api, "getStructure").mockRejectedValueOnce(new Error("服务暂时不可用")).mockResolvedValueOnce({ ...structure, groups: [] });
    render(<MemoryRouter><BenchmarkStructurePage /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("服务暂时不可用");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText(/暂无符合条件/)).toBeInTheDocument();
  });
  it("confirms a selected level with version and reviewer note", async () => {
    vi.spyOn(api, "getLevelMappings").mockResolvedValue({ items: [mapping], requestId: "test" });
    const review = vi.spyOn(api, "reviewLevelMapping").mockResolvedValue({ ok: true });
    render(<MemoryRouter><LevelBenchmarkPage /></MemoryRouter>);
    await screen.findByText("职责证据");
    expect(screen.getByRole("button", { name: "确认映射" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("确认职级"), { target: { value: "P4" } });
    fireEvent.change(screen.getByLabelText("审核备注"), { target: { value: "证据已核验" } });
    fireEvent.click(screen.getByRole("button", { name: "确认映射" }));
    await waitFor(() => expect(review).toHaveBeenCalledWith(mapping.id, { expectedVersion: 1, status: "confirmed", selectedLevel: "P4", note: "证据已核验" }));
    expect(await screen.findByRole("status")).toHaveTextContent("审核已保存");
  });
  it("disables mutation for readonly roles and missing source evidence", async () => {
    vi.spyOn(api, "getLevelMappings").mockResolvedValue({ items: [{ ...mapping, evidenceUrl: null }], requestId: "test" });
    render(<MemoryRouter><LevelBenchmarkPage canWrite={false} /></MemoryRouter>);
    await screen.findByText("无来源证据，暂不可确认。");
    expect(screen.getByLabelText("审核备注")).toBeDisabled();
    expect(screen.getByRole("button", { name: "确认映射" })).toBeDisabled();
  });
  it("keeps exported report tied to calculated inputs after the draft changes", async () => {
    const report = { snapshotId: "29000000-0000-4000-8000-000000000001", calculationVersion: "v1", createdAt: "2026-10-14T00:00:00.000Z", input: { role: "产品经理", levelCode: "P4", target: "p50", metric: "totalCash", asOfDate: "2026-10-14", plans: [] }, results: [], assumptionsVersion: "v1", exchangeRateDate: "2026-09-29", pppYear: 2026, macroSource: "seed", macroStale: false, minimumSampleCount: 3, requestId: "test" } as unknown as CompetitivenessReport;
    const compare = vi.spyOn(api, "compareCompetitiveness").mockResolvedValue(report);
    const download = vi.spyOn(api, "exportBenchmark").mockImplementation(() => undefined);
    render(<MemoryRouter><CompetitivenessPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "生成比较快照" }));
    await screen.findByRole("button", { name: "导出比较报告" });
    expect(compare).toHaveBeenCalledWith(expect.objectContaining({ plans: [expect.objectContaining({ annualCash: 570000 }), expect.objectContaining({ annualCash: 160000 })] }));
    fireEvent.change(screen.getByLabelText("年总现金 A（本币）"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "导出比较报告" }));
    expect(download).toHaveBeenCalledWith(report);
  });
  it("shows calculation and permission failures", async () => {
    vi.spyOn(api, "compareCompetitiveness").mockRejectedValue(new Error("没有访问权限"));
    render(<MemoryRouter><CompetitivenessPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "生成比较快照" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("没有访问权限");
    expect(screen.queryByRole("button", { name: "导出比较报告" })).not.toBeInTheDocument();
  });
});
