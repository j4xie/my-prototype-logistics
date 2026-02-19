import { test, expect, Page } from "@playwright/test";
import path from "path";

const SCREENSHOT_DIR = path.resolve(__dirname, "../../../test-screenshots/smartbi-ui-audit-20260218");

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  const u = page.locator("input[placeholder*=用户名]").first();
  const p = page.locator("input[type=password]").first();
  await u.fill("factory_admin1");
  await p.fill("123456");
  await page.waitForTimeout(500);
  await page.locator(".login-button").first().click();
  await page.waitForTimeout(5000);
}

async function ss(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, name + ".png"), fullPage: true });
}

test.describe("Test A: Sales Analysis", () => {
  test("A1 - Full audit", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/sales", { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);
    await ss(page, "A1-sales-initial");
    const kc = page.locator(".kpi-card");
    const kn = await kc.count();
    console.log("KPI_CARD_COUNT: " + kn);
    for (let i=0;i<kn;i++) { console.log("KPI_" + i + ": " + ((await kc.nth(i).textContent())||"")); }
    const ib = page.locator(".el-alert--info");
    for (let i=0;i<await ib.count();i++) console.log("INFO_BANNER: " + (await ib.nth(i).textContent()||""));
    const eb = page.locator(".el-alert--error");
    for (let i=0;i<await eb.count();i++) console.log("ERROR_BANNER: " + (await eb.nth(i).textContent()||""));
    console.log("RANKING_ROWS: " + await page.locator(".ranking-card .el-table__row").count());
    console.log("RANKING_EMPTY: " + (await page.locator(".ranking-card .el-empty").count()>0));
    console.log("CHART_CARDS: " + await page.locator(".chart-card").count());
    console.log("CANVASES: " + await page.locator("canvas").count());
    console.log("FILTER_ITEMS: " + await page.locator(".filter-item").count());
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(2000);
    await ss(page, "A1-sales-scrolled");
    console.log("EXPLORATION: " + await page.locator(".exploration-card").count());
    console.log("INSIGHTS: " + await page.locator(".insight-card").count());
  });

  test("A2 - Date filter", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/sales", { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    const dp = page.locator(".el-date-editor").first();
    if (await dp.isVisible()) {
      await dp.click();
      await page.waitForTimeout(1000);
      await ss(page, "A2-date-picker-open");
      const sc = page.locator(".el-picker-panel__shortcut");
      const sn = await sc.count();
      console.log("DATE_SHORTCUTS: " + sn);
      for (let i=0;i<sn;i++) console.log("SC_" + i + ": " + (await sc.nth(i).textContent()||""));
      if (sn>=3) { await sc.nth(2).click(); await page.waitForTimeout(3000); console.log("CLICKED_SC_2"); }
    }
    await ss(page, "A2-date-filter-result");
  });

  test("A3 - Data source switch", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/sales", { waitUntil: "networkidle" });
    await page.waitForTimeout(6000);
    await ss(page, "A3-before");
    const ds = page.locator(".filter-item .el-select").first();
    if (await ds.isVisible()) {
      await ds.click();
      await page.waitForTimeout(1500);
      await ss(page, "A3-dropdown");
      const opts = page.locator(".el-select-dropdown__item:visible");
      const oc = await opts.count();
      console.log("DS_OPT_COUNT: " + oc);
      for (let i=0;i<Math.min(oc,8);i++) console.log("DS_" + i + ": " + (await opts.nth(i).textContent()||""));
      if (oc > 1) {
        await opts.nth(1).click();
        await page.waitForTimeout(8000);
        await ss(page, "A3-uploaded");
        console.log("SWITCHED: true");
        console.log("KPI_AFTER: " + await page.locator(".kpi-card").count());
        console.log("CANVAS_AFTER: " + await page.locator("canvas").count());
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(2000);
        await ss(page, "A3-uploaded-scroll");
      }
    } else { console.log("DS_SELECT: NOT VISIBLE"); }
  });
});

test.describe("Test B: AI Query", () => {
  test("B1 - Initial state", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/query", { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    await ss(page, "B1-initial");
    const sel = page.locator(".el-select");
    console.log("SELECT_COUNT: " + await sel.count());
    for (let i=0;i<await sel.count();i++) console.log("SEL_" + i + ": " + ((await sel.nth(i).textContent())||""));
    console.log("INPUT_COUNT: " + await page.locator("input.el-input__inner, textarea").count());
    const bt = await page.textContent("body") || "";
    console.log("HAS_WELCOME: " + bt.includes("SmartBI"));
    const tpl = page.locator(".template-card, .template-item");
    console.log("TEMPLATE_CARDS: " + await tpl.count());
    for (let i=0;i<Math.min(await tpl.count(),6);i++) console.log("TPL_" + i + ": " + ((await tpl.nth(i).textContent())||""));
    await page.evaluate(() => window.scrollTo(0,document.body.scrollHeight));
    await page.waitForTimeout(1000);
    await ss(page, "B1-scrolled");
  });

  test("B2 - Revenue trend query", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/query", { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    const ci = page.locator(".input-area textarea").first();  //
    await ci.fill("");
    await ci.type("分析各月份收入趋势", { delay: 50 });
    await page.waitForTimeout(500);
    await ss(page, "B2-typed");
    await page.locator(".input-area button").first().click();
    console.log("B2_SENT: true");
    let got = false;
    for (let i=0;i<12;i++) {
      await page.waitForTimeout(5000);
      const ld = page.locator(".typing-indicator:visible, .el-loading-mask:visible");
      if (await ld.count()===0 && i>=1) { got=true; console.log("B2_TIME: ~" + ((i+1)*5) + "s"); break; }
    }
    await ss(page, "B2-response");
    const bt = await page.textContent("body") || "";
    console.log("B2_GOT: " + got);
    console.log("B2_HANGCI: " + bt.includes("行次"));
    console.log("B2_COLXX: " + /Column_d+/.test(bt));
    const ms = page.locator(".chat-message, .message-bubble, .message-text, .message-content");
    console.log("B2_MSGS: " + await ms.count());
    for (let i=0;i<await ms.count();i++) { const t=(await ms.nth(i).textContent()||""); if(t.length>10) console.log("B2_M" + i + ": " + t.slice(0,300)); }
    console.log("B2_CHARTS: " + await page.locator("canvas").count());
  });

  test("B3 - Budget comparison", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/query", { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    const ci = page.locator(".input-area textarea").first();  //
    await ci.fill("");
    await ci.type("对比预算和实际金额", { delay: 50 });
    await page.waitForTimeout(500);
    await page.locator(".input-area button").first().click();
    console.log("B3_SENT: true");
    let got = false;
    for (let i=0;i<12;i++) {
      await page.waitForTimeout(5000);
      const ld = page.locator(".typing-indicator:visible, .el-loading-mask:visible");
      if (await ld.count()===0 && i>=1) { got=true; console.log("B3_TIME: ~" + ((i+1)*5) + "s"); break; }
    }
    await ss(page, "B3-response");
    console.log("B3_GOT: " + got);
    console.log("B3_CHARTS: " + await page.locator("canvas").count());
    const ms = page.locator(".chat-message, .message-bubble, .message-text, .message-content");
    for (let i=0;i<await ms.count();i++) { const t=(await ms.nth(i).textContent()||""); if(t.length>10) console.log("B3_M" + i + ": " + t.slice(0,300)); }
  });
});

test.describe("Test C: Query Templates", () => {
  test("C1 - Templates audit", async ({ page }) => {
    await login(page);
    await page.goto("/smart-bi/query-templates", { waitUntil: "networkidle" });
    await page.waitForTimeout(5000);
    await ss(page, "C1-templates");
    const bt = await page.textContent("body") || "";
    console.log("C1_TEXT: " + bt.slice(0,500));
    console.log("C1_404: " + bt.includes("404"));
    console.log("C1_CARDS: " + await page.locator(".el-card").count());
    console.log("C1_TABLES: " + await page.locator(".el-table").count());
    console.log("C1_ROWS: " + await page.locator(".el-table__row").count());
    console.log("C1_EMPTY: " + await page.locator(".el-empty").count());
    const hd = page.locator("h1, h2, h3, h4");
    for (let i=0;i<await hd.count();i++) console.log("C1_H" + i + ": " + (await hd.nth(i).textContent()||""));
  });
});