# 餐饮 vs 工厂 模块归属分类

**背景**: 当前系统同时服务 FACTORY (制造业 / 食品加工) 和 RESTAURANT (连锁餐饮 / POS 门店) 两种租户类型. 许多模块是通用的 (销售/财务/分析), 但命名+UX 往往偏向一侧. 需要明确归属以便:
1. 侧边栏 `hideForFactoryTypes` 配置准确
2. 页面术语本地化 (产品 vs 菜品, 批次 vs 出品, 车间 vs 后厨)
3. 未来开发 feature 时直接对应正确的 schema 层
4. 客户沟通时能说清"你这个 SaaS 给谁用"

---

## 三类归属

| 归属 | 定义 |
|------|------|
| **🏭 FACTORY 专属** | 只对制造业有意义, 餐饮租户应 hide |
| **🍴 RESTAURANT 专属** | 只对餐饮有意义, 工厂租户应 hide |
| **🔄 SHARED** | 两边都用, 但可能需要术语本地化 |

---

## 按侧边栏分组的归属

### 🔄 SHARED (两边都用)

| 侧边栏项 | 路径 | 备注 |
|---------|------|------|
| 首页 | /dashboard | 欢迎页, 通用 |
| 销售订单 | /sales/orders | 餐饮=B2B 订餐合同; 工厂=成品销售. 不同语义同名. |
| 客户管理 | /sales/customers | 餐饮=会员/B2B 客户; 工厂=批发/代理. |
| 用户管理/角色/操作日志/系统设置 | /system/{users,roles,logs,settings} | 标准 admin |
| AI意图配置/Skill-Tool/LLM用量 | /system/{ai-intents,skill-tools,llm-usage} | AI 基础设施 |
| 功能模块配置/Canvas | /system/features, /canvas-editor | 平台配置 |
| POS集成 | /system/pos | ✅ 餐饮必须, 工厂选装 (销售额源) |
| SmartBI配置 | /system/smartbi-config | 分析平台 |
| **分析概览/趋势分析/KPI看板/异常预警/AI分析报告/进销存闭环** | /analytics/* | **通用** 但 UI 需按租户 split |
| **智能BI 全组** | /smart-bi/* | 通用 (KPI / Gold / LLM 问答) |

---

### 🏭 FACTORY 专属 (RESTAURANT 应 hide)

| 侧边栏项 | 路径 | 为什么 FACTORY-only | 当前 hide 状态 |
|---------|------|---------------------|---------------|
| 生产管理 (生产批次/计划/BOM/报工/工艺) | /production/* | 制造批次、工艺路线是制造概念 | ✅ P1-5 hide |
| 仓储管理 (原材料批次/出货/盘点/物料均价) | /warehouse/* | 工厂仓库; 餐饮门店独立库存走 /restaurant/stocktaking | ✅ P1-5 hide |
| 质量管理 (质检/废弃/标准) | /quality/* | QC/QA 标准是工厂流程 | ✅ P1-5 hide |
| 采购管理 (采购订单/供应商/价格表) | /procurement/* | 工厂大宗原料采购; 餐饮门店采购走 restaurant/requisitions | ✅ P1-5 hide |
| 人事管理 (员工/考勤/白名单/部门) | /hr/* | 工厂制式人事; 餐饮人事走 POS | ✅ P1-5 hide |
| 调拨管理 | /transfer/* | 工厂仓库间调拨 | ✅ P1-5 hide |
| 设备管理 (列表/维护/告警) | /equipment/* | 工厂设备物联; 餐饮门店设备走 POS 终端 | ✅ P1-5 hide |
| 财务管理 (概览/报表/应收应付/开票/收款/SKU毛利) | /finance/* | 工厂会计体系; 餐饮走 POS 日结+总部财务 | ✅ P1-5 hide |
| 研发管理 (研发样品) | /rd/* | 工厂产品研发; 餐饮新菜研发走 recipes | ✅ P1-5 hide |
| **车间实时生产报表** | /analytics/production-report | "车间"工厂术语 | ✅ P0 hide (commit 411fe7116) |
| **工序管理** | /system/work-processes | 工序=制造业概念 | ✅ P0 hide |
| **产品-工序配置** | /system/product-processes | 菜品没工序路径 | ✅ P0 hide |
| **员工工牌生成** | /system/badge-generator | 餐厅员工不戴工牌 | ✅ P0 hide |

---

### 🍴 RESTAURANT 专属 (FACTORY 应 hide)

| 侧边栏项 | 路径 | 为什么 RESTAURANT-only | 当前 hide 状态 |
|---------|------|------------------------|---------------|
| 餐饮运营 (整组) | /restaurant/* | 明显 | ⚠️ 需为 FACTORY 加 hide |
| └ 运营总览 | /restaurant/analytics | 餐饮 KPI/子行业/菜品四象限 | |
| └ 菜品四象限 | /restaurant/analytics/menu | BCG 菜品分类 | |
| └ 门店对比 | /restaurant/analytics/stores | 连锁门店经营比较 | |
| └ 经营与平台分析 | /restaurant/analytics/dianping | 大众点评/美团平台数据 | |
| └ 领料管理 | /restaurant/requisitions | 后厨向仓库领食材 | |
| └ 损耗管理 | /restaurant/wastage | 食材变质/破碎/客人退菜 | |
| └ 配方管理 | /restaurant/recipes | 菜品食材配比 (等效 BOM 但餐饮语义) | |
| └ 盘点管理 | /restaurant/stocktaking | 门店食材盘点 | |
| **财务分析看板** | /smart-bi/financial-dashboard | (当前) 餐饮多店连锁财务看板 | 实际通用可留 |

**差距**: `/restaurant/*` 对 FACTORY 租户目前未隐藏 — 建议给 `餐饮运营` 顶级项加 `hideForFactoryTypes: ['FACTORY']`.

---

## 行动项

### 🟢 已完成 (此前会话)
1. ✅ 9 FACTORY 顶级项 (生产/仓储/质量/采购/人事/调拨/设备/财务/研发) 对 RESTAURANT hide
2. ✅ 4 FACTORY 子项 (车间实时生产报表/工序管理/产品-工序配置/员工工牌生成) 对 RESTAURANT hide
3. ✅ 餐饮运营 7 项内部细化: 运营总览/菜品四象限/门店对比/经营与平台分析 功能完整; 领料/损耗/配方/盘点 待 P1 深化

### 🔴 P0-D (新发现, 10 分钟): 餐饮运营对 FACTORY hide
```ts
// AppSidebar.vue 餐饮运营顶级项
{
  path: '/restaurant', title: '餐饮运营', icon: 'KnifeFork', module: 'restaurant',
  hideForFactoryTypes: ['FACTORY'],  // ← 加这行
  children: [...]
}
```
同理后续顶级路由 (如有) 需明确 `hideForFactoryTypes: ['FACTORY']` 对应.

### 🟡 P1 (本次): 4 餐饮日常深化
每个加 KPI + 趋势 + 排行:
- **领料管理**: 本周领料金额/频次 + 趋势图 + Top N 食材领料
- **损耗管理**: 损耗总额/损耗率 + 趋势 + Top N 损耗菜品
- **配方管理**: 菜品数/平均食材种类/总成本 + Top N 高成本菜品
- **盘点管理**: 盘点频次/盘亏率 + 趋势 + Top N 盘亏食材

### 🟠 P2 (未来): 术语本地化
SHARED 模块对 RESTAURANT 租户时 UI 术语替换:
- 产品 → 菜品 (/system/products 中 column label)
- 批次 → 出品 (/production/batches — 但此项已对 RESTAURANT hide)
- 客户 列 (/sales/customers) 表单字段 "客户类型" 加 "门店/连锁总部/B2B订餐" 选项
- 分析概览 / KPI看板 / 趋势分析 数据源按租户自动选餐饮 Gold 表

---

## 数据层映射 (Silver / Gold 表)

| 模块 | 工厂租户 Silver | 餐饮租户 Silver |
|------|----------------|----------------|
| 销售 | fact_sales_order (B2B 订单) | fact_pos_bill (POS 账单) |
| 库存 | dim_material + fact_inventory_movement | dim_ingredient + fact_stocktaking |
| 生产/配方 | fact_production_batch | fact_dish_production + dim_recipe |
| 财务 | fact_receivable / fact_invoice | fact_pos_daily_summary |

(详见 `docs/superpowers/specs/2026-04-23-v2-*` 4 份数据层设计)
