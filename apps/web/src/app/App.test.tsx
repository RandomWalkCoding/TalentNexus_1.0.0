import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { App } from "./App";

describe("App", () => {
  afterEach(cleanup);
  beforeEach(() => {
    window.history.replaceState({}, "", "/dashboard");
    localStorage.clear();
  });

  it("renders the navigation shell", () => {
    render(<App />);

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "情报中心" })).toHaveAttribute("href", "/intelligence");
    expect(screen.getByRole("button", { name: "切换浅色主题" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "情报中心" }));
    expect(screen.getByRole("heading", { name: "情报中心" })).toBeInTheDocument();
  });

  it("persists the theme setting", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "切换浅色主题" }));
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(localStorage.getItem("hr-theme")).toBe("light");
  });

  it("searches and opens a route", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /搜索模块/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "搜索模块" }), { target: { value: "职级" } });
    fireEvent.click(screen.getByRole("button", { name: /职级体系/ }));
    await waitFor(() => expect(window.location.pathname).toBe("/job-levels"));
  });

  it("shows a recovery link for unknown routes", () => {
    window.history.replaceState({}, "", "/unknown");
    render(<App />);
    expect(screen.getByRole("heading", { name: "页面未找到" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "返回工作台" })).toHaveAttribute("href", "/dashboard");
  });
});
