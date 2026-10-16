import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPage } from "./AdminPage";
import { SettingsPage } from "./SettingsPage";

const user = { id: "00000000-0000-4000-8000-000000000001", name: "测试用户", email: "hr@example.test", role: "admin", status: "active", updatedAt: "2026-10-01T00:00:00.000Z" };
const preferences = { theme: "dark", density: "comfortable", notifications: true, defaultLocation: "beijing", defaultCurrency: "CNY" };
const me = { user, permissions: ["admin:read", "admin:write", "settings:write"], preferences };
const list = (items: unknown[]) => ({ items, total: items.length, page: 1, pageSize: 20, requestId: "test" });

describe("administration workflows", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (url.includes("me/preferences")) return new Response(JSON.stringify({ preferences: JSON.parse(options?.body as string) }), { status: 200 });
    if (url.endsWith("/me")) return new Response(JSON.stringify(me));
    if (url.includes("storage/status")) return new Response(JSON.stringify({ provider: "postgresql", connected: true, lastSyncedAt: "2026-10-05T08:00:00.000Z", scopes: ["个人偏好", "业务数据"], requestId: "storage-test" }));
    if (options?.method) return new Response(JSON.stringify({ ok: true }));
    if (url.includes("dictionaries")) return new Response(JSON.stringify(list([{ id: user.id, group: "lead-stage", code: "new", label: "新线索", enabled: true, updatedAt: user.updatedAt }])));
    return new Response(JSON.stringify(list([user])));
  })));
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it("loads users and submits creation using contract fields", async () => {
    render(<AdminPage />);
    expect(await screen.findByText("hr@example.test")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "新增用户" }));
    fireEvent.change(screen.getByLabelText("姓名"), { target: { value: "新用户" } });
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "new@example.test" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(await screen.findByText("已保存")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/admin/users", expect.objectContaining({ method: "POST", body: JSON.stringify({ name: "新用户", email: "new@example.test", role: "hr" }) }));
  });
  it("loads dictionaries and submits status changes", async () => {
    render(<AdminPage />);
    fireEvent.click(screen.getByRole("tab", { name: "字典" }));
    expect(await screen.findByText("新线索")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "停用新线索" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/v1/admin/dictionaries/${user.id}`, expect.objectContaining({ method: "PATCH", body: JSON.stringify({ enabled: false }) })));
  });
  it("shows forbidden errors and never invents administrative records", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: {} }), { status: 403 })));
    render(<AdminPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("没有访问此资源的权限");
    expect(screen.queryByRole("button", { name: "新增用户" })).not.toBeInTheDocument();
    expect(screen.queryByText("hr@example.test")).not.toBeInTheDocument();
  });
  it("saves notification, location, currency and display preferences", async () => {
    render(<SettingsPage theme="light" density="compact" setTheme={vi.fn()} setDensity={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "保存偏好" })).toBeEnabled());
    fireEvent.click(screen.getByLabelText("通知"));
    fireEvent.change(screen.getByLabelText("默认地区"), { target: { value: "shanghai" } });
    fireEvent.change(screen.getByLabelText("默认币种"), { target: { value: "USD" } });
    fireEvent.click(screen.getByRole("button", { name: "保存偏好" }));
    expect(await screen.findByText("偏好已保存")).toBeInTheDocument();
    expect(screen.getByText("PostgreSQL 云端数据库")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/v1/me/preferences", expect.objectContaining({ method: "PATCH", body: JSON.stringify({ theme: "light", density: "compact", notifications: false, defaultLocation: "shanghai", defaultCurrency: "USD" }) }));
  });
});
