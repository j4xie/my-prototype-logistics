# V1 E2E 测试框架重设计

**日期**: 2026-04-11
**作者**: Steve + Claude (brainstorming session)
**状态**: Design approved, ready for writing-plans
**覆盖目标**: 六扇门 v3 客户需求 P0 19/19 + P1 9/9 全链路

---

## 1. 背景与问题

### 为什么要重做 E2E

过去 2 个月跑了 6 轮 E2E (参见 `feedback_e2e_skill_enforcement.md`), 每次都漏 bug 或"测了但没测对". 典型病症:

1. **偷懒执行**: 用 API 代替 UI 操作, 声称覆盖完整链路
2. **WARN 当成 PASS**: 测试拿到警告继续跑, 最后声称全绿
3. **创建后不验证详情**: 只看 "创建成功" toast, 不点进详情页核对数据
4. **只测 Layer 1**: 页面打开即算通过, 从未提交真实表单
5. **跨端割裂**: Web 测 Web, RN 测 RN, 从未验证"销售下单 → 车间扫码报工"同一业务链的数据一致性
6. **种子数据不足**: SQLite in-memory / 空工厂 / 拍脑袋 mock, 不符合真实场景
7. **CI 不阻塞**: E2E 挂了没人管, 部署照样推

六扇门客户 v3 要求里有几个硬指标必须端到端过:

- **G1 税率分组开票**: 同一订单税率不同 (2500 元 @ 9%, 800 元 @ 13%) → 生成两张独立发票 (杀手锏 demo)
- **G2 销售→采购→入库**: 订单自动建采购建议 → 入库后库存增加
- **G3 生产 6 步链**: plan → FMR → 车间仓 → 报工 → 收工 → 退回物流仓
- **P1-1 员工工序段**: 开工 / 正常下班 / 早退 / 换工种 四分支 (RN 扫码)
- **P1-3 研发样品转报模**: 样品审批后自动生成第二个研发页面
- **P1-7 销售合同附件**: PDF/Word/图片 ≤20MB 上传

这些不是"能打开页面就行", 必须 **实际提交表单 → 数据落库 → 在另一个模块验证联动**.

---

## 2. 设计决策摘要

brainstorming 过程中的 5 个关键选择 (每个都 locked):

| Q | 选项 | 理由 |
|---|------|------|
| **Q1: 测试组织** | C: Hybrid (核心链固化 + 新功能 ad-hoc) | 避免 overkill, 但保留核心链的稳定性 |
| **Q2: 执行时机** | b+d: PR-level L1 smoke + 3 G-chain, Post-deploy 全 10 journey | PR 不拖太久 (~12 min), 全量走 post-deploy |
| **Q3: 种子数据** | b-realistic: 专用 `F_E2E_TEST` 工厂, 3 客户/5 SKU/40+ 原料 | 真实场景, 但控制在 ~200 行 SQL |
| **Q4: RN 覆盖度** | b+重量跨端: Web 10 journey + RN 2-3 journey + 重量级跨端一致性验证 | 保证 Web 和 RN 看的是同一份数据 |
| **Q5: 跨端同步机制** | a: Sequential via DB state, 全部走 UI | 最简单握手, 两端都测真实交互 |

**不选的原因**:
- Q1 选 A (全固化) → 新功能不断, 固化维护成本爆炸
- Q1 选 B (全 ad-hoc) → 核心链会退化, 回归无保护
- Q2 选 a (PR 全量) → ~45 分钟 PR 延迟不可接受
- Q4 选 a (纯 Web) → 跨端 bug 漏网, 客户场景是跨端的
- Q5 选 c (API 替代 UI) → UI 渲染 bug 逃过测试

---

## 3. 架构总览

### 3.1 目录结构

```
tests/v1-e2e/
├── fixtures/
│   ├── seed-e2e-factory.sql          # 200 行真实种子 (master data)
│   └── .shared-state.json            # 跨端握手, gitignored
├── web/                              # Playwright Test
│   ├── l1-smoke.spec.ts              # PR, 2 分钟, 10 主菜单导航
│   ├── g1-invoice.spec.ts            # PR, G1 分组开票
│   ├── g2-sales-chain.spec.ts        # PR, G2 销售→采购→入库
│   ├── g3-production-chain.spec.ts   # PR, G3 生产 6 步
│   ├── j4-super-admin-setup.spec.ts  # Post-deploy, 工厂初始化
│   ├── j5-sales-full.spec.ts         # Post-deploy, 销售全周期
│   ├── j6-purchase-full.spec.ts
│   ├── j7-warehouse-full.spec.ts
│   ├── j8-rd-sample.spec.ts
│   ├── j9-employee-segment-web.spec.ts  # Web 侧主管查看
│   ├── j10-bom-audit.spec.ts
│   ├── cross-end-phase1.spec.ts      # 跨端 phase 1: 建单
│   └── cross-end-phase3.spec.ts      # 跨端 phase 3: 验证
├── rn/                               # Maestro
│   ├── rn-01-login.yaml
│   ├── rn-02-signature.yaml
│   ├── rn-03-process-report.yaml
│   └── rn-cross-end.yaml             # 跨端 phase 2: RN 报工
└── scripts/
    ├── seed-and-reset.sh             # psql 回放 + truncate 业务表
    ├── run-pr-gate.sh                # PR 门禁 (~12 min)
    └── run-full.sh                   # 全量 + 跨端 (~45 min)
```

### 3.2 两层节奏

| 层 | 触发 | 时长 | 内容 |
|----|------|------|------|
| **PR 门禁** | `pull_request` | ~12 分钟 | L1 smoke + G1/G2/G3 |
| **Post-deploy** | `workflow_dispatch` + nightly cron | ~45 分钟 | 上面 + J4-J10 + 跨端 phase 1/2/3 |

---

## 4. 种子数据 (F_E2E_TEST)

### 4.1 原则

**一次 seed, master data 不动, 业务数据每次 PR 前 truncate 重建.**

Master data 放 Flyway migration `V20260411_99_seed_e2e_factory.sql`, CI 启动数据库时自动有. 业务数据 (订单/FMR/报工记录/发票) 走 `seed-and-reset.sh`.

### 4.2 Master data 清单

| 类别 | 数量 | 关键实例 |
|------|------|----------|
| 工厂 | 1 | `F_E2E_TEST` |
| 用户 | 5 | super_admin / sales_mgr / purchase_mgr / warehouse_ops / workshop_supervisor |
| 客户 | 3 | 鼎鲜火锅 (9% 税率) / 云海小龙虾 (13%) / 张三 (个人, 免税) |
| 供应商 | 3 | 泰森禽业 / 海天调料 / 纸箱大王 |
| 产品 SKU | 5 | 酸菜鱼 500g / 剁椒鱼 500g / 花椒鱼 300g / 鲜牛肉丸 1kg / 去骨鸡腿 2kg |
| 原料 | 40 | 鱼肉 (10) / 调料 (15) / 包装 (15) |
| 仓库 | 2 | 物流仓 / 鲜棉仓 (车间) |
| BOM | 5 | 每个 SKU 一个, 含 8-12 原料 |

### 4.3 Transactional data (每次 PR 前 truncate)

```sql
TRUNCATE TABLE
  sales_order,
  purchase_order,
  production_plan,
  factory_material_requisition,
  employee_process_segment,
  invoice,
  payment_record,
  internal_transfer,
  bom_change_log,
  product_sample_tracking_record
RESTART IDENTITY CASCADE;
```

然后 `seed-and-reset.sh` 再插入 3-5 条 demo 订单 (给 PR 门禁做预置状态).

### 4.4 为什么不是全空

全空工厂 → journey 里要建 BOM → 测试跑 30 分钟也跑不完. 预置 master 后, PR gate 只测"从销售下单开始"的动作, 不做基础设施.

---

## 5. 跨端握手机制 (重量级)

### 5.1 串行三 phase

```
┌─ Phase 1: Playwright (Web) ─┐  [PR + Post-deploy 都跑]
│ 1. 登录 sales_mgr            │
│ 2. 创建销售订单 (5 × 酸菜鱼) │
│ 3. 确认 → 转生产 plan        │
│ 4. 生成 FMR 调拨单           │
│ 5. 从 UI 读取 batchNumber    │
│ 6. 写 .shared-state.json      │
└──────────────────────────────┘
             ↓ exit 0
┌─ Phase 2: Maestro (RN) ──────┐  [仅 Post-deploy]
│ 1. launchApp                 │
│ 2. 登录 workshop_supervisor  │
│ 3. 读 .shared-state.json      │
│ 4. 手动输入 batchNumber       │
│    (代替硬件扫码)              │
│ 5. 开工序段 → 报工 50kg       │
│ 6. 收工 + 签名拍照            │
└──────────────────────────────┘
             ↓ exit 0
┌─ Phase 3: Playwright (Web) ──┐  [仅 Post-deploy]
│ 1. 登录 sales_mgr            │
│ 2. 打开订单 → 读状态         │
│ 3. assert: 已排产 + 已报工   │
│ 4. 生成分组发票 (G1)          │
└──────────────────────────────┘
```

### 5.2 .shared-state.json 格式

```json
{
  "createdAt": "2026-04-11T14:23:11Z",
  "orderCode": "SO20260411001",
  "planCode": "PP20260411001",
  "fmrCode": "FMR20260411001",
  "batchNumber": "B20260411-ACY-001",
  "productId": 1,
  "productName": "酸菜鱼 500g",
  "quantity": 5
}
```

### 5.3 失败停机

任一 phase `exit != 0` 立即停. `.shared-state.json` 保留做 debug. CI 上传所有 artifact.

### 5.4 为什么不用 API 替代 UI

虽然 API 跑更快, 但客户真实使用时:
- Web 的按钮 disabled 逻辑 (P1-6 6 tab 筛选)
- RN 的扫码输入组件 (P1-1)
- 跨端状态同步 (Web 订单状态 ↔ RN 报工)

这些只有真实 UI 交互才能验证. 节省的 40% 时间换来的是客户 demo 时崩溃的风险.

---

## 6. 10 核心 Journey

### 6.1 PR 门禁层 (3 G-chain)

| # | Journey | 角色 | 核心断言 |
|---|---------|------|----------|
| **G1** | 税率分组开票 (杀手锏 demo) | sales_mgr | 两张发票生成: 发票 A 金额 2500 @ 9% 税 225, 发票 B 金额 800 @ 13% 税 104 |
| **G2** | 销售→采购→入库 | sales_mgr → purchase_mgr → warehouse_ops | SO 触发采购建议, PO 确认, 入库后库存 +N |
| **G3** | 生产 6 步链 | sales_mgr → workshop_supervisor | plan → FMR → 转车间仓 → 报工 → 收工 → 退回物流仓 |

外加 `l1-smoke.spec.ts`: 登录 super_admin → 点 10 个主菜单项, 每个页面 HTTP 200 + 无 error toast.

### 6.2 Post-deploy 层 (7 role journey)

| # | Journey | 角色 | 覆盖 |
|---|---------|------|------|
| **J4** | 工厂初始化 | super_admin | 建产品/客户/供应商/BOM/仓库 |
| **J5** | 销售全周期 | sales_mgr | 建单 + 合同上传 (P1-7) + 6 tab 筛选 (P1-6) + 分组开票 + 收款 (P0-9) + 3 状态标签 |
| **J6** | 采购全周期 | purchase_mgr | PO 建单 + 供应商选择 + 到货 + 质检 + 入库 + 付款 |
| **J7** | 仓储全周期 | warehouse_ops | 入库 + 出库 + 调拨 (InternalTransfer 双向) + 盘点 |
| **J8** | 研发样品 | super_admin | 新建 + 追踪记录 (P1-8 独立表) + 6 Round3 字段 + 转报模 (P1-3) |
| **J9** | 员工工序段 | workshop_supervisor | 开工→正常下班 / 开工→早退 / 开工→换工种 (P1-1 三分支) |
| **J10** | BOM 审计 + 通知 | super_admin | 改 BOM 自动写 bom_change_log (P1-9) + FMR 过期通知 (P1-5, @Scheduled 手动触发) |

### 6.3 覆盖矩阵

| v3 需求 | Journey |
|---------|---------|
| P0-3 分组开票 | G1 |
| P0-3b deliveredQuantity | J5 |
| P0-3c OSS upload | J5 |
| P0-3d receiptUrl | J5 |
| P0-4 OperationalQuote | J8 |
| P0-5 B1 FMR warehouse | G3 |
| P0-5 B2 (Rejected, see ADR) | - |
| P0-7 SKU 去重 | J5 |
| P0-9 订单状态标签 | J5 |
| P0-19 其余全部 | J4-J10 |
| P1-1 员工工序段 | G3 + J9 + 跨端 |
| P1-3 转报模 | J8 |
| P1-4 FMR 仓库自动 | G3 |
| P1-5 FMR 通知 | J10 |
| P1-6 6 tab 筛选 | J5 |
| P1-7 合同上传 | J5 |
| P1-8 追踪记录独立表 | J8 |
| P1-9 BOM 审计日志 | J10 |

**结论**: P0 19/19 + P1 9/9 全部有 journey 覆盖.

---

## 7. CI 集成

### 7.1 PR workflow

`.github/workflows/e2e-pr.yml`:

```yaml
name: E2E PR Gate
on: [pull_request]
jobs:
  e2e-pr-gate:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: cretas_pass
          POSTGRES_DB: cretas_db
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { distribution: zulu, java-version: 21 }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - name: Start backend
        run: |
          cd backend/java/cretas-api
          mvn spring-boot:run \
            -Dspring-boot.run.jvmArguments="-DDB_PASSWORD=cretas_pass -DPOSTGRES_SMARTBI_PASSWORD=smartbi_pass -DJWT_SECRET=local_dev_jwt_secret_at_least_32_chars_long" &
          ./wait-for-health.sh http://localhost:10010/api/mobile/health 120
      - name: Start web-admin
        run: |
          cd web-admin
          npm ci && npm run dev &
          ./wait-for-port.sh 5173 60
      - name: Seed
        run: psql -h localhost -U postgres -d cretas_db -f tests/v1-e2e/fixtures/seed-e2e-factory.sql
      - name: PR gate tests
        run: npx playwright test --grep "@pr-gate"
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-trace
          path: test-results/
```

### 7.2 Post-deploy workflow

`.github/workflows/e2e-post-deploy.yml`:

```yaml
name: E2E Full + Cross-End
on:
  workflow_dispatch:
  schedule:
    - cron: '0 18 * * *'  # UTC 18:00 = CST 02:00
jobs:
  e2e-full:
    runs-on: macos-latest  # Maestro 需要 macOS 或 Linux 配 emulator
    timeout-minutes: 60
    steps:
      # ... setup 同 PR workflow ...
      - uses: reactivecircus/android-emulator-runner@v2
        with:
          api-level: 34
          script: |
            bash tests/v1-e2e/scripts/run-full.sh
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: maestro-video
          path: ~/.maestro/tests/
```

### 7.3 重试策略

- Playwright CI: `retries: 1` (单次重试), 本地: 0
- Maestro: 无重试 (慢, 重试只会掩盖 flaky)
- 任何 journey 失败 → PR 阻塞, 不做 soft fail

### 7.4 artifact 清单

所有 CI run 无论成败都上传:
- `playwright-report/` — HTML 报告
- `test-results/*/trace.zip` — 每个失败测试的 trace (可用 `npx playwright show-trace` 重放)
- `test-results/*/*.png` — 失败截图
- `.shared-state.json` — 跨端状态
- `pg_dump_failure.sql` — 失败前数据库 snapshot (仅跨端 fail 时)

### 7.5 本地开发工作流

```bash
# 跑单 spec (开发中)
npm run e2e:web -- web/g1-invoice.spec.ts

# PR 门禁自测 (commit 前)
npm run e2e:pr-gate   # ~12 分钟

# 部署前全量自测
bash tests/v1-e2e/scripts/run-full.sh   # ~45 分钟

# 只测 RN
bash tests/v1-e2e/scripts/run-rn-only.sh
```

---

## 8. 失败诊断路径

当 PR gate 失败时, 按下列顺序排查:

1. **先看 artifact**: 下载 `playwright-report.zip`, 打开 `index.html`
2. **点 trace**: 找到失败的 test, 点 "View trace" → 时间轴可见点击/API/DOM
3. **看 console 日志**: 有无 `[ERROR]` 或 `undefined`
4. **看 shared-state.json**: 跨端失败时看是 phase 1/2/3 哪个挂
5. **下载 DB snapshot**: `pg_dump_failure.sql` 导入本地, 用 DBeaver 看数据

---

## 9. 不在本设计范围 (Out of Scope)

明确排除以防 scope creep:

- **负载测试** (k6 / JMeter) — 与 E2E 框架分开
- **视觉回归测试** (Percy / Chromatic) — v2 再加
- **API 契约测试** (Pact / OpenAPI) — 与 E2E 分开, 是另一层
- **SmartBI 数据分析端到端** — SmartBI 有自己的 evals, 不拼进这里
- **Canvas 画布编辑器 E2E** — canvas-v3 有自己的 lifecycle test
- **多租户隔离 E2E** — audit 框架已覆盖 (tool-factory-isolation-audit.mjs)
- **钉钉集成** — 客户还没买, 暂不测
- **P0-5 B2 warehouse dimension** — ADR Rejected, 整个特性不存在

---

## 10. 实施顺序

按 writing-plans 做 plan 时建议这个顺序:

1. **Fixture 层** (2 天)
   - 写 `seed-e2e-factory.sql` (200 行 SQL)
   - 写 `seed-and-reset.sh`
   - 本地验证: seed → connect → 看到 F_E2E_TEST

2. **Web 基础设施** (1 天)
   - 安装 Playwright, 配 `playwright.config.ts`
   - 写 `helpers/login.ts`, `helpers/api-client.ts` (仅用于 assert)
   - 写 `l1-smoke.spec.ts` (最简单的 journey)

3. **PR 门禁 3 G-chain** (3 天, 一天一条)
   - G1 分组开票
   - G2 销售→采购→入库
   - G3 生产 6 步

4. **CI PR workflow 上线** (半天)
   - `.github/workflows/e2e-pr.yml`
   - 开 PR 验证跑得通

5. **Post-deploy 7 role journey** (5-7 天, 平均一天一条)
   - J4 → J5 → J6 → J7 → J8 → J9 → J10

6. **RN Maestro 3 journey** (2 天)
   - RN-01 login, RN-02 signature, RN-03 process report

7. **跨端握手 + post-deploy workflow** (2 天)
   - cross-end-phase1, cross-end-phase3, rn-cross-end
   - `.github/workflows/e2e-post-deploy.yml`

8. **Docs + README** (半天)
   - 更新 `docs/e2e-testing-guide.md`
   - 更新 `MEMORY.md` 索引

**总工期估算**: 16-18 人日 (~3 周).

---

## 11. 成功标准

这个框架做完后应该能说:

- [x] PR 门禁跑 12 分钟 ± 3 分钟, 稳定率 > 95%
- [x] Post-deploy 跑 45 分钟 ± 10 分钟, 稳定率 > 90% (容忍 emulator 偶发)
- [x] P0 19/19 + P1 9/9 全部有 journey 覆盖
- [x] 跨端 journey 验证 Web 订单状态 ↔ RN 报工数据一致
- [x] 客户 demo 前跑一次 `run-full.sh`, 0 failure = 可以上台
- [x] 失败能在 5 分钟内定位根因 (看 trace + screenshot)
- [x] 本地跑单 journey ≤ 3 分钟 (G1 / G2 / G3 任一条)

---

## 12. 参考

- `feedback_e2e_skill_enforcement.md` — 前 6 轮 E2E 偷懒模式
- `docs/plans/v1-user-journey-audit.md` — 8 角色全栈业务流审计
- `docs/plans/p0-5-b2-warehouse-dimension-adr.md` — 为何放弃仓库粒度
- `maestro-e2e-patterns.md` — Maestro 50 test 经验
- `project_apr7_session_summary.md` — Apr 7 六扇门会议来源
