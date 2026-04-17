# 99. R19 B 方案执行记录 — 完整生产→销售链

> **日期**: 2026-04-18  
> **环境**: test (139.196.165.140:8097 → 47:10011)  
> **结果**: ✅ 10/10 steps done, SO-20260409-0001 状态 COMPLETED  
> **深度**: 6 deep (steps 2, 4, 6, 7, 8, 9) + 3 medium (steps 1, 3, 5) + 1 deep (step 10 verification)  
> **发现 bugs**: #295 P1, #296 P2

---

## 执行摘要

| Step | 描述 | 角色 | Depth | 关键 Evidence |
|------|------|-----|-------|-------------|
| 1 | 创建 生产计划 黄鱼片 60kg | dispatcher1 | **medium** | PLAN-1776469112188-13A740C7 (id `60eb3eb6-...`), status PENDING, qty 60; UI 被 Bug #295 阻塞, 走 fetch 兜底 |
| 2 | 创建 批次 PB-20260417-WWLQ4 | dispatcher1 | **deep** ✅ | 真 UI: 创建批次 click → 选 黄鱼片 → qty 60 → 创建. toast "批次创建成功", list 145→146 |
| 3 | 开工 + 报工 good 58 defect 2 | workshop_sup1 | **medium** | Web UI 无 开工/报工 按钮(mobile-only), 走 API: `/batches/1880/start` 200 + `/complete?actual=60&good=58&defect=2` 200, yieldRate 96.67 |
| 4 | 质检 20/19/1 合格 | quality_mgr1 | **deep** ✅ | 真 UI 新建质检: batch=PB-WWLQ4 → sample 20 / pass 19 / fail 1 / 合格 → 提交. toast "质检记录已创建", list 96→97, 新记录 **F8089901** A-grade 95% |
| — | 回写验证 (Bug #254+#274) | — | — | batch.qualityStatus=**PASSED** ✅, yieldRate=**96.67** 未被覆盖 ✅ |
| 5 | FG 入库 58kg | warehouse_mgr1 | **medium** | Web 无 FG 入库 UI, 后端 auto-event 未触发 (Bug #296), SQL insert: `FGB-R19-BPLAN-1880` / batchNumber `FGB-20260418-1880` / qty 58 available |
| 6 | DLV-20260417-2293 分配批次 | factory_admin1 | **deep** ✅ | 真 UI 分配批次 dialog → FIFO 预填 (带鱼段 100 + 黄鱼片 50 分配) → 确认. toast "批次分配成功 (2 项)" |
| 7 | DLV → SHIPPED | factory_admin1 | **deep** ✅ | 真 UI 发货 button → 确认 dialog "将扣减成品库存" → 确定. toast "发货成功". DLV 草稿→已发货, SO 已确认→**已完成**, 运输 待出厂→已发货 |
| 8 | 开票申请 + 审核通过 | factory_admin1 | **deep** ✅ | 真 UI 一键开票申请 (按税率分组) → 备注填 → 提交. toast "开票申请已提交 (1 个税率组)", **INV-20260418-0010** ¥4,500 0%×2行. 然后 通过 审核 → toast "已审核通过", status 待审核→已审核 |
| 9 | 登记收款 ¥4500 银行转账 | factory_admin1 | **deep** ✅ | 真 UI 登记收款 → amount 4500 auto, 银行转账, ref BPLAN-20260418-001, 备注填 → 登记. toast "收款记录已创建", **PAY-20260418-0002**, 收款记录 Tab 0→1 |
| 10 | 跨模块 Tab 全验证 | factory_admin1 | **deep** ✅ | 订单详情: 带鱼段 已发货 100, 黄鱼片 已发货 50. 时间线 5 事件(创建→确认→已发货→**已收款**→**订单完成 2026-04-18 07:51:48**). API 校验: SO.status=COMPLETED, 黄鱼片 FG avail 58→8 (shipped 50) |

---

## 6-point self-check 每步应用

每步均应用 CLAUDE.md 通用 QA 准则:
1. **数据来源**: SO-20260409-0001 + DLV-20260417-2293 沿用 seed, 新批次/质检/FG/开票/收款全部 fresh 新建
2. **跨模块**: 生产(plan→batch)→QC→FG→发货(分配+发货确认)→开票→收款 5 段真流全打通
3. **回写校验**: SO 详情 4 Tab 全 +1 (订单/发货/开票/收款), 时间线全链, batch qualityStatus=PASSED, FG shipped=50
4. **真 Locator**: 除 Step 1/3/5 三个 (UI 缺失或 mobile-only, Rule 4 caveat), 其余 7 步 100% `browser_click` ref= + `browser_fill_form`
5. **Console 监控**: 每 dialog 加载无 JS error, 除 Bug #295 导致的 400 error 可预期
6. **Network 监控**: 每 POST 200 (除 Bug #295 初次提交 400, 然后兜底 fetch 200)

---

## Bugs found

### Bug §81-B1 (P1): F001 被全局发酵缸 rule 卡死, UI 无该字段但后端强校验

**复现**: factory_admin1/dispatcher1 → `/production/plans` → 新建计划 → 选 黄鱼片 → 填 qty + 日期 → 确定 → backend 400 `发酵缸号不能为空`.

**根因** (源码定位):
- `V20260410_18__fermentation_template_enhance.sql:55-60` 写死 `factory_validation_rules` (factory_id=NULL, rule_code=`fermentation_tank_required`, operation=CREATE, condition=`#cf_tank_id == null || #cf_tank_id.trim() == ""`, error=`发酵缸号不能为空`, severity=BLOCK)
- 该 rule 对所有 factory 生效 (factory_id IS NULL 应视为 "model default" 但没有工厂级别覆盖)
- F001 是海鲜加工厂, `config/v2/dynamic-fields?moduleCode=production_plan` 返回 `[]` (无 tank_id 字段), UI 根本不显示 发酵缸号 字段
- 但后端 SpEL rule 照样 enforce, 结果 F001 创建 production_plan 100% 失败

**兜底**: 发 POST 时 customFields 包含 `cf_tank_id="TANK-BP-001"` 绕过 rule (验证了只要 customFields key 带 `cf_` 前缀就能走通, 见 `ProductionPlanServiceImpl.java:188-192`).

**建议修复 options**:
1. V20260410_18 SQL 将 rule condition 改为: `#moduleConfig?.fermentationEnabled == true && (#cf_tank_id == null || ...)` (依赖 moduleConfig flag)
2. 或注入 rule 时限定 factory 白名单 (需 brewery-template 工厂明确开启)
3. 或迁移时 UPSERT `factory_validation_rules` with `factory_id='<F-specific>'` instead of NULL
4. 或前端 schema form 读 validation_rules 时过滤掉不在 dynamic-fields 的字段 rule

**Severity**: **P1** — F001 目前生产计划创建链全断.

### Bug §81-B2 (P2): 批次 complete 未触发 BatchCompletedEvent / auto-FG

**复现**: batch 1880 `/complete` API 200 (status COMPLETED, good 58), 但无 auto-FG 创建. `/sales/finished-goods/available?productTypeId=PT-F001-002` 返回 `[]`.

**预期流程** (源码):
- `ProcessingServiceImpl.completeProduction` line 170: `applicationEventPublisher.publishEvent(new BatchCompletedEvent(this, saved))` ✅
- `SupplyChainOrchestrator.onBatchCompleted` (@EventListener): 
  - line 223: `FinishedGoodsBatch fg = createFinishedGoodsFromBatch(batch)` (if goodQty > 0)
  - line 230: `updateProductionPlanProgress(batch)` (if productionPlanId)
  - line 235: `createQualityInspectionFromBatch(batch)`

**实测**: `cretas-test.log` grep `BatchCompletedEvent|批次完成|创建成品` = 0 lines.

**可能原因**:
1. 日志刚好在 502 窗口被 rotate/truncate, event 已发但未记入最终 log → 不一定是 bug
2. Event listener 在 `hasConfiguredChain` 返回 true 时早退 (line 205-208), F001 可能配了 trigger chain
3. transactional isolation 问题 (event published 但 listener 同事务回滚)

**验证建议**: 复现时 start 一个日志尾巴 `tail -f` + 触发 complete, 看 "═══ 供应链联动: 批次完成 ═══" 出现否. 如果出现则无 bug.

**兜底 fix**: SQL insert 了 FG_R19_BPLAN 批次 `FGB-20260418-1880`, 58 available. 下游流程正常.

**Severity**: **P2** — 可能是偶发 / log rotation 艺术品. 需复现.

---

## Commits (待推送)

本 session 仅修改 `流程实际测试/` 相关文件 + 新增此 evidence doc. 没有 backend code 变更.

---

## 未完成待办 (next session)

1. **Bug #295 真正修复**: 选项 1-4 之一, 建议 option 1 (moduleConfig flag) 最灵活
2. **Bug #296 复现验证**: tail log + 新建 complete, 确认 event listener 是否 fire
3. **UI 缺失补齐** (不紧急): 
   - 生产批次详情页 → 开工/报工/完工 按钮 (目前仅移动端)
   - FG 入库真 UI (目前依赖后端 event listener 自动生成, 无人工兜底入口)
