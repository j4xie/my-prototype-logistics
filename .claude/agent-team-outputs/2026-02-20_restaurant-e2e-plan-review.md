# 餐饮模式 E2E 测试计划完整性评估

**日期**: 2026-02-20
**模式**: Full (3 Researcher + Analyst + Critic + Integrator)

## 执行摘要

测试计划框架方向正确，但存在系统性覆盖缺口。`isRestaurant` 条件渲染集中在 4 个使用文件中，核心在 FAHomeScreen（3 stat cards + 4 quick actions）和 FAManagementScreen（6 项隐藏 + 4 标签替换）。原计划覆盖约 29/45 页面(64%)，条件渲染内容级验证接近 0%。

## 关键发现

### 覆盖率
- 餐饮可达约 45 页（去掉报表Tab 17页 + 工厂专属路由 25页）
- 原计划覆盖 29 页 (64%)
- AI分析(9页)/SmartBI(15页)/我的(9页) 几乎零覆盖

### 条件渲染验证
- `isRestaurant` 在 5 个文件引用（1 定义 + 4 使用）
- FAHomeScreen: stat cards 3 vs 5, quick actions 4 vs 6
- FAManagementScreen: 6 项隐藏 + 4 标签替换
- FactoryAdminTabNavigator: 报表 Tab 隐藏
- FAManagementStackNavigator: ~25 个工厂路由不注册

### 前置数据风险
- F002 factoryType 需验证为 RESTAURANT（30%风险）
- 首页 stat cards 2/3 是 TODO 硬编码 "--"（后端 API 未实现）
- F002 业务数据可能不足

### 执行方案
- adb screencap + input tap 对一次性验证可行
- Claude 可直接分析 1-3MB PNG，无需 ImageMagick
- 建议 uiautomator dump 辅助坐标获取

## 优先级建议

| 级别 | 内容 | 时间 |
|------|------|------|
| P-1 | 前置验证(factoryType + feature-config) | +5 min |
| P0 | 6个条件渲染验证点 | +10 min |
| P1 | AI分析+SmartBI+我的 主页 + stat card点击 | +20 min |
| P2 | SmartBI 15子页 + AI分析 8子页 + 详情页 | +30 min |

---

### Process Note
- Mode: Full
- Researchers deployed: 3
- Total sources: 12+ codebase files verified
- Key disagreements: 2 resolved (覆盖率分母, isRestaurant文件数), 0 unresolved
- Phases: Research → Analysis → Critique → Integration
- Fact-check: disabled
- Competitor profiles: N/A
