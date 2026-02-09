import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, printSummary } from '../helpers';

test.describe('W2-S4: Workshop Supervisor (RN)', () => {
  test('Explore all workshop pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'workshop_sup1', '123456', 'Workshop',
      ['首页', '批次', '人员', '设备', '我的'],
      async (page, results) => {
        // Home sub-items
        await clickTabByPosition(page, '首页');
        for (const item of [
          '通知', 'Notification', '任务指引', 'Task Guide',
          '今日概览', 'Today', '快捷操作', 'Quick',
        ]) {
          const r = await tryClickItem(page, item, '首页', 'Workshop');
          if (r) results.push(r);
        }

        // Batches sub-items
        await clickTabByPosition(page, '批次');
        for (const item of [
          '进行中', 'In Progress', '已完成', 'Completed',
          '待开始', 'Pending', '全部', 'All',
          '开始生产', 'Start', '阶段', 'Stage',
          '领料', 'Material', '完成', 'Complete',
        ]) {
          const r = await tryClickItem(page, item, '批次', 'Workshop');
          if (r) results.push(r);
        }

        // Workers sub-items
        await clickTabByPosition(page, '人员');
        for (const item of [
          '分配', 'Assign', '打卡', 'Clock In',
          '历史', 'History', '考勤', 'Attendance',
        ]) {
          const r = await tryClickItem(page, item, '人员', 'Workshop');
          if (r) results.push(r);
        }

        // Equipment sub-items
        await clickTabByPosition(page, '设备');
        for (const item of [
          '告警', 'Alert', '维护', 'Maintenance',
          '运行中', 'Running', '停机', 'Stopped',
        ]) {
          const r = await tryClickItem(page, item, '设备', 'Workshop');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W2-S4: Workshop Supervisor (RN)', results);
  });
});
