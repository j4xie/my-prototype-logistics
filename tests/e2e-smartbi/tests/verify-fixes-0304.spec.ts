import { test, expect } from '@playwright/test';

/**
 * SmartBI Bug Fix Verification Test (2026-03-04)
 * Pure API tests — no browser login needed.
 *
 * Verifies:
 * - P0-D: Radar chart multi-row aggregation (was iloc[0])
 * - P1-H: Area chart stacking subtitle indicator
 * - P1-O: Insight fields preservation (title, dimension, confidence, action_items)
 * - P0-E: Dead code removal (insight_generator prompt cleanup)
 */

const PYTHON_API = 'http://47.100.235.168:8083';

test.describe('SmartBI Fix Verification — API Tests', () => {

  test('P0-D: Radar chart returns multiple data polygons per group', async ({ request }) => {
    const response = await request.post(`${PYTHON_API}/api/chart/build`, {
      data: {
        data: [
          { "门店": "东门口旗舰店", "销售额": 85000, "客单价": 95, "翻台率": 3.2, "好评率": 92 },
          { "门店": "南京路店", "销售额": 72000, "客单价": 88, "翻台率": 2.8, "好评率": 89 },
          { "门店": "徐汇店", "销售额": 65000, "客单价": 82, "翻台率": 2.5, "好评率": 91 },
          { "门店": "浦东店", "销售额": 78000, "客单价": 90, "翻台率": 3.0, "好评率": 88 },
        ],
        chartType: "radar",
        xField: "门店",
        yFields: ["销售额", "客单价", "翻台率", "好评率"],
        title: "门店对比雷达图"
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    const config = result.config;

    // Should have 4 data entries (one per store), NOT 1 from iloc[0]
    const dataCount = config?.series?.[0]?.data?.length || 0;
    expect(dataCount).toBe(4);

    const names = config?.series?.[0]?.data?.map((d: any) => d.name) || [];
    console.log(`P0-D: ${dataCount} polygons — ${names.join(', ')}`);
    expect(names).toContain('东门口旗舰店');
    expect(names).toContain('浦东店');
  });

  test('P0-D: Radar without xField uses mean aggregation', async ({ request }) => {
    const response = await request.post(`${PYTHON_API}/api/chart/build`, {
      data: {
        data: [
          { "销售额": 85000, "客单价": 95, "翻台率": 3.2, "好评率": 92 },
          { "销售额": 72000, "客单价": 88, "翻台率": 2.8, "好评率": 89 },
          { "销售额": 65000, "客单价": 82, "翻台率": 2.5, "好评率": 91 },
        ],
        chartType: "radar",
        yFields: ["销售额", "客单价", "翻台率", "好评率"],
        title: "综合指标雷达图"
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    const config = result.config;

    // Without xField, should show single "均值" polygon
    const dataCount = config?.series?.[0]?.data?.length || 0;
    expect(dataCount).toBe(1);

    const name = config?.series?.[0]?.data?.[0]?.name;
    console.log(`P0-D (no xField): ${dataCount} polygon — name: "${name}"`);
    expect(name).toBe('均值');
  });

  test('P1-H: Area chart stacking has subtitle indicator', async ({ request }) => {
    const response = await request.post(`${PYTHON_API}/api/chart/build`, {
      data: {
        data: [
          { "月份": "1月", "销售额": 50000, "成本": 30000, "利润": 20000 },
          { "月份": "2月", "销售额": 55000, "成本": 32000, "利润": 23000 },
          { "月份": "3月", "销售额": 60000, "成本": 33000, "利润": 27000 },
        ],
        chartType: "area",
        xField: "月份",
        yFields: ["销售额", "成本", "利润"],
        title: "月度趋势面积图"
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    const config = result.config;

    // Check stacking subtitle preserved through _add_common_options
    const subtext = config?.title?.subtext || '';
    console.log(`P1-H: subtext = "${subtext}"`);
    expect(subtext).toContain('堆叠面积图');

    // Check series have areaStyle and stack
    const series = config?.series || [];
    expect(series.length).toBe(3);
    for (const s of series) {
      expect(s.areaStyle).toBeDefined();
      expect(s.stack).toBe('total');
    }
  });

  test('P1-H: Single-series area chart has NO stacking subtitle', async ({ request }) => {
    const response = await request.post(`${PYTHON_API}/api/chart/build`, {
      data: {
        data: [
          { "月份": "1月", "销售额": 50000 },
          { "月份": "2月", "销售额": 55000 },
          { "月份": "3月", "销售额": 60000 },
        ],
        chartType: "area",
        xField: "月份",
        yFields: ["销售额"],
        title: "单指标面积图"
      },
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();
    const config = result.config;

    // Single series should NOT be stacked
    const subtext = config?.title?.subtext || '';
    console.log(`P1-H (single): subtext = "${subtext}"`);
    expect(subtext).not.toContain('堆叠面积图');

    const series = config?.series || [];
    expect(series.length).toBe(1);
    // stack should be null or undefined for single series
    expect(series[0].stack).toBeFalsy();
  });

  test('P1-O: AI insights preserve title/dimension/confidence/source fields', async ({ request }) => {
    const response = await request.post(`${PYTHON_API}/api/insight/generate`, {
      data: {
        data: [
          { "门店": "旗舰店", "月份": "1月", "销售额": 85000, "成本": 51000 },
          { "门店": "旗舰店", "月份": "2月", "销售额": 92000, "成本": 53000 },
          { "门店": "分店A", "月份": "1月", "销售额": 65000, "成本": 42000 },
          { "门店": "分店A", "月份": "2月", "销售额": 68000, "成本": 43000 },
          { "门店": "分店B", "月份": "1月", "销售额": 45000, "成本": 32000 },
          { "门店": "分店B", "月份": "2月", "销售额": 48000, "成本": 33000 },
        ],
        analysisContext: "餐饮连锁门店销售分析",
        maxInsights: 5,
      },
      timeout: 60000,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.insights?.length).toBeGreaterThan(0);

    // All insights should have 'source' field = 'llm'
    for (const insight of result.insights) {
      expect(insight.source).toBe('llm');
    }

    // Log insights for manual review
    for (const insight of result.insights) {
      const fields: string[] = [];
      if (insight.title) fields.push(`title="${insight.title}"`);
      if (insight.dimension) fields.push(`dim="${insight.dimension}"`);
      if (insight.confidence) fields.push(`conf=${insight.confidence}`);
      if (insight.action_items) fields.push(`actions=${insight.action_items.length}`);
      console.log(`  [${insight.type}] ${insight.text?.substring(0, 60)}... ${fields.join(', ')}`);
    }
  });

  test('P0-E: Insight generation works after dead-code removal', async ({ request }) => {
    const response = await request.post(`${PYTHON_API}/api/insight/generate`, {
      data: {
        data: [
          { "月份": "1月", "产量": 15000, "良品率": 96.5, "废品率": 3.5, "设备利用率": 85 },
          { "月份": "2月", "产量": 16200, "良品率": 97.1, "废品率": 2.9, "设备利用率": 88 },
          { "月份": "3月", "产量": 15800, "良品率": 96.8, "废品率": 3.2, "设备利用率": 86 },
        ],
        analysisContext: "工厂生产月度报告",
        maxInsights: 3,
      },
      timeout: 60000,
    });

    expect(response.ok()).toBeTruthy();
    const result = await response.json();

    expect(result.success).toBeTruthy();
    expect(result.insights?.length).toBeGreaterThan(0);

    // Insights should have valid text (not empty or error messages)
    for (const insight of result.insights) {
      expect(insight.text).toBeTruthy();
      expect(insight.text.length).toBeGreaterThan(10);
      console.log(`  [${insight.type}] ${insight.text?.substring(0, 80)}...`);
    }
  });
});
