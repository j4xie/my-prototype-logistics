import { test } from '@playwright/test';
import { exploreRNRole, tryClickItem, clickTabByPosition, printSummary } from '../helpers';

test.describe('W2-S3: Factory Admin Management (RN)', () => {
  test('Explore management sub-pages', async ({ page }) => {
    const results = await exploreRNRole(
      page, 'factory_admin1', '123456', 'FA-Mgmt',
      ['首页', 'AI分析', '报表', '智能分析', '管理', '我的'],
      async (page, results) => {
        // Management tab sub-pages
        await clickTabByPosition(page, '管理');
        for (const item of [
          '产品类型', 'Product Type', '原材料类型', 'Material Type',
          '部门管理', 'Department', '供应商管理', 'Supplier',
          '客户管理', 'Customer', '出货管理', 'Shipment',
          '转换率', 'Conversion', '废弃处理', 'Disposal',
          '数据模板', 'Schema', '表单模板', 'Form Template',
          '规则配置', 'Rule', 'AI配置', 'AI Config',
          '编码规则', 'Encoding', '质检标准', 'QC Standard',
          'SOP管理', 'SOP', '意图管理', 'Intent',
          '设备管理', 'Equipment', '物联网', 'IoT',
          'ISAPI', 'Device', '蓝图管理', 'Blueprint',
        ]) {
          const r = await tryClickItem(page, item, '管理', 'FA-Mgmt');
          if (r) results.push(r);
        }
      }
    );
    printSummary('W2-S3: FA Management (RN)', results);
  });
});
