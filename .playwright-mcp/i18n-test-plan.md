# i18n 中英文一致性测试计划

## 测试目标
验证所有新实现的 Coming Soon 屏幕在中文(zh-CN)和英文(en-US)模式下不会出现中英文混杂。

## 测试步骤

### Phase 1: 英文模式验证
1. 登录 factory_admin1
2. 确认当前语言为 English (en-US)
3. 逐一访问每个屏幕，检查是否有中文字符残留

### Phase 2: 中文模式验证
1. 切换语言到中文 (zh-CN)
2. 逐一访问每个屏幕，检查是否有英文混杂

### 检查清单

| 屏幕 | 检查项 | en-US | zh-CN |
|------|--------|-------|-------|
| CashFlowScreen | 标题、KPI标签、图表图例、健康提示 | | |
| CustomerRFMScreen | 标题、汇总标签、分群名、详情标签、建议文字 | | |
| FinancialRatiosScreen | 标题、健康分标签、分类名、比率名、状态标签、图例 | | |
| LogisticsDashboardScreen | 标题、状态标签、快捷操作、错误提示 | | |
| SmartBIHomeScreen | 3个新菜单标题+描述 | | |
| VoiceMicButton | Alert文字 | | |
| NotificationSettings | 通知类型标签 | | |
