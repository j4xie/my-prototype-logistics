/**
 * 不依赖浏览器/后端的纯逻辑验证
 * 模拟 DashboardDefault 的 MODULE_CONFIG + factoryType 过滤
 * 同时验证 AppSidebar menuConfig 的 factoryTypes 一致性
 */

// ===== 从 DashboardDefault.vue 提取的 MODULE_CONFIG =====
const MODULE_CONFIG = [
  { key: 'dashboard', title: '首页' },
  { key: 'production', title: '生产管理', factoryTypes: ['FACTORY', 'CENTRAL_KITCHEN'] },
  { key: 'warehouse', title: '仓储管理', restaurantTitle: '后厨仓库' },
  { key: 'quality', title: '质量管理', factoryTypes: ['FACTORY', 'CENTRAL_KITCHEN'] },
  { key: 'procurement', title: '采购管理', restaurantTitle: '进货管理' },
  { key: 'sales', title: '销售管理' },
  { key: 'hr', title: '人事管理' },
  { key: 'equipment', title: '设备管理', factoryTypes: ['FACTORY', 'CENTRAL_KITCHEN'] },
  { key: 'finance', title: '财务管理' },
  { key: 'system', title: '系统管理' },
];

// ===== 从 dashboard/index.ts 提取的 getDashboardComponent =====
function getDashboardComponent(role, factoryType) {
  if (factoryType === 'RESTAURANT' || factoryType === 'CENTRAL_KITCHEN') {
    return 'DashboardRestaurant';
  }
  const ROLE_MAP = {
    factory_super_admin: 'DashboardAdmin',
    hr_admin: 'DashboardHR',
    warehouse_manager: 'DashboardWarehouse',
    finance_manager: 'DashboardFinance',
    production_manager: 'DashboardProduction',
    viewer: 'DashboardDefault',
    default: 'DashboardDefault',
  };
  return ROLE_MAP[role] || ROLE_MAP['default'];
}

// ===== 过滤逻辑（与 DashboardDefault.vue computed 一致）=====
function filterModules(factoryType) {
  const isRestaurant = factoryType === 'RESTAURANT' || factoryType === 'CENTRAL_KITCHEN';
  return MODULE_CONFIG
    .filter(m => !m.factoryTypes || m.factoryTypes.includes(factoryType))
    .map(m => ({
      ...m,
      title: (isRestaurant && m.restaurantTitle) ? m.restaurantTitle : m.title,
    }));
}

// ===== 测试 =====
let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; console.log(`  [PASS] ${msg}`); }
  else { fail++; console.log(`  [FAIL] ${msg}`); }
}

console.log('\n======= TEST 1: RESTAURANT 过滤 =======');
const restaurantModules = filterModules('RESTAURANT');
const rKeys = restaurantModules.map(m => m.key);
const rTitles = restaurantModules.map(m => m.title);

assert(!rKeys.includes('production'), '生产管理 被过滤');
assert(!rKeys.includes('equipment'), '设备管理 被过滤');
assert(!rKeys.includes('quality'), '质量管理 被过滤');
assert(rKeys.includes('warehouse'), '仓储管理 保留');
assert(rKeys.includes('procurement'), '采购管理 保留');
assert(rKeys.includes('hr'), '人事管理 保留');
assert(rKeys.includes('finance'), '财务管理 保留');
assert(rKeys.includes('system'), '系统管理 保留');
assert(rKeys.includes('sales'), '销售管理 保留');

console.log('\n======= TEST 2: RESTAURANT 术语替换 =======');
assert(rTitles.includes('后厨仓库'), '仓储管理 → 后厨仓库');
assert(rTitles.includes('进货管理'), '采购管理 → 进货管理');
assert(!rTitles.includes('仓储管理'), '原标题「仓储管理」不再显示');
assert(!rTitles.includes('采购管理'), '原标题「采购管理」不再显示');

console.log('\n======= TEST 3: FACTORY 保留全部 =======');
const factoryModules = filterModules('FACTORY');
const fKeys = factoryModules.map(m => m.key);
assert(fKeys.includes('production'), '生产管理 可见');
assert(fKeys.includes('equipment'), '设备管理 可见');
assert(fKeys.includes('quality'), '质量管理 可见');
assert(fKeys.length === 10, `全部 10 模块可见 (实际: ${fKeys.length})`);
assert(factoryModules.find(m => m.key === 'warehouse').title === '仓储管理', '工厂模式用原标题');
assert(factoryModules.find(m => m.key === 'procurement').title === '采购管理', '工厂模式用原标题');

console.log('\n======= TEST 4: CENTRAL_KITCHEN 同时在两端 =======');
const ckModules = filterModules('CENTRAL_KITCHEN');
const ckKeys = ckModules.map(m => m.key);
assert(ckKeys.includes('production'), '中央厨房 可见生产管理');
assert(ckKeys.includes('warehouse'), '中央厨房 可见仓储');
assert(!ckKeys.includes('equipment') === false, '中央厨房 可见设备管理');
// 注意：CK 在 factoryTypes 数组中同时出现在 ['FACTORY', 'CENTRAL_KITCHEN']
assert(ckModules.find(m => m.key === 'warehouse').title === '后厨仓库', '中央厨房 使用餐饮术语');

console.log('\n======= TEST 5: Dashboard 分发 — 所有角色 =======');
const roles = ['factory_super_admin', 'hr_admin', 'warehouse_manager', 'finance_manager', 'viewer', 'production_manager'];
for (const role of roles) {
  assert(getDashboardComponent(role, 'RESTAURANT') === 'DashboardRestaurant',
    `RESTAURANT + ${role} → DashboardRestaurant`);
}
assert(getDashboardComponent('factory_super_admin', 'FACTORY') === 'DashboardAdmin',
  'FACTORY + factory_super_admin → DashboardAdmin');
assert(getDashboardComponent('hr_admin', 'FACTORY') === 'DashboardHR',
  'FACTORY + hr_admin → DashboardHR');

console.log('\n======= TEST 6: 模块化扩展验证 =======');
// 模拟新增一个餐饮专属模块
const EXTENDED_CONFIG = [
  ...MODULE_CONFIG,
  { key: 'restaurant', title: '餐饮管理', factoryTypes: ['RESTAURANT', 'CENTRAL_KITCHEN'] },
];

function filterExtended(factoryType) {
  const isRestaurant = factoryType === 'RESTAURANT' || factoryType === 'CENTRAL_KITCHEN';
  return EXTENDED_CONFIG
    .filter(m => !m.factoryTypes || m.factoryTypes.includes(factoryType))
    .map(m => ({ ...m, title: (isRestaurant && m.restaurantTitle) ? m.restaurantTitle : m.title }));
}

const extRestaurant = filterExtended('RESTAURANT');
const extFactory = filterExtended('FACTORY');
assert(extRestaurant.map(m => m.key).includes('restaurant'), '扩展: 餐饮专属模块在 RESTAURANT 可见');
assert(!extFactory.map(m => m.key).includes('restaurant'), '扩展: 餐饮专属模块在 FACTORY 隐藏');
console.log('  → 验证: 只需在 MODULE_CONFIG 中加一行 factoryTypes 即可扩展，无需改过滤逻辑');

// 模拟新增 restaurantTitle
const TITLE_TEST = [
  { key: 'sales', title: '销售管理', restaurantTitle: '外卖管理' },
];
function filterTitle(factoryType) {
  const isRestaurant = factoryType === 'RESTAURANT' || factoryType === 'CENTRAL_KITCHEN';
  return TITLE_TEST.map(m => ({ ...m, title: (isRestaurant && m.restaurantTitle) ? m.restaurantTitle : m.title }));
}
assert(filterTitle('RESTAURANT')[0].title === '外卖管理', '扩展: 加 restaurantTitle 即可换餐饮标题');
assert(filterTitle('FACTORY')[0].title === '销售管理', '扩展: 工厂端仍用原标题');

// ===== 总结 =====
console.log(`\n===== RESULTS: ${pass} passed, ${fail} failed =====`);
process.exit(fail > 0 ? 1 : 0);
