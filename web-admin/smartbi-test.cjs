const { chromium } = require("@playwright/test");
const path = require("path");

const SCREENSHOT_DIR = path.join(__dirname, "test-screenshots");
const TEST_FILE = path.resolve(__dirname, "..", "Test.xlsx");
const BASE_URL = "http://localhost:5173";
const UPLOAD_TIMEOUT = 300000;
const TAB_RENDER_WAIT = 8000;

async function run() {
  console.log("=== SmartBI Upload E2E Test ===");
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();
  const consoleMessages = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error" || text.includes("enrichment") || text.includes("Enrich") || text.includes("[Render]")) {
      consoleMessages.push({ type: msg.type(), text });
    }
  });

  try {
    console.log("[1] Navigating...");
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    console.log("URL:", currentUrl);

    if (currentUrl.includes("/login")) {
      console.log("[2] Logging in...");
      const quickBtn = page.locator("button").filter({ hasText: "factory_admin1" });
      const qv = await quickBtn.isVisible({ timeout: 3000 }).catch(() => false);
      if (qv) { await quickBtn.click(); await page.waitForTimeout(500); }
      else { await page.locator("input").first().fill("factory_admin1"); await page.locator("input[type=password]").fill("123456"); }
      await page.locator(".login-button").click();
      await page.waitForURL("**/dashboard**", { timeout: 15000 });
      console.log("  Login OK");
      await page.waitForTimeout(2000);
    }

    console.log("[3] SmartBI upload page...");
    await page.goto(BASE_URL + "/smart-bi/analysis", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01-upload-page.png") });

    console.log("[4] Uploading Test.xlsx...");
    await page.locator("input[type=file]").setInputFiles(TEST_FILE);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02-file-selected.png") });
    const analyzeBtn = page.locator("button").filter({ hasText: "开始分析" });
    const abv = await analyzeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (abv) { console.log("  Clicking analyze..."); await analyzeBtn.click(); }

    console.log("[5] Waiting for SSE upload...");
    try {
      await page.locator(".result-section").waitFor({ state: "visible", timeout: UPLOAD_TIMEOUT });
      console.log("  Upload done!");
    } catch (e) {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-timeout.png"), fullPage: true });
      throw e;
    }
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03-upload-complete.png") });

    console.log("[5b] Waiting enrichment (120s max)...");
    const ws = Date.now();
    while (Date.now() - ws < 120000) {
      const lc = await page.locator(".chart-loading").count();
      if (lc === 0) { console.log("  Enrichment done."); break; }
      console.log("  Enriching... (" + lc + " loading)");
      await page.waitForTimeout(5000);
    }
    await page.waitForTimeout(5000);

    console.log("[6] Analyzing tabs...");
    const tabs = page.locator(".el-tabs__item");
    const tabCount = await tabs.count();
    console.log("Tabs found:", tabCount);
    const results = {};

    for (let i = 0; i < tabCount; i++) {
      const tab = tabs.nth(i);
      const tabText = ((await tab.textContent()) || "Tab" + i).trim();
      console.log("--- Tab " + i + ": " + tabText + " ---");
      await tab.click();
      await page.waitForTimeout(TAB_RENDER_WAIT);

      const tl = await page.locator(".chart-loading").isVisible().catch(() => false);
      if (tl) {
        console.log("  Still loading...");
        try { await page.locator(".chart-loading").first().waitFor({ state: "hidden", timeout: 60000 }); } catch(ig) {}
        await page.waitForTimeout(3000);
      }

      const cc = await page.locator(".chart-grid-item").count();
      const kc = await page.locator(".kpi-section .kpi-grid > *").count();
      const ai = await page.locator(".ai-analysis-section").isVisible().catch(() => false);
      const em = await page.locator(".empty-sheet").isVisible().catch(() => false);
      const ix = await page.locator(".index-page-view").isVisible().catch(() => false);
      results[tabText] = { charts: cc, kpis: kc, hasAI: ai, isEmpty: em, isIndex: ix };
      console.log("  Charts:" + cc + " KPIs:" + kc + " AI:" + ai + " Empty:" + em + " Index:" + ix);

      const sn = tabText.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "sheet-" + String(i).padStart(2,"0") + "-" + sn + ".png") });
    }

    console.log("========================================");
    console.log("       SmartBI Upload Test Results       ");
    console.log("========================================");
    console.log("Total tabs:", tabCount);
    let totalCharts = 0;
    const entries = Object.entries(results);
    for (const [name, data] of entries) {
      totalCharts += data.charts;
      const st = data.isIndex ? "INDEX" : (data.isEmpty ? "EMPTY" : "OK");
      console.log("  " + name.padEnd(25) + " | Charts:" + data.charts + " | KPIs:" + data.kpis + " | AI:" + (data.hasAI?"Y":"N") + " | " + st);
    }
    console.log("Total charts:", totalCharts);

    console.log("--- Validations ---");
    function chk(kw, min) {
      const m = entries.find(e => e[0].includes(kw));
      if (m) {
        const ok = m[1].charts >= min;
        console.log("  " + (ok?"PASS":"FAIL") + ": " + m[0] + " has " + m[1].charts + " charts (need>=" + min + ")");
        return ok;
      }
      console.log("  SKIP: no tab with " + kw);
      return false;
    }
    const v1 = chk("收入及净利", 2);
    const v2 = chk("返利明细", 1);
    const v3 = chk("利润表", 4);

    const ee = consoleMessages.filter(e => e.text.includes("enrichment failed") || (e.type==="error" && e.text.includes("Enrich")));
    if (ee.length > 0) { console.log("--- Enrichment Errors ---"); ee.forEach(e => console.log("  ["+e.type+"]", e.text)); }
    else { console.log("No enrichment errors."); }

    const rm = consoleMessages.filter(e => e.text.includes("[Render]"));
    if (rm.length > 0) { console.log("--- Render Msgs ---"); rm.forEach(e => console.log(" ", e.text)); }

    console.log("========================================");
    console.log("Overall:", v1&&v2&&v3 ? "ALL KEY CHECKS PASSED" : "SOME CHECKS FAILED");
    console.log("========================================");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "final-state.png"), fullPage: true });

  } catch (err) {
    console.error("Test error:", err.message);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "error-state.png"), fullPage: true }).catch(() => {});
  } finally {
    await page.waitForTimeout(3000);
    await browser.close();
  }
}

run().catch(err => { console.error("Fatal:", err); process.exit(1); });
