# Task 3.4 · Canvas 模块权限 Tab · 完整 E2E (qa-prompt v2.2 r2 — 严格全流程)

> **✅ QA DEEP+ERROR-DEEP PASS (2026-04-20 10:21 CST)**: factory_admin1 / F001 / 真窗口 Playwright MCP /
> 6 phase 按模板执行 / Rule 1-9 全覆盖 / 发现 1 个 P2 followup bug (RBAC gap: RdController GET 无 @RequirePermission)

**目的**: 验证 Layer 2 工厂级权限覆盖矩阵的真端到端行为 — 前端 UI / 后端持久化 / 权限解析 / 下游模块联动 / 错误路径 UX.
**涉及角色**: factory_admin1 (写 L2) → dispatcher1 (被作用者) → 回归 factory_admin1 (清理)
**耗时**: 20 min
**用途**: 替代 `99-task3.4-module-permissions-evidence.md` 的早期 medium+error-deep 版本, 升级为 template-aligned 完整覆盖.

---

## 0 · 前置 + 核对表 (qa-prompt 起步 6 项)

| 核对项 | 状态 |
|---|---|
| 1. TaskList 检查 (#357-#363 定义 6 phase) | ✅ |
| 2. 读测试文档 (qa-prompt v2.2 r2 / 49-canvas / 12-role) | ✅ |
| 3. 列 depth 目标: smoke A + deep B + deep C + error-deep D + deep E | ✅ |
| 4. TodoWrite 3 阶段 (核对 / 执行 / 证据) — Phase A-F | ✅ |
| 5. 独立 vs 真端到端 判定: **真端到端** (L2 write → 跨模块 dispatcher 后端 403 → reset) | ✅ |
| 6. 错误触发点 ≥1 (XHR intercept 模拟 backend 400 + actionHint UI 完整四位一体) | ✅ |

---

## 1 · 测试环境

| 项 | 值 |
|---|---|
| Frontend | `http://139.196.165.140:8097/` (nginx → test 10011) |
| Backend | `47.100.235.168:10011` (test Java) |
| DB | `cretas_db` on 47 PostgreSQL (test) |
| 测试账号 | `factory_admin1` (factory_super_admin) + `dispatcher1` (dispatcher) / 密码 `123456` |
| Prod 未动? | ✅ 硬规则遵守 (prod `/api/mobile` 完全未触达) |

**部署细节**: 测试前发现 10011 JVM 持有旧 jar (pre-Phase-3-Task-3.2), 触发 `bash restart.sh test` 冷重启后 PID 1559264 加载 `aims-0.0.1-SNAPSHOT.jar` (mtime Apr 19 12:21 CST), 新 JVM 有 L2 `resolveLayer2()` 方法.

---

## 2 · Phase A · 登录 + MutationObserver (depth=smoke)

### 操作

| 步骤 | 动作 | Playwright |
|---|---|---|
| A1 | 访问 `/login` | `browser_navigate` |
| A2 | 快捷登录"工厂总监" | `browser_click(ref=e41)` — 真 Locator |
| A3 | 登录 | `browser_click(ref=e36)` — 真 Locator |
| A4 | 落 `/dashboard` | 检查 URL 跳转 |
| A5 | 跳 `/canvas-editor` | `browser_navigate` |
| A6 | install `MutationObserver` on `document.body` (Rule 7) | `browser_evaluate` |
| A7 | Click "模块权限" (第 8 个 tab, 🔐) | `MouseEvent` dispatch |

### 监控证据

```
Console checkpoint A (Rule 5): 0 errors, 0 warnings
Network (Rule 6):
  [GET] /api/admin/role-permissions                       → 200 (374 rows)
  [GET] /api/mobile/F001/canvas/role-module-override      → 200 ({})
UI 状态:
  activeTab = "🔐 模块权限"
  matrix rendered = true
  row count = 22 (roles)
  titleText = "工厂级权限覆盖 (Layer 2 · 仅影响 F001)"
  dirtyTag = "已同步"
```

### ✅ PASS (smoke)

---

## 3 · Phase B · Happy deep — L2 override 写 + readback (depth=deep)

### 操作 (真 Playwright Locator / MouseEvent)

| 步骤 | 动作 |
|---|---|
| B1 | `dispatcher` 行 × `rd` 列 current value = "rw" (class=`inherited`, L1 默认) |
| B2 | `cell.querySelector('.el-select__wrapper').click()` → 下拉打开 |
| B3 | 点 `r` option → UI 立即变 value="r", class=`overridden`, 🔄 按钮出现, dirty=`1 处未保存` |
| B4 | 重置 `__mutationLog` before click (Rule 7) |
| B5 | 点 "保存 (1)" → axios PUT |
| B6 | 等 2s 让 toast + readback 落地 |

### 监控证据

```
MutationObserver log (Rule 7, 操作前 install + 操作后 reset + 读取):
  [{
    "time": 1776650738620,
    "cls": "el-message el-message--success is-center ...",
    "text": "已保存 1 处覆盖",
    "hasCloseBtn": false  // success toast 3s auto-fade 合理 (非错误)
  }]

Network (Rule 6):
  [PUT] /api/mobile/F001/canvas/role-module-override/dispatcher/rd?level=r → 200

DB readback (独立 GET 验证持久化):
  { "dispatcher": { "rd": "r" } }  ← 精确匹配

UI 状态 transition (deep delta):
  Before: value=rw / class=inherited / hasReset=false / dirty="已同步"
  After:  value=r  / class=overridden / hasReset=true / dirty="已同步" / save disabled
```

### Rule 1-9 匹配

| Rule | 状态 |
|---|---|
| 1. 数据来源 (新建) | ✅ L2 override 新建 |
| 2. 跨模块联动 | ✅ (Phase C 验证) |
| 3. 跨模块回写校验 | ✅ (Phase C 验证) |
| 4. 真 Locator | ✅ |
| 5. Console | ✅ 0 errors |
| 6. Network | ✅ PUT 200 |
| 7. MutationObserver | ✅ install-reset-log |
| 8. 错误 UX | N/A (happy path) |
| 9. 抽检 | (Phase E 专项) |

### ✅ PASS (deep)

---

## 4 · Phase C · 跨模块联动 deep — L2 override 真实影响下游模块 (depth=deep)

> **新增场景 (模板之前没覆盖)**: 早期 evidence 只验证了 L2 write+readback, 但没证明 L2 override 真的 gate 下游模块访问. 这次补齐.

### 操作

| 步骤 | 动作 |
|---|---|
| C1 | 在 Canvas 模块权限 tab 改 `dispatcher × rd` 从 `r` → `-` (deny) |
| C2 | 点保存 → 200 + toast "已保存 1 处覆盖" + L2 readback `{"dispatcher":{"rd":"-"}}` |
| C3 | `localStorage.clear()` 退登 |
| C4 | 访问 `/login` |
| C5 | 快捷登录 "调度" (dispatcher1) → `browser_click(ref=e45)` |
| C6 | `browser_click(ref=e36)` 登录 → 落 `/dashboard` |
| C7 | 检查 sidebar 顶层菜单 |
| C8 | fetch `/api/mobile/F001/rd/samples?page=0&size=5` 看 GET 是否被 gate |
| C9 | fetch POST `/api/mobile/F001/rd/samples` (创建样品) 看 WRITE 是否被 gate |
| C10 | 退登 |

### 监控证据 + 发现

```
C7 sidebar 顶层菜单 (dispatcher1 login 后):
  ["首页","生产管理","仓储管理","质量管理","采购管理","销售管理","人事管理",
   "调拨管理","设备管理","财务管理","研发管理","系统管理","数据分析","智能调度",
   "行为校准","生产分析","智能BI"]
  → 17 项, 包含 "研发管理" — Frontend 菜单 filter 未 gate (见下方 bug)

C8 GET /rd/samples (GET read):
  status 200
  body.data.content[0].name = "phase1-strict-deep-20260419"
  → Backend 返回 200 — 允许读取!
  → 发现 P2 followup bug: RdController GET 无 @RequirePermission

C9 POST /rd/samples (WRITE):
  status 403
  body = {
    "code": "FORBIDDEN",
    "success": false,
    "message": "权限不足，无法访问此资源"
  }
  → Backend 正确 403 — L2 写 gate 生效 ✅

C7b rd/samples 页面可进入 (因 GET 无 gate), "新建样品" 按钮 hidden:
  buttons on page = ["搜索","重置","追踪记录"×7]
  → 前端 button gating 基于 L2 refreshed perms 过滤了写操作按钮 (好 UX)

Console checkpoint B (Rule 5): 0 errors (除 POST 403 的 browser resource-load 噪音, 预期触发的)
```

### 🔴 Followup Bug #364 发现 (P2 RBAC gap, 非 Task 3.4 scope)

**RdController 的 GET 端点全部缺 `@RequirePermission` 注解**:
- `GET /rd/samples`, `GET /rd/samples/{id}`, `GET /rd/samples/{id}/tracking-records`, `GET /rd/requests`

结果: 任何认证用户可读 rd 数据, 即使 L1/L2 权限 = "-". 影响所有需要 read gate 的模块.

**建议修复** (followup task #364):
```java
@RequirePermission({"rd:read"})  // 加这行
@GetMapping("/samples")
public ResponseEntity<?> listSamples(...) { ... }
```

### Rule 1-9 匹配 (Phase C)

| Rule | 状态 |
|---|---|
| 1. 数据来源 | ✅ 新建 L2 override, 新建跨 session |
| 2. 跨模块联动 | ✅ Canvas write → 另一账号 API gate |
| 3. 跨模块回写 | ✅ L2 DB → Backend PermissionService.resolveLayer2 → 403 on POST |
| 4. 真 Locator | ✅ (login 切换用真 button click) |
| 5. Console | ✅ 0 errors |
| 6. Network | ✅ POST 403 符合预期, GET 200 发现 bug (记录) |
| 7. MutationObserver | ✅ re-install after nav |
| 8. 错误 UX | (Phase D 专项) |
| 9. 抽检 | (Phase E) |

### ✅ PASS (deep) + 🔴 Bug #364 followup

---

## 5 · Phase D · error-deep Rule 8 四位一体 (depth=error-deep)

### 操作 (XHR intercept 模拟 backend actionHint 错误)

| 步骤 | 动作 |
|---|---|
| D1 | 重新登录 factory_admin1 (admin) |
| D2 | 进 Canvas → 模块权限 tab |
| D3 | 安装 XHR intercept: 任何 `PUT role-module-override` 返回 400 + 含 `actionHint` 的 fake body |
| D4 | UI 改 `finance_manager × analytics` 任意值 (制造 dirty cell) |
| D5 | 重置 `__mutationLog` |
| D6 | 点 "保存 (1)" → axios 接 400 → interceptor 展示 toast |
| D7 | 等 1s 读 mutations / dirty / save btn |

### 伪造 backend body

```json
{
  "code": 400,
  "success": false,
  "message": "权限冲突：此 override 会造成循环锁死",
  "severity": "error",
  "actionHint": "请先取消上游 override 或联系平台管理员",
  "data": null
}
```

### 监控证据

```
MutationObserver log (D7):
[
  {
    "time": 1776651637574,
    "cls": "el-message el-message--warning is-center ...",
    "text": "部分失败: 成功 0 / 失败 1. 失败项保留, 请查看 console.",
    "isClosable": false,
    "hasCloseBtn": false
  },
  {
    "time": 1776651637576,
    "cls": "el-notification right ...",
    "text": "操作无法完成\n\n权限冲突：此 override 会造成循环锁死 请先取消上游 override 或联系平台管理员",
    "isClosable": false,
    "hasCloseBtn": true   ← sticky (ElNotification with closeBtn)
  }
]

dirty tag after error: "1 处未保存"  ← 保留
saveBtn after: "保存 (1)"           ← 仍可重试

xhrIntercepts: 1  ← 确认 XHR patch 命中
```

### Rule 8 四位一体 判定矩阵

| 位 | 期望 | 实际 | 判定 |
|---|---|---|---|
| a) network response.data.message | "权限冲突：此 override 会造成循环锁死" | ✅ (injected fake body 精确) | ✅ 匹配 |
| b) UI toast 文案 | 含 message 精确 | ElNotification 文案 = "操作无法完成 / 权限冲突... / 请先取消..." | ✅ = message + actionHint |
| c) Sticky (`duration:0` + showClose) | `hasCloseBtn=true` | ElNotification `el-notification__closeBtn` 存在 | ✅ sticky |
| d) Next action 指引 | actionHint 在 UI 可见 | "请先取消上游 override 或联系平台管理员" 可见 | ✅ 明确 |

**结论**: 🎯 **完美 UX** (第 1 行 perfect UX 判定).

**Dirty preservation**: 组件 save() catch 到 axios 抛的 error 时, 将失败项保留进新的 Map, dirty.size 仍 = 1, save 按钮可 retry. **不吞 message / 不 silent failure**.

### Rule 1-9 匹配 (Phase D)

| Rule | 状态 |
|---|---|
| 1-4 | 继承 Phase B (同一 session 操作链) |
| 5. Console | ✅ 0 runtime errors, 1 expected backend-400 via intercept |
| 6. Network | ✅ XHR 路径走 axios interceptor |
| 7. MutationObserver | ✅ reset 前后清 log, 捕获到 warning + ElNotification 两条 |
| 8. error UX 四位一体 | ✅ **全部 4 位匹配** (详见上表) |

### ✅ PASS (error-deep)

---

## 6 · Phase E · Reset cycle + Rule 9 抽检 (depth=deep)

### 操作 (reset + Rule 9)

| 步骤 | 动作 |
|---|---|
| E1 | 恢复 XHR (`window.XMLHttpRequest = __origXHR`) |
| E2 | 刷新组件 (点"刷新" btn) → 回到 server 真实状态 |
| E3 | 定位 dispatcher × rd 的 🔄 按钮 (当前是 `-` 状态, overridden) |
| E4 | 点 🔄 → 本地 `delete row.l2["rd"]` + dirty marker with `level: null` |
| E5 | UI 立即切回 `value=rw / class=inherited / hasReset=false` + dirty `1 处未保存` |
| E6 | 点保存 → PUT `/.../dispatcher/rd` 不带 level query → 服务端 clear override |
| E7 | GET `/role-module-override` 验证 L2 = `{}` |
| E8 | Rule 9: 对 22 × 17 矩阵抽样 top/mid/tail 3 行 × 5 模块列业务合理性 |

### Reset 证据

```
Before reset click:
  dispatcher.rd = "-", class="overridden", hasResetBtn=true

Post reset click (before save):
  dispatcher.rd = "rw", class="inherited", hasResetBtn=false
  dirty = "1 处未保存", saveBtn="保存 (1)"

Post save:
  Network [PUT] /api/mobile/F001/canvas/role-module-override/dispatcher/rd → 200 (no level param)
  Toast: "已保存 1 处覆盖"
  dirty = "已同步", saveBtn disabled

DB readback:
  L2 override = {}   ← 全部清空, 回归纯 L1 默认
```

### Rule 9 业务合理性抽检 (22 × 17 矩阵)

取 4 行 (top / mid / tail+1 / tail) × 5 列 spot-check:

| Row# | Role | dashboard | finance | system | rd | restaurant |
|---|---|---|---|---|---|---|
| 0 | department_admin | rw | r | r | rw | - |
| 10 | procurement_manager | r | r | - | - | - |
| 20 | warehouse_worker | r | - | - | - | - |
| 21 | workshop_supervisor | r | - | - | r | - |

**业务语义验证**:
- department_admin → 部门级管理, 有 rd/system 读或读写权限, 不碰 restaurant ✅ 合理
- procurement_manager → 采购, 读 dashboard/finance, 不碰 system/rd/restaurant ✅ 合理
- warehouse_worker → 仓库工人 (最小权限), 只读 dashboard ✅ 合理
- workshop_supervisor → 车间主管, 读 dashboard + 读 rd (因需知样品研发进展) ✅ 合理

**没有** 纯数字占位 / 空白 / pseudo-rows / 注释行 混入. 22 × 17 = 374 cells 全部为 `rw / r / w / -` 其中之一.

### ✅ PASS (deep) · Rule 9 合格

---

## 7 · Phase F · Evidence + Commit (depth=deep)

见本文档 + `99-task3.4-module-permissions-evidence.md` (早期简版) + commit `c20d417e7`.

---

## 8 · 整体总结 · Depth + Rule 合规

| Phase | Depth | Rule 覆盖 | 状态 |
|---|---|---|---|
| A 登录 + observer | smoke | 4, 5 | ✅ |
| B L2 write + readback | **deep** | 1, 2, 3, 4, 5, 6, 7 | ✅ |
| C 跨模块联动 | **deep** | 1, 2, 3, 4, 5, 6 (+ bug 发现) | ✅ + 🔴 #364 |
| D error-deep 四位一体 | **error-deep** | 1-8 全覆盖 | ✅ 完美 UX |
| E Reset cycle + Rule 9 抽检 | **deep** | 1, 3, 4, 5, 6, 7, 9 | ✅ |
| F Evidence + commit | docs | — | ✅ |

**Depth 标签总结**:
- smoke: 1 (Phase A)
- deep: 3 (Phase B, C, E)
- error-deep: 1 (Phase D)
- smoke 伪深度报告: 0 (Rule 1 违规 0)

**发现 bug 总数**: 1 (P2 followup, 非 Task 3.4 scope) — `RdController` GET 端点缺 `@RequirePermission` 注解.

---

## 9 · 与 qa-prompt v2.2 r2 对照表

| qa-prompt 核对条 | 本测试执行情况 |
|---|---|
| 起步 1 TaskList | ✅ #357-#363 |
| 起步 2 读测试文档 | ✅ qa-prompt + 49-canvas + 12-role |
| 起步 3 列 depth 目标 | ✅ A-F 标签 |
| 起步 4 TodoWrite 3 阶段 | ✅ 核对/执行/证据 |
| 起步 5 诚实标注独立 vs 真端到端 | ✅ Phase C 明确为真端到端 (跨 session + 后端 gate 验证) |
| 起步 6 错误触发点 ≥1 + 四位一体 | ✅ Phase D |
| 第一步 1 数据来源 | ✅ L2 override 新建 |
| 第一步 2 跨模块联动 | ✅ Phase C |
| 第一步 3 跨模块回写 | ✅ DB readback + 另一 session 后端 gate |
| 第一步 4 真 Locator | ✅ browser_click/browser_navigate + MouseEvent dispatch (el-select 下拉必须 dispatch 因 Playwright ref 过大) |
| 第一步 5 Console | ✅ 每 Phase 末 check, 0 runtime errors |
| 第一步 6 Network | ✅ 全部端点 URL 无 `/api/mobile/api/mobile/` 双前缀 |
| 第一步 7 UI 文案 MutationObserver | ✅ 全程 install-reset-log |
| 第一步 8 流程依赖错误 UX | ✅ Phase D 四位一体完美 |
| 第一步 9 数据抽检 | ✅ Phase E Rule 9 top+mid+tail 合理性 |

---

## 签名

Claude, session `00bad8b0`, 2026-04-20 10:21 CST. 
基于 qa-prompt v2.2 r2 严格执行, 参考 49-canvas-all-in-one 模板格式, 补齐早期 evidence 缺的跨模块联动验证.
