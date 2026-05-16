# Sprint 2 prod smoke E2E

**执行**: 2026-05-16 05:13 - 05:18 UTC (CST 13:13 - 13:18)
**Tester**: organizer-dispatched smoke chat
**Env**: prod `https://admin.cretaceousfuture.com` (DNS) + `http://139.196.165.140:8086` (IP-direct)
**Account**: `f006_admin / 123456` (factoryId=F006, role=factory_super_admin, permissions=["*:*"])

---

## TL;DR

🔴 **整个 Sprint 2 frontend 没 deploy 到 prod**。Sprint 2 frontend PR (#675-#689) 全部在 03:06-04:51 UTC 之间 merge, 但 prod web-admin Last-Modified `Sat, 16 May 2026 02:48:24 GMT` (早于第一个 merge 18 分钟). 两个 vhost (admin DNS + IP:8086) build hash 完全一致 (`ETag: "6a07daf8-853"`, `Content-Length: 2131`). 没有任何 Sprint 2 UI 元素出现在 prod.

同时发现 nginx 缺 route blocks: 即使前端 deploy 了, 新 endpoint 仍会 fallback 到 SPA index.html (7/7 探测路径全返回 `text/html`).

**结论**: Sprint 2 主 8 PR + FU 5 PR 24 个 PR **0 个能在 prod UI E2E 验证**. Sprint 2 业务功能在 prod 全部不可见.

---

## 已 verify (PASS)

- ✅ Sprint 1 RBAC + 系统骨架 prod 在线: `f006_admin` 登录成功, 进入 `/dashboard`, 侧边栏 13 一级菜单全显, token 写 `localStorage['cretas_access_token']` (252 字符). (`smoke-1-dashboard.png`)
- ✅ Sprint 1 销售订单页存量数据正常: `/sales/orders` 共 5 条历史订单 (SO-20260511-0001 起), radiogroup 分页/分组 work. (`smoke-2-sales-orders-workflow.png`)
- ✅ Sprint 1 路由全 200: `/procurement/orders`, `/production/plans`, `/finance/invoices`, `/warehouse/inventory` 全部 200 + Vue 渲染表头. (`smoke-3-procurement-no-features.png`)

---

## Bug 发现

### Bug 1 — P0 — Sprint 2 frontend 整批没 deploy 到 prod
- **重现**:
  - `curl -sI https://admin.cretaceousfuture.com/` → `Last-Modified: Sat, 16 May 2026 02:48:24 GMT`
  - `curl -sI http://139.196.165.140:8086/` → 同 `Last-Modified: 02:48:24 GMT`, 同 `ETag: "6a07daf8-853"`
  - `gh pr list --search "Sprint 2"` → 最早 Sprint 2 PR (#675) merged `2026-05-16T03:06:46Z`, 最晚 (#689) merged `2026-05-16T04:51:12Z`
- **期望**: web-admin 重新 build + deploy, Last-Modified ≥ 04:51 UTC
- **实际**: web-admin Last-Modified 02:48 UTC, 早于第一个 Sprint 2 merge ~18 分钟
- **直接证据**: `/sales/orders` 页面 DOM 0 个 `.workflow*` class, 0 个 `.sticky-footer*` class, 行末"操作"列全是直 button (无 dropdown `▾`)
- **影响 chat**: Chat G (PR #683 #684 #685) + Chat H (PR #678 #689) + Chat I (PR #681 #688) + Chat J Vue (PR #686) + Chat F RN (PR #687) — **9 个 frontend PR 0 % 可见**
- **截图**: `screenshots/smoke-2-sales-orders-workflow.png`, `screenshots/smoke-3-procurement-no-features.png`
- **根因 (推测)**: 没有触发 web-admin deploy. memory `feedback_organizer_must_git_pull_before_deploy.md` 的执行 gap 复发.

### Bug 2 — P0 — admin DNS vhost nginx 缺 Sprint 2 endpoint route blocks
- **重现**: 用 `f006_admin` 已认证 token, 浏览器内 `fetch()`:
  ```
  /api/v2/workflow-buckets/sales              → 200 text/html (SPA fallback)
  /api/workflow-buckets/sales-orders          → 200 text/html
  /api/v2/finance/purchase-orders/pending-review → 200 text/html
  /api/finance/purchase-orders/pending-review → 200 text/html
  /api/sales-orders/SO-20260507-0001/shortage-report → 200 text/html
  /api/v2/sales/orders/.../shortage-report    → 200 text/html
  /api/product-samples?page=1                 → 200 text/html
  /api/v2/product-samples                     → 200 text/html
  ```
  Response body 是 `<!doctype html>...` (web-admin index.html), 不是 backend JSON.
- **期望**: 这些 endpoint 应 proxy 到 backend (Java / Python), 返回 application/json.
- **实际**: 所有新 Sprint 2 endpoint 全部 fallback 到 SPA root (nginx 默认 `try_files ... /index.html`).
- **对照** (working baseline):
  - `/api/mobile/F006/sales/orders?page=1&size=10` → 200 application/json ✅ (正确 proxy)
  - `/smartbi-api/api/smartbi/gold/finance-summary?...` → 200 application/json ✅
  - `/api/mobile/health` → 404 application/json ✅ (说明 `/api/mobile/` 有 route block)
- **影响 chat**: 所有 Sprint 2 chat (E/F/G/H/I/J + 5 FU). 即使 web-admin 前端补 deploy, API 仍 broken.
- **根因**: memory `feedback_nginx_3_vhost_sync.md` HARD 规则违反. 3 vhost (admin DNS + IP:8086 + api DNS) 都需要新 endpoint route blocks. Sprint 2 backend 显然有 ship (PR #682 #680 #683 #675 等 backend 部分), 但 nginx vhost 没 sync.

### Bug 3 — P2 — api.cretaceousfuture.com DNS 无应答
- **重现**: `curl -sI https://api.cretaceousfuture.com/api/mobile/health` → `Exit code 6` (DNS resolution fail) / `curl http://api.cretaceousfuture.com/...` → connection failed.
- **期望**: 按 memory `feedback_nginx_3_vhost_sync.md`, `api.cretaceousfuture.com` 应该是第 3 个 vhost (API DNS).
- **实际**: DNS 没解析 / 端口没开. (Bug 2 的间接影响——前端只能用 admin DNS 路径, 没有 backend-only API 出口可旁路.)
- **影响**: 限制 API E2E debug.

---

## 因 Bug 1/2 阻塞的 verify (BLOCKED, 无法 E2E)

以下 7 area 全部因为 web-admin frontend 没 deploy + nginx 缺 route block 而无法在 UI 走通:

| Area | Chat | PR | Blocked reason |
|------|------|----|----|
| UX-A1 WorkflowBar 3 节点 + count badge | G | #683 / #684 / #685 | 5/5 list view DOM 0 workflow class (`smoke-2`, `smoke-3`) |
| UX-A1 节点点击 filter 联动 | G FU3 | #685 | 无 UI 可点 |
| UX-A2 行末"操作 ▾" dropdown 8-14 actions | H | #678 | 5/5 list view 行末为直 button, 无 dropdown |
| UX-A2 "打印 PDF" 触发真后端 PrintController | H FU | #689 | 同上, action 不存在 |
| UX-A2 仓管员价格 action hide RBAC | H | #678 | 同上 |
| UX-A3 Sticky Footer (X 单 / Y 元 / Z 个) | I | #681 | 10/10 list view DOM 0 sticky-footer class |
| UX-A3 仓管员金额合计 hide | I | #681 | 同上 |
| UX-A3 📊 AI 按钮 entryContext | I FU | #688 | 同上 |
| N31 销售单财审通过自动写 sales_order_shortage_report | E | #682 | nginx `/api/sales-orders/.../shortage-report` SPA fallback. 后端可能 OK, 但 UI 无法触发. |
| N31 AIChat "SO-XXX 缺什么" chain-card | E | #682 | AIChat 入口需 Chat I FU 的 deep-link (没 deploy) |
| N48 研发员创样品 + 真照片上传 | F | #680 / #687 | `/api/product-samples` SPA fallback. RN-only (没 web), 也无法 web 验证. |
| N48 主管 approve → BOM 自动建 + 报价任务 | F | #680 | 同上 |
| P-FIN-1 /procurement/finance-review/list 路由 | J FU1 | #686 | Vue view 在 #686 (frontend), 没 deploy. 试访问 → SPA 404 / 跳转. |
| P-FIN-1 三价对比 priceAlert=true 红色 (#FFE4E1) | J | #675 | 同上 |
| P-FIN-1 approve/reject 流转 PENDING_FINANCE_REVIEW → FINANCE_APPROVED | J | #675 / #679 | Backend 可能 OK (#675 backend + #679 通知), 但 UI 无入口. |

---

## Tier 3 未验证 (defer, 不在 P0/P1 scope)

- **RN App**: 你不能 playwright RN, 手测 defer. (Chat F/G/H/I 都有 RN-side, 需 Maestro / 真机.)
- **钉钉通知**: Track B1 未 merge, smoke 无法 verify 财务审核 → 钉钉机器人.
- **后端单独 E2E**: 直接探测 Java/Python REST endpoint 本可绕开 Bug 2 nginx 问题, 但需要直连 backend 端口 10010/8080, prod 防火墙拦 (`ssh root@139.196.165.140` 也 timeout 在 smoke 环境). 建议下一轮 backend dev 在内网跑 API smoke.

---

## 建议 (organizer 接手)

1. **立即**: 触发 web-admin redeploy (在某个 Sprint 2 PR sister chat 跑 `pnpm run build && ./scripts/deploy-web-admin.sh`). 确认 Last-Modified ≥ `2026-05-16 04:51 UTC`.
2. **同时**: nginx admin DNS vhost + IP vhost 加新 endpoint route block (workflow-buckets / shortage-report / finance/purchase-orders/pending-review / product-samples). 参考 `docs/superpowers/runbooks/nginx-vhost-sync-checklist.md` (memory `feedback_nginx_3_vhost_sync.md`). 修复后跑 3 vhost curl 烟测.
3. **修完**: 重新跑这份 smoke. 预期所有 BLOCKED 项目转 PASS 或暴露新 bug (功能性 bug, 不是 deploy bug).
4. **追溯**: Sprint 2 dispatch 流程为何没触发 web-admin redeploy + nginx sync? 是否所有 frontend chat 各自 push 但没有人负责"最后 deploy"步? `feedback_organizer_must_git_pull_before_deploy.md` HARD 规则的执行 hook 是否失效?

---

## 数据点 (reference)

- prod web-admin build: `assets/index-4TCqtOAp.js` (02:48 UTC)
- 触发的 Sprint 2 PR (frontend 部分):
  - #683 G-1 组件 + API (04:03 UTC merge)
  - #684 G-2 web 接入 + AI 触发 (04:03 UTC)
  - #685 G-FU3 bucket→filter (04:47 UTC)
  - #678 H 行末操作 dropdown (03:33 UTC)
  - #689 H-FU 真打印接 PrintController (04:51 UTC)
  - #681 I Sticky Footer (03:58 UTC)
  - #688 I-FU AI deep-link 18 sites (04:47 UTC)
  - #686 J Vue 财务审核 PC views (Sprint 2 J FU1)
  - #687 F-FU2 Sample 真 Attachment (04:47 UTC, RN-only)
- nginx vhost 文件位置: `/etc/nginx/conf.d/admin.cretaceousfuture.com.conf` + `web-admin.conf` + `api.cretaceousfuture.com.conf`
- F006 prod accounts pool: 16 users (per memory `reference_f006_liutengmen_prod_accounts.md`), 本次只用了 `f006_admin`. 仓管员/财务经理/研发员 RBAC smoke 因 Bug 1 阻塞未跑.

---

**Organizer 接手**: smoke 完了, 3 个 bug (其中 2 个 P0 deploy/nginx, 1 个 P2 DNS) 见上. **24 PR 0 个 UI E2E 通过**, 等 deploy + nginx sync 后重跑.
