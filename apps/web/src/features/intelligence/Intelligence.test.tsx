import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Intelligence } from "./Intelligence";

describe("Intelligence", () => {
  it("renders fallback data and opens detail drawer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<Intelligence />);
    expect(await screen.findByText("生成式 AI 企业采购进入规模化阶段")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /生成式 AI 企业采购/ }));
    await waitFor(() => expect(screen.getByText("详细内容")).toBeInTheDocument());
  });
});
