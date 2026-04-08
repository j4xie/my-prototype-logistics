# Round 2 Task C — P0-13 / P1-1 / P1-3 深度核对

核对日期: 2026-04-07
核对人: Verification Agent (Round 2)
依据: temp/meeting-transcribe/transcript.txt + 后端 entity 源码

---

## P0-13 PC 批次（生产日期批次）

### 客户原话 (transcript line 1849-1869)

> "我们这边可能比较特殊一点，就是我们这边那个所有商品涉及到 **PC 管理**，所以说那个 PC 的那个这个字段也加上去……PC 那个吗？**就其实就商品的生产日期**。比如说这个原材料是 10 号到了一批，12 号到了一批，那么只有两个 PC 这个 OK……包括我们自己生产的也是，可能今天是 7 号生产的一批……当然我们给到客户肯定是出了一张销售出户单，**上面可能会是同一个产品出现三个 PC**，因为我们给到客户里面要告知人家生产日期的，**人家也要做到先进先出**。"

并参考 line 988-1017:
> "出户批次可以选择批次……比如说这个注入心可能是 1 月 1 号生产的，第二个注入心可能是 1 月 2 号生产的，是两个不同批次，库存不一样。"

**含义解读**:
1. PC = "Production Code" = 生产日期批次
2. **粒度**: 同一 SKU 按日期可拆多批次
3. **关键场景**: **同一销售出库单的同一产品行可拆 2-3 个 PC 批次**显示给客户（FIFO 出货）
4. 适用范围: 原材料入库、自产成品入库、销售出库 全链路

### 现状代码核查

| 检查点 | 文件 | 结果 |
|--------|------|------|
| MaterialBatch 有批次号 | `entity/MaterialBatch.java` | 存在 (但是采购批次概念，不是 PC 日期批次) |
| FinishedGoodsBatch.batchNumber | `entity/inventory/FinishedGoodsBatch.java:61` | 存在 |
| FinishedGoodsBatch.productionDate | `entity/inventory/FinishedGoodsBatch.java:94-95` | **存在 LocalDate productionDate** ✅ + 索引 idx_fgb_production_date |
| SalesDeliveryItem 关联批次 | `entity/inventory/SalesDeliveryItem.java:59-80` | **只有单个 finishedGoodsBatchId** ❌ |
| FIFO/FEFO 出库逻辑 | `MaterialFifoRecommendTool` / `InventoryMatchingService` / `SalesServiceImpl` | 存在原料 FIFO Tool, 销售出库 FIFO 不明确 |

### 真实差距

1. **数据模型 50% 已经具备**: FinishedGoodsBatch 已有 `productionDate` + `batchNumber`，原料 MaterialBatch 也有批次号。客户说的 "PC 字段" 实际上 **后端字段已存在**，缺的是 **前端 UI 没暴露/没命名为 "PC"**。
2. **致命差距 — 出库单一行只能绑一个批次**: `SalesDeliveryItem.finishedGoodsBatchId` 是单值字段。客户明确说"同一个产品出现三个 PC"，意味着销售出库单的一行 SKU 必须能拆成 N 行 PC 子行，每行带数量+生产日期。当前模型做不到（只能在前端拆成多个 SalesDeliveryItem，但同一 productType 拆多行会破坏订单对账）。
3. **打印模板缺 PC 列**: 销售出库单打印必须显示 PC 编号 + 生产日期，目前模板未确认。
4. **FIFO 出库自动选批**: 销售出库未确认是否按 productionDate 升序自动建议批次。`MaterialFifoRecommendTool` 仅服务于原料端。

### 修复建议（具体到字段/方法）

1. **字段重命名/暴露**: 前端 SKU 列表、采购入库、生产报工、销售出库都加列 "PC (生产日期批次)"，绑 `FinishedGoodsBatch.productionDate` + `batchNumber`，组合显示如 `PC20260107-01`。
2. **新增 SalesDeliveryItemBatchAllocation 子表**:
   ```java
   @Entity @Table(name = "sales_delivery_item_batch_allocations")
   class SalesDeliveryItemBatchAllocation {
     Long id;
     String deliveryItemId;       // FK -> sales_delivery_items.id
     String finishedGoodsBatchId; // FK -> finished_goods_batches.id
     BigDecimal quantity;         // 该 PC 出库数量
     LocalDate productionDate;    // 冗余便于打印
     String pcCode;               // 冗余 PC 显示编号
   }
   ```
   `SalesDeliveryItem` 加 `@OneToMany List<SalesDeliveryItemBatchAllocation> allocations`。
3. **SalesServiceImpl.confirmDelivery()** 改造: 按 FIFO (productionDate ASC) 自动从 FinishedGoodsBatch 扣减库存，生成多条 allocation 记录。
4. **打印模板**: SalesDeliveryNote PDF/HTML 输出，每个产品行下方显示子表 (PC 编号 / 生产日期 / 数量)。
5. **MaterialBatch** 同步加 `productionDate` 字段（如未存在），供原料 PC 显示。

### 评分: **3/10**

后端 50% 数据模型已就绪 (FinishedGoodsBatch.productionDate)，但 SalesDeliveryItem 单批次绑定结构性阻断、前端无 PC 列、打印模板无 PC、销售出库 FIFO 未实现。需要 schema 改动 + Service 改造 + 前端 + 打印模板四处工作。

---

## P1-1 工人欠退/换岗扫码

### 客户原话 (transcript line 1730-1744)

> "早上选择好工序啊，就是对应产品的对应工序选好以后，然后扫码啊，扫了一个千道，把对应的下面员工领走啊……**如果中间有员工走了，那我肯定就再选一下我正在进行的这个工序，然后有个欠退，我再扫一下这个员工，这个员工相当于欠退了，从我这下从我这工序下班了**，就类似这个原则啊。"

并参考 line 1565-1614:
> "先扫码签到，然后分配人员……后面你们扫码到的时候认领……这里就可以加一个那个扫码的环节了，就是开始。"

**含义解读**:
1. **欠退** = 员工中途从当前正在进行的工序退出 (并不是离开工厂，而是从这道工序下班)
2. 流程: 主管选当前工序 → 点 "欠退" → 扫该员工的工牌 → 系统结算该员工在该工序的工时
3. 同一员工可能下午被扫到另一个工序 → 工时分段累计
4. 关键: 扫码 = 工序级签入/签出，不是日级签到

### 现状代码核查

| 检查点 | 结果 |
|--------|------|
| `EmployeeWorkSession` 字段 | id, factoryId, userId, **workTypeId** (单个工种), startTime, endTime, status (active/completed), actualWorkMinutes, laborCost |
| `BatchWorkSession` 存在 | 存在，是 worksession-batch 多对多桥 |
| 中途退出/欠退 API | Grep `欠退` `partialQuit` `leaveSession` → **零匹配** |
| 工序级签入签出 | `WorkReportCheckinTool` 存在但是签到入工厂级别，不是工序级 |
| 主管扫员工工牌结算 | 未发现 |

`EmployeeWorkSession` 是 "员工今天做哪个工种" 一段时间的容器 (workTypeId 单值)，**没有"中途从工序 A 退出 → 加入工序 B"的状态机**。

### 真实差距

1. **数据模型不支持**: 一个 EmployeeWorkSession 只绑一个 workTypeId，无法表达"上午做切配 / 下午做包装" 的工序切换。需要新表 `EmployeeProcessSegment` 或允许 EmployeeWorkSession 一天有多条记录。
2. **无"欠退"动作**: 缺 API `POST /worksession/scan-leave` (params: workTypeId, employeeBadgeQR) → 结算该员工在该 workType 当前 active session 的 endTime + actualWorkMinutes + laborCost，状态置 completed。
3. **无主管端"当前工序" UI**: 主管界面没有"当前正在进行工序 → 选择 → 扫码加人/扫码踢人"的扫码界面 (web-admin 和 RN 均无)。
4. **签入侧也不完整**: 现有签到是日级，客户要的是 "扫码加入到这道工序"，意味着扫码 → 自动 startSession(userId, workTypeId, batchId)。

### 修复建议

1. **后端新增 endpoint**:
   - `POST /api/mobile/{factoryId}/worksession/scan-join`: body { workTypeId, batchId, employeeId } → 创建 EmployeeWorkSession (status=active)
   - `POST /api/mobile/{factoryId}/worksession/scan-leave`: body { workTypeId, employeeId } → 找到该员工 active session 的同 workTypeId 记录，结算并 completed
2. **WorkSessionController** 新增上述两个 action，复用 `EmployeeWorkSessionService` 计算 laborCost 逻辑。
3. **RN App 主管页**: 新增 "工序扫码" 屏幕，显示当前正在进行工序列表 + [加员工扫码] / [欠退扫码] 两个按钮，调用上述 API。
4. **可选**: 增加 `EmployeeWorkSession.exitReason` 字段 (`shift_end` / `partial_quit` / `transfer`)，便于工时报表分类。

### 评分: **2/10**

完全没有"工序级扫码进出 + 欠退结算"的流程。EmployeeWorkSession 数据模型就近能改造（加 join/leave API），但 UI、扫码集成、工牌系统都没有。需要后端 2 个 API + RN/Web 主管页 + 扫码硬件联调。

---

## P1-3 研发样品 3 页合 2 页

### 客户原话

**Line 194-198 (关于审批流)**:
> "你那边设计逻辑挺好的……样品过了以后转转审批，然后运营那边应该报价。"

**Line 458-471 (关于页面归属)**:
> "你不你去那个**样品研发**的，因为我们刚刚是点在里面的，外面没看见……样品研发我看看发哪了……**对在小屋下小屋管理下**……对你刚过去了……对那 ok 没问题了，**到时候的话就看那个研发需求跟样品管理做一个合并就行了**，这个两个其实是一个道理的动作。"

**Line 475-491**:
> "对这做一个合并就行了。然后那个报价嘛，就是报价管理就是我们这边呃**样品过了以后**……类似于提交一个审批嘛，对应的人员去报价的……正常的话就是呃**样品研发过后提交报价**，报价的话我们只点一个运营，因为我们这边报价是运营报价的。"

**含义解读**:
1. 客户希望的最终结构: **2 页**
   - 页 1: **研发需求 + 样品管理 (合并)** — 一条样品记录从需求到样品全流程
   - 页 2: **报价管理** — 样品审批通过后流转到报价
2. 当前是 3 页（猜测）: 研发需求 / 样品管理 / 报价管理
3. 客户原话明确："研发需求跟样品管理做一个合并"

### 现状代码核查

| 检查点 | 结果 |
|--------|------|
| `web-admin/src/views/rd/` | 子目录: `samples/` (有 list.vue), `requests/` (空), `quotations/` (空) |
| 路由 `router/index.ts` | RD 模块只注册了 1 条路由 `rd/samples` → list.vue, 标题 "研发样品管理" |
| RD 模块菜单 | 只有"研发样品管理"一项，没有"研发需求" / "报价管理"页面 |

**当前实际状态**: 不是"3 页"也不是"2 页"，而是 **只有 1 页 (研发样品管理)**。`requests/` 和 `quotations/` 目录是空的占位。

### 真实差距

客户原话基于"客户当时看到的 3 页画面" — 这暗示某个版本/分支或者 PRD/原型上有 3 页，但 main 分支代码现在是 1 页。差距分两种解读:

**解读 A** (基于现在 main 分支):
- 1 页 → 客户期望 2 页 = **缺 1 页报价管理** + 样品管理需要内嵌"研发需求"字段
- 当前 list.vue 是否包含完整的"需求字段 + 样品字段"未验证

**解读 B** (基于客户记忆中的 3 页):
- 客户看到的是 PRD/原型 3 页 (需求/样品/报价) → 期望合并需求+样品 = 2 页
- 需要先确认客户记忆 vs 当前代码

### 修复建议

1. **核对当前 list.vue 字段** (需读 `web-admin/src/views/rd/samples/list.vue`)，确认是否已含 "研发需求" 字段集 (右远/样品名称/规格/等级/附件展示图)；不含则补齐。
2. **新增报价管理页**: `web-admin/src/views/rd/quotations/list.vue` + 路由注册 `rd/quotations`，标题 "报价管理"。
3. **样品 → 报价审批流**: 样品记录加 `status` 字段 (草稿/审核中/通过/驳回)，"通过"后可以"提交报价"按钮，自动创建 quotation 记录指派给运营角色。
4. **菜单**: RD 模块 children 改为 2 条 (研发样品管理 + 报价管理)。
5. **删/隐藏 requests 目录**: 因为已合并到 samples。

### 评分: **4/10**

当前状态比 PRD 还要简单（只 1 页），合并方向已明确但代码未做。报价管理整页缺失，样品 → 报价的流转动作没实现。改造工作量中等：1 个新页面 + 1 个状态字段 + 1 个流转 API。优势是路由结构干净、无需删旧代码。

---

## 评分汇总

| 需求 | 评分 | 主要瓶颈 |
|------|------|---------|
| P0-13 PC 批次 | 3/10 | SalesDeliveryItem 单批次绑定，需 schema 改动 + 出库 FIFO + 打印模板 |
| P1-1 工人欠退扫码 | 2/10 | 完全无工序级扫码进出，需新 API + 主管 UI + 扫码集成 |
| P1-3 研发样品合并 | 4/10 | 当前仅 1 页，需新增报价页 + 状态流转 |
