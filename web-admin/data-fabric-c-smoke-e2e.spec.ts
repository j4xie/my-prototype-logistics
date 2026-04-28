/**
 * 数据织网 Sub-Project C — real-window smoke tests.
 *
 * 覆盖 5 个关键用户旅程, 每个测试断言用户能直接感知的事 (KPI 数字不全 0,
 * grossMargin 不显 2058%, chart 不渲染空骨架等). 这些断言是为了 catch
 * 那种 "vitest 全 PASS 但生产挂了" 类 bug — Day 23-30 我们已经踩过 4 次:
 *
 *   - Day 26 cell-audit snake_case → camelCase 漂移 (vitest 全 pass, 真窗白屏)
 *   - P0-1 grossMargin = 2058% (单元测 service 不 mock 真数据, 没 catch)
 *   - P0-2 reports KPI 全 0 (前后端契约不匹配, mock 测对不上)
 *   - P1-3+P1-4 production-analytics 8 chart 空骨架 (echarts init 不渲染前没人能看到)
 *
 * 真窗 smoke 是补充 vitest, 不是替代. vitest 给 refactor safety;
 * 这里给 "用户能用" 的最低保证.
 *
 * 运行:
 *   E2E_BASE_URL=http://139.196.165.140:8097 \
 *   npx playwright test --project data-fabric-c-smoke
 *
 * 默认 BASE_URL 是 localhost:5173 (Vite dev), 别忘了切到 test 环境.
 */
import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

// ─── helpers ──────────────────────────────────────────────────────────────

async function gotoAndWait(page: Page, path: string, anchorText: string) {
  // SPA 有后台 polling / websocket → 'networkidle' 永远不到. 用 domcontentloaded
  // + 不应被踢回 login (storageState auth 起作用) + 等期望的页面 anchor 出现.
  // test env 单服务器在并发 worker 下有时慢, 60s + 30s 兜底.
  await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await expect(page).not.toHaveURL(/\/login/, { timeout: 10000 });
  await expect(page.getByText(anchorText).first()).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(2000); // 让 chart / table / API 数据进 DOM
}

// 抓所有 td 文本, 找出 raw English enum (3+ uppercase + underscores).
async function findRawEnumCells(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    const cells = [...document.querySelectorAll('td')].map(c => c.textContent?.trim()).filter(t => t);
    return cells.filter(t => /^[A-Z][A-Z_]{3,}$/.test(t || ''));
  });
}

// ─── tests ────────────────────────────────────────────────────────────────

test.describe('数据织网 C smoke — 真窗 user-experience guards', () => {

  test('P0-2 finance/reports — 4 KPI 卡显示非 0 数字 (有数据时)', async ({ page }) => {
    await gotoAndWait(page, '/finance/reports', '财务报表');
    // P0-2 修复后, 默认 30 天范围内 (含 Apr 17/18 真实交易) KPI 应该有数据.
    // 如果 future 改了路径让 reports 又走全空 SQL, 这个测试会响.
    // 抓页面所有可见数字, 找 4 KPI 卡里至少 1 个有逗号千分位的"百万级数字"
    // (e.g. "14,205,428.30") — 这样能 catch "全 0" 的 P0-2 regression 但不会
    // 因 backend / DB 数据的小波动假阳性.
    const bigNumberCount = await page.evaluate(() => {
      const text = document.body.innerText;
      const matches = text.match(/[\d]{1,3}(?:,[\d]{3})+(?:\.\d+)?/g) || [];
      return matches.length;
    });
    expect(
      bigNumberCount,
      'reports 页应至少 1 个千分位金额 (P0-2 regression guard: 修复前 KPI 全 0 因为前后端契约不匹配)',
    ).toBeGreaterThanOrEqual(1);
    const html = await page.content();
    expect(html, '不应有 NaN').not.toContain('NaN');
    expect(html, '不应有 Infinity').not.toContain('Infinity');
    await page.screenshot({ path: 'test-results/c-smoke-finance-reports.png', fullPage: true });
  });

  test('P0-1 smart-bi/finance — grossMargin 永远 ≤ 100% 或显 N/A', async ({ page }) => {
    await gotoAndWait(page, '/smart-bi/finance', '财务分析');
    // 触发利润分析加载 (默认 tab 应该就是利润分析).
    await page.waitForTimeout(3000);
    // 抓所有可见数字百分比, 任何 > 100% 都是 P0-1 regression.
    const bigPercentages = await page.evaluate(() => {
      const text = document.body.innerText;
      const matches = text.match(/(\d+(?:\.\d+)?)%/g) || [];
      return matches
        .map(m => parseFloat(m))
        .filter(n => !isNaN(n) && n > 100 && n < 100000); // 排除明显错误值
    });
    expect(
      bigPercentages,
      `P0-1 regression: 发现 >100% 百分比 ${JSON.stringify(bigPercentages)}. ` +
      `预期 grossMargin >100% 应被 cap 到 null + 显 "N/A". ` +
      `如果用户上传含负 cost 的 Excel, FinanceAnalysisServiceImpl.buildProfitChartFromFinanceData 应该 .abs() + 上限 cap.`,
    ).toEqual([]);
    await page.screenshot({ path: 'test-results/c-smoke-smartbi-finance.png', fullPage: true });
  });

  test('Day 27 provenance-config — 3 panel 渲染 + slider 范围正确 (P1.5-4)', async ({ page }) => {
    await gotoAndWait(page, '/system/data-fabric/provenance-config', '差异阈值');
    // Q1: el-slider aria-label 应说 "0.05 至 0.5" (P1.5-4 server-driven bounds).
    await expect(page.getByRole('slider', { name: /0\.05.*0\.5/ })).toBeVisible();
    // Q2: 6 行 source priority (manual / bill_flow / product_summary / review / inferred / industry_default).
    await expect(page.getByRole('cell', { name: '客户手动确认', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '账单流水', exact: true })).toBeVisible();
    await expect(page.getByRole('cell', { name: '行业默认值', exact: true })).toBeVisible();
    // Q3: 至少看到 1 个 cuisine category (e.g. 川菜).
    await expect(page.getByRole('cell', { name: '川菜', exact: true })).toBeVisible();
    // 保存按钮必须 disabled (form clean).
    await expect(page.getByRole('button', { name: '保存' })).toBeDisabled();
    await page.screenshot({ path: 'test-results/c-smoke-provenance-config.png', fullPage: true });
  });

  test('Day 26 cell-audit — 加载页 + 显示当前权威值 OR 空状态', async ({ page }) => {
    // Try a real product id first; fall back to checking empty state UX.
    await page.goto(BASE_URL + '/audit/cell?type=product&id=1&field=revenue', {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });
    // 页面标题正确解析 URL 参数 (regression guard for camelCase / URL parsing).
    await expect(page.getByText('字段血统: product #1 · revenue')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(3000);
    // 必须显其中一个 — 当前权威值 OR 空状态. 不应该白屏 / NaN / undefined.
    const html = await page.content();
    const hasContent =
      html.includes('当前权威值') || html.includes('此字段暂无 provenance 记录');
    expect(hasContent, 'cell-audit 必须渲染 "当前权威值" 卡或 "暂无 provenance" 空状态, 不能白屏').toBe(true);
    expect(html, 'JSONB field_value 不应渲染 [object Object]').not.toContain('[object Object]');
    expect(html, '不应泄露 sentinel factory_id').not.toContain('__sentinel__');
    expect(html, '不应泄露 sentinel file_name').not.toContain('_sentinel_manual');
    await page.screenshot({ path: 'test-results/c-smoke-cell-audit.png', fullPage: true });
  });

  test('P1-3 production-analytics — 8 chart 任一渲染 echarts canvas OR el-empty', async ({ page }) => {
    await gotoAndWait(page, '/production-analytics/production', '生产数据分析');
    await page.waitForTimeout(5000); // chart render
    // 4 个 chart-card 中, 每一个都应该至少有 echarts canvas OR el-empty.
    // 不能两个都没有 (那就是 P1-3 之前的"空骨架"状态 — 用户以为系统坏了).
    const chartCardCount = await page.locator('.chart-card').count();
    expect(chartCardCount, '生产数据分析应有 4 个 chart-card').toBe(4);
    for (let i = 0; i < chartCardCount; i++) {
      const card = page.locator('.chart-card').nth(i);
      const hasCanvas = (await card.locator('canvas').count()) > 0;
      const hasEmpty = (await card.locator('.el-empty').count()) > 0;
      expect(
        hasCanvas || hasEmpty,
        `chart-card ${i} 必须显 canvas (有数据) 或 el-empty (空状态), 不能空骨架`,
      ).toBe(true);
    }
    await page.screenshot({ path: 'test-results/c-smoke-production-analytics.png', fullPage: true });
  });

  test('P2-1 i18n — supply-chain 表格不应泄露 raw English enum', async ({ page }) => {
    await gotoAndWait(page, '/analytics/supply-chain', '进销存闭环总览');
    await page.waitForTimeout(3000);
    const rawEnums = await findRawEnumCells(page);
    // 已知翻译过的 (修复后应该都中文): PARTIAL_RECEIVED, AVAILABLE, RESERVED, etc.
    // 任何剩余 raw enum 都是新漏译 — 测试响, 提示去补 SupplyChainOverview.vue#getStatusText.
    expect(
      rawEnums,
      `P2-1 regression: 发现 raw English enum cells: ${JSON.stringify(rawEnums.slice(0, 10))}. ` +
      `去 SupplyChainOverview.vue#getStatusText 加翻译.`,
    ).toEqual([]);
    await page.screenshot({ path: 'test-results/c-smoke-supply-chain.png', fullPage: true });
  });

});
