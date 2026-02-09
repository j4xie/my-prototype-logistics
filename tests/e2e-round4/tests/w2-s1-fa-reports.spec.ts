import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, checkRNPage, printSummary } from '../helpers';

test.describe('W2-S1: Factory Admin Reports + Home Deep (RN)', () => {
  test('Explore reports and home sub-pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'factory_admin1', '123456', 'FA-Reports',
      ['首页', 'AI分析', '报表', '智能分析', '管理', '我的'],
      async (page, results) => {
        // Reports tab deep exploration
        await clickTabByPosition(page, '报表');
        for (const item of [
          '生产日报', 'Daily Production', '质量周报', 'Quality Weekly',
          '库存月报', 'Inventory Monthly', '财务报表', 'Financial',
          '人力报表', 'HR Report', '设备报表', 'Equipment Report',
          '采购报表', 'Procurement', '销售报表', 'Sales Report',
          '综合报表', 'Comprehensive', '趋势分析', 'Trend',
          '自定义报表', 'Custom', '导出', 'Export',
        ]) {
          const r = await tryClickItem(page, item, '报表', 'FA-Reports');
          if (r) results.push(r);
        }

        // Home tab sub-pages
        await clickTabByPosition(page, '首页');
        for (const item of [
          '今日概览', 'Today Overview', '生产批次', 'Batches',
          '告警', 'Alerts', '通知', 'Notifications',
          '快捷操作', 'Quick Actions', '待处理', 'Pending',
        ]) {
          const r = await tryClickItem(page, item, '首页', 'FA-Reports');
          if (r) results.push(r);
        }

        // Profile sub-pages
        await clickTabByPosition(page, '我的');
        for (const item of [
          '个人信息', 'Personal Info', '修改密码', 'Change Password',
          '通知设置', 'Notification', '帮助', 'Help',
          '关于', 'About', '会员', 'Membership',
        ]) {
          const r = await tryClickItem(page, item, '我的', 'FA-Reports');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W2-S1: FA Reports + Home (RN)', results);
  });
});
