import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.WEB_URL || "http://127.0.0.1:5173";
const output = resolve("output/playwright/stage05");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(`${base}/job-levels`);
  await desktop.waitForLoadState("networkidle");
  await desktop.screenshot({ path: resolve(output, "stage04-job-levels-1440.png"), fullPage: true });
  if (await desktop.getByRole("heading", { name: "职级体系" }).count() !== 1) throw new Error("stage 04 page missing");
  if (await desktop.locator(".level-row").count() !== 7) throw new Error("stage 04 level rows missing");

  await desktop.goto(`${base}/compensation`);
  await desktop.waitForLoadState("networkidle");
  await desktop.getByText("北京", { exact: true }).last().waitFor();
  await desktop.screenshot({ path: resolve(output, "stage05-compensation-1440.png"), fullPage: true });
  if (await desktop.getByText("上海", { exact: true }).last().count() !== 1) throw new Error("Shanghai result missing");
  if (await desktop.getByText("中国香港", { exact: true }).last().count() !== 1) throw new Error("Hong Kong result missing");
  await desktop.getByLabel("月薪（税前）").fill("35000");
  await desktop.waitForTimeout(500);
  if (await desktop.locator("text=/快照 calc-/").count() !== 1) throw new Error("calculation snapshot missing");
  await desktop.getByRole("link", { name: "查看分析" }).click();
  await desktop.locator(".analysis-page").waitFor({ state: "visible", timeout: 5000 });
  console.log(`analysis url: ${desktop.url()}`);
  console.log((await desktop.locator("body").innerText()).slice(0, 1200));
  for (const label of ["企业总成本（年）", "候选人侧（税前 → 到手）", "月度到手曲线"]) {
    if (await desktop.getByText(label, { exact: true }).count() !== 1) throw new Error(`${label} missing`);
  }
  await desktop.screenshot({ path: resolve(output, "stage05-analysis-1440.png"), fullPage: true });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${base}/compensation`);
  await mobile.waitForLoadState("networkidle");
  await mobile.getByText("北京", { exact: true }).last().waitFor();
  await mobile.screenshot({ path: resolve(output, "stage05-compensation-mobile.png"), fullPage: true });
  const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error(`mobile horizontal overflow ${overflow}px`);
  console.log(`Stage 04/05 browser smoke passed; screenshots: ${output}`);
} finally {
  await browser.close();
}
