import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.WEB_URL || "http://127.0.0.1:5173";
const output = resolve("output/playwright/stage03");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : { channel: "chrome" }) });
const paths = ["intelligence", "competitor-monitoring", "ai-briefing", "leads", "talent-pool", "research-tasks", "outreach", "mapping"];
const problems = [];

try {
  for (const width of [1440, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("pageerror", (error) => problems.push(`${width}: ${error.message}`));
    for (const path of paths) {
      await page.goto(`${base}/${path}`);
      await page.waitForLoadState("networkidle");
      await page.locator(".operation-loading").waitFor({ state: "hidden" });
      if (await page.locator(".operations-page").count() !== 1) problems.push(`${width}/${path}: missing page`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflow > 2) problems.push(`${width}/${path}: horizontal overflow ${overflow}px`);
      await page.screenshot({ path: resolve(output, `${path}-${width}.png`), fullPage: true });
    }
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const lead = { id: "test-lead", subject: "浏览器验证线索", company: "示例公司", owner: "测试负责人", score: 70, stage: "new", summary: "测试记录", updatedAt: new Date().toISOString() };
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (!new URL(request.url()).pathname.startsWith("/api/v1/leads")) { await route.continue(); return; }
    if (request.method() === "POST") Object.assign(lead, request.postDataJSON(), { id: "test-lead", updatedAt: new Date().toISOString() });
    if (request.method() === "PATCH") Object.assign(lead, request.postDataJSON(), { updatedAt: new Date().toISOString() });
    const body = new URL(request.url()).pathname === "/api/v1/leads/test-lead" ? request.method() === "PATCH" ? { ok: true, item: lead } : lead : request.method() === "POST" ? { ok: true, item: lead } : { items: lead.subject === "浏览器验证线索" ? [] : [lead], total: lead.subject === "浏览器验证线索" ? 0 : 1, page: 1, pageSize: 20, requestId: "browser-test" };
    // Start with an empty list, then expose the created record on the next refresh.
    await route.fulfill({ status: request.method() === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto(`${base}/leads`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "新建" }).click();
  const drawer = page.getByRole("dialog", { name: "新建记录" });
  await drawer.getByRole("textbox", { name: "名称" }).fill("新机会");
  await drawer.getByRole("textbox", { name: "公司" }).fill("示例公司");
  await drawer.getByRole("textbox", { name: "摘要" }).fill("待跟进");
  await drawer.getByRole("textbox", { name: "负责人" }).fill("测试负责人");
  await drawer.getByRole("button", { name: "创建记录" }).click();
  await page.getByRole("status").filter({ hasText: "记录已创建" }).waitFor();
  await page.getByRole("button", { name: /新机会/ }).first().click();
  const detail = page.getByRole("dialog", { name: "记录详情" });
  await page.locator(".operation-loading").waitFor({ state: "hidden" });
  await detail.getByRole("combobox", { name: "阶段" }).selectOption("qualified");
  await detail.getByRole("button", { name: "保存更改" }).click();
  await page.getByRole("status").filter({ hasText: "已保存更改" }).waitFor();
  if (lead.stage !== "qualified") problems.push("lead edit did not reach API");
  await page.screenshot({ path: resolve(output, "lead-edited.png"), fullPage: true });
  await context.close();

  for (const [resource, path] of [["research-tasks", "research-tasks"], ["outreach", "outreach"]]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 } });
    const page = await context.newPage();
    let record = null;
    await page.route("**/api/v1/**", async (route) => {
      const request = route.request();
      if (!new URL(request.url()).pathname.startsWith(`/api/v1/${resource}`)) { await route.continue(); return; }
      if (request.method() === "POST") record = { ...request.postDataJSON(), id: "created", updatedAt: new Date().toISOString() };
      await route.fulfill({ status: request.method() === "POST" ? 201 : 200, contentType: "application/json", body: JSON.stringify(request.method() === "POST" ? { item: record } : { items: record ? [record] : [], total: record ? 1 : 0, page: 1, pageSize: 20, requestId: "browser-test" }) });
    });
    await page.goto(`${base}/${path}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "新建" }).click();
    const drawer = page.getByRole("dialog", { name: "新建记录" });
    await drawer.getByRole("textbox", { name: "名称" }).fill("浏览器创建");
    await drawer.getByRole("textbox", { name: "摘要" }).fill("测试摘要");
    if (resource === "research-tasks") {
      await drawer.getByRole("textbox", { name: "摸排目标" }).fill("示例公司");
      await drawer.getByRole("textbox", { name: "负责人" }).fill("负责人");
      await drawer.getByLabel("截止日期").fill("2026-10-01");
      await drawer.getByRole("textbox", { name: "摸排成果" }).fill("岗位名单");
    } else {
      await drawer.getByRole("spinbutton", { name: "目标人数" }).fill("5");
      await drawer.getByRole("spinbutton", { name: "发送数" }).fill("3");
      await drawer.getByRole("spinbutton", { name: "回复数" }).fill("4");
      await drawer.getByRole("button", { name: "创建记录" }).click();
      await drawer.getByRole("alert").waitFor();
      if (record) problems.push("invalid outreach was submitted");
      await drawer.getByRole("spinbutton", { name: "回复数" }).fill("1");
    }
    await page.screenshot({ path: resolve(output, `${resource}-create-mobile.png`), fullPage: true });
    await drawer.getByRole("button", { name: "创建记录" }).click();
    await page.getByRole("status").filter({ hasText: "记录已创建" }).waitFor();
    if (!record) problems.push(`${resource} creation failed`);
    await context.close();
  }

  const toolsContext = await browser.newContext({ viewport: { width: 390, height: 900 }, acceptDownloads: true });
  const toolsPage = await toolsContext.newPage();
  const mapping = { source: "公司 / 岗位", target: "P5", type: "role", confidence: 80, summary: "样本" };
  const importBatchSizes = [];
  const talent = { id: "talent-test", name: "测试人才", title: "工程师", company: "公司", category: "技术", location: "上海", tags: ["AI"], updatedAt: new Date().toISOString() };
  const categories = [{ name: "技术", owner: "未分配", count: 1 }, { name: "未分类", owner: "未分配", count: 0 }];
  await toolsPage.route("**/api/v1/**", async (route) => {
    const request = route.request(); const path = new URL(request.url()).pathname; let body;
    if (path === "/api/v1/mapping/import") { const items = request.postDataJSON().items; importBatchSizes.push(items.length); body = { imported: items.length }; }
    else if (path === "/api/v1/mapping/export") body = { items: Array.from({ length: 101 }, () => mapping) };
    else if (path === "/api/v1/mapping") body = { items: [{ ...mapping, id: "map-test", updatedAt: new Date().toISOString() }], total: 1, page: 1, pageSize: 20, requestId: "browser-test" };
    else if (path === "/api/v1/talent-categories") body = { items: categories, requestId: "browser-test" };
    else if (path.startsWith("/api/v1/talent-categories/") && request.method() === "PATCH") { Object.assign(categories[0], request.postDataJSON()); body = { ok: true }; }
    else if (path === "/api/v1/talents/talent-test") { if (request.method() === "PATCH") { Object.assign(talent, request.postDataJSON()); categories[0].count = 0; categories[1].count = 1; } body = request.method() === "PATCH" ? { item: talent } : talent; }
    else if (path === "/api/v1/talents") body = { items: [talent], total: 1, page: 1, pageSize: 20, requestId: "browser-test" };
    else { await route.continue(); return; }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
  await toolsPage.goto(`${base}/mapping`); await toolsPage.waitForLoadState("networkidle");
  await toolsPage.getByLabel("导入映射文件").setInputFiles({ name: "mapping.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ items: Array.from({ length: 101 }, () => mapping) })) });
  await toolsPage.getByRole("status").filter({ hasText: "已导入 101 条" }).waitFor();
  if (importBatchSizes.join(",") !== "100,1") problems.push(`mapping import batches: ${importBatchSizes.join(",")}`);
  const downloadPromise = toolsPage.waitForEvent("download");
  await toolsPage.getByRole("button", { name: "导出" }).click();
  await (await downloadPromise).saveAs(resolve(output, "mapping-export.json"));
  await toolsPage.goto(`${base}/talent-pool`); await toolsPage.waitForLoadState("networkidle");
  await toolsPage.getByRole("button", { name: /测试人才/ }).click();
  const talentDrawer = toolsPage.getByRole("dialog", { name: "记录详情" });
  await talentDrawer.getByRole("combobox", { name: "分类" }).selectOption("未分类");
  await talentDrawer.getByRole("button", { name: "保存分类" }).click();
  await toolsPage.getByRole("status").filter({ hasText: "已保存更改" }).waitFor();
  await toolsPage.keyboard.press("Escape");
  await toolsPage.getByText("分类管理", { exact: true }).click();
  await toolsPage.getByRole("textbox", { name: "技术分类名称" }).fill("研发");
  await toolsPage.getByRole("textbox", { name: "技术负责人" }).fill("负责人");
  await toolsPage.getByRole("button", { name: "保存技术分类" }).click();
  await toolsPage.getByRole("status").filter({ hasText: "分类已保存" }).waitFor();
  if (talent.category !== "未分类" || categories[0].name !== "研发") problems.push("talent category write mismatch");
  await toolsPage.screenshot({ path: resolve(output, "category-edited-mobile.png"), fullPage: true });
  if (await toolsPage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) > 2) problems.push("expanded category manager overflows on mobile");
  await toolsContext.close();
} finally {
  await browser.close();
}
if (problems.length) { console.error(problems.join("\n")); process.exitCode = 1; }
else console.log(`Stage 03 browser smoke passed; screenshots: ${output}`);
