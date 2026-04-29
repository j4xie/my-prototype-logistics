# Bug #319 修复证据文档

**修复日期**: 2026-04-18 22:08 CST
**合规**: qa-prompt v2.2 r2 (真窗口 + MutationObserver + 四位一体)

---

## Bug 描述

组件 `catch` 块硬编码 `ElMessage.error('xxx 失败')` fallback, 吞了 axios interceptor 已经通过 ElMessageBox/ElMessage 显示的后端真实 message. 用户看到**两条错误提示**, 其中 toast 显示 "创建失败" fallback 不提供原因, MessageBox 显示真实原因. UX 冗余且混乱.

## 根因

axios interceptor (`request.ts`) 已在 response 错误拦截:
- HTTP 403 → ElMessageBox `"操作被拒绝 / 权限不足，无法访问此资源"` (severity=BLOCKING)
- HTTP 4xx/5xx → showRichError → ElMessage sticky (with 真实 `response.data.message`)
- `success: false` business 错误 → showRichError → 同上

然后 Promise.reject(new ApiError(...)). 组件 `.catch` 捕获 rejection 再调 `ElMessage.error('创建失败')` → **重复显示 + 文案劣化**.

## 修复

**扫描**: 15 个 .vue 文件, 35 处 `catch { ElMessage.error('xxx 失败'); }` 或 `catch(e){ if(e!=='cancel') ElMessage.error('xxx') }` 模式.

**修改**:
- `catch { ElMessage.error('xxx失败'); }` → `catch { /* axios interceptor already displayed error toast */ }` (30 处)
- `catch (e) { if (e !== 'cancel') ElMessage.error('xxx'); }` → `catch (e) { /* axios interceptor handles API errors; cancel from MessageBox is silent */ }` (5 处)

保留 cancel-check 语义: ElMessageBox.confirm 被用户点取消时 reject 字符串 `'cancel'`, 不需弹 toast; 其他情况 interceptor 已处理.

**影响文件** (14):
```
web-admin/src/views/finance/ar-ap/index.vue                  (1)
web-admin/src/views/finance/invoices/list.vue                (2)
web-admin/src/views/finance/payments/list.vue                (4)
web-admin/src/views/platform/canvas-editor/OnboardingWizard.vue (1)
web-admin/src/views/platform/canvas-editor/index.vue         (1)
web-admin/src/views/procurement/orders/detail.vue            (2)
web-admin/src/views/procurement/orders/list.vue              (2)
web-admin/src/views/procurement/price-lists/list.vue         (3)
web-admin/src/views/rd/samples/list.vue                      (3)
web-admin/src/views/sales/finished-goods/list.vue            (1)
web-admin/src/views/sales/orders/list.vue                    (7)
web-admin/src/views/sales/shipments/list.vue                 (1)
web-admin/src/views/system/pos/list.vue                      (5)
web-admin/src/views/transfer/detail.vue                      (1)
web-admin/src/views/transfer/list.vue                        (1)
```

## 真窗口验证 (v2.2 Rule 4 + 7 + 8 合规)

**场景**: dispatcher1 (无 rd:rw) 触发 POST /rd/samples → 403

### 执行

1. 打开 Playwright MCP 窗口 → 登录 dispatcher1 → 导航 `/rd/samples`
2. 安装 MutationObserver
3. 点击"新建样品" → 填"样品名称=bug319-verify" → 重置 toast log → 点击"创建"
4. 等 3s, 读 `window.__toastLog` + `document.querySelectorAll('.el-message*, .el-notification')`
5. 等 5s (总 37s), 再读验证 sticky

### 证据 — MutationObserver 抓取 (修后)

```js
// totalEvents = 3, 全部来自 MessageBox
window.__toastLog = [
  { cls: "el-message-box__message",            text: "权限不足，无法访问此资源" },
  { cls: "el-icon el-message-box-icon--error", text: "" },
  { cls: "el-message-box__header show-close",  text: "操作被拒绝" },
]

// document.querySelectorAll('.el-message') → null (no ElMessage toast)
// document.querySelectorAll('.el-message-box') → 1 (sticky at t+37s)
```

### 修前 vs 修后 对比 (文档化历史 — 修前来自 `99-R19-phaseB-真窗口-evidence.md`)

| 指标 | 修前 | 修后 |
|---|---|---|
| ElMessage "创建失败" | ❌ 存在 (fallback, 吞 message) | ✅ 消失 |
| ElMessageBox "操作被拒绝 / 权限不足" | ✅ 存在 (interceptor) | ✅ 存在 |
| 总 error 元素可见数 | 2 (冗余) | 1 (干净) |
| 文案精确度 | 混合 (fallback + 真实) | 真实 (只剩真实) |
| Sticky | ✅ (is-closable) | ✅ (MessageBox blocks) |
| 总 MutationObserver 事件数 | 4 | 3 |

### 四位一体判定 (修后)

| 检查项 (Rule 8) | 结果 |
|---|---|
| a) network.response.data.message = "权限不足，无法访问此资源" | ✅ |
| b) UI 文案 (ElMessage / MessageBox) = 后端 message | ✅ (MessageBox 完全匹配) |
| c) sticky (duration:0 或 blocking dialog) | ✅ (MessageBox 阻塞, 37s 后仍在 DOM) |
| d) next action | ⚠️ 仍缺 — 后续可加 actionHint "请切换到有 rd:rw 的角色" |

### 同时附带证据文件

- `99-R19-bug319-verify-rd-samples.yml` — 操作前页面快照
- `99-R19-bug319-dialog.yml` — 新建样品 dialog 打开后
- `99-R19-bug319-network.log` — network 确认 403
- console error = 1 ("Failed to load resource 403") — 预期, 无 UI 关联 (浏览器自动打 log)

## Depth 标签

**深度**: **error-deep** (v2.2 定义: 触发错误 + toast 文案 = 后端 message + console 4xx + response.data.message 四匹配 + sticky/showClose 校验)

## 覆盖度

- **已修** (35 处): 14 个 .vue 文件 (finance/procurement/sales/rd/transfer/canvas/pos)
- **未覆盖**: 可能存在 `.then(...).catch(err => ElMessage.error(...))` 链式模式, 或在其他 .vue 中用 `catch` 但非硬编码 fallback. Grep pattern `catch.*ElMessage\.error\(['"\u4e00-\u9fa5]` 可做补充扫描.

## 签名

Claude Code session `bf9bf97b-6b12-4165-a7ec-0536bdcfcdd1`, Apr 18 2026 22:08 CST.
修复 + 部署 + 真窗口验证全程按 qa-prompt v2.2 r2 执行, 证据完整归档.
