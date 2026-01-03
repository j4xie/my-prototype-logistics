# 平台管理员原型图 (Platform Admin Prototype)

## 概述

白垩纪食品溯源系统 - 平台管理员移动端原型图。平台管理员是系统最高级别管理者，负责管理所有工厂、蓝图模板、AI配额、规则配置等。

## 设计规范

| 项目 | 值 |
|------|-----|
| 屏幕宽度 | 375px |
| 屏幕高度 | 812px |
| 主题渐变 | `#1a1a2e` -> `#16213e` (深邃紫色) |
| 角色图标 | `平` (平台管理员首字母) |
| 底部导航 | 4个Tab (首页/工厂/蓝图/我的) |

## 页面清单

### Tab 主页面 (4个)
- `index.html` - 首页/仪表板
- `factories.html` - 工厂管理Tab
- `blueprints.html` - 蓝图管理Tab
- `profile.html` - 个人中心Tab

### 工厂管理模块 (8个)
- `factory-list.html` - 工厂列表
- `factory-detail.html` - 工厂详情
- `factory-create.html` - 手动创建工厂
- `factory-edit.html` - 编辑工厂
- `factory-ai-quick.html` - AI快速创建 (一键模式)
- `factory-ai-wizard.html` - AI详细创建 (向导模式)
- `factory-ai-preview.html` - AI配置预览
- `factory-quota.html` - AI配额设置

### 蓝图管理模块 (8个)
- `blueprint-list.html` - 蓝图列表
- `blueprint-detail.html` - 蓝图详情
- `blueprint-create.html` - 创建蓝图
- `blueprint-edit.html` - 编辑蓝图
- `blueprint-versions.html` - 版本历史
- `blueprint-bindings.html` - 工厂绑定
- `blueprint-preview.html` - 预览效果
- `blueprint-apply.html` - 应用到工厂

### 规则管理模块 (9个)
- `rule-list.html` - 规则列表
- `rule-detail.html` - 规则详情
- `rule-create.html` - 创建规则
- `rule-test.html` - 规则测试
- `decision-table.html` - 决策表管理
- `decision-table-upload.html` - 上传决策表
- `state-machine-list.html` - 状态机列表
- `state-machine-edit.html` - 状态机编辑
- `state-machine-test.html` - 状态转换测试

### AI配额管理模块 (4个)
- `quota-overview.html` - 配额概览
- `quota-rules.html` - 配额规则
- `quota-rule-edit.html` - 编辑配额规则
- `quota-usage-stats.html` - 使用统计

### 系统监控模块 (4个)
- `system-metrics.html` - 系统指标
- `system-health.html` - 健康状态
- `system-logs.html` - 操作日志
- `system-alerts.html` - 系统告警

### 报表模块 (4个)
- `report-dashboard.html` - 报表中心
- `report-production.html` - 生产报表
- `report-quality.html` - 质量报表
- `report-factory-ranking.html` - 工厂排行

### 个人中心模块 (4个)
- `personal-info.html` - 个人信息
- `change-password.html` - 修改密码
- `notification-settings.html` - 通知设置
- `about.html` - 关于系统

## 对应后端API

| 模块 | Controller | 基础路径 |
|------|------------|----------|
| 工厂管理 | PlatformController | `/api/platform/factories/*` |
| 蓝图管理 | FactoryBlueprintController | `/api/platform/blueprints/*` |
| 规则管理 | RuleController | `/api/mobile/{factoryId}/rules/*` |
| AI配额 | PlatformController | `/api/platform/ai-quota/*` |
| 系统监控 | PlatformController | `/api/platform/system/*` |
| 报表 | PlatformController | `/api/platform/reports` |

## 文件结构

```
platform-admin/
├── README.md              # 本文档
├── styles.css             # 平台管理员专属样式
├── index.html             # 首页
├── factories.html         # 工厂管理Tab
├── blueprints.html        # 蓝图管理Tab
├── profile.html           # 个人中心Tab
├── factory-*.html         # 工厂管理相关页面
├── blueprint-*.html       # 蓝图管理相关页面
├── rule-*.html            # 规则管理相关页面
├── decision-table*.html   # 决策表相关页面
├── state-machine-*.html   # 状态机相关页面
├── quota-*.html           # AI配额相关页面
├── system-*.html          # 系统监控相关页面
├── report-*.html          # 报表相关页面
└── personal-*.html        # 个人中心相关页面
```

## 样式依赖

- `../styles.css` - 公共样式
- `../components.css` - 组件库
- `styles.css` - 平台管理员专属样式
