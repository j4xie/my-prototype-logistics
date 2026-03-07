# 操作手册进销存章节角色归属评估

**日期**: 2026-03-04
**研究主题**: 操作手册中"进销存管理"章节应该放在哪个角色下？

---

## Final Integrated Report

### Executive Summary

- **推荐**: 采用"双角色双章节"方案 — 保留现有仓储主管的仓储操作章节，新增工厂超管的进销存管理章节
- **置信度**: 高 (基于完整代码验证)
- **核心发现**: 两个角色的"进销存"功能实际是完全不同的业务维度 — 仓储主管侧重**仓库操作执行**(入库/出库/盘点)，工厂超管侧重**商业流程管理**(采购/销售/财务)
- **关键风险**: 当前以仓储主管单一视角编写，遗漏了采购、销售、财务、退货等完整的"进销存"商业流程
- **工作量**: 新增工厂超管进销存章节约需 7 个步骤卡片 + 截图

---

### 1. 功能对比矩阵

#### 1.1 仓储主管 (warehouse_manager) — 仓库操作维度

| # | 功能模块 | 屏幕数 | 关键屏幕 | Feature Gate |
|---|---------|--------|---------|-------------|
| 1 | 首页Dashboard | 5 | WHHome (今日任务/预警/温控) | 无 |
| 2 | 入库管理 | 6 | InboundList, Create, Inspect, Putaway, ScanOperation | `isScreenEnabled('InboundManagement')` |
| 3 | 出货管理 | 8 | OutboundList, Packing, Loading, ShippingConfirm, TrackingDetail | `isScreenEnabled('OutboundManagement')` |
| 4 | 库存管理 | 13 | InventoryList, Check, Transfer, LocationManage, ExpireHandle, TempMonitor, IOStatistics, BatchTrace, Alerts | 无 |
| 5 | 个人中心 | 12 | OperationLog, AlertList, RecallManage, ConversionAnalysis | 无 |
| | **合计** | **35 (去重)** | | |

**核心操作链**: 到货 -> 入库登记 -> 质检 -> 上架 -> 在库管理(盘点/温控/预警) -> 出库打包 -> 装车 -> 发货确认 -> 物流跟踪

#### 1.2 工厂超管 (factory_super_admin) — 商业流程维度

| # | 功能模块 | 屏幕数 | 关键屏幕 | Feature Gate |
|---|---------|--------|---------|-------------|
| 1 | 采购订单 | 2 | PurchaseOrderList (草稿/提交/审批/驳回/完成), PurchaseOrderDetail | 无 |
| 2 | 销售订单 | 2 | SalesOrderList, SalesOrderDetail | 无 |
| 3 | 成品库存 | 1 | FinishedGoodsList (库存量/可用量/预留量/生产日期/保质期) | 无 |
| 4 | 调拨管理 | 2 | TransferList, TransferDetail | 无 |
| 5 | 应收应付 | 1 | ArApOverview (概览/应收/应付/账龄 4个Tab, 支持挂账/回款/付款) | 无 |
| 6 | 价格表 | 1 | PriceList | 无 |
| 7 | 退货管理 | 2 | ReturnOrderList, ReturnOrderDetail | 无 |
| | **合计** | **11** | | |

**核心操作链**: 采购下单 -> 审批 -> 收货入库 -> 成品库存 -> 销售下单 -> 出库 -> 财务结算(应收应付) -> 退货处理

#### 1.3 供应链管理 (工厂超管附加)

| # | 功能 | 屏幕数 |
|---|------|--------|
| 1 | 供应商管理 | 1 |
| 2 | 客户管理 | 1 |
| 3 | 出货管理 | 1 |
| | **合计** | **3** |

---

### 2. 维度对比分析

| 对比维度 | 仓储主管 | 工厂超管 | 分析 |
|---------|---------|---------|------|
| **屏幕总数** | 35 | 11 (进销存) + 3 (供应链) | 仓储数量多但聚焦执行层 |
| **操作深度** | 深 (入库6步骤/出库5步骤) | 中 (每模块List+Detail) | 仓储每步有独立屏幕 |
| **业务完整性** | 中 (缺采购/销售/财务) | 高 (采购到财务全覆盖) | 超管覆盖完整商业链 |
| **Feature Gate** | 入库/出库Tab可被隐藏 | 无任何gate限制 | 仓储可能部分功能不可见 |
| **财务功能** | 无 | ArAp (应收/应付/账龄) | 仓储完全没有财务视角 |
| **价格管理** | 无 | PriceList | 仓储不涉及定价 |
| **退货管理** | 无 | ReturnOrder (List+Detail) | 仓储不处理退货流程 |
| **质检功能** | 有 (WHInspect) | 无 | 仓储有质检执行能力 |
| **温控监测** | 有 (WHTempMonitor) | 无 | 仓储有冷链监控 |
| **批次溯源** | 有 (WHBatchTrace) | 无 | 仓储有溯源能力 |
| **扫码操作** | 有 (WHScanOperation) | 无 | 仓储有现场操作工具 |
| **用户画像** | 仓库一线操作人员 | 企业管理层/老板 | 不同决策层级 |

---

### 3. 决策分析

#### 3.1 "进销存"一词的歧义

"进销存"在中文业务语境下通常指的是完整的商业流程:
- **进** = 采购进货 (采购订单 -> 审批 -> 收货)
- **销** = 销售出货 (销售订单 -> 出库 -> 发货)
- **存** = 库存管理 (库存盘点 -> 调拨 -> 预警)

从这个定义看:
- **仓储主管**只覆盖了"存"的执行层 + "进/销"的仓库操作环节
- **工厂超管**覆盖了完整的"进(采购)+销(销售)+存(成品库存)" + 财务(应收应付) + 退货

#### 3.2 当前操作手册的问题

当前手册 `platform/app-manual/index.html` 进销存章节:
- 标题为"进销存管理"
- 实际内容为: 仓储首页 -> 入库管理 -> 库存管理 -> 出库发货 -> 统计分析
- 以 `warehouse_mgr1` 测试账号演示
- **缺失**: 采购流程、销售流程、财务结算、退货管理、价格配置

这是"仓库操作指南"而非"进销存管理指南"。

#### 3.3 Feature Gate 风险

仓储主管的入库Tab和出货Tab受`isScreenEnabled('InboundManagement')`和`isScreenEnabled('OutboundManagement')`控制。如果工厂配置关闭了这些feature，仓储主管只能看到: 首页 + 库存 + 我的 — 三个Tab。而工厂超管的进销存模块完全没有feature gate限制。

---

### 4. 推荐方案

#### 方案: 双角色双章节 (推荐)

| 章节 | 角色 | 内容 | 步骤数 |
|------|------|------|--------|
| **第三章: 仓库操作** (改名) | 仓储主管 | 首页/入库/库存/出库/统计 | 5 (现有) |
| **第四章: 进销存管理** (新增) | 工厂超管 | 采购/销售/成品库存/调拨/应收应付/价格表/退货 | 7 (新增) |

**理由**:
1. **业务完整性**: 工厂超管的进销存才是真正的"进销存"全流程，覆盖采购到财务
2. **目标用户精准**: 仓储章节面向一线操作人员，进销存章节面向管理层
3. **避免歧义**: 重命名现有章节为"仓库操作"更准确反映内容
4. **无Feature Gate风险**: 工厂超管的进销存模块无任何条件隐藏
5. **补全短板**: 当前手册完全缺失采购、销售、财务相关操作说明

#### 具体行动项

1. **[无需代码改动]** 将现有第三章从"进销存管理"改名为"仓库操作管理"，副标题更新为"仓储主管的日常操作"
2. **[无需代码改动]** 新增第四章"进销存管理"，以工厂超管(factory_admin1)视角编写，包含:
   - Step 01: 采购订单 (创建/审批/收货 全流程)
   - Step 02: 销售订单 (创建/出库/完成)
   - Step 03: 成品库存 (库存查看/库存状态)
   - Step 04: 调拨管理 (创建/审批/执行)
   - Step 05: 应收应付 (概览/挂账/回款/账龄分析)
   - Step 06: 价格表管理
   - Step 07: 退货管理 (客户退货/供应商退货)
3. **[无需代码改动]** 需要截取11个工厂超管进销存屏幕的截图
4. **[无需代码改动]** 更新手册目录导航，添加新章节链接

---

### 5. 置信度评估

| 结论 | 置信度 | 依据 | 证据基础 |
|------|--------|------|---------|
| 两个角色的进销存功能是不同维度 | ★★★★★ | 代码直接验证: 完全不同的screen文件、不同的API client | 代码验证 |
| 工厂超管覆盖更完整的"进销存"商业流程 | ★★★★★ | 代码验证: 7模块覆盖进(采购)+销(销售)+存(库存)+财务+退货 | 代码验证 |
| 仓储主管侧重操作执行 | ★★★★★ | 代码验证: 质检/上架/打包/装车/扫码等现场操作屏幕 | 代码验证 |
| 双章节方案可行 | ★★★★☆ | 功能不重叠、目标用户不同、操作路径独立 | 代码验证 + 分析 |
| Feature gate影响仓储功能可见性 | ★★★★★ | 代码验证: `isScreenEnabled('InboundManagement')` | 代码验证 |

---

### 6. 代码验证记录

| # | 验证项 | 文件 | 结果 |
|---|--------|------|------|
| 1 | 仓储Tab structure | `WarehouseManagerTabNavigator.tsx` | 5 Tabs, 入库/出库受feature gate |
| 2 | 工厂超管进销存screens | `FAManagementStackNavigator.tsx:74-86` | 11 screens imported |
| 3 | 进销存九宫格入口 | `FAManagementScreen.tsx:146-193` | 7 grid items 无条件渲染 |
| 4 | 仓储入库流程 | `WHInboundStackNavigator.tsx` | 6 screens (List->Detail->Create->Inspect->Putaway->Scan) |
| 5 | 仓储出库流程 | `WHOutboundStackNavigator.tsx` | 8 screens (List->Detail->Packing->Loading->Shipping->Tracking) |
| 6 | 仓储库存管理 | `WHInventoryStackNavigator.tsx` | 13 screens (含盘点/调拨/温控/溯源/预警) |
| 7 | 应收应付深度 | `ArApOverviewScreen.tsx:72-79` | 4 Tab (overview/ar/ap/aging), 支持挂账/回款/付款 |
| 8 | 采购订单状态流 | `PurchaseOrderListScreen.tsx:13-21` | 7 status: DRAFT->SUBMITTED->APPROVED->PARTIAL->COMPLETED |
| 9 | 成品库存指标 | `FinishedGoodsListScreen.tsx:29-33` | total/available/reserved + 低库存/售罄/充足状态 |
| 10 | 当前手册内容 | `platform/app-manual/index.html:1208-1210` | "仓储主管的日常操作" 5步流程 |

---

### Process Note
- Mode: Full (Manager直接执行, 代码已完整探索)
- 源文件探索: 15+ files
- 关键分歧: 无 (代码事实清晰)
- 代码验证: 10 项全部通过
- Phases completed: Research -> Analysis -> Critique -> Integration -> Heal
- Healer Notes: All checks passed

---

### Healer Notes: All checks passed
- Structural completeness: Executive Summary, Comparison Matrix, Recommendations, Confidence all present
- Cross-reference integrity: All file citations verified against actual reads
- Confidence consistency: All conclusions at 4-5 stars supported by code evidence
- Actionable recommendations: 4 specific action items with clear scope
