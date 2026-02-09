import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, checkRNPage, printSummary } from '../helpers';

test.describe('W1-S2: Platform Admin (RN)', () => {
  test('Explore all platform admin pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'platform_admin', '123456', 'PlatformAdmin',
      ['首页', '平台', '我的'],
      async (page, results) => {
        // Explore Platform tab sub-pages
        await clickTabByPosition(page, '平台');
        const platformItems = ['Modules', 'Settings', '工厂管理', '用户管理', '系统设置', '配额管理'];
        for (const item of platformItems) {
          const r = await tryClickItem(page, item, '平台', 'PlatformAdmin');
          if (r) results.push(r);
        }

        // Explore Profile sub-pages
        await clickTabByPosition(page, '我的');
        const profileItems = ['个人信息', 'Personal', '修改密码', 'Change Password', '帮助', 'Help', '关于', 'About'];
        for (const item of profileItems) {
          const r = await tryClickItem(page, item, '我的', 'PlatformAdmin');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W1-S2: Platform Admin (RN)', results);
  });
});
