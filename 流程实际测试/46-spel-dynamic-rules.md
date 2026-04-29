# 46. SpEL 动态规则 + 即时生效

> **🟡 R18 QA Smoke (2026-04-17 07:07)**: /F001/validation-rules **404** (SpEL rules 配置 API 未实装 at factory 层级, 可能 Canvas 编辑器内部). Canvas-E2E-R1-R7 memory 有深度验证.

**来源**: R4 Agent 4
**耗时**: 15 min

---

## 46.1 SpEL 验证规则概述

Canvas V3 允许配置 SpEL 校验规则, 如:
- `#plannedQuantity > 0`
- `#deliveryDate > #orderDate`
- `#unitPrice * #quantity > 100 || #approved`

存在 `factory_validation_rules` 表, 关联 factoryId + entity.

---

## 46.2 规则热更新测试

### 步骤 (更精确 — R6 修正)
1. **Chrome 窗口 A** (admin): 进 `/canvas-editor` → 选 `sales_order` 模块
2. Tab 3 "校验规则" → 点 "+ 添加规则":
   - 规则名: `qty_over_100`
   - SpEL: `#quantity > 100`
   - 错误消息: `数量必须 > 100`
3. 点右上角 "⚡ 立即发布" 按钮
4. **保持 Chrome 窗口 A 不关闭**
5. **Chrome 窗口 B** (新开无痕, sales 账号): 地址栏输 `/sales/orders/create` (或列表点新建)
6. 填客户+产品+数量**50**+其他字段 → 点保存

### ✅ PASS (热更新)
- 前端立即显示 "数量必须 > 100"
- **无需 reload**

### ⚠️ 弱 PASS (需 reload)
- 提交成功 (规则未生效)
- 手动刷新后新规则生效
- 告诉客户: 修改规则后需让 SO 填写员刷新

### ❌ FAIL
- 规则永远不生效 (缓存 bug)

---

## 46.3 规则删除

1. Canvas Tab 3 删除 `qty_over_100`
2. 发布
3. sales 再填数量 50
4. ✅ 应能提交 (规则移除)

---

## 46.4 多规则叠加

- 规则 A: `#quantity > 0`
- 规则 B: `#quantity < 10000`
- 规则 C: `#unitPrice >= 1`

### 测试
- 填 quantity=0 → 违规 A
- 填 quantity=5000, unitPrice=0 → 违规 C
- 填 quantity=15000 → 违规 B

✅ 按**优先级**/顺序 显示错误消息

---

## 46.5 跨工厂规则继承

- 平台蓝图定义 "全局校验规则"
- 各工厂可 override 或继承

### 测试
- 蓝图定义 `#quantity > 0`
- F001 override 为 `#quantity > 10`
- F002 不 override (继承蓝图 > 0)

### ✅ PASS
- F001 sales 填 5 → 违规
- F002 sales 填 5 → 通过

---

## 46.6 SpEL 安全 (避免代码注入)

### ⚠️ 前置确认 (R5 审计)
**完整 SpEL 沙盒可能未实装**, 当前可能只有基础关键字黑名单. 测试方法:
1. 配置含 `T(java.lang.Runtime).getRuntime().exec('xxx')` 的规则
2. 观察:
   - ✅ 后端**至少**拒绝包含 `T(...)` / `getRuntime` / `Runtime` / `exec` / `System` 的 SpEL
   - ✅ 不该真的执行 shell
   - ⚠️ 若仅拒绝保存但无运行时隔离, 标 "⚠️ 沙盒 V2 roadmap"

### 测试
- 管理员误配 `T(java.lang.Runtime).getRuntime().exec('rm -rf /')`
- ✅ 后端拒绝 + 提示 "SpEL 包含非法关键字"
- 若能保存并执行 → **严重安全漏洞, 立即上报 P0**

---

## 46.7 Checklist (8 项)

| # | 测试 | 勾选 |
|---|------|------|
| 1 | 规则添加 + 发布 | ☐ |
| 2 | 热更新生效 (无需 reload) | ☐ ⭐ |
| 3 | 违规消息显示 | ☐ |
| 4 | 规则删除生效 | ☐ |
| 5 | 多规则叠加 | ☐ |
| 6 | 规则优先级顺序 | ☐ |
| 7 | 跨工厂继承 override | ☐ |
| 8 | SpEL 沙盒安全 | ☐ ⭐⭐ |
