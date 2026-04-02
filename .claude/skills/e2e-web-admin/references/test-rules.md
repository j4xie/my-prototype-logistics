# E2E 测试执行规范

> 整合自: TestDino Playwright Skill, firstloophq/claude-code-test-runner,
> Playwright Test Agents (Planner/Healer), lackeyjb/playwright-skill

## 执行行为准则

**在测试执行期间，严格遵守以下指令:**

1. **不要偏离测试计划。不要询问跟进问题。** 遇到歧义时做最合理的决定并继续，在证据区块中报告歧义。
2. **优先使用 `browser_snapshot` 而非 `browser_take_screenshot`。** 只在需要视觉验证时截图。Snapshot 提供结构化 DOM 数据用于元素发现，token 消耗更低。
3. **每个模块最多 20 次工具交互。** 防止失控的测试执行。超过限制标记为 TIMEOUT。
4. **假设新鲜状态。** 测试场景应独立，可以任意顺序运行。

## 硬性规则 (违反则测试无效)

1. **必须实际填写并提交表单** — 报告必须有 `filled:` 证据行，列出每个填写字段的具体值
2. **必须记录 API 响应** — 报告必须有 `toast:` 证据行，记录确切的 toast 文本（不能只说"success toast appeared"）
3. **必须验证数据持久化** — 报告必须有 `list after:` 证据行，说明创建的数据在列表中是否可见
4. **跨模块必须验证下拉列表** — 报告必须有 `下拉列表:` 证据行，列出实际看到的选项
5. **禁止无证据 PASS** — 没有 evidence 区块的 PASS 标记为 ⚠️ UNVERIFIED
6. **必须验证前后端校验一致** — 检查带星号(*)的前端必填字段 = 后端 @NotNull/@NotBlank 字段

**强制证据模板 (必须逐项填写，不能省略):**

```
### [模块名] — [操作]
  action: [点击了什么按钮，打开了什么弹窗]
  evidence:
    - filled: 字段A=值1, 字段B=值2, 字段C=值3
    - toast: "确切的toast文本内容"
    - API: HTTP [状态码], success=[true/false], message="..."
    - list after: [数据在列表中可见/不可见，具体行内容]
    - validation: 前端必填标记与后端一致=[YES/NO]
  result: ✅ PASS / ❌ FAIL / ❌ KNOWN_BUG [原因]
```

不允许用"filled form with data"、"success toast appeared"这类模糊描述代替具体值。

## 前后端校验一致性检查

**必须检查每个创建/编辑表单的字段校验:**

| 检查项 | 方法 | 失败标记 |
|--------|------|---------|
| 前端有星号 → 后端有 @NotNull | 对比 formRules 和 DTO 注解 | ⚠️ VALIDATION_MISMATCH |
| 后端有 @NotNull → 前端有星号 | 反向对比 | ⚠️ VALIDATION_MISMATCH |
| body vs query param | 检查前端 post(url, body) vs 后端 @RequestParam | ❌ PARAM_MISMATCH |
| HTTP method | 前端 put/post/delete vs 后端 @PutMapping/@PostMapping | ❌ METHOD_MISMATCH |

常见失败模式 (本项目已发现 4 次):
- 前端 POST body 传参，后端 `@RequestParam` 期望 query param
- 前端调 PUT，后端只有 POST (405 Method Not Allowed)
- 后端必填字段前端没标星号，用户不填就 500

## Healer 模式 (--fix)

来自 Playwright Test Agents 的自愈模式:

```
运行测试 → 失败 → snapshot 页面 → 分析根因 → 修复代码 → 重跑 → 重复直到通过
```

**关键逃生舱:** 如果错误持续存在且你有高置信度认为测试是正确的（应用本身有 bug），标记为 `KNOWN_BUG` 并附注释解释实际行为 vs 预期行为。不要无限循环试图"修复"应用。

```
result: ❌ KNOWN_BUG
  expected: 点击"创建"后显示成功 toast
  actual: 500 系统异常 (后端缺少 orderDate 校验)
  action: 需要修复后端 CreatePurchaseOrderRequest DTO
```

## 元素定位优先级

来自 TestDino 的 locator 最佳实践。用 MCP 工具操作时，优先用高层级方式标识元素:

| 优先级 | 方式 | 示例 | 使用场景 |
|--------|------|------|---------|
| 1 | Role | `button[name="提交"]` | 始终首选 |
| 2 | Label | `label "用户名"` 关联的 input | 表单字段 |
| 3 | Text | 包含 "创建成功" 的元素 | 非交互内容 |
| 4 | Placeholder | `input[placeholder="请输入"]` | 搜索框 |
| 5 | TestID | `[data-testid="xxx"]` | 最后的语义选项 |
| 6 | CSS | `.el-select-dropdown__item` | 最后手段 |

在 `browser_click` 的 `ref` 参数中，使用 `browser_snapshot` 返回的 ref 值，不要猜 CSS 选择器。

## 失败分类

来自 TestDino 的 flakiness taxonomy:

| 类别 | 诊断方式 | 修复 |
|------|---------|------|
| **时序/异步** | 本地重复跑 20 次有时失败 | 用 auto-retry assertion 替代 waitForTimeout |
| **测试隔离** | 单独跑通过，一起跑失败 | 共享可变状态/数据冲突 |
| **环境** | 只在 CI/远程失败 | viewport/字体/慢机器 |
| **应用 Bug** | 稳定复现 | 标记 KNOWN_BUG，修后端/前端 |

## Element Plus 操作模式

```
# 选下拉 (el-select)
1. browser_snapshot → 找到 label "客户" 旁的 el-select
2. browser_click → 点击 el-select 打开下拉
3. browser_snapshot → 找到下拉选项
4. browser_click → 点击目标选项

# 填表单 (el-input)
1. browser_snapshot → 找到 label "批次号" 旁的 input
2. browser_fill_form → 填入值

# 检查 toast
1. browser_snapshot → 查找 .el-message--error 或 .el-message--success
2. 如果找到 error → 记录错误文本 → FAIL
3. 如果找到 success → 记录成功文本 → PASS

# 验证表格数据
1. browser_snapshot → 找到 .el-table
2. 检查 .el-table__row 数量 > 0
3. 检查第一行是否包含刚创建的数据
```

## 自然语言测试定义

来自 firstloophq/claude-code-test-runner。测试用结构化自然语言定义:

```
模块: 销售订单
操作: 创建
步骤:
  1. 导航到 /sales/orders
  2. 点击"新建销售订单"
  3. 选择客户: 任意可用客户
  4. 选择业务员: 任意下拉选项 (验证是下拉不是文本框)
  5. 添加商品: 选择任意产品, 数量=10, 单价=自动填充
  6. 点击"创建"
  7. 验证: 成功 toast 出现
  8. 验证: 列表中出现新创建的订单
```

每步骤必须标记: `PASS` / `FAIL` / `SKIPPED`，失败时附 error 详情。
