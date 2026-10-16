import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { JobLevels } from "./JobLevels";

describe("JobLevels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("API unavailable")));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("filters series, opens level details and selects company benchmarks", async () => {
    const { container } = render(<JobLevels />);

    expect(await screen.findByText("API 暂不可用，当前显示演示职级数据。" )).toBeInTheDocument();
    expect(container.querySelectorAll(".level-row")).toHaveLength(7);

    fireEvent.click(screen.getByRole("button", { name: /^T$/ }));
    await waitFor(() => expect(container.querySelectorAll(".level-row")).toHaveLength(1));
    expect(container.querySelectorAll(".level-band")).toHaveLength(4);

    fireEvent.click(container.querySelector(".level-band") as HTMLButtonElement);
    expect(screen.getByLabelText("职级详情")).toBeInTheDocument();
    expect(screen.getByText(/Survey Grade 4–5/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Google/ }));
    expect(screen.getByLabelText("已选公司对比")).toHaveTextContent("Google");
  });
});
