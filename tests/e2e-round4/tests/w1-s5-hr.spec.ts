import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, printSummary } from '../helpers';

test.describe('W1-S5: HR Admin (RN)', () => {
  test('Explore all HR admin pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'hr_admin1', '123456', 'HRAdmin',
      ['首页', '人员', '考勤', '白名单', '我的'],
      async (page, results) => {
        // Home sub-items
        await clickTabByPosition(page, '首页');
        for (const item of ['添加员工', '批次分配', '工时成本', '绩效分析', '排班管理', '本月入职',
          'On Site', 'Late Today', 'New Hires', 'View All']) {
          const r = await tryClickItem(page, item, '首页', 'HRAdmin');
          if (r) results.push(r);
        }

        // Staff sub-items
        await clickTabByPosition(page, '人员');
        for (const item of ['添加员工', 'Add Staff', '员工列表', 'Staff List', '部门管理', 'Department',
          '在职', 'Active', '离职', 'Resigned', 'AI推荐', 'AI Recommend']) {
          const r = await tryClickItem(page, item, '人员', 'HRAdmin');
          if (r) results.push(r);
        }

        // Attendance sub-items
        await clickTabByPosition(page, '考勤');
        for (const item of ['考勤异常', 'Anomaly', '考勤统计', 'Statistics', '打卡记录', 'Records',
          '补卡申请', 'Supplement', '月度报表', 'Monthly']) {
          const r = await tryClickItem(page, item, '考勤', 'HRAdmin');
          if (r) results.push(r);
        }

        // Whitelist sub-items
        await clickTabByPosition(page, '白名单');
        for (const item of ['添加白名单', 'Add Whitelist', '审批记录', 'Approval']) {
          const r = await tryClickItem(page, item, '白名单', 'HRAdmin');
          if (r) results.push(r);
        }

        // Profile
        await clickTabByPosition(page, '我的');
        for (const item of ['个人信息', 'Personal', '修改密码', '通知设置', '帮助']) {
          const r = await tryClickItem(page, item, '我的', 'HRAdmin');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W1-S5: HR Admin (RN)', results);
  });
});
