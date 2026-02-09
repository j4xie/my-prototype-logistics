import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, printSummary } from '../helpers';

test.describe('W2-S2: Factory Admin SmartBI (RN)', () => {
  test('Explore SmartBI sub-dashboards', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'factory_admin1', '123456', 'FA-SmartBI',
      ['首页', 'AI分析', '报表', '智能分析', '管理', '我的'],
      async (page, results) => {
        // SmartBI tab sub-dashboards
        await clickTabByPosition(page, '智能分析');
        for (const item of [
          '生产分析', 'Production', '质量分析', 'Quality',
          '库存分析', 'Inventory', '采购分析', 'Procurement',
          '销售漏斗', 'Sales Funnel', '客户RFM', 'Customer RFM',
          '现金流', 'Cash Flow', '财务比率', 'Financial Ratios',
          '动态分析', 'Dynamic', '效率看板', 'Efficiency',
          'Excel上传', 'Excel Upload', 'AI问答', 'AI Query',
          '经营驾驶舱', 'Operations', '数据看板', 'Dashboard',
          '趋势预测', 'Forecast',
        ]) {
          const r = await tryClickItem(page, item, '智能分析', 'FA-SmartBI');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W2-S2: FA SmartBI (RN)', results);
  });
});
