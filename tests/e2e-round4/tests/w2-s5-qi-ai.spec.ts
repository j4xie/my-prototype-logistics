import { test } from '@playwright/test';
import { rnLogin, exploreRNRole, tryClickItem, clickTabByPosition, checkRNPage, printSummary, PageResult } from '../helpers';

test.describe('W2-S5: Quality Inspector + Factory Admin AI (RN)', () => {
  test('Quality Inspector - explore all pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'quality_insp1', '123456', 'QI',
      ['首页', '质检', '记录', '分析', '我的'],
      async (page, results) => {
        // Inspect tab sub-items
        await clickTabByPosition(page, '质检');
        for (const item of [
          '选择批次', 'Select Batch', '扫码', 'Scan',
          '表单', 'Form', '语音', 'Voice',
          '拍照', 'Camera', '结果', 'Result',
        ]) {
          const r = await tryClickItem(page, item, '质检', 'QI');
          if (r) results.push(r);
        }

        // Records tab sub-items
        await clickTabByPosition(page, '记录');
        for (const item of [
          '趋势', 'Trend', '报告', 'Report',
          '全部', 'All', '合格', 'Passed', '不合格', 'Failed',
        ]) {
          const r = await tryClickItem(page, item, '记录', 'QI');
          if (r) results.push(r);
        }

        // Analysis sub-items
        await clickTabByPosition(page, '分析');
        for (const item of [
          '数据分析', 'Data', '质量趋势', 'Quality Trend',
          '报告生成', 'Generate Report',
        ]) {
          const r = await tryClickItem(page, item, '分析', 'QI');
          if (r) results.push(r);
        }

        // Profile - clock-in and settings
        await clickTabByPosition(page, '我的');
        for (const item of ['打卡', 'Clock In', '设置', 'Settings', '个人信息', '帮助']) {
          const r = await tryClickItem(page, item, '我的', 'QI');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W2-S5: Quality Inspector (RN)', results);
  });

  test('Factory Admin AI - explore AI pages', async ({ page }) => {
    const results: PageResult[] = [];
    await rnLogin(page, 'factory_admin1', '123456');
    results.push(await checkRNPage(page, 'FA-AI/Home'));

    // Navigate to AI Analysis tab
    await clickTabByPosition(page, 'AI分析');
    results.push(await checkRNPage(page, 'FA-AI/Tab:AI分析'));

    // Explore AI sub-pages
    for (const item of [
      '报告', 'Report', 'AI Report',
      '对话', 'Chat', 'AI Chat',
      '质量分析', 'Quality Analysis',
      '创建计划', 'Create Plan',
      '意图建议', 'Intent',
      '智能问答', 'Smart Q&A',
    ]) {
      const r = await tryClickItem(page, item, 'AI分析', 'FA-AI');
      if (r) results.push(r);
    }

    printSummary('W2-S5: Factory Admin AI (RN)', results);
  });
});
