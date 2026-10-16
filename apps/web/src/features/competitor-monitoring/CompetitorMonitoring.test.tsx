import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompetitorMonitoring } from "./CompetitorMonitoring";
import { MemoryRouter } from "react-router-dom";

describe("CompetitorMonitoring", () => {
  it("renders fallback data and rolls back failed monitor update", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<MemoryRouter><CompetitorMonitoring /></MemoryRouter>);
    expect(await screen.findByText("Northstar AI")).toBeInTheDocument();
    const toggle = screen.getAllByRole("button", { name: "监测中" })[0]!;
    fireEvent.click(toggle);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "监测中" })[0]!).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Northstar AI/ }));
    expect(await screen.findByText("监测信号")).toBeInTheDocument();
  });
});
