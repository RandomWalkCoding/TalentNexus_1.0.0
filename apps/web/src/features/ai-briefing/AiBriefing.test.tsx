import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiBriefing } from "./AiBriefing";

describe("AiBriefing", () => {
  it("renders signals and supports mark-all-read and detail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<AiBriefing />);
    expect(await screen.findByText("今日值得关注的市场变化")).toBeInTheDocument();
    expect(screen.getByText(/条未读/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /全部标记已读/ }));
    fireEvent.click(screen.getByRole("button", { name: /生成式 AI 企业采购/ }));
    expect(await screen.findByText("分析内容")).toBeInTheDocument();
  });
});
