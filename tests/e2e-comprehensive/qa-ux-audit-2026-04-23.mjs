// UX audit — 时序性能 + fullPage 截屏 + 明显可用性问题编程检测
// Playwright 隔离: fresh chromium.launch, no shared profile, no MCP tools.
import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.env.TARGET_URL || 'https://admin.cretaceousfuture.com';
const OUT = 'tests/e2e-comprehensive/results/qa-2026-04-23/ux';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, ignoreHTTPSErrors: true });
const page = await ctx.newPage();

const findings = [];
const report = {};

// login
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForSelector('input');
const ins = await page.locator('input').all();
let u, p; for (const i of ins) { const t = await i.getAttribute('type'); if (t === 'password' && !p) p = i; else if (!u && (t === 'text' || !t)) u = i; }
await u.fill('qhj_prod'); await p.fill('123456'); await p.press('Enter');
await page.waitForTimeout(6000);

const PAGES = [
  { key: 'dashboard', path: '/smart-bi/dashboard',      name: '经营驾驶舱' },
  { key: 'finance',   path: '/smart-bi/finance',        name: '财务分析' },
  { key: 'rest_v2',   path: '/smart-bi/restaurant-v2',  name: '餐饮v2' },
  { key: 'trends',    path: '/analytics/trends',        name: '趋势分析' },
  { key: 'orders',    path: '/sales/orders',            name: '销售订单' },
];

for (const P of PAGES) {
  console.log(`\n=== ${P.name} ${P.path} ===`);
  const t0 = Date.now();
  try { await page.goto(`${BASE}${P.path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }); }
  catch (e) { console.log('  nav timeout'); }
  const tDom = Date.now() - t0;

  // Wait for network idle + scroll to trigger lazy
  try { await page.waitForLoadState('networkidle', { timeout: 30000 }); } catch {}
  const tIdle = Date.now() - t0;

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(5000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);

  const tTotal = Date.now() - t0;

  // Collect measurable UX signals
  const signals = await page.evaluate(() => {
    const result = {};

    // 1. Loading spinners still visible after 5s (我们已 wait 超过 5s)
    result.lingeringSpinners = document.querySelectorAll(
      '.el-loading-mask:not([style*="display: none"]), .el-skeleton:not([style*="display: none"])'
    ).length;

    // 2. 空 el-empty placeholders
    result.emptyStates = document.querySelectorAll('.el-empty').length;

    // 3. Overlay boxes / broken image
    result.brokenImages = Array.from(document.images).filter(img => img.naturalWidth === 0 && img.complete).length;

    // 4. Text overflow / clipped values (scrollWidth > clientWidth on KPI or statistic numbers)
    const statNums = Array.from(document.querySelectorAll('.el-statistic__number, .tpl-kpi-value'));
    result.overflowedNumbers = statNums.filter(e => e.scrollWidth > e.clientWidth + 2).map(e => (e.textContent || '').trim().slice(0, 40));

    // 5. 标题文字太长被截断 (ellipsis)
    const titles = Array.from(document.querySelectorAll('.tpl-title, .page-title, .header-title'));
    result.truncatedTitles = titles.filter(e => e.scrollWidth > e.clientWidth + 2).map(e => (e.textContent || '').trim().slice(0, 60));

    // 6. Missing 内容的 card (card 里只有 header, body 全空)
    const cards = Array.from(document.querySelectorAll('.el-card'));
    result.emptyBodyCards = cards.filter(c => {
      const body = c.querySelector('.el-card__body');
      if (!body) return false;
      const txt = (body.textContent || '').trim();
      return txt.length < 5 && body.children.length === 0;
    }).length;

    // 7. 可点击但无 cursor:pointer / 按钮但无 role=button
    // Proxy: anchors with # href + no :hover
    result.deadAnchors = Array.from(document.querySelectorAll('a[href="#"], a[href=""]')).length;

    // 8. 低对比度文字样本 (very rough — only catch #CCC on white)
    const lowContrastSamples = [];
    document.querySelectorAll('*').forEach(el => {
      const s = getComputedStyle(el);
      const fg = s.color;
      const bg = s.backgroundColor;
      if (fg.includes('rgb(204, 204, 204)') || fg.includes('#CCCCCC')) {
        const t = (el.textContent || '').trim().slice(0, 30);
        if (t && lowContrastSamples.length < 5) lowContrastSamples.push(t);
      }
    });
    result.lowContrastSamples = lowContrastSamples;

    // 9. 页面总 DOM 节点数
    result.domNodes = document.querySelectorAll('*').length;

    // 10. 主要内容区尺寸
    result.mainSize = (() => {
      const main = document.querySelector('.app-main, .el-main, main') || document.body;
      const r = main.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height) };
    })();

    // 11. Chart canvas count
    result.chartCanvases = document.querySelectorAll('canvas').length;

    // 12. 疑似只读字段显示 0 (例如 "0 天" "¥0" — maybe empty state 但没用 el-empty)
    const zeroLikeValues = Array.from(document.querySelectorAll('.el-statistic__number')).map(e => (e.textContent || '').trim()).filter(t => t === '0' || t === '0.00' || t === '¥0.00' || t === '¥0');
    result.zeroLikeStats = zeroLikeValues.length;

    // 13. Template cards 里各卡状态
    const tplCards = Array.from(document.querySelectorAll('.tpl-card'));
    result.tplCardCount = tplCards.length;
    result.tplCardTitles = tplCards.map(c => {
      const t = c.querySelector('.tpl-title')?.textContent?.trim() || '';
      return t.slice(0, 30);
    });

    // 14. "暂无数据" text anywhere
    result.noDataTextCount = document.body.textContent?.split('暂无数据').length - 1 || 0;

    return result;
  });

  report[P.key] = { path: P.path, name: P.name, timings: { tDom, tIdle, tTotal }, ...signals };

  // fullPage screenshot (big but valuable)
  await page.screenshot({ path: `${OUT}/${P.key}.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/${P.key}-viewport.png`, fullPage: false });

  console.log(`  tDom=${tDom}ms tIdle=${tIdle}ms tTotal=${tTotal}ms`);
  console.log(`  domNodes=${signals.domNodes} canvases=${signals.chartCanvases} tplCards=${signals.tplCardCount} zeroStats=${signals.zeroLikeStats} emptyStates=${signals.emptyStates} lingeringSpinners=${signals.lingeringSpinners}`);
  if (signals.overflowedNumbers.length) console.log(`  ⚠ overflowed: ${signals.overflowedNumbers.slice(0, 3).join(', ')}`);
  if (signals.truncatedTitles.length) console.log(`  ⚠ truncated titles: ${signals.truncatedTitles.slice(0, 3).join(', ')}`);
  if (signals.emptyBodyCards > 0) console.log(`  ⚠ empty-body cards: ${signals.emptyBodyCards}`);

  // Findings aggregation
  if (tTotal > 10000) findings.push(`[${P.name}] 加载慢: tTotal=${tTotal}ms (>10s)`);
  if (tIdle > 5000) findings.push(`[${P.name}] 网络空闲慢: tIdle=${tIdle}ms (>5s, 用户看到骨架屏)`);
  if (signals.lingeringSpinners > 0) findings.push(`[${P.name}] 遗留 spinner/骨架屏 ${signals.lingeringSpinners} 个 (5s 后仍在 loading)`);
  if (signals.overflowedNumbers.length > 0) findings.push(`[${P.name}] KPI 数字溢出: ${signals.overflowedNumbers.slice(0, 3).join(' / ')}`);
  if (signals.truncatedTitles.length > 0) findings.push(`[${P.name}] 标题截断: ${signals.truncatedTitles.slice(0, 3).join(' / ')}`);
  if (signals.emptyBodyCards > 0) findings.push(`[${P.name}] 空 body 的 card ${signals.emptyBodyCards} 个`);
  if (signals.noDataTextCount > 2) findings.push(`[${P.name}] "暂无数据" 出现 ${signals.noDataTextCount} 次 (大量 section 为空)`);
  if (signals.zeroLikeStats > 3) findings.push(`[${P.name}] ¥0 / 0 统计值 ${signals.zeroLikeStats} 个 (疑似数据缺失显 0)`);
  if (signals.domNodes > 5000) findings.push(`[${P.name}] DOM 节点 ${signals.domNodes} 个 (>5000 可能影响流畅度)`);
}

// ========= tablet viewport 1024x768 spot check =========
console.log('\n=== 1024x768 tablet viewport spot check ===');
const tabletCtx = await browser.newContext({ viewport: { width: 1024, height: 768 }, ignoreHTTPSErrors: true });
const tp = await tabletCtx.newPage();
await tp.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await tp.waitForSelector('input');
const ins2 = await tp.locator('input').all();
let u2, p2; for (const i of ins2) { const t = await i.getAttribute('type'); if (t === 'password' && !p2) p2 = i; else if (!u2 && (t === 'text' || !t)) u2 = i; }
await u2.fill('qhj_prod'); await p2.fill('123456'); await p2.press('Enter');
await tp.waitForTimeout(5000);
await tp.goto(`${BASE}/smart-bi/dashboard`, { waitUntil: 'networkidle' });
await tp.waitForTimeout(5000);
const tabletSignals = await tp.evaluate(() => {
  // detect horizontal scroll on body
  return {
    bodyScrollable: document.body.scrollWidth > document.body.clientWidth,
    overflowX: document.body.scrollWidth - document.body.clientWidth,
    kpiCardWidths: Array.from(document.querySelectorAll('.el-statistic')).slice(0, 6).map(e => Math.round(e.getBoundingClientRect().width)),
  };
});
await tp.screenshot({ path: `${OUT}/tablet-dashboard.png`, fullPage: true });
console.log(`  bodyHorizontalScroll=${tabletSignals.bodyScrollable} overflowX=${tabletSignals.overflowX}px kpiCardWidths=${tabletSignals.kpiCardWidths.join(',')}`);
if (tabletSignals.bodyScrollable) findings.push(`[tablet 1024] body 横向溢出 ${tabletSignals.overflowX}px — layout 未响应`);

report.tablet = tabletSignals;

fs.writeFileSync(`${OUT}/ux-report.json`, JSON.stringify({ report, findings }, null, 2));
console.log(`\n========= FINDINGS (${findings.length}) =========`);
findings.forEach(f => console.log(`  - ${f}`));
console.log(`\nreport: ${OUT}/ux-report.json`);
console.log(`screenshots: ${OUT}/{dashboard,finance,rest_v2,trends,orders}.png + {*-viewport.png,tablet-dashboard.png}`);

await browser.close();
