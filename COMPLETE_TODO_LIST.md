# 前后端集成完整 TODO 清单
## Complete Frontend-Backend Integration TODO List

**生成时间**: 2025-11-19
**总任务数**: 41个
**已完成**: 6个 (14.6%)
**进行中**: 0个
**待开始**: 35个 (85.4%)

---

## 📊 任务总览

| 阶段 | 任务数 | 已完成 | 进行中 | 待开始 | 完成率 |
|------|--------|--------|--------|--------|--------|
| **Phase 1: 已集成验证** | 6 | 6 | 0 | 0 | 100% |
| **Phase 2: 质检管理** | 4 | 0 | 0 | 4 | 0% |
| **Phase 3: 成本分析** | 5 | 0 | 0 | 5 | 0% |
| **Phase 4: AI分析** | 6 | 0 | 0 | 6 | 0% |
| **Phase 5: 报表功能** | 10 | 0 | 0 | 10 | 0% |
| **Phase 6: 设备管理** | 6 | 0 | 0 | 6 | 0% |
| **Phase 7: 功能增强** | 4 | 0 | 0 | 4 | 0% |
| **总计** | **41** | **6** | **0** | **35** | **14.6%** |

---

## ✅ Phase 1: 已完成集成验证 (Completed - 6 tasks)

### 1.1 报表导出功能 ✅
- **文件**: `DataExportScreen.tsx`
- **后端API**:
  - `GET /api/mobile/{factoryId}/reports/export/excel`
  - `GET /api/mobile/{factoryId}/reports/export/pdf`
- **依赖**: expo-file-system, expo-sharing
- **状态**: ✅ 已完成
- **测试**: 需验证Excel和PDF导出功能

### 1.2 考勤历史查询 ✅
- **文件**: `AttendanceHistoryScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/timeclock/history`
- **功能**: 打卡历史、工时统计、日期筛选
- **状态**: ✅ 已完成
- **测试**: 需验证历史数据加载和筛选

### 1.3 设备告警获取 ✅
- **文件**: `EquipmentAlertsScreen.tsx`
- **后端API**:
  - `GET /equipment/needing-maintenance` ✅
  - `GET /equipment/expiring-warranty` ✅
- **状态**: ✅ 部分完成（告警确认/解决需后端实现）
- **测试**: 需验证告警列表显示

### 1.4 库存盘点功能 ✅
- **文件**: `InventoryCheckScreen.tsx`
- **后端API**:
  - `GET /material-batches/status/available`
  - `POST /material-batches/{batchId}/adjust`
- **状态**: ✅ 已完成
- **测试**: 需验证批次选择和数量调整

### 1.5 打卡基础功能 ✅
- **文件**: `TimeClockScreen.tsx`
- **后端API**:
  - `POST /timeclock/clock-in`
  - `POST /timeclock/clock-out`
  - `GET /timeclock/status`
  - `GET /timeclock/today`
- **状态**: ✅ 已完成
- **测试**: 需验证打卡流程

### 1.6 用户认证 ✅
- **文件**: `EnhancedLoginScreen.tsx`
- **后端API**:
  - `POST /auth/login`
  - `POST /auth/platform-login`
  - `POST /auth/register`
- **状态**: ✅ 已完成
- **测试**: 需验证登录和注册流程

---

## 🔨 Phase 2: 质检管理集成 (Quality Inspection - 4 tasks)

### 2.1 质检记录提交 ⏸️
- **文件**: `CreateQualityRecordScreen.tsx`
- **后端API**: `POST /api/mobile/{factoryId}/quality/inspections`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 添加 `qualityInspectionApiClient.ts`
  2. 实现质检记录提交表单
  3. 集成图片上传功能（需 expo-image-picker）
  4. 实现GPS位置记录（需 expo-location）
  5. 添加质检标准选择器
- **依赖**: expo-image-picker, expo-location
- **测试要点**:
  - [ ] 表单验证正确性
  - [ ] 图片上传成功
  - [ ] GPS坐标记录
  - [ ] 提交后数据正确保存

### 2.2 质检记录列表 ⏸️
- **文件**: `QualityInspectionListScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/quality/inspections`
- **优先级**: P1
- **预计时间**: 1.5小时
- **任务内容**:
  1. 集成质检记录列表API
  2. 实现分页加载
  3. 添加日期筛选
  4. 实现批次号搜索
  5. 添加质检结果筛选（合格/不合格）
- **测试要点**:
  - [ ] 列表数据正确显示
  - [ ] 分页功能正常
  - [ ] 筛选和搜索功能
  - [ ] 点击跳转到详情页

### 2.3 质检统计分析 ⏸️
- **文件**: `QualityAnalyticsScreen.tsx`
- **后端API**:
  - `GET /api/mobile/{factoryId}/quality/statistics`
  - `GET /api/mobile/{factoryId}/quality/trends`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 集成质量统计API
  2. 实现合格率图表显示
  3. 集成质量趋势分析
  4. 添加按产品类型统计
  5. 实现按时间维度统计（日/周/月）
- **依赖**: react-native-chart-kit 或类似图表库
- **测试要点**:
  - [ ] 统计数据正确性
  - [ ] 图表渲染正常
  - [ ] 趋势分析准确
  - [ ] 不同维度切换功能

### 2.4 质检详情页 ⏸️
- **文件**: `QualityInspectionDetailScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/quality/inspections/{inspectionId}`
- **优先级**: P2
- **预计时间**: 1.5小时
- **任务内容**:
  1. 新建详情页面
  2. 集成详情数据加载
  3. 显示质检图片
  4. 显示GPS位置（地图）
  5. 添加编辑/删除功能（仅限质检员和管理员）
- **测试要点**:
  - [ ] 详情数据完整显示
  - [ ] 图片正常加载
  - [ ] 权限控制正确

---

## 💰 Phase 3: 成本分析集成 (Cost Analysis - 5 tasks)

### 3.1 批次成本分析 ⏸️
- **文件**: `CostAnalysisDashboard.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/batches/{batchId}/cost-analysis`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 集成批次成本详细分析API
  2. 显示成本构成饼图（原料/人工/设备/其他）
  3. 显示成本明细列表
  4. 添加成本对比功能（计划vs实际）
  5. 实现导出成本报表
- **测试要点**:
  - [ ] 成本数据准确性
  - [ ] 饼图显示正确
  - [ ] 明细列表完整
  - [ ] 导出功能正常

### 3.2 AI批次成本分析 ⏸️
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **后端API**: `POST /api/mobile/{factoryId}/ai/analysis/cost/batch`
- **优先级**: P1
- **预计时间**: 3小时
- **任务内容**:
  1. 创建 `aiApiClient.ts`
  2. 集成AI批次成本分析API
  3. 显示AI分析结果（成本优化建议）
  4. 添加成本异常检测
  5. 实现分析历史记录
  6. 显示AI配额使用情况
- **测试要点**:
  - [ ] AI分析请求成功
  - [ ] 分析结果正确显示
  - [ ] 配额监控正常
  - [ ] 历史记录可查看

### 3.3 AI时间范围成本分析 ⏸️
- **文件**: `CostComparisonScreen.tsx`
- **后端API**: `POST /api/mobile/{factoryId}/ai/analysis/cost/time-range`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 集成时间范围成本分析API
  2. 实现日期范围选择器
  3. 显示成本趋势图表
  4. 添加成本异常标注
  5. 实现导出分析报告
- **测试要点**:
  - [ ] 日期选择功能
  - [ ] 趋势图表准确
  - [ ] 异常标注正确

### 3.4 AI批次对比分析 ⏸️
- **文件**: `CostComparisonScreen.tsx`
- **后端API**: `POST /api/mobile/{factoryId}/ai/analysis/cost/compare`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 集成批次对比分析API
  2. 实现多批次选择器（最多5个）
  3. 显示对比图表（柱状图/雷达图）
  4. 添加成本差异分析
  5. 实现最优批次推荐
- **测试要点**:
  - [ ] 批次选择功能
  - [ ] 对比图表显示
  - [ ] 差异分析准确

### 3.5 成本重算功能 ⏸️
- **文件**: `BatchDetailScreen.tsx`
- **后端API**: `POST /api/mobile/{factoryId}/batches/{batchId}/recalculate-cost`
- **优先级**: P2
- **预计时间**: 1小时
- **任务内容**:
  1. 添加"重新计算成本"按钮
  2. 集成成本重算API
  3. 显示重算进度
  4. 对比重算前后差异
- **测试要点**:
  - [ ] 重算功能正常
  - [ ] 进度显示正确
  - [ ] 差异对比准确

---

## 🤖 Phase 4: AI 分析功能集成 (DeepSeek AI - 6 tasks)

### 4.1 AI 服务初始化 ⏸️
- **文件**: `src/services/api/aiApiClient.ts`
- **后端API**: `GET /api/mobile/{factoryId}/ai/health`
- **优先级**: P1
- **预计时间**: 1.5小时
- **任务内容**:
  1. 创建 AI API 客户端
  2. 实现健康检查
  3. 配置请求拦截器
  4. 实现错误处理
  5. 添加配额监控
- **测试要点**:
  - [ ] API客户端正常工作
  - [ ] 健康检查成功
  - [ ] 错误处理正确

### 4.2 AI 配额管理 ⏸️
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **后端API**:
  - `GET /api/mobile/{factoryId}/ai/quota`
  - `PUT /api/mobile/{factoryId}/ai/quota`
- **优先级**: P2
- **预计时间**: 1.5小时
- **任务内容**:
  1. 显示当前配额使用情况
  2. 添加配额警告提示
  3. 实现配额调整功能（管理员）
  4. 显示配额历史记录
- **测试要点**:
  - [ ] 配额显示准确
  - [ ] 警告提示正常
  - [ ] 权限控制正确

### 4.3 AI 对话功能 ⏸️
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/ai/conversations/{sessionId}`
- **优先级**: P2
- **预计时间**: 2.5小时
- **任务内容**:
  1. 实现对话界面
  2. 集成对话历史API
  3. 添加消息发送功能
  4. 实现流式响应显示
  5. 添加会话管理
- **测试要点**:
  - [ ] 对话界面流畅
  - [ ] 历史记录正确
  - [ ] 流式响应显示

### 4.4 AI 报告生成 ⏸️
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **后端API**:
  - `POST /api/mobile/{factoryId}/ai/reports/generate`
  - `GET /api/mobile/{factoryId}/ai/reports`
  - `GET /api/mobile/{factoryId}/ai/reports/{reportId}`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 实现报告生成请求
  2. 显示生成进度
  3. 集成报告列表
  4. 实现报告详情查看
  5. 添加报告导出功能
- **测试要点**:
  - [ ] 报告生成成功
  - [ ] 进度显示正确
  - [ ] 报告内容完整

### 4.5 AI 会话管理 ⏸️
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **后端API**: `DELETE /api/mobile/{factoryId}/ai/conversations/{sessionId}`
- **优先级**: P3
- **预计时间**: 1小时
- **任务内容**:
  1. 实现会话关闭功能
  2. 添加会话列表
  3. 实现会话切换
  4. 添加会话重命名
- **测试要点**:
  - [ ] 会话关闭正常
  - [ ] 会话切换流畅

### 4.6 AI 功能集成测试 ⏸️
- **测试范围**: 所有AI相关功能
- **优先级**: P1
- **预计时间**: 2小时
- **测试内容**:
  1. 配额监控准确性
  2. 分析请求响应时间
  3. 报告生成完整性
  4. 错误处理机制
  5. 成本控制效果（目标 <¥30/月）
- **测试要点**:
  - [ ] 所有AI功能正常
  - [ ] 配额控制有效
  - [ ] 成本在预算内
  - [ ] 用户体验流畅

---

## 📈 Phase 5: 报表分析功能集成 (Reports - 10 tasks)

### 5.1 报表仪表盘 ⏸️
- **文件**: 新建 `ReportDashboardScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/dashboard`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 创建报表仪表盘页面
  2. 集成综合统计数据
  3. 显示关键指标卡片
  4. 添加快捷导航
- **测试要点**:
  - [ ] 数据加载正确
  - [ ] 卡片显示完整
  - [ ] 导航功能正常

### 5.2 生产报表 ⏸️
- **文件**: 新建 `ProductionReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/production`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 创建生产报表页面
  2. 集成生产数据API
  3. 显示产量趋势图
  4. 添加产品类型筛选
  5. 实现日期范围筛选
- **测试要点**:
  - [ ] 报表数据准确
  - [ ] 图表显示正常
  - [ ] 筛选功能有效

### 5.3 质量报表 ⏸️
- **文件**: 新建 `QualityReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/quality`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 创建质量报表页面
  2. 集成质量数据API
  3. 显示合格率趋势
  4. 添加不合格原因分析
- **测试要点**:
  - [ ] 质量数据准确
  - [ ] 趋势分析正确

### 5.4 成本分析报表 ⏸️
- **文件**: 新建 `CostAnalysisReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/cost-analysis`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 创建成本分析报表页面
  2. 集成成本数据API
  3. 显示成本构成分析
  4. 添加成本趋势图
  5. 实现成本异常检测
- **测试要点**:
  - [ ] 成本数据准确
  - [ ] 异常检测有效

### 5.5 效率分析报表 ⏸️
- **文件**: 新建 `EfficiencyReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/efficiency-analysis`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 创建效率分析报表页面
  2. 集成效率数据API
  3. 显示生产效率指标
  4. 添加设备利用率分析
- **测试要点**:
  - [ ] 效率指标准确
  - [ ] 分析图表正确

### 5.6 趋势分析报表 ⏸️
- **文件**: 新建 `TrendAnalysisScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/trend-analysis`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 创建趋势分析页面
  2. 集成趋势数据API
  3. 显示多维度趋势图
  4. 添加同比/环比分析
- **测试要点**:
  - [ ] 趋势分析准确
  - [ ] 对比数据正确

### 5.7 KPI 指标报表 ⏸️
- **文件**: 新建 `KPIReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/kpi`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 创建KPI指标页面
  2. 集成KPI数据API
  3. 显示关键绩效指标
  4. 添加目标达成率
  5. 实现KPI趋势图
- **测试要点**:
  - [ ] KPI数据准确
  - [ ] 达成率计算正确

### 5.8 预测报表 ⏸️
- **文件**: 新建 `ForecastReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/forecast`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 创建预测报表页面
  2. 集成预测数据API
  3. 显示产量预测
  4. 添加成本预测
  5. 实现置信区间显示
- **测试要点**:
  - [ ] 预测数据合理
  - [ ] 置信区间正确

### 5.9 异常报告 ⏸️
- **文件**: 新建 `AnomalyReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/anomalies`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 创建异常报告页面
  2. 集成异常数据API
  3. 显示异常事件列表
  4. 添加异常类型筛选
  5. 实现异常处理跟踪
- **测试要点**:
  - [ ] 异常检测准确
  - [ ] 筛选功能有效

### 5.10 实时报表 ⏸️
- **文件**: 新建 `RealtimeReportScreen.tsx`
- **后端API**: `GET /api/mobile/{factoryId}/reports/realtime`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 创建实时报表页面
  2. 集成实时数据API
  3. 实现定时刷新（5秒）
  4. 显示实时生产状态
  5. 添加实时告警提示
- **测试要点**:
  - [ ] 数据实时更新
  - [ ] 刷新机制正常
  - [ ] 告警提示及时

---

## ⚙️ Phase 6: 设备管理增强集成 (Equipment - 6 tasks)

### 6.1 设备详情增强 ⏸️
- **文件**: `EquipmentDetailScreen.tsx`
- **后端API**:
  - `GET /equipment/{equipmentId}/statistics`
  - `GET /equipment/{equipmentId}/usage-history`
  - `GET /equipment/{equipmentId}/maintenance-history`
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 集成设备统计API
  2. 显示使用历史
  3. 显示维护历史
  4. 添加数据可视化图表
- **测试要点**:
  - [ ] 统计数据准确
  - [ ] 历史记录完整

### 6.2 设备 OEE 分析 ⏸️
- **文件**: `EquipmentDetailScreen.tsx`
- **后端API**: `GET /equipment/{equipmentId}/oee`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 集成OEE计算API
  2. 显示OEE指标（可用率/性能率/质量率）
  3. 添加OEE趋势图
  4. 实现与行业标准对比
- **测试要点**:
  - [ ] OEE计算准确
  - [ ] 趋势图显示正确

### 6.3 设备效率报告 ⏸️
- **文件**: `EquipmentDetailScreen.tsx`
- **后端API**: `GET /equipment/{equipmentId}/efficiency-report`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 集成效率报告API
  2. 显示效率分析
  3. 添加优化建议
  4. 实现导出功能
- **测试要点**:
  - [ ] 效率分析准确
  - [ ] 建议合理

### 6.4 设备折旧价值 ⏸️
- **文件**: `EquipmentDetailScreen.tsx`
- **后端API**: `GET /equipment/{equipmentId}/depreciated-value`
- **优先级**: P1
- **预计时间**: 1.5小时
- **任务内容**:
  1. 集成折旧计算API
  2. 显示当前折旧价值
  3. 添加折旧曲线图
  4. 实现残值预测
- **测试要点**:
  - [ ] 折旧计算正确
  - [ ] 曲线图准确

### 6.5 设备维护管理 ⏸️
- **文件**: `EquipmentMonitoringScreen.tsx`
- **后端API**: `POST /equipment/{equipmentId}/maintenance`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 集成维护记录API
  2. 实现维护表单
  3. 添加维护提醒
  4. 实现维护计划管理
- **测试要点**:
  - [ ] 维护记录保存成功
  - [ ] 提醒功能正常

### 6.6 设备总体统计 ⏸️
- **文件**: `EquipmentMonitoringScreen.tsx`
- **后端API**: `GET /equipment/overall-statistics`
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 集成总体统计API
  2. 显示设备运行状态
  3. 添加设备健康度分析
  4. 实现设备排名
- **测试要点**:
  - [ ] 统计数据全面
  - [ ] 健康度分析准确

---

## 🚀 Phase 7: 功能增强与优化 (Enhancement - 4 tasks)

### 7.1 GPS 定位集成 ⏸️
- **依赖**: expo-location
- **优先级**: P1
- **预计时间**: 2小时
- **任务内容**:
  1. 安装 expo-location
  2. 请求位置权限
  3. 实现实时定位
  4. 集成到打卡功能
  5. 集成到质检功能
- **测试要点**:
  - [ ] 权限请求正常
  - [ ] 定位功能准确
  - [ ] 位置数据保存成功

### 7.2 图片上传集成 ⏸️
- **依赖**: expo-image-picker
- **优先级**: P1
- **预计时间**: 2.5小时
- **任务内容**:
  1. 安装 expo-image-picker
  2. 实现图片选择功能
  3. 添加图片压缩
  4. 集成到质检功能
  5. 实现图片预览
- **测试要点**:
  - [ ] 图片选择功能正常
  - [ ] 压缩算法有效
  - [ ] 上传成功

### 7.3 修改密码功能 ⏸️
- **文件**: `ProfileScreen.tsx` 或新建 `ChangePasswordScreen.tsx`
- **后端API**: `POST /api/mobile/auth/change-password`
- **优先级**: P1
- **预计时间**: 1.5小时
- **任务内容**:
  1. 创建修改密码表单
  2. 集成修改密码API
  3. 实现密码强度验证
  4. 添加确认密码验证
  5. 修改成功后自动登出
- **测试要点**:
  - [ ] 表单验证正确
  - [ ] 密码修改成功
  - [ ] 自动登出功能

### 7.4 忘记密码功能 ⚠️
- **文件**: `ForgotPasswordScreen.tsx`
- **后端API**: `POST /api/mobile/auth/forgot-password` ❌ **需后端实现**
- **优先级**: P1
- **预计时间**: 3小时（前端2小时 + 后端1小时）
- **任务内容**:
  1. **后端实现**:
     - 集成短信验证码服务
     - 实现验证码发送API
     - 实现验证码验证和密码重置API
  2. **前端实现**:
     - 创建忘记密码页面
     - 实现手机号验证
     - 集成验证码发送
     - 实现密码重置流程
- **测试要点**:
  - [ ] 短信发送成功
  - [ ] 验证码验证正确
  - [ ] 密码重置成功

---

## ⚠️ 需要后端实现的功能 (Backend Implementation Needed - 4 tasks)

### B.1 设备告警确认 API ⏸️
- **端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge`
- **优先级**: P1
- **预计时间**: 1小时
- **请求参数**:
  ```json
  {
    "acknowledgedBy": "userId",
    "notes": "确认备注"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "alertId": "xxx",
      "status": "acknowledged",
      "acknowledgedAt": "2025-11-19T10:00:00Z"
    }
  }
  ```

### B.2 设备告警解决 API ⏸️
- **端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve`
- **优先级**: P1
- **预计时间**: 1小时
- **请求参数**:
  ```json
  {
    "resolvedBy": "userId",
    "solution": "解决方案描述",
    "notes": "备注"
  }
  ```
- **响应**:
  ```json
  {
    "success": true,
    "data": {
      "alertId": "xxx",
      "status": "resolved",
      "resolvedAt": "2025-11-19T11:00:00Z"
    }
  }
  ```

### B.3 忘记密码 API ⏸️
- **端点**: `POST /api/mobile/auth/forgot-password`
- **优先级**: P1
- **预计时间**: 2小时
- **步骤**:
  1. 发送验证码: `POST /auth/send-verification-code`
  2. 验证并重置: `POST /auth/reset-password-with-code`
- **请求参数**:
  ```json
  {
    "phone": "13800138000",
    "verificationCode": "123456",
    "newPassword": "newPassword123"
  }
  ```

### B.4 第三方登录 API ⏸️
- **端点**: `POST /api/mobile/auth/oauth/{provider}`
- **优先级**: P3（可选）
- **预计时间**: 4小时
- **支持平台**: 微信、支付宝
- **说明**: 低优先级，可延后实现

---

## 🧪 测试阶段 (Testing Phase)

### T.1 单元测试 ⏸️
- **优先级**: P2
- **预计时间**: 4小时
- **测试内容**:
  - [ ] API 客户端测试
  - [ ] 数据转换函数测试
  - [ ] 状态管理测试
  - [ ] 工具函数测试
- **覆盖率目标**: >70%

### T.2 集成测试 ⏸️
- **优先级**: P1
- **预计时间**: 6小时
- **测试内容**:
  - [ ] 用户登录流程
  - [ ] 打卡完整流程
  - [ ] 质检记录提交流程
  - [ ] 成本分析查看流程
  - [ ] AI分析请求流程
  - [ ] 报表导出流程

### T.3 端到端测试 ⏸️
- **优先级**: P1
- **预计时间**: 8小时
- **测试场景**:
  1. **生产批次全流程**:
     - 创建批次 → 开始生产 → 原料消耗 → 质检 → 完成 → 成本分析
  2. **考勤完整流程**:
     - 上班打卡 → 休息 → 下班打卡 → 查看历史 → 统计分析
  3. **设备管理流程**:
     - 设备监控 → 发现告警 → 确认告警 → 维护记录 → 解决告警
  4. **报表分析流程**:
     - 选择报表类型 → 设置筛选条件 → 查看分析 → 导出报表

### T.4 性能测试 ⏸️
- **优先级**: P2
- **预计时间**: 3小时
- **测试指标**:
  - [ ] 页面加载时间 <2秒
  - [ ] API响应时间 <1秒
  - [ ] 列表滚动流畅度 >60fps
  - [ ] 内存使用 <200MB
  - [ ] 图表渲染时间 <500ms

### T.5 用户验收测试 (UAT) ⏸️
- **优先级**: P1
- **预计时间**: 4小时
- **测试人员**: 实际用户（质检员、生产主管、管理员）
- **测试内容**:
  - [ ] 功能完整性
  - [ ] 操作流畅度
  - [ ] 界面友好度
  - [ ] 错误处理合理性
  - [ ] 收集改进建议

---

## 📝 文档任务 (Documentation)

### D.1 API 集成文档 ⏸️
- **文件**: `API_INTEGRATION_GUIDE.md`
- **优先级**: P2
- **预计时间**: 2小时
- **内容**:
  - 所有已集成API列表
  - API调用示例
  - 错误处理指南
  - 常见问题FAQ

### D.2 功能缺失报告 ⏸️
- **文件**: `FEATURE_GAP_REPORT.md`
- **优先级**: P1
- **预计时间**: 1.5小时
- **内容**:
  - 前端独立实现功能清单
  - 后端独立实现功能清单
  - 需要协同开发功能清单
  - 优先级排序和时间估算

### D.3 测试报告 ⏸️
- **文件**: `TEST_REPORT.md`
- **优先级**: P1
- **预计时间**: 2小时
- **内容**:
  - 测试覆盖率统计
  - 发现的问题列表
  - 已修复问题记录
  - 性能测试结果
  - UAT反馈总结

---

## 📅 时间估算总览

| 阶段 | 任务数 | 预计时间 | 占比 |
|------|--------|---------|------|
| Phase 1 (已完成) | 6 | 已完成 | - |
| Phase 2 (质检) | 4 | 7.5小时 | 8% |
| Phase 3 (成本) | 5 | 12小时 | 13% |
| Phase 4 (AI) | 6 | 11小时 | 12% |
| Phase 5 (报表) | 10 | 23小时 | 25% |
| Phase 6 (设备) | 6 | 12小时 | 13% |
| Phase 7 (增强) | 4 | 9小时 | 10% |
| 后端实现 | 4 | 9小时 | 10% |
| 测试阶段 | 5 | 25小时 | 27% |
| 文档任务 | 3 | 5.5小时 | 6% |
| **总计** | **47** | **~93小时** | **100%** |

**工作日估算** (按每天6小时有效工作时间): **~15.5天**

---

## 🎯 下一步行动建议

### 立即开始 (今天)
1. **质检管理集成** (Phase 2) - 7.5小时
   - 创建质检API客户端
   - 集成质检记录列表
   - 集成质检统计分析

### 本周完成 (Week 1)
2. **成本分析集成** (Phase 3) - 12小时
3. **AI分析集成** (Phase 4) - 11小时

### 下周完成 (Week 2)
4. **报表功能集成** (Phase 5) - 23小时

### 第三周完成 (Week 3)
5. **设备管理增强** (Phase 6) - 12小时
6. **功能增强** (Phase 7) - 9小时

### 第四周完成 (Week 4)
7. **后端补充开发** - 9小时
8. **全面测试** - 25小时
9. **文档编写** - 5.5小时

---

**TODO List 结束**
