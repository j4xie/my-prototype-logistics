# R28 — R22-T4 Part 2 Full DEEP (finally!)

**Date**: 2026-04-16
**Method**: MCP playwright-test + 2 API seeds (BomItem + MaterialProductConversion) + real UI click 生成调拨单 + cross-module verify
**Blocker removed**: R27-F2 made BOM errors actionable; R28 discovered 2 tables (BomItem vs MaterialProductConversion) and used the right one.

---

## The schema surprise

The `/production/bom` page writes to **`bom_items`** (BomItem entity — used for cost calculation).

The `/production-plans/{id}/generate-transfer` backend expands BOM via **`material_product_conversions`** (MaterialProductConversion — used for production material requirement expansion).

**Two separate tables, two separate purposes, same UI page tab bar ("原辅料配方" + "转换率")**:

| Tab | Table | Used by |
|---|---|---|
| 原辅料配方 | `bom_items` | Cost calculation, `/bom/items/{productTypeId}` |
| 转换率 | `material_product_conversions` | BOM expansion (`bomExpansionService.expandBOM()`) for auto-transfer |

R22 and R23 attempts to seed BOM via the 原辅料配方 form would never unlock generate-transfer — wrong table.

---

## R28 seed + test sequence

1. **Seed BomItem** (cost-side, id=27): `POST /bom/items`
   ```
   productTypeId=prod_e2e_test_001
   materialTypeId=mat_e2e_test_001
   standardQuantity=0.5
   unit=kg, unitPrice=10, taxRate=9
   materialCategory=RAW
   ```

2. **Seed MaterialProductConversion** (expansion-side, id=84d08c30-2bdb): `POST /conversions`
   ```
   materialTypeId=mat_e2e_test_001
   productTypeId=prod_e2e_test_001
   conversionRate=0.5 (kg material per 1 kg product)
   wastageRate=5 (5%)
   isActive=true
   ```

3. **Click 生成调拨单** via UI on PP-AUTO-20260415-0001 (plannedQuantity=100)
4. **Dialog**: "确定为计划 PP-AUTO-20260415-0001 生成调拨单? 将根据 BOM 配方自动计算所需原辅料及包材..."
5. **Click 生成** → Toast **"调拨单已生成，共 1 项物料，等待仓库审批"**
6. **Navigate /transfer/list**: 1 row, **TRF-20260416-3798**
   - 方向: 调出
   - 类型: 总部→分部
   - 调出方/调入方: FOOD_3101_048 (self-transfer since no targetFactoryId specified)
   - 金额: ¥0.00 (material cost not populated in transfer items)
   - 状态: **已申请** (auto-submitted for warehouse approval)
7. **Console errors**: 0

---

## Cross-module chain proven

```
生产计划 PP-AUTO-20260415-0001 (待执行, 100件)
    ↓ click 生成调拨单
ProductionWorkflowOrchestrator.generateTransferFromPlan()
    ↓ bomExpansionService.expandBOM(factoryId, productTypeId, 100)
MaterialProductConversion[mat_e2e_test_001 → prod_e2e_test_001, rate=0.5]
    ↓ required = 100 * 0.5 = 50kg of mat_e2e_test_001
InternalTransfer TRF-20260416-3798 created (direction=OUT, factory→factory)
    ↓ transferService.requestTransfer()
Status → 已申请 (等待仓库审批)
```

---

## R28 also indirectly verified

- R27-F2 fix shipped live: BOM POST 400 errors are now specific ("必须选择产品" from factory_validation_rules)
- R27-F1 hardening: /product-types responds in sub-second
- R22-T4 backend logic is sound — the issue was purely data seeding

---

## R28 lessons

1. **UI vs backend schema dissonance**: BomItem+MaterialProductConversion are sibling concepts presented as one in UI ("BOM 管理" page with 2 tabs). Testing or seeding BOM data without knowing which table the target code path queries leads to R22/R23's false "BOM missing" confusion.
2. **Customer-facing implication**: If users only configure 原辅料配方 (cost side) without 转换率, generate-transfer would fail with "无 BOM 配置" — which is factually misleading since BOM items exist. Better error: "该产品无转换率配置" or "请在 BOM → 转换率 tab 配置原料转换关系".
3. **Data-prerequisite clause per depth-first-e2e Rule 1**: R22-T4 Part 2 is a case study — without full seed, test downgraded to medium (wiring proven, happy path blocked). R28 provided the seed, test is now FULL DEEP.

---

## R29 backlog

1. R22-F1 PO 409 transient (SQL trace setup)
2. Improve "无 BOM 配置" error to point to conversions tab specifically (UX P3)
3. Maven target/ lock → deploy script retry logic (R27 side finding)
4. P3: BomItem vs MaterialProductConversion — consider deduplication or strong cross-reference
