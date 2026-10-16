import { chromium, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.WEB_URL || "http://127.0.0.1:5199";
const output = resolve("output/playwright/stage09");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const problems = [];
try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on("pageerror", error => problems.push(`${width}: ${error.message}`));
    await page.goto(`${base}/compensation/analysis`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "登录 TalentNexus" }).or(page.getByRole("heading", { name: "薪酬结构分析", exact: true }))).toBeVisible();
    if (await page.getByRole("button", { name: "登录 TalentNexus" }).isVisible().catch(() => false)) {
      await page.getByLabel("邮箱").fill("rachel@talentnexus.local");
      await page.getByLabel("密码", { exact: true }).fill("TalentNexus07!");
      await page.getByRole("button", { name: "登录 TalentNexus" }).click();
    }
    await expect(page.getByRole("heading", { name: "薪酬结构分析", exact: true })).toBeVisible();
    await expect(page.getByText(/最低有效样本/)).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `structure-${width}.png`), fullPage: true });
    await page.locator(".benchmark-filters select").first().selectOption("shenzhen");
    await expect(page.getByText(/数据不足：未达到/)).toBeVisible();
    await page.getByLabel("公司", { exact: true }).fill("无样本公司");
    await expect(page.getByText(/暂无符合条件/)).toBeVisible();
    await page.goto(`${base}/job-levels/benchmarks`);
    await expect(page.getByText("无来源证据，暂不可确认。")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `mapping-${width}.png`), fullPage: true });
    if (width === 1440) {
      const card = page.locator("article").filter({ hasText: "Northstar AI" });
      await card.getByLabel("确认职级").selectOption("P4");
      await card.getByLabel("审核备注").fill("浏览器验收：演示职责证据已核验");
      await card.getByRole("button", { name: "确认映射" }).click();
      await expect(page.getByText("审核已保存，历史版本可追溯。")).toBeVisible();
      await expect(card.getByText(/已确认/)).toBeVisible();
      await card.getByText(/历史记录/).click();
      await expect(card.locator("details p").filter({ hasText: "浏览器验收：演示职责证据已核验" }).first()).toBeVisible();
    }
    await page.goto(`${base}/compensation/competitiveness`);
    await page.getByRole("button", { name: "生成比较快照" }).click();
    await expect(page.getByRole("button", { name: "导出比较报告" })).toBeVisible();
    await expect(page.getByText("CNY 570,000", { exact: true }).first()).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: resolve(output, `competitiveness-${width}.png`), fullPage: true });
    const reportRequest = page.waitForResponse(response => response.url().endsWith("/compensation/competitiveness") && response.request().method() === "POST");
    await page.getByRole("button", { name: "生成比较快照" }).click();
    const report = await (await reportRequest).json();
    await expect(page.getByText(new RegExp(report.snapshotId))).toBeVisible();
    const saved = await context.request.get(`${base}/api/v1/compensation/reports/${report.snapshotId}`);
    expect(await saved.json()).toEqual(report);
    expect(report.results[0].trend.at(-1).takeHome).toBe(report.results[0].takeHome);
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "导出比较报告" }).click();
    expect((await download).suggestedFilename()).toBe(`benchmark-${report.snapshotId}.json`);
    for (const path of ["compensation/analysis", "job-levels/benchmarks", "compensation/competitiveness"]) {
      await page.goto(`${base}/${path}`);
      await expect(page.locator("main")).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) problems.push(`${width}/${path}: overflow ${overflow}`);
    }
    await context.close();
  }
  if (problems.length) throw new Error(problems.join("\n"));
  console.log("Stage09: real database, login, review history, A/B comparison, snapshot retrieval, export, 1440px/390px checks passed.");
} finally { await browser.close(); }
