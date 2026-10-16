import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { WorkflowPage } from "./WorkflowPage";

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("WorkflowPage", () => {
  it("submits search, filters, opens detail and retains state", async () => {
    const fetchMock = vi.fn(async (input: string) => {
      if (input.includes("/lead-1")) return { ok: true, json: async () => ({ id: "lead-1", subject: "Northstar AI", company: "Northstar AI", stage: "new", owner: "Rachel", score: 80, summary: "新增线索", updatedAt: "2026-09-28T08:00:00.000Z" }) };
      return { ok: true, json: async () => ({ items: [{ id: "lead-1", subject: "Northstar AI", company: "Northstar AI", stage: "new", owner: "Rachel", score: 80, summary: "新增线索", updatedAt: "2026-09-28T08:00:00.000Z" }], total: 21, page: Number(new URL(input, "http://local").searchParams.get("page")), pageSize: 20, requestId: "req-1" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><WorkflowPage resource="leads" /></MemoryRouter>);
    await screen.findByText("新增线索");
    const calls = fetchMock.mock.calls.length;
    fireEvent.change(screen.getByRole("textbox", { name: "搜索记录" }), { target: { value: "Northstar" } });
    expect(fetchMock).toHaveBeenCalledTimes(calls);
    fireEvent.click(screen.getByRole("button", { name: "搜索" }));
    await waitFor(() => expect(fetchMock.mock.lastCall?.[0]).toContain("q=Northstar"));
    fireEvent.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(fetchMock.mock.lastCall?.[0]).toContain("page=2"));
    fireEvent.click(screen.getByRole("button", { name: /Northstar AI/ }));
    expect(await screen.findByRole("dialog", { name: "记录详情" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "关闭详情" }));
    expect(screen.getByText("第 2 页 / 共 2 页")).toBeInTheDocument();
  });

  it("keeps the original status after a failed update", async () => {
    const task = { id: "task-1", name: "任务 A", status: "todo", progress: 0, owner: "Rachel", target: "公司", summary: "摸排", updatedAt: "2026-09-28T08:00:00.000Z" };
    vi.stubGlobal("fetch", vi.fn(async (input: string, options?: { method?: string }) => options?.method === "PATCH" ? { ok: false } : { ok: true, json: async () => input.endsWith("/task-1") ? task : { items: [task], total: 1, page: 1, pageSize: 20, requestId: "req-1" } }));
    render(<MemoryRouter><WorkflowPage resource="research-tasks" /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "待开始" }));
    const drawer = await screen.findByRole("dialog", { name: "记录详情" });
    fireEvent.change(within(drawer).getByRole("combobox", { name: "状态" }), { target: { value: "done" } });
    fireEvent.click(within(drawer).getByRole("button", { name: "保存更改" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("保存失败");
    expect(screen.getByRole("button", { name: "待开始" })).toBeInTheDocument();
  });
});
