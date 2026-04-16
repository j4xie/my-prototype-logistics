# 49. Canvas 大模块 (全功能集中版)

**说明**: 此文件把散落在 02/17/30/39/45/46 中的 Canvas 相关测试**集中整合**, 按 Canvas 模块逻辑完整跑一遍. 部分步骤与其他节有重复, 这是**按模块视角的完整验证**.
**涉及角色**: admin / factory_super_admin / platform_admin
**耗时**: 60-90 min (全 Canvas 模块端到端)

---

## 49.1 Canvas 模块总览

Canvas V3 = 低代码动态模块配置系统, 允许每工厂自定义:
- 字段 (新增/必填/校验/联动/可见性)
- 工作流 (状态机 + 转换)
- 触发链 (事件驱动自动化)
- 校验规则 (SpEL)
- 权限矩阵 (角色级)
- 工具技能 (AI tool 绑定)
- 定时任务 (cron)

### 核心入口

| URL | 功能 |
|-----|------|
| `/canvas-editor` | 主编辑器 (7 Tab) |
| `/canvas-editor/blueprint/edit` | 蓝图编辑 |
| `/modules/{moduleCode}` | 动态模块运行时 (如 sales_order) |
| `/system/canvas-config` | 配置列表 |

---

## 49.2 访问权限 (来自 §02.2 + §12)

### 49.2.1 权限验证
| 角色 | 应可访问? |
|------|---------|
| admin (factory_super_admin) | ✅ |
| platform_admin | ✅ |
| permission_admin | ✅ |
| sales / finance / purchase / 其他 | ❌ 应 403 或隐藏菜单 |

### 49.2.2 Bug #1 回归 (Canvas 403)
- admin 登录, Ctrl+Shift+R 强刷
- 侧边栏 → "系统管理" → "Canvas 配置编辑器"
- ✅ 页面加载, 无 403

---

## 49.3 主编辑器 7 个 Tab (来自 §17.4)

### 前置
1. admin 进 `/canvas-editor`
2. 顶部下拉选要配置的模块 (如 `sales_order`)
3. 加载当前发布版本

### Tab 1: 流程设计 (工作流)
- 左侧节点面板: 开始 / 任务 / 审批 / 条件分支 / 合并 / 结束
- 画布拖拽节点放置
- 鼠标从节点边缘连线到另一节点
- 双击连线编辑 transition 名 (如 "确认")
- 删除节点 (选中 + Delete)
- 缩放 / 适应屏幕
- 保存草稿

### ✅ PASS
- 节点可拖动, 连线不掉线
- 保存 toast "保存成功", 状态 `DRAFT`

### Tab 2: 触发链
- 左侧事件列表: `SalesOrderFinanceApprovedEvent` / `BatchCompletedEvent` / 等
- 中间画布: 按顺序拖步骤 (如 "库存检查" → "创建采购建议" → "推送通知")
- 每步骤点击配置参数
- 错误策略: CONTINUE / STOP / ROLLBACK
- 保存

### Tab 3: 校验规则 (SpEL)
- 添加规则:
  - 规则名: `qty_positive`
  - SpEL: `#plannedQuantity > 0`
  - 错误消息: `计划数量必须大于 0`
- 添加第 2 条:
  - SpEL: `#deliveryDate > #orderDate`
  - 错误消息: `交货日期不能早于下单日期`
- 保存

### Tab 4: 字段配置 ⭐ 核心
- 左侧字段面板: 文本 / 数字 / 日期 / 下拉 / 多选 / 文件 / 子表
- 拖字段到画布
- 配置每字段:
  - 字段代码 (fieldCode, 唯一): `customField1`
  - 字段类型 (type): STRING / NUMBER / DATE / SELECT / SUBTABLE
  - 必填 (required): Boolean
  - 默认值
  - 显示条件 (visibleWhen SpEL): `#status == 'DRAFT'`
  - 计算表达式 (computedWhen): `#qty * #unitPrice`
  - 下拉选项 (如 type=SELECT)
  - 关联实体 (如 type=REFERENCE)
  - 排序
- 发布时生成数据库 DDL (自动执行)

### Tab 5: 权限矩阵
- 表头: 角色列 (所有角色)
- 行: 操作 (查看列表 / 查看详情 / 新建 / 编辑 / 删除 / 审核)
- 每格下拉: 允许 / 拒绝 / 仅自己的
- 保存

### Tab 6: 工具/技能
- AI Tool 列表 (337+)
- 勾选绑定到此模块
- 配置调用时机 (按钮点击 / 表单填写 / 状态变化)

### Tab 7: 定时任务
- 添加 cron: `0 0 2 * * ?`
- 选择动作 (如 "自动关闭超期订单")
- 保存

---

## 49.4 发布 + 版本管理

### 步骤 (R6 修正按钮文字)
1. 编辑完成, 点右上角 "**⚡ 立即发布**" 按钮 (不是纯 "发布", 是 CanvasHeader.vue 里的)
2. 弹出发布确认对话框:
   - 版本号 **自动 +1** (前端不可手填)
   - 发布说明 (textarea, 可选)
   - 生效时间: 立即生效 / 指定时间
3. 点 "确认发布"

### ✅ PASS
- 版本记录列表新增
- 数据库 DDL 自动执行 (字段新增)
- 前端运行时页面 `/modules/sales_order` reload 后看到新字段
- 工厂实时生效

### 版本对比 (diff)
- 版本列表点 "对比" → 显示字段/规则差异

### 回滚
- 点历史版本 → "回滚到此版本"
- 确认后当前版本变为该版本

### 灰度发布
- 发布时选 "仅部分工厂"
- 勾选工厂列表

---

## 49.5 动态模块运行时 (来自 §30.5)

### 49.5.1 验证字段配置生效
1. Canvas 给 `sales_order` 添加字段 `customField1` (type=STRING, required=true)
2. 发布
3. sales 账号打开 `/sales/orders/create`
4. **应看到新字段 `customField1`** 带红星 *
5. 不填提交 → 应显示必填错误

### 49.5.2 验证 SpEL 校验
- Tab 3 添加 `#quantity > 0`
- 发布
- sales 填数量 0 提交 → 错误提示 "计划数量必须大于 0"

### 49.5.3 验证可见性联动
- Tab 4 添加字段 `rejectReason` (visibleWhen: `#status == 'REJECTED'`)
- 发布
- sales 新建 SO (status=DRAFT) → 该字段**不可见**
- 状态变 REJECTED → 字段**显示**

### 49.5.4 验证计算表达式
- 字段 `totalAmount` (computedWhen: `#quantity * #unitPrice`)
- **说明**: `computedWhen` 是**前端 JavaScript 表达式**, 实时计算, 无需提交
- 前端填 qty=10, unitPrice=50 → totalAmount **立即**显示 500 (只读灰底)
- 改 qty=20 → totalAmount **实时**变 1000

### 49.5.5 验证权限矩阵 ⚠️
- Tab 5 对 `operator` 角色禁用 "审核"
- operator 登录, SO 详情 → "审核" 按钮**隐藏**

**⚠️ R5 审计**: Canvas 权限矩阵的**运行时生效**需确认. 配置保存≠前端自动应用. 若测试发现:
- 配置保存但按钮仍显示 → 后端权限合成逻辑未接入 Canvas 配置, 需 V2 修
- 配置保存后前端 reload 才生效 → 属已知限制, 不算 bug

---

## 49.6 触发链 E2E (来自 §45)

### 步骤
1. Canvas Tab 2 配置:
   - Event: SalesOrderFinanceApprovedEvent
   - Step 1: 库存检查
   - Step 2: 创建采购建议
   - Step 3: 推送通知
   - Error: CONTINUE
2. 发布
3. 创建 SO, 走完 finance 审核
4. 等 5s 观察

### ✅ PASS
- 后端日志/`/system/trigger-chain-logs`: 3 步都执行
- SO 详情 Tab "采购订单" 出现自动 PO draft
- 消息中心新通知

---

## 49.7 SpEL 规则热更新 (来自 §46)

### 步骤
1. Canvas 添加规则 `#quantity > 100`, 发布
2. 不关闭浏览器, sales 新开标签填 SO 数量 50
3. 提交

### ✅ PASS (热更新)
- 立即显示规则错误
- 无需 reload

### ⚠️ 弱 PASS
- 需刷新后规则生效

---

## 49.8 Canvas 蓝图管理 (来自 §39.4)

### 49.8.1 蓝图 = 跨工厂模板
- `/canvas-editor/blueprint/edit`
- platform_admin 定义基础蓝图
- 各工厂继承 + 可 override

### 49.8.2 蓝图多工厂绑定
- 1 蓝图分配给 N 工厂
- 工厂可选 "跟随蓝图更新" 或 "冻结"

### 49.8.3 继承测试
- 蓝图定义规则 `#qty > 0`
- F001 继承, F002 override 为 `#qty > 10`
- F001 填 qty=5 → 违规 (blueprint)
- F002 填 qty=5 → 通过 (override)

---

## 49.9 Canvas 相关 bug 回归 (来自 §02 + §04/11)

### 49.9.1 Bug #4 URL 双前缀 (ReferenceSelector 根因)
- ReferenceSelector 是 Canvas 动态字段里用的远程下拉
- Canvas 配置 apiEndpoint 若误写 `/api/mobile/{factoryId}/customers`, 叠加 axios baseURL = 双前缀
- **已修复**: ReferenceSelector strip 前缀
- 测试: `/sales/orders/create` 客户下拉正常加载

### 49.9.2 Canvas 编辑器脏数据保护 (§26.7)
- Tab 4 拖字段但未保存
- 切 Tab / 关浏览器
- ✅ 弹 "有未保存修改"

---

## 49.10 Canvas Checklist (30 项)

| # | 项目 | 勾选 |
|---|------|------|
| 1 | admin 访问 /canvas-editor 无 403 | ☐ ⭐ |
| 2 | factory_super_admin 有权限 | ☐ |
| 3 | sales 访问应 403 | ☐ |
| 4 | 7 Tab 切换无 error | ☐ |
| 5 | Tab 1 节点拖拽 + 连线 | ☐ |
| 6 | Tab 1 保存草稿 | ☐ |
| 7 | Tab 2 触发链配置 | ☐ |
| 8 | Tab 3 SpEL 规则添加 | ☐ |
| 9 | Tab 4 字段拖入画布 | ☐ ⭐ |
| 10 | Tab 4 字段配置全面 (type/required/visibleWhen) | ☐ ⭐ |
| 11 | Tab 5 权限矩阵 | ☐ |
| 12 | Tab 6 工具绑定 | ☐ |
| 13 | Tab 7 cron 配置 | ☐ |
| 14 | 发布 + 版本 +1 | ☐ ⭐ |
| 15 | DDL 自动执行 | ☐ ⭐ |
| 16 | 运行时看到新字段 | ☐ ⭐ |
| 17 | 必填校验生效 | ☐ |
| 18 | SpEL 校验生效 | ☐ |
| 19 | 可见性联动 | ☐ |
| 20 | 计算表达式 | ☐ |
| 21 | 权限矩阵 Hide 按钮 | ☐ |
| 22 | SpEL 热更新 (无需 reload) | ☐ ⭐ |
| 23 | 触发链 E2E 3 步执行 | ☐ ⭐ |
| 24 | 版本对比 diff | ☐ |
| 25 | 版本回滚 | ☐ |
| 26 | 灰度发布 | ☐ |
| 27 | 蓝图继承 | ☐ |
| 28 | 蓝图 override | ☐ |
| 29 | Canvas 编辑脏数据保护 | ☐ |
| 30 | ReferenceSelector 无双前缀 | ☐ ⭐⭐ |

⭐⭐ = Bug #4 回归, 必测
