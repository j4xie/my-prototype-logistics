# W2 Handoff — Apr 7-8 Session 续

**日期**: 2026-04-08
**上下文**: Apr 7 客户会议需求落地 W1 全部完成 (13 commits, E2E 11/11), W2 续做.

---

## 本轮 4 commits

| # | Commit | 内容 | 行数 |
|---|--------|------|------|
| 1 | `3140dd02` | W2-1 purchase_order_items schema 漂移修复 (V20260407_05) | +15 |
| 2 | `e8743e98` | W2-2 OperationalQuote 前端管理页 (`/sales/quotes`) | +448 |
| 3 | `3e0b436e` | W2-3 P0-5 FactoryMaterialRequisition 后端 MVP | +699 |
| 4 | `2502c6a2` | W2-3b P0-5 3 AI Tools (generate/query/close) | +216 |

**编译验证**: ✅ `mvnw compile` (54s) + ✅ `vite build` (28s)

---

## W2-3 关键设计决策

**命名冲突**: `restaurant.MaterialRequisition` 已占用 `material_requisitions` 表 (单行单料餐厅版).
→ 工厂版用 `FactoryMaterialRequisition` + `factory_material_requisitions`, 新建 `entity.factory` 包.

**新建文件** (8 个 Java + 1 个 SQL + 3 个 Tool):
```
entity/factory/FactoryMaterialRequisition.java           # 状态机 + 操作人时间
entity/factory/FactoryMaterialRequisitionItem.java       # BOM 展开行 + batch_numbers JSONB
repository/factory/FactoryMaterialRequisitionRepository.java
repository/factory/FactoryMaterialRequisitionItemRepository.java
service/factory/FactoryMaterialRequisitionService.java   # 9 方法接口
service/factory/impl/FactoryMaterialRequisitionServiceImpl.java
controller/factory/FactoryMaterialRequisitionController.java  # 9 REST endpoints
db/migration/V20260407_06__factory_material_requisitions.sql
ai/tool/impl/factory/MaterialRequisitionGenerateTool.java
ai/tool/impl/factory/MaterialRequisitionQueryPendingTool.java
ai/tool/impl/factory/MaterialRequisitionCloseTool.java
```

**状态机**: `PENDING → PICKING → TRANSFERRED → ISSUED → IN_USE → CLOSED` (+ `CANCELLED`)

**generateFromPlan 算法**:
```
for each BomItem of plan.productTypeId:
    required_qty = plan.plannedQuantity × bom.getActualQuantity()
                   // getActualQuantity() 已考虑 yieldRate
```

**close 算法**:
```
for each item:
    returned_qty = max(0, issued_qty - consumed_qty)
```

**已标注 TODO** (代码注释里):
- `transferToFactory()`: 未调用真实 `InventoryTransferService` 创建库存调拨单
- `close()`: 未创建反向 transfer (factory → logistics)

---

## 下次开工优先级

1. 🔴 **内部 dry-run** (4h) — **演示前必做**
   - 用 playwright skill 跑: 登录 → 销售订单新建 → 5 tab 业务中心 → 税率分组开票 → /sales/quotes 页 → factory_material_requisitions 生成 curl
   - 产出话术 + 截图

2. 🟡 **AI intent DB 绑定** (1h) — 3 个新 tool 插 `ai_intent_config` 记录
   ```sql
   INSERT INTO ai_intent_config (id, intent_code, intent_name, intent_category, tool_name, keywords, is_active, sensitivity_level)
   VALUES
     (gen_random_uuid(), 'FACTORY_MR_GENERATE', '生成物料需求单', 'DATA_OPERATION', 'factory_material_requisition_generate', '["生成备料单","按BOM备料","排产备料","物料需求单"]', true, 'LOW'),
     (gen_random_uuid(), 'FACTORY_MR_QUERY_PENDING', '待备料查询', 'DATA_QUERY', 'factory_material_requisition_query_pending', '["待备料","今天要备的料","物料需求单列表"]', true, 'LOW'),
     (gen_random_uuid(), 'FACTORY_MR_CLOSE', '物料需求单关单', 'DATA_OPERATION', 'factory_material_requisition_close', '["关闭MR","物料需求单关单","生产退料"]', true, 'MEDIUM');
   ```

3. 🟡 **前端 FactoryMaterialRequisition 列表/详情页** (4-6h)
   - 仿 `web-admin/src/views/sales/quotes/list.vue` 结构
   - 路由 `/factory/material-requisitions`
   - 状态 tag + 7 个 action 按钮 (按状态显示)
   - BOM 展开明细行表格 (required/picked/issued/consumed/returned)

4. 🟢 **InventoryTransfer 双向集成** (8h) — 替换 2 个 TODO 注释
   - `transferToFactory()`: 调 `InventoryTransferService.create(source=logistics, target=factory, items=[{batch,qty}])`
   - `close()`: 创建反向 transfer, source=factory, target=logistics, qty=returned_qty
   - 注意锁定原批次号 (difficulty 高, Agent B 评估 9/10 成熟度是"字段级", 实现级有坑)

5. 🟢 **PC 批次 SalesDeliveryItemBatchAllocation** (12-16h)

6. 🟢 **camera 修复** (1 HIGH + 5 MEDIUM factoryId, 4-6h)

7. 🟢 **P1-1 工人欠退扫码** (16-24h, 涉及硬件)

---

## 验收状态

- [x] 后端编译通过 (mvnw compile ✅)
- [x] 前端编译通过 (vite build ✅)
- [ ] 本地 Flyway 迁移应用 — **下次启动自动跑** V20260407_05/_06
- [ ] 本地 E2E 真实调用 (curl) — 未做
- [ ] 部署服务器 — 未推

---

## 参考

- **设计文档**: `docs/plans/verification-round2/B-p04-p05-design.md` (P0-5 完整设计, 9/10 成熟度)
- **客户原话**: `temp/meeting-transcribe/transcript.txt` 3124-3252s
- **V1.0 路线图**: `docs/plans/customer-meeting-apr7-requirements-v3.md`
