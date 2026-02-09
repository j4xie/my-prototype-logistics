import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, printSummary } from '../helpers';

test.describe('W1-S3: Dispatcher (RN)', () => {
  test('Explore all dispatcher pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'dispatcher1', '123456', 'Dispatcher',
      ['首页', '计划', 'AI调度', '智能分析', '人员', '我的'],
      async (page, results) => {
        // Home tab sub-items
        await clickTabByPosition(page, '首页');
        for (const item of ['AI 智能调度中心', '一键 AI 智能排产', 'AI 风险预警', '查看全部', '调动人员']) {
          const r = await tryClickItem(page, item, '首页', 'Dispatcher');
          if (r) results.push(r);
        }

        // Plan tab sub-items
        await clickTabByPosition(page, '计划');
        for (const item of ['创建计划', '甘特图', '紧急插单', '审批', '任务列表', '待审批', '进行中', '已完成']) {
          const r = await tryClickItem(page, item, '计划', 'Dispatcher');
          if (r) results.push(r);
        }

        // AI Scheduling sub-items
        await clickTabByPosition(page, 'AI调度');
        for (const item of ['智能排产', '优化建议', '人力调配', '效率分析', '开始排产', 'AI优化']) {
          const r = await tryClickItem(page, item, 'AI调度', 'Dispatcher');
          if (r) results.push(r);
        }

        // Personnel sub-items
        await clickTabByPosition(page, '人员');
        for (const item of ['考勤记录', '人员列表', '班次管理', '排班表', '出勤统计', '调动记录']) {
          const r = await tryClickItem(page, item, '人员', 'Dispatcher');
          if (r) results.push(r);
        }

        // Profile sub-items
        await clickTabByPosition(page, '我的');
        for (const item of ['个人信息', 'Personal', '修改密码', '通知设置', '帮助']) {
          const r = await tryClickItem(page, item, '我的', 'Dispatcher');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W1-S3: Dispatcher (RN)', results);
  });
});
