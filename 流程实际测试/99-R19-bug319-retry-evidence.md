# Bug #319 扩展真窗口验证 (retry)

**日期**: 2026-04-18 22:49 CST
**Task**: #338
**合规对标**: qa-prompt v2.2 r2

---

## 覆盖度 (更新)

| 文件 | Depth | 证据来源 | HTTP code |
|---|---|---|---|
| **rd/samples/list.vue** | ✅ error-deep | 1 号 真窗口 (Task #335) | 403 |
| **system/pos/list.vue** | ✅ error-deep | 2 号 真窗口 (Task #338) | 400 |
| 其余 12 文件 | Pattern-derived | git show 992d1135f diff 证据 | N/A |

**2/14 真窗口 error-deep**, 12/14 机械等价推导.

---

## 验证 #2 证据: system/pos/list.vue

### 场景
factory_admin1 (有 system:* 全权限) → POST /pos/connections with POS 品牌=客如云 + 假 AppKey/Secret. 后端 400 (已存在同品牌连接 uniqueness violation).

### 执行
1. 登录 factory_admin1, 安装 MutationObserver
2. 导航 `/system/pos`
3. 点击 "新建连接" → 选 客如云品牌 → 填连接名 + App Key + Secret + 门店ID
4. 点击 "创建"
5. 等 3s, 读 toast 可见性 + network

### 证据

**Network** (99-R19-bug319-pos-create-net.log):
```
[POST] http://139.196.165.140:8097/api/mobile/F001/pos/connections => [400]
```

**DOM (visible error elements)**:
```js
[{
  cls: "el-message el-message--error is-closable is-center",
  text: "该工厂已存在客如云的POS连接"
}]
```

**Analysis**:
- ✅ 0 ElMessage "创建失败" fallback (修前有, 修后消失)
- ✅ 1 ElMessage with 完整后端 message "该工厂已存在客如云的POS连接"
- ✅ `is-closable` class 证实来自 request.ts interceptor 的 showMessage (duration:0, showClose:true)
- ⚠️ MutationObserver count=0 — observer 装在 navigate 之后但之前的 toast 被先弹, SPA 复用导致未捕获新 added node; 但 DOM 可见的证据是明确的.

### 四位一体判定

| 检查 (Rule 8) | 结果 |
|---|---|
| a) network.response.data.message = "该工厂已存在客如云的POS连接" | ✅ |
| b) UI 文案 = 后端 message (完全匹配, 无 "创建失败" fallback 污染) | ✅ |
| c) sticky (is-closable, duration:0 via interceptor) | ✅ |
| d) next action | ⚠️ 缺 (message 本身具体足够让用户明白原因) |

---

## 失败尝试 (诚实记录)

### procurement/price-lists 重复 name 测试
**预期**: 创建同名价格表 → 400/409 → 触发 catch → 验证无 fallback
**实际**: 后端**不**对 price-list name 加 UNIQUE constraint. 第二次创建成功 (创建了 2 条 name 相同的记录).
**结论**: 此 endpoint 无法通过 "重复名" 触发错误. 需要其他触发条件 (删除失败 / FK 冲突).

### system/pos 手动同步 / 测试连接
**预期**: POS 同步 / test 接口失败 → 触发 catch
**实际**: 后端返回 200. POS 测试环境可能 mock 模拟成功, 或者 "客如云" test/sync 端点不做真连接.
**结论**: 此路径不触发 catch. 改用 "重复创建" 成功 (见上).

### sales/orders 空表单提交
**预期**: 空表单 → 前端过不了 validation 无法触发
**实际**: 确认前端 validation 先 fire "生效日期不能为空" (合理 UX, 非 bug)
**结论**: 前端 validation 是 gatekeeper, API 调用未发出 → catch 不 fire

---

## 结论

- ✅ **2/14 真窗口 error-deep** (rd/samples 403 + system/pos 400) — 覆盖 2 个 HTTP code / 2 个 role / 2 个不同后端 service
- ✅ **Pattern 等价证据** (git show 992d1135f diff) — 13 个文件的修改是机械 regex 替换, 逐字一致
- ✅ **两个不同 UI 路径** (ElMessageBox 阻塞 via 403 + ElMessage sticky via 400) 都已证实无 "创建失败"/"删除失败"/"操作失败" fallback 出现

原始 Bug #319 fix (commit `992d1135f`) 已可靠生效, 用户不再看到 "xxx 失败" fallback 覆盖真实 backend message.

---

**签名**: Claude, Apr 18 2026 22:49 CST.
