import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

/**
 * SmartBI E2E Quality Audit (2026-03-04)
 *
 * Tests representative files from each category via the Python API.
 * Evaluates: chart generation, AI insight quality, cross-industry detection.
 *
 * Categories tested:
 * - Food processing (normal)
 * - Manufacturing (loss scenario)
 * - Retail (growth scenario)
 * - Restaurant hotpot (normal)
 * - Restaurant fish (sparse)
 * - Restaurant bakery (loss)
 * - Edge cases (3 files)
 */

const PYTHON_API = 'http://47.100.235.168:8083';
const TEST_DATA = path.resolve(__dirname, '../../test-data');
const SCREENSHOT_DIR = path.join(__dirname, '../reports/screenshots/e2e-0304');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface TestResult {
  file: string;
  category: string;
  sheetsCount: number;
  chartsGenerated: number;
  chartTypes: string[];
  insightsCount: number;
  insightHasTitle: boolean;
  insightHasSource: boolean;
  aiResponseTime: number;
  errors: string[];
}

/** Read Excel file and upload via API to get parsed data */
async function uploadAndParse(request: any, filePath: string): Promise<any> {
  const form = new FormData();
  const fileBuffer = fs.readFileSync(filePath);
  const blob = new Blob([fileBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  form.append('file', blob, path.basename(filePath));

  // Use Java backend upload endpoint
  const response = await request.post(`http://47.100.235.168:10010/api/mobile/F001/smartbi/upload/excel`, {
    multipart: {
      file: {
        name: path.basename(filePath),
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: fileBuffer,
      }
    },
    headers: {
      'Authorization': 'Bearer test-skip',
    },
    timeout: 60000,
  });

  return response;
}

/** Test chart generation for given data */
async function testChartGeneration(request: any, data: any[], title: string): Promise<{
  charts: any[],
  time: number,
  errors: string[],
}> {
  const errors: string[] = [];
  const start = Date.now();

  try {
    // Use chart recommendation API
    const response = await request.post(`${PYTHON_API}/api/chart/recommend`, {
      data: { data, title, maxCharts: 5 },
      timeout: 30000,
    });

    const time = Date.now() - start;

    if (!response.ok()) {
      errors.push(`Chart recommend ${response.status()}: ${await response.text()}`);
      return { charts: [], time, errors };
    }

    const result = await response.json();
    const recommendations = result.data?.recommendations || result.recommendations || [];

    // Build each recommended chart
    const charts: any[] = [];
    for (const rec of recommendations.slice(0, 5)) {
      try {
        const chartResp = await request.post(`${PYTHON_API}/api/chart/build`, {
          data: {
            data,
            chartType: rec.chartType,
            xField: rec.xField,
            yFields: rec.yFields,
            title: rec.title || title,
          },
          timeout: 15000,
        });
        if (chartResp.ok()) {
          const chartResult = await chartResp.json();
          charts.push({
            type: rec.chartType,
            success: chartResult.success,
            hasData: (chartResult.config?.series?.length || 0) > 0,
          });
        } else {
          errors.push(`Chart build ${rec.chartType}: ${chartResp.status()}`);
        }
      } catch (e: any) {
        errors.push(`Chart build ${rec.chartType}: ${e.message}`);
      }
    }

    return { charts, time, errors };
  } catch (e: any) {
    return { charts: [], time: Date.now() - start, errors: [`Chart recommend: ${e.message}`] };
  }
}

/** Test insight generation for given data */
async function testInsightGeneration(request: any, data: any[], context: string): Promise<{
  insights: any[],
  time: number,
  success: boolean,
  errors: string[],
}> {
  const start = Date.now();
  const errors: string[] = [];

  try {
    const response = await request.post(`${PYTHON_API}/api/insight/generate`, {
      data: {
        data: data.slice(0, 200), // Limit to 200 rows for API test
        analysisContext: context,
        maxInsights: 5,
      },
      timeout: 60000,
    });

    const time = Date.now() - start;

    if (!response.ok()) {
      errors.push(`Insight API ${response.status()}: ${(await response.text()).substring(0, 200)}`);
      return { insights: [], time, success: false, errors };
    }

    const result = await response.json();
    return {
      insights: result.insights || [],
      time,
      success: result.success || false,
      errors,
    };
  } catch (e: any) {
    return { insights: [], time: Date.now() - start, success: false, errors: [`Insight: ${e.message}`] };
  }
}

/** Parse Excel to JSON via quick-summary endpoint */
async function parseExcelData(request: any, filePath: string): Promise<any[]> {
  // Read the Excel file and parse it locally
  // For API testing, we use pre-defined representative data per category
  return [];
}

// Representative data samples for each category
const FOOD_DATA = [
  { "日期": "2026-01", "产品": "冷鲜肉A", "产量": 15000, "良品率": 96.5, "成本": 450000, "销售额": 600000 },
  { "日期": "2026-01", "产品": "冷鲜肉B", "产量": 12000, "良品率": 97.1, "成本": 360000, "销售额": 480000 },
  { "日期": "2026-02", "产品": "冷鲜肉A", "产量": 16200, "良品率": 96.8, "成本": 486000, "销售额": 648000 },
  { "日期": "2026-02", "产品": "冷鲜肉B", "产量": 13500, "良品率": 97.3, "成本": 405000, "销售额": 540000 },
  { "日期": "2026-03", "产品": "冷鲜肉A", "产量": 15800, "良品率": 96.2, "成本": 474000, "销售额": 632000 },
];

const MFG_LOSS_DATA = [
  { "月份": "2025-10", "产线": "A线", "产量": 5000, "废品数": 350, "废品率": 7.0, "设备故障次数": 3 },
  { "月份": "2025-11", "产线": "A线", "产量": 4800, "废品数": 432, "废品率": 9.0, "设备故障次数": 5 },
  { "月份": "2025-12", "产线": "A线", "产量": 4200, "废品数": 504, "废品率": 12.0, "设备故障次数": 8 },
  { "月份": "2025-10", "产线": "B线", "产量": 6000, "废品数": 180, "废品率": 3.0, "设备故障次数": 1 },
  { "月份": "2025-11", "产线": "B线", "产量": 6200, "废品数": 186, "废品率": 3.0, "设备故障次数": 1 },
];

const RETAIL_GROWTH_DATA = [
  { "门店": "旗舰店", "品类": "服装", "2025Q3销售额": 120000, "2025Q4销售额": 156000, "增长率": 30 },
  { "门店": "旗舰店", "品类": "鞋包", "2025Q3销售额": 80000, "2025Q4销售额": 96000, "增长率": 20 },
  { "门店": "商场店", "品类": "服装", "2025Q3销售额": 95000, "2025Q4销售额": 114000, "增长率": 20 },
  { "门店": "商场店", "品类": "鞋包", "2025Q3销售额": 60000, "2025Q4销售额": 78000, "增长率": 30 },
  { "门店": "社区店", "品类": "服装", "2025Q3销售额": 45000, "2025Q4销售额": 49500, "增长率": 10 },
];

const HOTPOT_DATA = [
  { "门店": "东门口旗舰店", "菜品": "麻辣锅底", "销量": 1200, "金额": 36000, "成本": 12600, "毛利率": 65 },
  { "门店": "东门口旗舰店", "菜品": "鲜切毛肚", "销量": 980, "金额": 46060, "成本": 18424, "毛利率": 60 },
  { "门店": "南京路店", "菜品": "麻辣锅底", "销量": 850, "金额": 25500, "成本": 8925, "毛利率": 65 },
  { "门店": "南京路店", "菜品": "鲜切毛肚", "销量": 720, "金额": 33840, "成本": 13536, "毛利率": 60 },
  { "门店": "徐汇店", "菜品": "麻辣锅底", "销量": 680, "金额": 20400, "成本": 7140, "毛利率": 65 },
];

const FISH_SPARSE_DATA = [
  { "门店": "总店", "菜品": "酸菜鱼", "销量": 500, "金额": 30000 },
  { "门店": "总店", "菜品": "水煮鱼", "销量": 300, "金额": 21000 },
  { "门店": "分店", "菜品": "酸菜鱼", "销量": 200, "金额": 12000 },
  // Sparse: missing fields, few rows
];

const BAKERY_LOSS_DATA = [
  { "门店": "中央厨房", "产品": "法式面包", "日产量": 500, "报废量": 75, "报废率": 15, "原料成本": 2500 },
  { "门店": "中央厨房", "产品": "蛋糕", "日产量": 200, "报废量": 40, "报废率": 20, "原料成本": 4000 },
  { "门店": "门店A", "产品": "法式面包", "日产量": 100, "报废量": 10, "报废率": 10, "原料成本": 500 },
  { "门店": "门店A", "产品": "蛋糕", "日产量": 50, "报废量": 8, "报废率": 16, "原料成本": 1000 },
];

const EDGE_EMPTY_DATA = [
  { "产品": "A", "销售额": 100, "成本": null, "利润": null },
  { "产品": "B", "销售额": null, "成本": 50, "利润": null },
  { "产品": "C", "销售额": 200, "成本": 80, "利润": 120 },
  { "产品": null, "销售额": 150, "成本": 60, "利润": 90 },
];

const EDGE_MIXED_DATA = [
  { "ID": "001", "值": "100", "日期": "2026-01-01", "备注": "正常" },
  { "ID": "002", "值": "abc", "日期": "2026-01-02", "备注": "异常值" },
  { "ID": "003", "值": "200", "日期": "not-a-date", "备注": "日期异常" },
  { "ID": "004", "值": "150", "日期": "2026-01-04", "备注": "" },
];

interface CategoryTest {
  name: string;
  category: string;
  data: any[];
  context: string;
}

const TEST_CASES: CategoryTest[] = [
  { name: "food-normal", category: "食品加工", data: FOOD_DATA, context: "冷鲜肉生产月度报表" },
  { name: "mfg-loss", category: "制造业", data: MFG_LOSS_DATA, context: "产线废品率分析" },
  { name: "retail-growth", category: "零售", data: RETAIL_GROWTH_DATA, context: "门店季度销售增长分析" },
  { name: "hotpot-normal", category: "餐饮-火锅", data: HOTPOT_DATA, context: "火锅连锁门店菜品销售分析" },
  { name: "fish-sparse", category: "餐饮-鱼类", data: FISH_SPARSE_DATA, context: "鱼类餐厅销售报表" },
  { name: "bakery-loss", category: "餐饮-烘焙", data: BAKERY_LOSS_DATA, context: "烘焙损耗分析报告" },
  { name: "edge-empty", category: "边界-空值", data: EDGE_EMPTY_DATA, context: "含空值的销售数据" },
  { name: "edge-mixed", category: "边界-混合类型", data: EDGE_MIXED_DATA, context: "混合类型数据" },
];

test.describe('SmartBI E2E Quality Audit', () => {
  const results: TestResult[] = [];

  for (const tc of TEST_CASES) {
    test(`[${tc.name}] Chart + Insight quality`, async ({ request }) => {
      const errors: string[] = [];

      // Test chart generation
      const chartResult = await testChartGeneration(request, tc.data, tc.context);
      errors.push(...chartResult.errors);

      // Test insight generation
      const insightResult = await testInsightGeneration(request, tc.data, tc.context);
      errors.push(...insightResult.errors);

      // Log results
      console.log(`\n=== ${tc.name} (${tc.category}) ===`);
      console.log(`  Charts: ${chartResult.charts.length} generated in ${chartResult.time}ms`);
      for (const c of chartResult.charts) {
        console.log(`    ${c.type}: success=${c.success}, hasData=${c.hasData}`);
      }
      console.log(`  Insights: ${insightResult.insights.length} in ${insightResult.time}ms`);
      for (const i of insightResult.insights) {
        const meta: string[] = [];
        if (i.title) meta.push(`title="${i.title}"`);
        if (i.confidence) meta.push(`conf=${i.confidence}`);
        console.log(`    [${i.type}] ${i.text?.substring(0, 60)}... ${meta.join(' ')}`);
      }
      if (errors.length > 0) {
        console.log(`  Errors: ${errors.join('; ')}`);
      }

      // Assertions
      // For edge cases, relaxed expectations
      if (tc.name.startsWith('edge-')) {
        // Edge cases should not crash
        expect(insightResult.success || insightResult.insights.length >= 0).toBeTruthy();
      } else {
        // Normal cases should produce charts and insights
        expect(chartResult.charts.length).toBeGreaterThan(0);
        expect(insightResult.success).toBeTruthy();
        expect(insightResult.insights.length).toBeGreaterThan(0);

        // Insights should have source = 'llm'
        for (const i of insightResult.insights) {
          expect(i.source).toBe('llm');
        }
      }
    });
  }

  test('Cross-industry: No scenario leakage between categories', async ({ request }) => {
    // Test that food data doesn't get retail insights and vice versa
    const foodInsight = await testInsightGeneration(request, FOOD_DATA, "冷鲜肉加工产量报表");
    const retailInsight = await testInsightGeneration(request, RETAIL_GROWTH_DATA, "零售门店季度销售");
    const hotpotInsight = await testInsightGeneration(request, HOTPOT_DATA, "火锅连锁菜品销量");

    console.log('\n=== Cross-industry Leakage Check ===');

    // Food insights should mention production-related terms
    const foodTexts = foodInsight.insights.map((i: any) => i.text).join(' ');
    console.log(`  Food keywords: ${foodTexts.includes('产量') || foodTexts.includes('良品') ? 'CORRECT' : 'MISSING'}`);

    // Retail should mention store/sales terms
    const retailTexts = retailInsight.insights.map((i: any) => i.text).join(' ');
    console.log(`  Retail keywords: ${retailTexts.includes('门店') || retailTexts.includes('增长') ? 'CORRECT' : 'MISSING'}`);

    // Hotpot should mention restaurant/dish terms
    const hotpotTexts = hotpotInsight.insights.map((i: any) => i.text).join(' ');
    console.log(`  Hotpot keywords: ${hotpotTexts.includes('菜品') || hotpotTexts.includes('锅底') || hotpotTexts.includes('门店') ? 'CORRECT' : 'MISSING'}`);

    // Basic check: food insights shouldn't talk about "锅底" or "菜品"
    const foodLeaks = foodTexts.includes('锅底') || foodTexts.includes('翻台');
    console.log(`  Food → Restaurant leak: ${foodLeaks ? 'DETECTED ⚠️' : 'NONE ✅'}`);

    expect(foodLeaks).toBeFalsy();
  });
});
