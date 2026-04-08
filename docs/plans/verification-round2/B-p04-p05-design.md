# Round 2 Task B — P0-4 销售运营报价 & P0-5 物料需求单 设计核对

> 验证日期: 2026-04-07
> 验证员: Verification Agent (Round 2 - Task B)
> 输入: temp/meeting-transcribe/transcript.txt
> 现状代码: backend/java/cretas-api/src/main/java/com/cretas/aims/entity/

---

## 一、原话核对

### P0-4 销售运营报价 (transcript 行 476–535, 时间 1642s–1768s)

关键原话:
- 行 477–479: "报价管理就是我们这边样品过了以后，**像类似于提交一个审批**，对应的人员去报价的"
- 行 484–486: "**某个权限去报价**" / "**对，某个权限里报价**" / "**那指定人员报价**"
- 行 490–495: "正常的话就是样品研发过后**提交报价**，报价的话**我们只点一个运营**，因为我们这边报价是运营报价的。运营报完价以后...**调过去审批审批完 ok 没问题，然后给到销售这边**"
- 行 511–520: "运营我们其实是一个部门嘛...我们这边叫**销售运营部**...**这个报价也是他们做**"
- 行 523–533: "我们到时候肯定是以**人员**做那个，一般是**指定人员**，**不是说指定岗位**...因为我们这边岗位也是比较模糊的"

**v3 描述准确吗?** ✅ 准确，但有遗漏:
- v3 抓住了"销售运营部"和"指定到人不是岗位"两个核心点
- **遗漏 1**: 报价是从"样品研发"驱动的 — 必须有 SampleRequest → Quote 的链路 (P2-1 研发样品和本项强耦合)
- **遗漏 2**: 报价完成后**还要走一次审批**才能给到销售 ("调过去审批审批完 ok 没问题，然后给到销售这边") — 也就是 报价 → 审批 → 销售可下单, 是 **三段式**, 不是单纯的"运营录价"
- **遗漏 3**: 客户提到"有些是固定报价的，有些不是固定报价" (行 722–723) — 暗示 Quote 有 `fixed/negotiable` 类型

### P0-5 物料需求单 (transcript 行 1197–1252, 时间 3124s–3252s)

关键原话:
- 行 1197–1199: "这里是分两步，因为你提交过后，**如果生产一个物料需求单**" (生产计划提交 → 自动生成物料需求单, 是**两步**)
- 行 1202–1207: "或者就是**根据 BOM**，就我们之前设的 BOM, 500 份的白卤鸡腿，回销多少的原料、多少的辅料，**会生产一个物料需求单**"
- 行 1208–1212: "物料需求单的话，就是**给到仓库备料**，然后仓库把他的库存**调过到工厂**，工厂的话就是开始跑生产"
- 行 1227–1235: "对应的生产跑完以后，我们可能会涉及到要领多了...**进行一个生产退料，相当于一个仓库调拨**，把多出来的原料辅料再退回到工厂仓库通过物流仓库"
- 行 1239–1248: 工厂仓 vs 物流仓双仓制 — "**鲜棉仓 (工厂仓) 不留库存**，当天生产完当天清仓"

**v3 描述准确吗?** ✅ 准确, 但 v3 描述太简化:
- v3 只说"G3 6 步链路缺第 2 步'物料需求单'独立实体"
- **真实诉求是 4 个动作 + 1 个实体**:
  1. 生产计划提交 → 按 BOM 自动**生成** MaterialRequisition (原料 + 辅料分行)
  2. 仓库**备料** (从物流仓拣货)
  3. 物流仓 → 工厂仓**调拨** (Transfer)
  4. 生产报工后**退料** (剩余原料/辅料退回物流仓)
- **核心: MaterialRequisition 是生产计划与库存调拨之间的"任务单"**, 没有它, BOM 展开结果无处落地, 退料也没有"基准线"

---

## 二、P0-4 销售运营报价 — 完整设计

### 2.1 端到端业务场景 (从客户视角)

> 客户"老王肉制品厂"打电话: "我要 500 公斤白卤鸡腿，下周三交货。"
>
> 1. **销售小李** 在 PC 端 / RN 端打开"研发样品申请"，填写客户名 + 产品描述 + 期望价位区间，提交。
> 2. **研发主管 (王工)** 在工作台收到待办，做出样品，**关联 BOM (原料/辅料配方+成本)**，点击"样品确认 → 提交报价"。系统自动**创建 OperationalQuote 单据 (status=PENDING_QUOTE)**, 并按"销售运营部 = 张三"指派人。
> 3. **销售运营张三** 收到待办，基于 BOM 成本 + 加价系数 + 客户历史，在系统填写 `unitPrice / minOrderQty / validUntil / quoteType (FIXED/NEGOTIABLE)`，点击"提交审批" (status=PENDING_APPROVAL)。
> 4. **销售运营主管李四** 审批通过 (status=APPROVED)。系统**自动通知销售小李**: "报价已就绪"。
> 5. 销售小李在新建销售订单时，**产品下拉只显示 status=APPROVED 的报价**, 选中后 `unitPrice/minOrderQty` 自动回填，提交销售订单。
> 6. 客户翻脸要砍价 → 销售小李点"申请重新报价"，回到 step 3。

### 2.2 OperationalQuote 实体字段 (DDL 级)

```sql
CREATE TABLE operational_quotes (
  id              UUID PRIMARY KEY,
  factory_id      VARCHAR(20)  NOT NULL,
  quote_no        VARCHAR(40)  NOT NULL UNIQUE,        -- QT202604070001
  sample_request_id UUID       NOT NULL REFERENCES sample_requests(id),
  customer_id     UUID         NOT NULL REFERENCES customers(id),
  product_id      UUID         NOT NULL REFERENCES products(id),
  bom_id          UUID         REFERENCES boms(id),
  -- 报价核心
  quote_type      VARCHAR(20)  NOT NULL,               -- FIXED / NEGOTIABLE
  unit_price      DECIMAL(12,2),
  unit            VARCHAR(20)  NOT NULL,               -- kg / 箱 / 件
  min_order_qty   DECIMAL(12,3),
  cost_price      DECIMAL(12,2),                       -- BOM 成本 (内部参考)
  margin_rate     DECIMAL(6,4),                        -- 毛利率 (内部)
  valid_until     DATE,
  -- 状态机 + 指派人 (核心: 必须到人, 不到岗位)
  status          VARCHAR(30)  NOT NULL,               -- DRAFT/PENDING_QUOTE/PENDING_APPROVAL/APPROVED/REJECTED/EXPIRED
  quoted_by_user_id   BIGINT   REFERENCES users(id),   -- 销售运营部具体的人
  quoted_at       TIMESTAMP,
  approver_user_id    BIGINT   REFERENCES users(id),   -- 销售运营主管具体的人
  approved_at     TIMESTAMP,
  rejection_reason TEXT,
  -- 备注
  remarks         TEXT,
  -- BaseEntity
  created_at      TIMESTAMP DEFAULT NOW(),
  updated_at      TIMESTAMP DEFAULT NOW(),
  deleted_at      TIMESTAMP NULL
);

CREATE INDEX idx_quote_factory_status ON operational_quotes(factory_id, status);
CREATE INDEX idx_quote_customer ON operational_quotes(customer_id);
CREATE INDEX idx_quote_assigned ON operational_quotes(quoted_by_user_id);
```

**配套表 — 报价审批历史** (供 W2 客户演示时展示流转):
```sql
CREATE TABLE operational_quote_audit_logs (
  id           UUID PRIMARY KEY,
  quote_id     UUID NOT NULL REFERENCES operational_quotes(id),
  action       VARCHAR(30) NOT NULL,   -- SUBMIT/APPROVE/REJECT/REVISE
  operator_id  BIGINT NOT NULL,
  comment      TEXT,
  created_at   TIMESTAMP DEFAULT NOW()
);
```

### 2.3 与现有实体关系图

```
SampleRequest (P2-1, 待建)
   │ 1:N
   ▼
OperationalQuote ──────────→ Customer
   │ 1:N                       Product
   ▼                           BOM
SalesOrder (现有)
   │ 引用 quote_id (新增字段)
   │ 选中后自动回填 unit_price / unit / min_order_qty
   ▼
SalesOrderItem (现有, 增加 quote_id 字段做溯源)
```

**SalesOrder 改动**: 新增 `quote_id UUID NULL REFERENCES operational_quotes(id)` 字段, 下单时校验"该 quote 必须 status=APPROVED 且未过期"。

### 2.4 API Endpoints

| Method | Path | Body / Query | 说明 |
|---|---|---|---|
| POST   | `/api/mobile/{factoryId}/quotes` | `{sampleRequestId, customerId, productId, bomId}` | 研发提交报价单 (status=PENDING_QUOTE) |
| GET    | `/api/mobile/{factoryId}/quotes?status=PENDING_QUOTE&assignedToMe=true` | — | 销售运营待办列表 |
| PUT    | `/api/mobile/{factoryId}/quotes/{id}/quote` | `{quoteType, unitPrice, unit, minOrderQty, validUntil, remarks}` | 销售运营录价 → status=PENDING_APPROVAL |
| PUT    | `/api/mobile/{factoryId}/quotes/{id}/approve` | `{comment}` | 主管批准 → status=APPROVED |
| PUT    | `/api/mobile/{factoryId}/quotes/{id}/reject`  | `{reason}` | 主管驳回 → status=REJECTED |
| GET    | `/api/mobile/{factoryId}/quotes/{id}` | — | 详情 (含审批历史) |
| GET    | `/api/mobile/{factoryId}/quotes/active?customerId=xxx&productId=yyy` | — | 销售下单时拉取**有效报价** |
| POST   | `/api/mobile/{factoryId}/quotes/{id}/revise` | `{newUnitPrice, reason}` | 客户砍价后重新报价 |

### 2.5 AI Tool 设计

| Tool Name | 触发短语示例 | 动作 |
|---|---|---|
| `quote_create_from_sample` | "把鸡腿样品提交报价" / "样品 SP202604001 报价" | 调 POST /quotes |
| `quote_query_pending` | "我的待报价" / "销售运营待办" | GET 列表 |
| `quote_submit_price` | "把 QT202604070001 报 28 块一公斤" | PUT /quote |
| `quote_approve` | "批准 QT202604070001" | PUT /approve |
| `quote_query_active_for_customer` | "老王肉制品厂的有效报价" | GET /active |

---

## 三、P0-5 物料需求单 — 完整设计

### 3.1 端到端业务场景

> **晚 18:00 排产**: 大组长在 RN 移动端或 PC 创建 ProductionPlan: "明天 500 公斤白卤鸡腿"。
>
> 1. 点击"提交排产", 系统**按 BOM 自动展开**, 创建 1 张 MaterialRequisition (单号 MR202604070001) 含 N 行 MaterialRequisitionItem (鸡腿原料 500kg, 卤料 12kg, 包装袋 500 个 …), 状态 = PENDING。
> 2. 物流仓管理员张五在 PC 工作台看到待备料, 点"开始备料"(status=PICKING), 按 FEFO 锁定批次。
> 3. 备料完成 → 点"调拨到工厂仓" → 系统自动创建 InventoryTransfer 单 (从 logistics_warehouse → factory_warehouse), MR.status=TRANSFERRED。
> 4. 工厂仓主管赵六 RN 扫码签收 → MR.status=ISSUED, 库存进入 factory_warehouse。
> 5. 工厂开工报工, 实际只用 480kg 鸡腿。
> 6. 收工时点 "退料", 系统按 MR 行的"已发数量 - 已耗数量"自动算出退料数量, 创建反向 InventoryTransfer (factory → logistics), MR.status=CLOSED。鲜棉仓清仓符合"当天清仓"原则。

### 3.2 MaterialRequisition 实体字段

```sql
CREATE TABLE material_requisitions (
  id                  UUID PRIMARY KEY,
  factory_id          VARCHAR(20)  NOT NULL,
  requisition_no      VARCHAR(40)  NOT NULL UNIQUE,    -- MR202604070001
  production_plan_id  UUID         NOT NULL REFERENCES production_plans(id),
  source_warehouse_id UUID         NOT NULL,           -- 物流仓
  target_warehouse_id UUID         NOT NULL,           -- 工厂(鲜棉)仓
  -- 状态机
  status              VARCHAR(20)  NOT NULL,
  -- DRAFT → PENDING(待备料) → PICKING(备料中) → TRANSFERRED(已调拨) → ISSUED(已签收) → IN_USE(生产中) → CLOSED(已退料关单) → CANCELLED
  required_date       DATE         NOT NULL,           -- 第二天生产日
  -- 操作人 (4 个角色)
  requested_by        BIGINT       NOT NULL,           -- 排产员
  picked_by           BIGINT,                          -- 物流仓备料员
  picked_at           TIMESTAMP,
  transferred_by      BIGINT,
  transferred_at      TIMESTAMP,
  received_by         BIGINT,                          -- 工厂仓签收人
  received_at         TIMESTAMP,
  closed_by           BIGINT,
  closed_at           TIMESTAMP,
  remarks             TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  deleted_at          TIMESTAMP NULL
);

CREATE TABLE material_requisition_items (
  id                  UUID PRIMARY KEY,
  requisition_id      UUID NOT NULL REFERENCES material_requisitions(id) ON DELETE CASCADE,
  material_id         UUID NOT NULL REFERENCES materials(id),
  material_type       VARCHAR(20) NOT NULL,            -- RAW(原料) / AUXILIARY(辅料) / PACKAGING(包装)
  bom_item_id         UUID         REFERENCES bom_items(id),  -- 溯源到 BOM 行
  required_qty        DECIMAL(12,3) NOT NULL,          -- BOM 算出的需求量
  picked_qty          DECIMAL(12,3),                   -- 实际备料量
  issued_qty          DECIMAL(12,3),                   -- 实际发往工厂量
  consumed_qty        DECIMAL(12,3),                   -- 报工时累计消耗 (从 ProductionPlanBatchUsage 回写)
  returned_qty        DECIMAL(12,3),                   -- 退料量
  unit                VARCHAR(20)  NOT NULL,
  batch_numbers       JSONB,                           -- FEFO 锁定的批次列表 [{batchNo, qty}]
  created_at          TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mr_factory_status ON material_requisitions(factory_id, status);
CREATE INDEX idx_mr_plan ON material_requisitions(production_plan_id);
```

### 3.3 与现有实体关系图

```
SalesOrder (现有)
   │ 1:N (排产时挑选)
   ▼
ProductionPlan (现有)──────────┐
   │ 1:1 自动生成               │ 引用 BOM
   ▼                            ▼
MaterialRequisition          BOM + BomItem (现有)
   │ 1:N                        │
   ▼                            │ 展开依据
MaterialRequisitionItem ◄──────┘
   │
   │ 触发
   ▼
InventoryTransfer (现有)        ProductionPlanBatchUsage (现有)
   (双向: 备料调出 + 退料调入)    (报工时回写 consumed_qty)
```

**关键集成点**:
1. ProductionPlan.submit() → 调 `MaterialRequisitionService.generateFromPlan(planId)` → 按 BOM 展开
2. MR.transferToFactory() → 调 `InventoryTransferService.create(...)` → 锁定库存
3. ProductionReport.submit() → 回写 MaterialRequisitionItem.consumed_qty
4. MR.close() → 自动算 `returned_qty = issued_qty - consumed_qty` 并创建反向 transfer

### 3.4 API Endpoints

| Method | Path | 说明 |
|---|---|---|
| POST   | `/api/mobile/{factoryId}/material-requisitions/generate` body `{productionPlanId}` | 按 BOM 自动展开生成 MR |
| GET    | `/api/mobile/{factoryId}/material-requisitions?status=PENDING` | 物流仓待备料列表 |
| GET    | `/api/mobile/{factoryId}/material-requisitions/{id}` | 详情含明细行 |
| PUT    | `/api/mobile/{factoryId}/material-requisitions/{id}/start-picking` | status → PICKING |
| PUT    | `/api/mobile/{factoryId}/material-requisitions/{id}/confirm-picking` body `{items:[{itemId, pickedQty, batchNumbers}]}` | 备料完成 (FEFO) |
| PUT    | `/api/mobile/{factoryId}/material-requisitions/{id}/transfer` | 调拨到工厂仓 → TRANSFERRED |
| PUT    | `/api/mobile/{factoryId}/material-requisitions/{id}/receive` (RN 扫码) | 工厂签收 → ISSUED |
| PUT    | `/api/mobile/{factoryId}/material-requisitions/{id}/close` | 关单 + 自动退料 |
| GET    | `/api/mobile/{factoryId}/material-requisitions/by-plan/{planId}` | 反查 |

### 3.5 AI Tool 设计

| Tool Name | 触发短语 | 动作 |
|---|---|---|
| `material_requisition_generate` | "按计划 PP202604001 生成物料需求单" | POST /generate |
| `material_requisition_query_pending` | "今天要备的料" / "待备料" | GET ?status=PENDING |
| `material_requisition_confirm_picking` | "MR202604001 备料完成" | PUT /confirm-picking |
| `material_requisition_close` | "关闭 MR202604001 退料" | PUT /close |
| `material_requisition_query_by_plan` | "PP202604001 的物料需求" | GET /by-plan |

---

## 四、对客户拒收的影响

### P0-4 销售运营报价

| 维度 | 评估 |
|---|---|
| 演示时缺失反应 | **严重**。客户原话明确"销售运营部"是核心组织单元, 演示时如果"研发样品 → 销售下单"中间没有报价节点, 客户会立刻质疑"那张三在哪里报价?"。 |
| 是否真 P0 | **是**。这是客户原话主动提出来的全新业务流, 不是猜测。是组织架构的一部分。 |
| 替代方案 | 短期可不做完整审批闭环, 但**至少** OperationalQuote 表 + 提交录价 + 销售下单挑选**必须有**, 否则演示立刻塌。 |

### P0-5 物料需求单

| 维度 | 评估 |
|---|---|
| 演示时缺失反应 | **致命**。客户原话"分两步" + "BOM 自动展开" + "给到仓库备料" + "退料" — 这是客户脑子里最清晰的链路。如果只演示 ProductionPlan 直接接报工, 客户会问"那我备料和退料在哪?"。**仓储 + 工厂双仓的核心都在这里**。 |
| 是否真 P0 | **是, 而且优先级高于 P0-4**。它打通的不仅是工厂域, 还连通了"物流仓 ↔ 工厂仓"双仓制 — 这是客户独特业务模型 (永辉学来的)。 |
| 替代方案 | 不可替代。如果做不出, 工厂模块 6 步链路就**断在第 2 步**, 之后所有报工/退料/成本算的演示都没法做。 |

---

## 五、并行工作建议

- **Subagent 并行**: ✅ P0-4 (sales 域) 与 P0-5 (production+inventory 域) 完全独立, 可并行 2 个 subagent 同时建实体 + service
- **多 Chat 并行**: ✅ 前端 (Vue + RN 表单) 与后端实体完全分离, 一个 chat 写 entity/service/controller, 一个 chat 写 web-admin 列表/表单页

---

## 六、设计成熟度自评

| 项 | P0-4 | P0-5 |
|---|---|---|
| 字段清单 (DDL) | ✅ 完整 | ✅ 完整含明细行 |
| 状态机 | ✅ 6 状态 | ✅ 8 状态 |
| API 清单 | ✅ 8 个 | ✅ 8 个 |
| AI Tool | ✅ 5 个 | ✅ 5 个 |
| 与现有实体关系 | ✅ 已画 | ✅ 已画 |
| E2E 场景 | ✅ 6 步 | ✅ 6 步 |
| 风险点 | ⚠ 依赖 P2-1 SampleRequest, 短期可允许 sampleRequestId nullable | ⚠ 退料反向 transfer 需要锁定原批次, 实现复杂度高 |

**P0-4 成熟度: 8.5/10** — 设计完整, 唯一拖累是依赖 P2-1 样品申请实体 (可降级 nullable 解决)
**P0-5 成熟度: 9/10** — 设计最完整, 字段/状态/集成点都已覆盖, 直接可写代码
