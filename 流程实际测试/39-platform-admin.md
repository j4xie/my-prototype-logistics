# 39. 平台级管理 API (Platform / Blueprint)

> **🟡 R18 QA Smoke (2026-04-17 07:06)**: /platform/tenants + /platform/factories 用 factory_super_admin token 正确 **403** "无权访问该工厂数据" ✅ (权限屏障正确). 需 PLATFORM_SUPER_ADMIN 账号才能 deep, 本 session 范围外.

**来源**: R3 Agent 1 — 1637 端点只测 31 个
**涉及角色**: platform_admin (最高权限, 跨工厂)
**耗时**: 30 min

---

## 39.1 平台级工厂管理 (`/api/platform/**`)

### 39.1.1 创建新工厂
1. platform_admin 登录
2. 进 `/platform/factories/create`
3. 字段:
   - 工厂编号: `F100`
   - 工厂名: `XX 食品厂`
   - 类型: 食品 / 餐饮 / 加工
   - 管理员账号 (初始)
   - 生效日期
   - 许可证 (上传)
4. 保存

### ✅ PASS
- API: `POST /api/platform/factories`
- 返回 factoryId
- 自动创建默认角色/菜单/配置

### 39.1.2 编辑工厂信息
- 改名 / 地址 / LOGO
- API: `PUT /api/platform/factories/{id}`

### 39.1.3 激活/停用工厂
- `POST .../activate` / `.../deactivate`
- 停用后该工厂所有账号无法登录

### 39.1.4 删除工厂
- `DELETE /api/platform/factories/{id}` (软删)
- 所有数据标记 deleted_at
- 30 天后物理删 (定时任务)

---

## 39.2 平台 Dashboard

- 所有工厂概览 KPI
- 跨工厂统计对比

### API
- `GET /api/platform/dashboard/statistics`
- `GET /api/platform/factories` (列表)

---

## 39.3 AI 配额管理

### 39.3.1 各工厂 AI 调用额度
- `GET /api/platform/ai-quota` — 列表
- `PUT /api/platform/ai-quota/{factoryId}` — 调整

### 字段
- 月调用次数上限
- 已用
- 重置周期

---

## 39.4 蓝图版本管理 (Blueprint)

### 39.4.1 蓝图列表
`/platform/blueprints` 或 `/api/mobile/{factoryId}/config/v2/**`

### 39.4.2 创建蓝图
- 定义 Canvas 模板 + 默认字段 + 工作流
- 发布后可分配给新工厂

### 39.4.3 版本控制
- 每次修改 → 新版本
- 版本对比 (diff)
- 灰度发布 (先部分工厂用)
- 回滚

### 39.4.4 多工厂绑定
- 1 蓝图可分配给 N 工厂
- 某工厂是否跟随蓝图更新 (可选)

---

## 39.5 Checklist (15 项)

| # | 项 | 勾选 |
|---|---|------|
| 1 | 创建工厂 | ☐ |
| 2 | 编辑工厂 | ☐ |
| 3 | 激活工厂 | ☐ |
| 4 | 停用工厂 + 账号无法登录 | ☐ ⭐ |
| 5 | 删除工厂软删 | ☐ |
| 6 | 30 天后物理删 (cron) | ☐ |
| 7 | Dashboard KPI 跨工厂 | ☐ |
| 8 | AI 配额列表 | ☐ |
| 9 | 调整配额生效 | ☐ |
| 10 | 蓝图创建 | ☐ |
| 11 | 版本 diff | ☐ |
| 12 | 灰度发布 | ☐ |
| 13 | 蓝图回滚 | ☐ |
| 14 | 蓝图分配多工厂 | ☐ |
| 15 | platform_admin 跨工厂访问 | ☐ ⭐ |
