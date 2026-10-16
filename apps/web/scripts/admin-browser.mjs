import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

const base = process.env.WEB_URL || "http://127.0.0.1:5173";
const output = resolve("output/playwright/stage07");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const errors = [];
const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function capture(page, name) {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), `${name}: page overflow`);
  await page.screenshot({ path: resolve(output, `${name}.png`), fullPage: true });
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", (error) => {
    if (!/aborted without reason|AbortError/i.test(error.message)) errors.push(error.message);
  });
  await page.goto(`${base}/admin`);
  const loginButton = page.getByRole("button", { name: "登录 TalentNexus" });
  const accountButton = page.getByRole("button", { name: /Rachel/ });
  await Promise.race([loginButton.waitFor({ state: "visible" }), accountButton.waitFor({ state: "visible" })]);
  if (await loginButton.isVisible().catch(() => false)) {
    await page.getByLabel("邮箱").fill("rachel@talentnexus.local");
    await page.getByLabel("密码").fill("TalentNexus07!");
    await loginButton.click();
  }
  await page.getByRole("button", { name: /Rachel/ }).waitFor();
  await page.getByRole("button", { name: "新增用户" }).waitFor();
  await page.getByText("rachel@talentnexus.local").waitFor();
  await capture(page, "admin-users-1440");
  const unique = Date.now();
  const name = `回归用户${unique}`;
  await page.getByRole("button", { name: "新增用户" }).click();
  await page.getByLabel("姓名", { exact: true }).fill(name);
  await page.getByLabel("邮箱", { exact: true }).fill(`browser-${unique}@example.test`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByText("已保存", { exact: true }).waitFor();
  const userRow = page.getByRole("row").filter({ hasText: name });
  await userRow.getByRole("button", { name: `编辑${name}角色` }).waitFor();
  await userRow.getByRole("button", { name: `编辑${name}角色` }).click();
  await page.getByRole("heading", { name: "编辑用户" }).waitFor();
  await page.locator('select[name="role"]').selectOption("manager");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("heading", { name: "编辑用户" }).waitFor({ state: "hidden" });
  await userRow.getByText("业务管理者", { exact: true }).waitFor();
  await userRow.getByRole("button", { name: `停用${name}` }).click();
  await userRow.getByRole("button", { name: `启用${name}` }).waitFor();
  await page.getByRole("tab", { name: "用户", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("tabpanel", { name: "角色与权限" }).getByText("admin:write", { exact: true }).waitFor();
  assert(await page.getByRole("tab", { name: "角色与权限" }).evaluate((element) => element === document.activeElement), "tab keyboard focus lost");
  await capture(page, "admin-roles-1440");
  await page.getByRole("tab", { name: "字典", exact: true }).click();
  await page.getByRole("button", { name: "新增字典" }).click();
  await page.getByLabel("分组", { exact: true }).fill("browser-regression");
  await page.getByLabel("编码", { exact: true }).fill(`test-${unique}`);
  await page.getByLabel("名称", { exact: true }).fill(`回归字典${unique}`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: `编辑回归字典${unique}` }).click();
  await page.getByLabel("名称", { exact: true }).fill(`已编辑字典${unique}`);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.getByRole("button", { name: `停用已编辑字典${unique}` }).click();
  await page.getByRole("button", { name: `启用已编辑字典${unique}` }).waitFor();
  await capture(page, "admin-dictionaries-1440");
  await page.getByRole("tab", { name: "操作日志" }).click();
  await page.getByRole("cell", { name: "patch.admin", exact: true }).first().waitFor();
  await capture(page, "admin-audit-1440");

  const original = (await (await page.request.get(`${base}/api/v1/me`)).json()).preferences;
  try {
    await page.goto(`${base}/settings`);
    await page.getByRole("button", { name: "保存偏好" }).waitFor();
    await page.getByText("PostgreSQL 云端数据库").waitFor();
    await page.getByText("已连接", { exact: true }).waitFor();
    await page.getByLabel("默认地区").selectOption("shanghai");
    await page.getByLabel("默认币种").selectOption("USD");
    await page.getByRole("button", { name: "浅色", exact: true }).click();
    await page.getByRole("button", { name: "紧凑", exact: true }).click();
    await page.getByRole("checkbox", { name: "通知", exact: true }).uncheck();
    await page.getByRole("button", { name: "保存偏好" }).click();
    await page.getByText("偏好已保存").waitFor();
    await page.reload();
    await page.waitForLoadState("networkidle");
    assert(await page.getByLabel("默认地区").inputValue() === "shanghai", "location not persisted");
    assert(await page.getByLabel("默认币种").inputValue() === "USD", "currency not persisted");
    assert(await page.getByRole("checkbox", { name: "通知", exact: true }).isChecked() === false, "notifications not persisted");
    assert(await page.evaluate(() => document.documentElement.dataset.theme === "light" && document.documentElement.dataset.density === "compact"), "display settings not persisted");
    await capture(page, "settings-light-1440");
  } finally {
    await page.request.patch(`${base}/api/v1/me/preferences`, { data: original });
  }

  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["admin", "settings", "dashboard", "job-levels", "compensation"]) {
      await page.goto(`${base}/${path}`);
      await page.waitForLoadState("networkidle");
      await capture(page, `${path}-${width}`);
    }
    await page.getByRole("link", { name: "查看分析" }).click();
    await page.locator(".analysis-page").waitFor();
    await capture(page, `compensation-analysis-${width}`);
  }

  await page.route("**/api/v1/admin/users?**", (route) => route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: "PERMISSION_DENIED" } }) }));
  await page.goto(`${base}/admin`);
  await page.getByRole("alert").filter({ hasText: "没有访问此资源的权限" }).waitFor();
  await capture(page, "admin-forbidden-mobile");
  await page.unroute("**/api/v1/admin/users?**");
  await page.route("**/api/v1/admin/users?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [], total: 0, page: 1, pageSize: 20, requestId: "empty-test" }) }));
  await page.reload();
  await page.getByText("暂无记录", { exact: true }).waitFor();
  await capture(page, "admin-empty-mobile");
  await page.unroute("**/api/v1/admin/users?**");
  await page.route("**/api/v1/admin/users?**", () => {});
  await page.goto(`${base}/admin`, { waitUntil: "domcontentloaded" });
  await page.getByRole("alert").filter({ hasText: "请求超时，请重试" }).waitFor({ timeout: 20000 });
  await capture(page, "admin-timeout-mobile");
  await page.unroute("**/api/v1/admin/users?**");
  assert(errors.length === 0, errors.join("\n"));
  console.log(`Stage 07 browser regression passed; screenshots: ${output}`);
} finally {
  await browser.close();
}
