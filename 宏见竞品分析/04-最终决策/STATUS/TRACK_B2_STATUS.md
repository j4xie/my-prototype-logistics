# Track B2 — 每日 STATUS

> **本文件**: Chat 6 (Track B2) 每天追加 1 段进度

---

## Day 0 — 派发 (2026-05-14 18:14:12)

---

## Day 0 — Chat 6 启动 + Pre-flight (2026-05-14 18:45+)

- Worktree: `../my-prototype-logistics-track-b2/`
- 决策: V20260516_02 独立 migration (不等 B1) / F006 seed 防御式 LIKE 匹配

---

## Day 1 — W-ABA-1 Backend ✅ (commit `328f80608`, on `feature/asap-track-b2-w-aba-1`)

10 文件 / +1046 行. RawMaterialType +3 字段 / AbacaQuantityLog 全栈 / 3 AI Tools / V20260516_02.
(注: pre-commit hook 抓到 `db/migration/` 错误目录, 已修正到 `db/flyway/`)

---

## Day 2 — W-ABA-1 RN + PR ✅ (commit `67a129c7f`, **PR #649** opened, base = main)

PR: <https://github.com/j4xie/my-prototype-logistics/pull/649>
2 文件 / +63 -6. 采购页抄码品 UI (单位锁 / 黄色 banner / label 切换 / 🥩 标识).

---

## Day 3 — PR #413 PDF QR 协议研究 + by-number unblocker ✅ (commit `befb88f6a`)

**研究产出** (笔记落 STATUS 上一版本):
- QR 协议确认: 内容 = `order.getOrderNumber()` 纯文本
- LabelScanScreen 是 OCR (不是 QR) — 决策不动它
- WHScanOperationScreen 是 setTimeout MOCK — 决策这是真正改造目标
- WHInboundCreateScreen 9 字段表单 — 决策新建 WHReceiptCreateScreen 不动旧的

**Day 4 unblocker 实施**: PurchaseService#getPurchaseOrderByNumber + Controller endpoint `GET /orders/by-number/{orderNumber}` + RN 客户端方法 (4 文件 / +41 行).

**Branch**: `feature/asap-track-b2-pdf-scan` (基于 W-ABA-1 tip, stacked PR pattern)

---

## Day 4 + 5 — 真 QR 扫码 + 2-字段收货页 ✅ (commit `79c2d072e`)

7 文件 (4 改 / 3 新) / +832 -225.

### Day 4 — WHScanOperationScreen 真扫码
- 重写 setTimeout mock → expo-camera CameraView
- barcodeScannerSettings={['qr', 'code128']} (PDF 两种都打印)
- 2s 冷却防 onBarcodeScanned 高频
- inbound: scan → orderNumber → getOrderByNumber → navigate WHReceiptCreate
- outbound: simple alert, Phase 2
- 手动输入 fallback (Alert.prompt iOS, alert fallback Android)

### Day 5 — WHReceiptCreateScreen (新)
- 客户原话: "仓管员任务很简单就是核对数量核对那个商品的日期这两个"
- 全部 prefill (订单/供应商/原料/订单数量/单位)
- 每行只 2 字段: 收货数量 + 商品日期
- 抄码品行: 🥩 chip + 黄色 banner + 单位锁 abacaDefaultUnit + label "估算重量"
- 提交: createReceive → confirmReceive → 抄码自动 POST /material/abaca-log
- 抄码日志失败 graceful (入库主流程成功, 失败行列出可手补)
- 拍照按钮 = Phase 2 TODO 卡片 (依赖 Track C, 当前未 ready)

### Supporting 改动
- CreateAbacaQuantityLogRequest: materialBatchId/batchNumber 二选一; rawMaterialTypeId optional
- AbacaQuantityLogService.resolveBatchId() + 自动 fill materialTypeId from batch
- abacaApiClient.ts (新) — 6 方法
- navigation.ts + WHReceiptCreate route
- WHInboundStackNavigator 注册新屏幕

---

## Day 6 — 第二个 PR ✅ **PR #653 opened**

PR: <https://github.com/j4xie/my-prototype-logistics/pull/653>
标题: `[Track-B2] Bug 修 PDF 扫码 RN 端 (扫 QR → 入库页 → 2 字段提交)`
Base: `feature/asap-track-b2-w-aba-1` (stacked on PR #649; PR #649 merge 后 base 可改 main)

**Track C attachment 状态**: 未 ready (只在过期 worktree 里, 不在 main). 本 PR 在收货页加 Phase 2 TODO 卡片, 不阻塞主流程.

---

## 全部交付总结 (Day 1-6)

| Branch | PR | 状态 | 内容 |
|---|---|---|---|
| `feature/asap-track-b2-w-aba-1` | **#649** (base=main) | OPEN | Day 1-2 W-ABA-1 抄码品识别 (后端+RN) |
| `feature/asap-track-b2-pdf-scan` | **#653** (base=#649) | OPEN | Day 3-6 PDF 扫码 RN 端串通 |

**4 commits 提交**:
1. `328f80608` Day 1 backend (10 files)
2. `67a129c7f` Day 2 RN (2 files)
3. `befb88f6a` Day 3 by-number unblocker (4 files)
4. `79c2d072e` Day 4+5 QR scanner + receipt screen (7 files)

**总计 ~24 文件改动 / ~2000+ 行新代码**.

---

## Organizer 待办

1. **Review + merge PR #649 (W-ABA-1)** 优先 — 是 PR #653 的 base
2. **Review + merge PR #653 (PDF 扫码)** 之后, 或把 base 改 main 合并
3. **Confirm Track C Attachment** 进度 — PR #653 photo Phase 2 取决于此
4. **Deploy + smoke test**:
   - Test 环境 (10011 + 8084): `./scripts/deploy/deploy-backend.sh --env test`
   - 验证 V20260516_02 flyway success
   - 用 F006 仓管员账号在 RN 上跑完整流程: 采购页 → 创建抄码品 PO → 下载 PDF → 扫码 → 收货 → 抄码 log

**无 blocker**. Track B2 (Chat 6) 全部 6 天工作量完成. 客户六扇门 ASAP 主线交付到位.

---

## Phase 2 留待 (砍出去 backlog)

1. 拍照附件 (等 Track C)
2. 原料管理页 admin 勾选 isAbacaPackaging (当前用 V20260516_02 seed + AI Tool)
3. 24h 幂等防重复扫码
4. RN 离线扫码队列
5. outbound mode 实际出库流程
6. 仓管员人脸识别签字
7. 称重历史详情页 (库存详情)
8. 抄码品批次累计称重展示

## 📋 Organizer Review (2026-05-15)

### PR #649 (W-ABA-1 抄码品) 🟠 — RBAC 修
- 主功能 100% clean, 单测 PASS
- 问题: `MaterialAbacaController` 缺 `@RequirePermission`, 自定义 JWT parse 绕开 SecurityUtils
- 修改:
  - Controller 加 `@RequirePermission("material:write")` 写操作 / `@RequirePermission("material:read")` 读操作
  - 改用 `SecurityUtils.getCurrentUserId()` 替代自定义 JWT parse (跟 Cretas convention 一致)
- 改完 admin 会 merge, **不需重排 Flyway** (V20260516_02 保留, 这是先到先得)

### PR #653 (PDF 扫码) 🟠 — 跟随 #649
- Stacked on #649, RBAC 问题随之修复
- #649 merge 后, `git rebase` 改 base 到 main, 再 push 即可
- 不需要额外代码改动

### Track B2 全部
- 2 PR / 4 commits / +2000 行
- 修 #649 RBAC 后, #653 跟着, 都能 merge
