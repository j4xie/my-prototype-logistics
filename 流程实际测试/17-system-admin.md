# 17. 系统管理深度 (用户/角色/Canvas/POS/工作流)

**涉及角色**: admin (全部) / hr (用户部分) / permission_admin (角色)
**耗时**: 25 min

---

## 17.1 模块总览

| 模块 | URL | 必备操作 |
|------|-----|---------|
| 用户管理 | `/system/users` | CRUD + 禁用 + 改密 |
| 角色管理 | `/system/roles` | 查看 (创建/编辑已禁用) |
| Canvas 配置编辑器 | `/canvas-editor` | 7 个 Tab 的深度配置 |
| 工作流设计器 | `/system/workflow-designer` | 节点拖拽 + 连线 + 校验 |
| POS 集成 | `/system/pos` | CRUD + 同步 + webhook |
| 手动同步 | 上述 POS | 已测 (§02.9) |

---

## 17.2 用户管理 (`/system/users`)

### 17.2.1 新建用户
1. `admin` 进 `/system/users`
2. 点 "**新建用户**"
3. 字段:
   - 用户名 username (必填): `qa_test_user`
   - 姓名 fullName (必填): `QA 测试员`
   - 密码 password (必填, 默认 123456): `123456`
   - 角色 roleCode (下拉, 必填): `operator`
   - 部门 departmentId (下拉): 选一个
   - 手机 phone (可选): `13800000001`
   - 邮箱 email (可选): `qa@test.com`
   - 是否启用 isActive (switch, 默认 true): 开
4. 点 "保存"

✅ PASS: Toast "创建成功" + 列表新增
❌ FAIL: 重名 → "用户名已存在"

### 17.2.2 禁用/启用用户
1. 列表行点 "**禁用**" 按钮
2. 确认框 → 确定
✅ PASS: is_active=false, 该用户登录时提示 "账号已被禁用"

### 17.2.3 重置密码
1. 列表行点 "**重置密码**" 按钮
2. 弹框输新密码 `123456`
3. 确定
✅ PASS: 该用户下次用新密码登录成功

### 17.2.4 编辑角色
1. 列表行点 "**编辑**" 按钮
2. 修改角色 (如从 operator → sales_manager)
3. 保存
✅ PASS: 用户重新登录生效新权限

### 17.2.5 删除用户
1. 点 "**删除**" (软删除)
2. 确认
✅ PASS: deleted_at 非 null, 列表不再显示

---

## 17.3 角色管理 (`/system/roles`)

### 17.3.1 查看权限矩阵 (已在 §02.7 测过)
✅ PASS: 12 模块显示权限

### 17.3.2 ⚠️ 创建/编辑角色
**当前 V1 禁用** (Vue 里 disabled 状态). 若客户问, 答 V2 roadmap.

---

## 17.4 Canvas 配置编辑器深度 (7 Tab)

### 前置
- admin 进 `/canvas-editor`
- 选定要配置的模块 (如 `sales_order`)

### Tab 1: 流程设计
- 画布拖拽节点 (开始/任务/审批/条件/结束)
- 节点连线
- 保存

✅ PASS: 节点可拖动, 连线不掉线, 保存 toast

### Tab 2: 触发链
- 选状态转换 (DRAFT → CONFIRMED)
- 配触发动作 (发通知 / 调 API / 跑脚本)

### Tab 3: 校验规则
- 添加 SpEL 规则: `#plannedQuantity > 0`
- 错误消息: `计划数量必须大于 0`
- 保存

### Tab 4: 字段配置
- 从左侧拖字段到画布
- 设必填/只读/可见/联动
- 发布时生成数据库 DDL

### Tab 5: 权限矩阵
- 为每角色配读写权限 (rw/r/w/-)

### Tab 6: 工具技能
- 关联 AI tools (可选)

### Tab 7: 定时任务
- cron 配置 (如每天 0 点汇总)

### 17.4.8 发布
- 点 "**发布**" 按钮
- 确认发布对话框
- 版本号 +1

✅ PASS: 发布后配置生效, 前端页面 reload 后新字段/规则可用

---

## 17.5 工作流设计器 (`/system/workflow-designer`)

### 17.5.1 选状态机
- 顶部下拉选 entityType: `sales_order`
- 加载当前发布版本

### 17.5.2 拖节点
- 左侧节点面板拖状态 (DRAFT/CONFIRMED/...)
- 中间画布放置

### 17.5.3 连线
- 鼠标从节点 A 边缘拖到节点 B
- 弹框输 transition 名 (如 `确认`)

### 17.5.4 保存草稿
- 点 "**保存**"
- ✅ 状态变 DRAFT 版本

### 17.5.5 ⭐ 校验
- 点 "**校验**" 按钮
- ✅ 若有循环/无出口节点, 报错
- ✅ 无问题 toast "校验通过"

### 17.5.6 发布
- 点 "**发布**"
- 版本 +1, 配置生效

---

## 17.6 POS 集成深度 (`/system/pos`)

### 17.6.1 新建连接
1. 点 "**新建连接**"
2. 字段:
   - 品牌 brand: 客如云 / 美团 / 自定义
   - 连接名: `白垩纪-客如云POS-线下店`
   - appKey: `kry_real_key`
   - appSecret: `***`
   - accessToken: (OAuth 流程获取)
   - posStoreId: `KRY-STORE-001`
   - webhookSecret: (可选)
3. 保存

✅ PASS: 列表新增连接

### 17.6.2 测试连接
- 行点 "**测试**" 按钮
- 调 `/pos/connections/{id}/test`
- ✅ Toast "连接测试成功"

### 17.6.3 手动同步 (已测 §02.9)
- demo 凭证返回 mock 订单 3 条

### 17.6.4 Webhook 配置
- 连接详情 Tab "Webhook"
- URL: `/api/mobile/{factoryId}/pos/webhook/keruyun`
- 填给 POS 平台配置

### 17.6.5 同步历史
- Tab "同步记录"
- 列表显示每次同步结果 (成功数/失败数/时间)

---

## 17.7 系统设置

### 17.7.1 工厂信息
- `/system/factory` (可能无独立页)
- 编辑工厂名/LOGO/地址

### 17.7.2 通知配置
- `/system/notifications` (可能)
- 配置消息通道 (邮件/短信/钉钉)

---

## 17.8 本节 Checklist (20 项)

| # | 项目 | 账号 | 勾选 |
|---|------|------|------|
| 1 | 17.2.1 新建用户 | admin | ☐ |
| 2 | 17.2.2 禁用用户 | admin | ☐ |
| 3 | 17.2.3 重置密码 | admin | ☐ |
| 4 | 17.2.4 编辑角色 | admin | ☐ |
| 5 | 17.2.5 删除用户 (软) | admin | ☐ |
| 6 | 17.3.1 角色权限查看 | admin | ☐ |
| 7 | 17.4 Canvas Tab 1 流程 | admin | ☐ |
| 8 | 17.4 Tab 2 触发链 | admin | ☐ |
| 9 | 17.4 Tab 3 校验规则 | admin | ☐ |
| 10 | 17.4 Tab 4 字段配置 | admin | ☐ |
| 11 | 17.4 Tab 5 权限矩阵 | admin | ☐ |
| 12 | 17.4 Tab 6 工具技能 | admin | ☐ |
| 13 | 17.4 Tab 7 定时任务 | admin | ☐ |
| 14 | 17.4.8 Canvas 发布 | admin | ☐ ⭐ |
| 15 | 17.5 工作流节点拖拽 | admin | ☐ |
| 16 | 17.5.5 工作流校验 | admin | ☐ ⭐ |
| 17 | 17.6.1 POS 新建连接 | admin | ☐ |
| 18 | 17.6.2 POS 测试连接 | admin | ☐ |
| 19 | 17.6.3 POS 手动同步 | admin | ☐ |
| 20 | 17.6.5 POS 同步历史 | admin | ☐ |
