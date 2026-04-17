# 99. R18 Handoff — B 方案完整生产→销售链 (下一 session)

> **📋 Handoff 目的**: R18 + R18-ext session 已结束. 下一 session compact 后直接按本文件跑 B 方案 (完整生产链→发货→开票→收款), 覆盖 Web QA 最后一个未 deep 的缺口 (§81 完整链).

---

## 已完成汇总 (R18 + R18-ext)

**Web QA 端 53/55 文件已覆盖 banner**, 只剩 **§43/§44 RN 移动端**未测 (超 Web 范围).

**14 个 bugs 全 fixed + verified test** (prod 按规则未动):

| # | 模块 | Sev | Fix |
|---|------|-----|-----|
| #254 | QC→Batch writeback | P2 | propagate qualityStatus only |
| #255 | QC label PASSED vs PASS | P1 | list.vue enum 兼容 |
| #256 | UserMapper 丢 email | P1 | DTO+Mapper 修 |
| #257 | Hibernate @Version NPE | P2 | Flyway V20260420_01/02 |
| #258 | 查询模板 payload | P2 | JSON.stringify |
| #264 | employeeCode 丢失 | P2 | DTO+Mapper 修 |
| #270 | QC 负数 sampleSize | P2 | BusinessException 3 断言 |
| #274 | batch yieldRate 概念错 | P2 | 只写 qualityStatus |
| #279 | finance_mgr1 被拒 /finance | **P1** | guards.ts whitelist |
| #280 | 双 toast 误导 | P2 | login.vue 删 hardcoded |
| #281 | dispatcher1 越权 | **P1 🔴** | permission.ts matrix |
| #282 | analytics silent fail | P2 | warning toast |
| #283 | 404 SO 空白页 | P2 | el-empty + actions |
| #284 | 合格率 6833% | P2 | formatPercent 去 ×100 |

**Commits on `e2e/v1-framework` (pushed)**: `8ee844942` → `65b560c2d` → `263fa7e7e` → `3496ddad7` → `6a028e7a5` → `2717903f5` → `262c20540` → `93531b9e8` → `190c6f311` → `3aef81e01` → `1e45555b7` → `b84037493`

---

## B 方案目标: 完整生产→发货→开票→收款 UI E2E

**目的**: 让 SO-20260409-0001 的黄鱼片 50kg 通过真实生产链产生 FG,然后完成发货/开票/收款 5 段完整 demo 核心链.

**涵盖 §81 + §83 + §85 + §22 + §10 跨模块真端到端**, 多角色切号 (Rule 7), 至少 1 个真 DEEP.

---

## 前置条件 ⚠️ 必做

### 1. 清理 backend 3 僵尸进程 (严重)

当前 test 10011 有 3 个 java 进程 race, 导致 health 间歇 200/502.

```bash
ssh root@47.100.235.168 "pkill -9 -f 'port=10011'; sleep 5; pkill -9 -f 'port=10013'; sleep 5; nohup bash /www/wwwroot/cretas/restart.sh test > /tmp/r-clean.log 2>&1 & sleep 3; tail -5 /tmp/r-clean.log"

# 等 90s semantic init (用 Bash run_in_background or until-loop)
until ssh root@47.100.235.168 "curl -s --max-time 3 -o /dev/null -w '%{http_code}' http://localhost:10011/api/mobile/health" | grep -q '200'; do sleep 10; done; echo ready
```

### 2. 验证只有 1 个进程

```bash
ssh root@47.100.235.168 "ps -ef | grep 'port=10011' | grep -v grep | wc -l"
# 期望: 1
```

### 3. Test env 可用
- Web UI: http://139.196.165.140:8097/
- API gateway: 同 URL /api/mobile/
- Backend direct: 47 loopback only (SG 已收紧)

---

## Seed 数据 (已存在, 不要重建)

| 实体 | 值 |
|------|-----|
| 目标 SO | **SO-20260409-0001** (JSON导入客户2, ¥4,500, **带鱼段 100kg + 黄鱼片 50kg**, 已确认) |
| 目标 DLV | **DLV-20260417-2293** (草稿状态, 待分配批次) |
| 黄鱼片 productTypeId | **PT-F001-002** (code: HYP001) |
| 带鱼段 productTypeId | PT-F001-001 (已有 FG 400kg, 不需生产) |
| 生产批次 seed | PB20260212002 香酥鱼柳 (id=1879, qualityStatus=PARTIAL_PASS 已被 #274 修过) |

**黄鱼片 FG 现状**: 总 3500kg 但 `available_quantity=0` 全部 reserved. 需通过生产链添加新 FG 或者释放 reserved (A 方案). **B 方案直接走生产链产生新 FG,不碰 reserved**.

---

## B 方案 Step-by-Step (估计 60-90 min)

### Step 1 - dispatcher1 建黄鱼片生产计划 (~10 min)

切号:
```js
localStorage.clear();
// login dispatcher1 / 123456
```

导航: `/production/plans` 或 `/scheduling/plans`.

点"新建生产计划":
- 产品: 黄鱼片 (PT-F001-002)
- 计划数量: **60 kg** (多产 10kg 留缓冲)
- 交货日期: 2026-04-20
- 指派: F001 车间

**evidence 记**: planNumber (PP-20260418-XXXX), status DRAFT→APPROVED

### Step 2 - 切 factory_super_admin 或 production_manager 开始批次 (~5 min)

导航: `/production/batches` 或 `/manufacturing`.

点"新建批次"或从生产计划"开工":
- 产品: 黄鱼片
- 批次号: 自动生成 (PB-20260418-XXX)
- plannedQuantity: 60
- startTime: now

**evidence**: batchNumber, status PENDING→IN_PROGRESS

### Step 3 - operator 报工 (~10 min)

**注意**: per memory, operator1 仅限移动端登录. Web 测不了, 需用 `group_leader` 或 `workshop_supervisor` 代替.

切 `group_leader` (小组长, 有 production=w).

在批次详情页:
- 开工 (startTime 已设)
- 报工: goodQuantity=58, defectQuantity=2, actualQuantity=60
- 完工 (endTime=now)

**evidence**: batch status IN_PROGRESS→COMPLETED, goodQuantity=58

### Step 4 - quality_mgr1 质检 (~10 min)

切 quality_mgr1.

`/quality/inspections` 真 UI **新建质检**:
- 批次: PB-20260418-XXX (黄鱼片)
- 抽样: 20, 合格: 19, 不合格: 1
- 结果: 合格 / PASS
- 备注: R19 B方案链式生产

submit → toast "质检记录已创建" → list +1

**evidence**: inspectionId, result=PASS, passRate=95.0

**验证 Bug #274 fix**: batch 1879 qualityStatus 应被写为 PASSED, yieldRate 保留本身生产值 (不被 passRate 覆盖). 如果走新 batch,新 batch qualityStatus 应 PASSED.

### Step 5 - 仓储 warehouse_mgr1 FG 入库 (~10 min)

切 warehouse_mgr1.

`/warehouse/finished-goods/receive` 或 `/inventory/fg-receipt`:
- 批次: PB-20260418-XXX 黄鱼片
- 入库数量: 58 (good qty)
- FG batch 号自动生成 (FGB-20260418-YYY)

**关键**: 完成后 `/sales/finished-goods/available?productTypeId=PT-F001-002` 应返回 count≥1.

**evidence**: FG batchNumber, quantity=58, availableQuantity=58

**如果 UI 无"FG 入库"按钮或路径**: 查后端 `@PostMapping` 看 fg-receipt endpoint,可能通过 batch "确认完工" 自动触发。

### Step 6 - factory_admin1 回 DLV 分配批次 (~5 min)

切 factory_admin1.

`/sales/orders/SO-F001-20260409-0001` → 发货记录 Tab → DLV-20260417-2293 "分配批次".

dialog 现在应该显示:
- 带鱼段: FG-existing 分配 100 ✅
- 黄鱼片: FGB-20260418-YYY 分配 50 ✅ (不再 "没有可用批次")

点"确认分配" → toast 分配成功.

**evidence**: 2 allocation record, DLV status 草稿→已分配.

### Step 7 - 真发货确认 (~5 min)

DLV 列表 点 "发货" 或 "确认发货":
- 填运输方式 / 物流公司 / 运单号
- 提交

**evidence**: DLV status → SHIPPED / 已发货 + 时间线事件 "已发货".

回 SO 详情: 发货记录 Tab 角标 +1 (或 status 已发货), 已发货金额 4500 (之前 0).

### Step 8 - 开票 (~5 min)

SO 列表或详情点 "开票" 或 "税率分组开票":
- 开票类型: NORMAL
- 金额: 4500 (或 G1 按税率拆)
- 提交

**evidence**: invoiceNumber (INV-20260418-XXXX), status 待审核 / 已开票.

Re-fetch finance AR: AR-20260418-XXXX 自动挂账 ¥4500 应出现在 `/finance/costs` 18→19 条.

### Step 9 - 收款 (~5 min)

SO 详情点 "收款":
- 收款方式: 银行
- 金额: 4500

**evidence**: paymentNumber (PAY-20260418-XXXX), status 已收款. SO 已发货+已开票+已收款 → **状态 已完成**.

### Step 10 - 详情 + 时间线 + 跨模块 Tab 总验证 (~5 min)

SO-20260409-0001 详情页: 4 Tab 全 +1:
- 订单详情 Tab: status 已完成, 时间线全链 (创建→确认→发货→开票→收款)
- 发货记录 Tab: 1 (DLV-20260417-2293, SHIPPED)
- 开票申请 Tab: 1 (新 INV)
- 收款记录 Tab: 1 (新 PAY)

`/finance/costs` AR+1 条 ¥4500.

`/sales/finished-goods` 黄鱼片 FG 减 50 (从 FGB 新 batch 扣减).

---

## 6-point self-check 必做每步

参照 CLAUDE.md 通用 QA prompt:

1. **数据来源**: 每步 fresh 新建 (除 SO/DLV 已存在继用)
2. **跨模块**: 生产→QC→FG→发货→AR→收款 5 段真流
3. **回写校验**: 回 SO 详情看各 Tab +1
4. **真 Locator**: 全 `browser_click` ref= 非 JS hack
5. **Console 监控**: 每步 error-only check
6. **Network 监控**: 每 POST status 200 verify

---

## 风险 + 降级

### 如 backend 再 race
- 立即 kill 所有 java + 等 clean restart
- 如持续问题, **改走 A 方案** (SQL 释放 reserved, 跳 Step 1-5)

### 如某 UI 无按钮 (FG 入库 / 报工 等)
- 用 fetch API 直接 POST (Rule 4 caveat 标 medium-deep 不纯 deep)
- 记 UI 路由 gap

### 如 operator 路径需移动端
- 用 group_leader / workshop_supervisor (后端权限接近)
- Rule 7 切号仍满足

---

## 期望产出

- **≥ 1 真 DEEP** 完整跨 5 模块 UI E2E
- **SO-20260409-0001 status: 已完成**
- **Evidence 单号全链**: planNumber, batchNumber, inspectionId, FG batch, DLV, INV, PAY
- 更新 §81 / §83 / §85 banner 真 deep 实测证据
- 新 commit push `e2e/v1-framework`

---

## Compact 后立即做

1. `cd C:/Users/Steve/my-prototype-logistics` + `git pull origin e2e/v1-framework`
2. Read 本文件 99-R18-handoff-B.md
3. 执行前置条件 1-2 (清僵尸进程 + health)
4. 按 Step 1-10 顺序做,每步记 evidence
