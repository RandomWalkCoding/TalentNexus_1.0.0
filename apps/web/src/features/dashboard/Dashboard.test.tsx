import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { Dashboard } from "./Dashboard";

const dashboard = {
  stats: { talentCount: 5341, weeklyNew: 540, monitoredCompanies: 14 },
  recommendations: [
    { id: "northstar-ai", company: "Northstar AI", category: "生成式 AI", region: "美国 · 旧金山", signal: "企业版客户增长", estimatedSize: "15–25 人" },
    { id: "harbor-robotics", company: "Harbor Robotics", category: "机器人", region: "中国 · 深圳", signal: "完成融资", estimatedSize: "20–30 人" }
  ],
  followups: [
    { id: "fu-1", name: "林予安", role: "资深产品经理", company: "Northstar AI", summary: "等待本周回复", status: "跟进中", occurredAt: "2026-09-28T08:40:00.000Z" },
    { id: "fu-2", name: "周启明", role: "研发总监", company: "Harbor Robotics", summary: "确认下周沟通", status: "已回复", occurredAt: "2026-09-28T07:15:00.000Z" }
  ],
  outreach: { total: 128, repliesLast7Days: 18, events: [{ id: "event-1", title: "AI 产品人才专题", channel: "邮件", occurredAt: "2026-09-28T08:10:00.000Z", replies: 4, touched: 32 }] }
};

function response(body: unknown, ok = true): Response {
  return { ok, json: async () => body } as Response;
}

describe("Dashboard", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(dashboard)));
  });

  it("renders API data and filters the followup list", async () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText("5,341")).toBeInTheDocument();
    expect(screen.getByText("Northstar AI")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "按状态筛选跟进" }), { target: { value: "已回复" } });
    expect(screen.getByText("周启明")).toBeInTheDocument();
    expect(screen.queryByText("林予安")).not.toBeInTheDocument();
  });

  it("supports ignore and undo through the API", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(response(dashboard));
    fetchMock.mockResolvedValueOnce(response({ ok: true, message: "已忽略" }));
    fetchMock.mockResolvedValueOnce(response({ ok: true, message: "已恢复" }));
    fetchMock.mockResolvedValueOnce(response(dashboard));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText("Northstar AI")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "忽略" })[0]!);
    expect(await screen.findByText("已忽略 Northstar AI")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Northstar AI")).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "撤销" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/dashboard/recommendations/northstar-ai/restore", { method: "POST" }));
    expect(await screen.findByText("Northstar AI")).toBeInTheDocument();
  });

  it("persists the selected workbench layout and provides fallback data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<MemoryRouter><Dashboard /></MemoryRouter>);

    expect(await screen.findByText(/API 暂不可用/)).toBeInTheDocument();
    expect(screen.getByText("Northstar AI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "排版" }));
    expect(localStorage.getItem("hr-dashboard-view")).toBe("layout");
  });
});
