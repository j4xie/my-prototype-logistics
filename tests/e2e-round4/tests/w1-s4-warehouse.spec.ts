import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, printSummary } from '../helpers';

test.describe('W1-S4: Warehouse Manager (RN)', () => {
  test('Explore all warehouse pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'warehouse_mgr1', '123456', 'Warehouse',
      ['首页', '入库', '出货', '库存', '我的'],
      async (page, results) => {
        // Home sub-items
        await clickTabByPosition(page, '首页');
        for (const item of ['Outbound Tasks', 'Inbound Tasks', 'Today Inbound', 'Today Outbound',
          'Stock Alerts', 'Temperature Monitor', 'View All']) {
          const r = await tryClickItem(page, item, '首页', 'Warehouse');
          if (r) results.push(r);
        }

        // Inbound sub-items
        await clickTabByPosition(page, '入库');
        for (const item of ['创建入库', 'Create', '扫码', 'Scan', '入库记录', '待处理', '已完成',
          'Receive', 'Inspect', 'Pending']) {
          const r = await tryClickItem(page, item, '入库', 'Warehouse');
          if (r) results.push(r);
        }

        // Outbound sub-items
        await clickTabByPosition(page, '出货');
        for (const item of ['创建出货', 'Create', '出货记录', '待出货', '已出货',
          'Packing', 'Loading', 'Shipping', 'Tracking']) {
          const r = await tryClickItem(page, item, '出货', 'Warehouse');
          if (r) results.push(r);
        }

        // Inventory sub-items
        await clickTabByPosition(page, '库存');
        for (const item of ['库存盘点', 'Inventory Check', '盘点记录', '库存预警',
          '库位管理', '库存调拨', '安全库存', 'Overview', 'Alerts', 'Audit']) {
          const r = await tryClickItem(page, item, '库存', 'Warehouse');
          if (r) results.push(r);
        }

        // Profile sub-items
        await clickTabByPosition(page, '我的');
        for (const item of ['个人信息', 'Personal', '修改密码', '通知设置', '帮助']) {
          const r = await tryClickItem(page, item, '我的', 'Warehouse');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W1-S4: Warehouse (RN)', results);
  });
});
