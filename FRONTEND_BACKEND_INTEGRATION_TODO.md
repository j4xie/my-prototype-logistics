# 前后端集成 TODO 清单（按执行顺序）
## Frontend-Backend Integration TODO List (Execution Order)

**生成时间**: 2025-11-19
**总任务数**: 42个
**策略**: 先完成所有前端集成 → 补充后端缺失API → 全面测试 → 文档输出

---

## 📊 进度总览

| 阶段 | 任务数 | 预计时间 | 状态 |
|------|--------|---------|------|
| ✅ **已完成** | 4 | - | 100% |
| 🔥 **Phase 1: P1质检管理** | 4 | 7.5h | 待开始 |
| 🔥 **Phase 2: P1成本分析** | 3 | 9h | 待开始 |
| 🔥 **Phase 3: P1 AI分析** | 2 | 5h | 待开始 |
| 🔥 **Phase 4: P1报表功能** | 2 | 6h | 待开始 |
| 🔥 **Phase 5: P1设备管理** | 4 | 8h | 待开始 |
| 🔥 **Phase 6: P1考勤工时** | 2 | 5h | 待开始 |
| 🔥 **Phase 7: P1库存管理** | 2 | 4h | 待开始 |
| ⚡ **Phase 8: P2功能增强** | 4 | 7h | 待开始 |
| ⚡ **Phase 9: P2其他集成** | 2 | 4h | 待开始 |
| 🔧 **Phase 10: P3辅助功能** | 2 | 3h | 待开始 |
| 🛠️ **Phase 11: 后端补充** | 4 | 9h | 待开始 |
| 🧪 **Phase 12: 测试阶段** | 5 | 25h | 待开始 |
| 📝 **Phase 13: 文档输出** | 3 | 5.5h | 待开始 |
| **总计** | **42** | **~98小时** | **9.5%** |

**预计完成时间**: 16-17个工作日（按每天6小时）

---

## ✅ 已完成 (Completed - 4 tasks)

### ✅ 1. Excel/PDF报表导出功能集成
- **文件**: `DataExportScreen.tsx`
- **API**: `GET /reports/export/excel`, `GET /reports/export/pdf`
- **状态**: ✅ 完成

### ✅ 2. 考勤历史查询API集成
- **文件**: `AttendanceHistoryScreen.tsx`
- **API**: `GET /timeclock/history`
- **状态**: ✅ 完成

### ✅ 3. 设备告警获取API集成
- **文件**: `EquipmentAlertsScreen.tsx`
- **API**: `GET /equipment/needing-maintenance`, `GET /equipment/expiring-warranty`
- **状态**: ✅ 完成（确认/解决需后端支持）

### ✅ 4. 库存盘点API集成
- **文件**: `InventoryCheckScreen.tsx`
- **API**: `GET /material-batches/status/available`, `POST /material-batches/{id}/adjust`
- **状态**: ✅ 完成

---

## 🔥 Phase 1: P1质检管理集成 (Quality - 4 tasks, 7.5h)

### 📋 1.1 创建质检API客户端并集成4个API
- **文件**: `src/services/api/qualityInspectionApiClient.ts` ✨ **新建**
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `POST /api/mobile/{factoryId}/quality/inspections` - 提交质检记录
  - `GET /api/mobile/{factoryId}/quality/inspections` - 获取质检记录列表
  - `GET /api/mobile/{factoryId}/quality/statistics` - 质量统计数据
  - `GET /api/mobile/{factoryId}/quality/trends` - 质量趋势分析
- **实现内容**:
  ```typescript
  // 创建 qualityInspectionApiClient.ts
  export interface QualityInspection {
    id: string;
    batchId: string;
    inspectorId: number;
    inspectionDate: string;
    result: 'pass' | 'fail';
    qualityGrade?: string;
    defectType?: string;
    notes?: string;
    images?: string[];
  }

  class QualityInspectionApiClient {
    private basePath = '/api/mobile/{factoryId}/quality';

    async submitInspection(data: any, factoryId: string) { }
    async getInspections(params: any, factoryId: string) { }
    async getStatistics(params: any, factoryId: string) { }
    async getTrends(params: any, factoryId: string) { }
  }
  ```

### 📋 1.2 集成质检记录列表
- **文件**: `QualityInspectionListScreen.tsx`
- **优先级**: P1
- **预计时间**: 1.5小时
- **集成内容**:
  - 调用 `qualityInspectionApiClient.getInspections()`
  - 显示质检记录列表（批次号、检验结果、日期）
  - 实现分页加载
  - 添加日期筛选器
  - 添加结果筛选（全部/合格/不合格）
  - 点击跳转详情页

### 📋 1.3 集成质检统计分析
- **文件**: `QualityAnalyticsScreen.tsx`
- **优先级**: P1
- **预计时间**: 2.5小时
- **集成内容**:
  - 调用 `qualityInspectionApiClient.getStatistics()`
  - 显示合格率卡片
  - 调用 `qualityInspectionApiClient.getTrends()`
  - 显示质量趋势图表（使用 react-native-chart-kit）
  - 按产品类型统计
  - 按时间维度统计（日/周/月切换）

### 📋 1.4 集成质检记录提交
- **文件**: `CreateQualityRecordScreen.tsx`
- **优先级**: P1
- **预计时间**: 1.5小时
- **集成内容**:
  - 调用 `qualityInspectionApiClient.submitInspection()`
  - 实现质检表单（批次选择、检验结果、缺陷类型、备注）
  - 集成图片上传（依赖 expo-image-picker，Phase 8实现）
  - 集成GPS定位（依赖 expo-location，Phase 8实现）
  - 提交成功后跳转到列表页

**Phase 1 总计**: 4个任务，7.5小时

---

## 🔥 Phase 2: P1成本分析集成 (Cost - 3 tasks, 9h)

### 📋 2.1 集成批次成本分析API
- **文件**: `CostAnalysisDashboard.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**: `GET /api/mobile/{factoryId}/batches/{batchId}/cost-analysis`
- **集成内容**:
  - 调用 `processingApiClient.getBatchCostAnalysis(batchId)`
  - 显示成本构成饼图（原料/人工/设备/其他）
  - 显示成本明细列表
  - 对比计划成本 vs 实际成本
  - 实现成本报表导出

### 📋 2.2 创建AI API客户端并集成AI成本分析3个核心API
- **文件**: `src/services/api/aiApiClient.ts` ✨ **新建**
- **优先级**: P1
- **预计时间**: 3小时
- **后端API**:
  - `POST /api/mobile/{factoryId}/ai/analysis/cost/batch` - AI单批次成本分析
  - `POST /api/mobile/{factoryId}/ai/analysis/cost/time-range` - AI时间范围成本分析
  - `POST /api/mobile/{factoryId}/ai/analysis/cost/compare` - AI批次对比分析
  - `GET /api/mobile/{factoryId}/ai/quota` - 查询AI配额
  - `GET /api/mobile/{factoryId}/ai/health` - AI服务健康检查
- **实现内容**:
  ```typescript
  // 创建 aiApiClient.ts
  export interface AIAnalysisRequest {
    batchId?: string;
    startDate?: string;
    endDate?: string;
    batchIds?: string[];
  }

  export interface AIAnalysisResult {
    summary: string;
    insights: string[];
    recommendations: string[];
    costBreakdown: any;
    abnormalities: any[];
  }

  class AIApiClient {
    private basePath = '/api/mobile/{factoryId}/ai';

    async analyzeBatchCost(batchId: string, factoryId: string) { }
    async analyzeTimeRangeCost(params: any, factoryId: string) { }
    async compareBatches(batchIds: string[], factoryId: string) { }
    async getQuota(factoryId: string) { }
    async checkHealth(factoryId: string) { }
  }
  ```

### 📋 2.3 集成成本对比功能
- **文件**: `CostComparisonScreen.tsx`
- **优先级**: P1
- **预计时间**: 4小时
- **集成内容**:
  - 调用 `aiApiClient.analyzeTimeRangeCost()`
  - 实现日期范围选择器
  - 显示成本趋势图表
  - 调用 `aiApiClient.compareBatches()`
  - 实现多批次选择器（最多5个）
  - 显示批次对比图表（柱状图/雷达图）
  - 显示AI分析建议
  - 标注成本异常点

**Phase 2 总计**: 3个任务，9小时

---

## 🔥 Phase 3: P1 AI分析集成 (DeepSeek - 2 tasks, 5h)

### 📋 3.1 集成DeepSeek AI分析功能
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **优先级**: P1
- **预计时间**: 3小时
- **集成内容**:
  - 调用 `aiApiClient.analyzeBatchCost()` - 单批次AI分析
  - 显示AI分析结果（成本优化建议）
  - 调用 `aiApiClient.getQuota()` - 配额监控
  - 显示AI配额使用情况（进度条）
  - 实现分析历史记录列表
  - 添加"重新分析"功能
  - 实现AI健康检查提示

### 📋 3.2 集成AI配额管理和报告生成功能
- **文件**: `DeepSeekAnalysisScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `POST /api/mobile/{factoryId}/ai/reports/generate` - 生成AI报告
  - `GET /api/mobile/{factoryId}/ai/reports` - 获取报告列表
  - `GET /api/mobile/{factoryId}/ai/reports/{reportId}` - 获取报告详情
- **集成内容**:
  - 实现报告生成请求
  - 显示生成进度
  - 集成报告列表
  - 实现报告详情查看
  - 添加报告导出功能
  - 配额警告提示（低于20%时）

**Phase 3 总计**: 2个任务，5小时

---

## 🔥 Phase 4: P1报表功能集成 (Reports - 2 tasks, 6h)

### 📋 4.1 创建9个核心报表页面
- **文件**: ✨ **新建9个文件**
  - `ReportDashboardScreen.tsx` - 报表仪表盘
  - `ProductionReportScreen.tsx` - 生产报表
  - `QualityReportScreen.tsx` - 质量报表
  - `CostAnalysisReportScreen.tsx` - 成本分析报表
  - `EfficiencyReportScreen.tsx` - 效率分析报表
  - `TrendAnalysisScreen.tsx` - 趋势分析报表
  - `KPIReportScreen.tsx` - KPI指标报表
  - `ForecastReportScreen.tsx` - 预测报表
  - `AnomalyReportScreen.tsx` - 异常报告
  - `RealtimeReportScreen.tsx` - 实时报表
- **优先级**: P1
- **预计时间**: 4小时（9个页面框架，每个30分钟）
- **实现内容**: 创建基础页面结构和导航

### 📋 4.2 集成报表仪表盘API
- **文件**: `ReportDashboardScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /api/mobile/{factoryId}/reports/dashboard` - 综合统计
  - `GET /api/mobile/{factoryId}/reports/production` - 生产报表
  - `GET /api/mobile/{factoryId}/reports/quality` - 质量报表
  - `GET /api/mobile/{factoryId}/reports/cost-analysis` - 成本分析
  - `GET /api/mobile/{factoryId}/reports/efficiency-analysis` - 效率分析
  - `GET /api/mobile/{factoryId}/reports/trend-analysis` - 趋势分析
  - `GET /api/mobile/{factoryId}/reports/kpi` - KPI指标
  - `GET /api/mobile/{factoryId}/reports/forecast` - 预测数据
  - `GET /api/mobile/{factoryId}/reports/anomalies` - 异常检测
  - `GET /api/mobile/{factoryId}/reports/realtime` - 实时数据
- **集成内容**:
  - 创建 `reportApiClient.ts`
  - 集成各报表API到对应页面
  - 实现图表可视化（react-native-chart-kit）
  - 添加日期范围筛选
  - 实现报表刷新功能

**Phase 4 总计**: 2个任务，6小时

---

## 🔥 Phase 5: P1设备管理集成 (Equipment - 4 tasks, 8h)

### 📋 5.1 集成设备OEE分析
- **文件**: `EquipmentDetailScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**: `GET /api/mobile/{factoryId}/equipment/{equipmentId}/oee`
- **集成内容**:
  - 调用 `equipmentApiClient.calculateOEE(equipmentId)`
  - 显示OEE三大指标（可用率、性能率、质量率）
  - 显示OEE趋势图
  - 实现与行业标准对比
  - 添加OEE优化建议

### 📋 5.2 集成设备效率报告和折旧价值API
- **文件**: `EquipmentDetailScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /equipment/{equipmentId}/efficiency-report` - 效率报告
  - `GET /equipment/{equipmentId}/depreciated-value` - 折旧价值
- **集成内容**:
  - 调用效率报告API，显示效率分析
  - 调用折旧价值API，显示当前价值
  - 显示折旧曲线图
  - 实现残值预测

### 📋 5.3 集成设备统计、历史、维护API
- **文件**: `EquipmentDetailScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /equipment/{equipmentId}/statistics` - 设备统计
  - `GET /equipment/{equipmentId}/usage-history` - 使用历史
  - `GET /equipment/{equipmentId}/maintenance-history` - 维护历史
- **集成内容**:
  - 显示设备运行统计数据
  - 显示使用历史时间轴
  - 显示维护记录列表
  - 添加维护计划提醒

### 📋 5.4 集成设备总体统计API
- **文件**: `EquipmentMonitoringScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /equipment/overall-statistics` - 工厂设备总体统计
  - `POST /equipment/{equipmentId}/maintenance` - 记录维护
- **集成内容**:
  - 显示设备运行状态（运行中/停机/维护中）
  - 显示设备健康度分析
  - 实现设备排名（按OEE、利用率）
  - 集成维护记录提交功能

**Phase 5 总计**: 4个任务，8小时

---

## 🔥 Phase 6: P1考勤工时集成 (Attendance - 2 tasks, 5h)

### 📋 6.1 集成工时统计API - 日/周/月统计
- **文件**: ✨ **新建** `TimeStatsScreen.tsx`
- **优先级**: P1
- **预计时间**: 3小时
- **后端API**:
  - `GET /time-stats/daily` - 日统计
  - `GET /time-stats/daily/range` - 日期范围统计
  - `GET /time-stats/weekly` - 周统计
  - `GET /time-stats/monthly` - 月统计
  - `GET /time-stats/by-work-type` - 按工种统计
  - `GET /time-stats/by-department` - 按部门统计
  - `GET /time-stats/productivity` - 生产力分析
  - `GET /time-stats/trend` - 统计趋势
- **集成内容**:
  - 创建工时统计页面
  - 实现时间维度切换（日/周/月）
  - 显示工时统计图表
  - 按工种/部门分组显示
  - 显示生产力分析

### 📋 6.2 创建工时统计分析页面
- **文件**: `TimeStatsScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /time-stats/workers` - 员工时间统计排名
  - `GET /time-stats/workers/{workerId}` - 员工个人统计
- **集成内容**:
  - 显示员工工时排名
  - 实现员工详情查看
  - 显示个人工时趋势
  - 添加工时导出功能

**Phase 6 总计**: 2个任务，5小时

---

## 🔥 Phase 7: P1库存管理集成 (Inventory - 2 tasks, 4h)

### 📋 7.1 集成库存统计、价值、低库存警告API
- **文件**: `MaterialBatchManagementScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /material-batches/inventory/statistics` - 库存统计
  - `GET /material-batches/inventory/valuation` - 库存价值
  - `GET /material-batches/low-stock` - 低库存警告
- **集成内容**:
  - 显示库存总体统计（总量、总价值）
  - 显示低库存警告列表
  - 添加库存预警设置
  - 实现库存价值趋势图

### 📋 7.2 集成批次FIFO、过期管理、预留/消耗API
- **文件**: `MaterialBatchManagementScreen.tsx`
- **优先级**: P1
- **预计时间**: 2小时
- **后端API**:
  - `GET /material-batches/fifo/{materialTypeId}` - FIFO批次
  - `GET /material-batches/expiring` - 即将过期批次
  - `GET /material-batches/expired` - 已过期批次
  - `POST /material-batches/{batchId}/reserve` - 预留材料
  - `POST /material-batches/{batchId}/consume` - 消耗材料
  - `POST /material-batches/{batchId}/use` - 使用材料
- **集成内容**:
  - 实现FIFO批次推荐
  - 显示过期提醒
  - 集成批次预留功能
  - 集成批次消耗记录

**Phase 7 总计**: 2个任务，4小时

---

## ⚡ Phase 8: P2功能增强 (Enhancement - 4 tasks, 7h)

### 📋 8.1 安装expo-location并集成GPS定位到打卡和质检
- **优先级**: P2
- **预计时间**: 2小时
- **依赖**: expo-location
- **实现内容**:
  ```bash
  # 安装依赖
  cd frontend/CretasFoodTrace
  npx expo install expo-location
  ```
  - 请求位置权限
  - 实现实时GPS定位
  - 集成到打卡功能（`TimeClockScreen.tsx`）
  - 集成到质检功能（`CreateQualityRecordScreen.tsx`）
  - 显示定位坐标
  - 地图显示（可选）

### 📋 8.2 安装expo-image-picker并集成图片上传到质检
- **优先级**: P2
- **预计时间**: 2.5小时
- **依赖**: expo-image-picker
- **实现内容**:
  ```bash
  # 安装依赖
  npx expo install expo-image-picker
  ```
  - 请求相机和相册权限
  - 实现图片选择功能（拍照/相册）
  - 添加图片压缩（质量80%，最大宽度1920px）
  - 集成到质检功能（`CreateQualityRecordScreen.tsx`）
  - 实现多图片上传（最多5张）
  - 图片预览功能

### 📋 8.3 集成修改密码功能
- **文件**: `ProfileScreen.tsx` 或新建 `ChangePasswordScreen.tsx`
- **优先级**: P2
- **预计时间**: 1.5小时
- **后端API**: `POST /api/mobile/auth/change-password`
- **集成内容**:
  - 创建修改密码表单
  - 验证原密码
  - 密码强度验证（至少8位，包含字母和数字）
  - 确认密码验证
  - 调用 `authApiClient.changePassword()`
  - 修改成功后自动登出

### 📋 8.4 集成考勤统计、部门考勤、记录修改API
- **文件**: `AttendanceHistoryScreen.tsx`
- **优先级**: P2
- **预计时间**: 1小时
- **后端API**:
  - `GET /timeclock/statistics` - 考勤统计
  - `GET /timeclock/department/{department}` - 部门考勤
  - `PUT /timeclock/records/{recordId}` - 修改打卡记录
- **集成内容**:
  - 显示考勤统计数据
  - 查看部门考勤
  - 实现打卡记录修改（仅管理员）

**Phase 8 总计**: 4个任务，7小时

---

## ⚡ Phase 9: P2其他集成 (Other - 2 tasks, 4h)

### 📋 9.1 集成库存/财务/人员/销售报表API
- **文件**: 对应报表页面
- **优先级**: P2
- **预计时间**: 2小时
- **后端API**:
  - `GET /reports/inventory` - 库存报表
  - `GET /reports/finance` - 财务报表
  - `GET /reports/personnel` - 人员报表
  - `GET /reports/sales` - 销售报表
- **集成内容**:
  - 集成库存报表（批次、过期、周转率）
  - 集成财务报表（收入、支出、利润）
  - 集成人员报表（出勤、工时、绩效）
  - 集成销售报表（排除养殖、物流模块）

### 📋 9.2 集成其他报表分析API
- **文件**: 对应报表页面
- **优先级**: P2
- **预计时间**: 2小时
- **后端API**:
  - `GET /reports/period-comparison` - 周期对比
  - `POST /reports/custom` - 自定义报表
- **集成内容**:
  - 实现周期对比功能（本周 vs 上周，本月 vs 上月）
  - 实现自定义报表（用户选择字段和筛选条件）

**Phase 9 总计**: 2个任务，4小时

---

## 🔧 Phase 10: P3辅助功能 (Optional - 2 tasks, 3h)

### 📋 10.1 集成设备CRUD、搜索、状态管理API
- **文件**: `EquipmentMonitoringScreen.tsx`
- **优先级**: P3
- **预计时间**: 1.5小时
- **后端API**:
  - `POST /equipment` - 创建设备
  - `PUT /equipment/{equipmentId}` - 更新设备
  - `DELETE /equipment/{equipmentId}` - 删除设备
  - `GET /equipment/search` - 搜索设备
  - `PUT /equipment/{equipmentId}/status` - 更新状态
- **集成内容**:
  - 实现设备创建表单
  - 实现设备编辑功能
  - 实现设备删除功能（含确认）
  - 实现设备搜索

### 📋 10.2 集成批次CRUD、导出、批量操作API
- **文件**: `MaterialBatchManagementScreen.tsx`
- **优先级**: P3
- **预计时间**: 1.5小时
- **后端API**:
  - `POST /material-batches` - 创建批次
  - `PUT /material-batches/{batchId}` - 更新批次
  - `DELETE /material-batches/{batchId}` - 删除批次
  - `GET /material-batches/export` - 导出库存
  - `POST /material-batches/batch` - 批量创建
- **集成内容**:
  - 实现批次创建表单
  - 实现批次编辑功能
  - 实现批次删除功能
  - 实现库存导出（Excel）
  - 实现批量创建

**Phase 10 总计**: 2个任务，3小时

---

## 🛠️ Phase 11: 后端补充开发 (Backend - 4 tasks, 9h)

### 📋 11.1 实现设备告警确认API
- **端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/acknowledge`
- **优先级**: P1
- **预计时间**: 1小时
- **实现内容**:
  - 创建告警确认接口
  - 记录确认人和确认时间
  - 更新告警状态为 `acknowledged`
  - 返回更新后的告警信息

### 📋 11.2 实现设备告警解决API
- **端点**: `POST /api/mobile/{factoryId}/equipment/alerts/{alertId}/resolve`
- **优先级**: P1
- **预计时间**: 1小时
- **实现内容**:
  - 创建告警解决接口
  - 记录解决方案和解决人
  - 更新告警状态为 `resolved`
  - 记录解决时间

### 📋 11.3 实现忘记密码API + 集成短信验证码服务
- **端点**:
  - `POST /api/mobile/auth/send-verification-code`
  - `POST /api/mobile/auth/reset-password-with-code`
- **优先级**: P1
- **预计时间**: 4小时
- **实现内容**:
  - 集成短信验证码服务（阿里云短信 或 腾讯云短信）
  - 实现验证码发送API（60秒限流）
  - 实现验证码验证和密码重置API
  - 添加验证码过期机制（5分钟）
  - 添加频率限制（同一手机号10分钟内最多5次）

### 📋 11.4 前端集成忘记密码功能
- **文件**: `ForgotPasswordScreen.tsx`
- **优先级**: P1
- **预计时间**: 3小时
- **实现内容**:
  - 创建忘记密码页面
  - 实现手机号输入和验证
  - 调用发送验证码API
  - 实现验证码倒计时（60秒）
  - 实现验证码验证
  - 实现密码重置表单
  - 重置成功后跳转登录页

**Phase 11 总计**: 4个任务，9小时

---

## 🧪 Phase 12: 测试阶段 (Testing - 5 tasks, 25h)

### 📋 12.1 单元测试 - API客户端、数据转换、工具函数
- **优先级**: P2
- **预计时间**: 4小时
- **测试范围**:
  - [ ] API客户端方法测试
  - [ ] 数据转换函数测试
  - [ ] 日期格式化函数测试
  - [ ] 状态管理 (Zustand stores) 测试
  - [ ] 权限验证函数测试
- **覆盖率目标**: >70%
- **测试工具**: Jest + React Native Testing Library

### 📋 12.2 集成测试 - 登录/打卡/质检/成本/AI/报表完整流程
- **优先级**: P1
- **预计时间**: 6小时
- **测试场景**:
  1. **用户登录流程**:
     - [ ] 输入用户名密码 → 点击登录 → 验证令牌 → 跳转主页
  2. **打卡完整流程**:
     - [ ] 上班打卡 → GPS定位 → 记录保存 → 显示打卡时间
     - [ ] 下班打卡 → 计算工时 → 更新状态
  3. **质检记录提交流程**:
     - [ ] 选择批次 → 填写质检结果 → 上传图片 → GPS定位 → 提交成功
  4. **成本分析查看流程**:
     - [ ] 选择批次 → 查看成本分析 → 查看AI建议 → 导出报表
  5. **AI分析请求流程**:
     - [ ] 提交AI分析请求 → 显示进度 → 查看结果 → 保存报告
  6. **报表导出流程**:
     - [ ] 选择报表类型 → 设置日期范围 → 导出Excel → 分享文件

### 📋 12.3 端到端测试 - 生产批次/考勤/设备/报表全流程
- **优先级**: P1
- **预计时间**: 8小时
- **测试场景**:
  1. **生产批次全流程**:
     - [ ] 创建生产批次
     - [ ] 开始生产
     - [ ] 记录原料消耗
     - [ ] 提交质检记录
     - [ ] 完成生产
     - [ ] 查看成本分析
     - [ ] 请求AI优化建议
  2. **考勤完整流程**:
     - [ ] 上班打卡（GPS定位）
     - [ ] 开始休息 → 结束休息
     - [ ] 下班打卡
     - [ ] 查看今日记录
     - [ ] 查看历史记录
     - [ ] 查看统计分析
     - [ ] 导出考勤数据
  3. **设备管理流程**:
     - [ ] 查看设备列表
     - [ ] 发现设备告警
     - [ ] 确认告警
     - [ ] 记录维护
     - [ ] 解决告警
     - [ ] 查看OEE分析
  4. **报表分析流程**:
     - [ ] 进入报表仪表盘
     - [ ] 查看生产报表
     - [ ] 查看质量报表
     - [ ] 查看成本分析
     - [ ] 查看趋势预测
     - [ ] 导出综合报表

### 📋 12.4 性能测试 - 页面加载/API响应/内存/图表渲染
- **优先级**: P2
- **预计时间**: 3小时
- **测试指标**:
  - [ ] **页面加载时间** < 2秒
  - [ ] **API响应时间** < 1秒
  - [ ] **列表滚动流畅度** > 60fps
  - [ ] **内存使用** < 200MB（稳定状态）
  - [ ] **图表渲染时间** < 500ms
  - [ ] **大列表加载** (100+ 项) 流畅
- **测试工具**: Flipper, React DevTools, Chrome Performance

### 📋 12.5 用户验收测试(UAT) - 实际用户测试并收集反馈
- **优先级**: P1
- **预计时间**: 4小时
- **测试人员**: 实际用户（质检员、生产主管、设备管理员、财务人员）
- **测试内容**:
  - [ ] 功能完整性验证
  - [ ] 操作流畅度评估
  - [ ] 界面友好度评分
  - [ ] 错误处理合理性
  - [ ] 收集改进建议
  - [ ] 记录用户痛点
- **输出**: UAT测试报告 + 改进建议清单

**Phase 12 总计**: 5个任务，25小时

---

## 📝 Phase 13: 文档输出 (Documentation - 3 tasks, 5.5h)

### 📋 13.1 生成API集成文档
- **文件**: `API_INTEGRATION_GUIDE.md`
- **优先级**: P2
- **预计时间**: 2小时
- **内容**:
  - 所有已集成API列表（126个）
  - 每个API的调用示例
  - 请求/响应格式说明
  - 错误处理指南
  - 常见问题FAQ
  - API版本管理说明

### 📋 13.2 生成功能缺失报告
- **文件**: `FEATURE_GAP_REPORT.md`
- **优先级**: P1
- **预计时间**: 1.5小时
- **内容**:
  - **前端独立实现功能清单**（不需要后端）
  - **后端独立实现功能清单**（不需要前端）
  - **需要协同开发功能清单**
  - 优先级排序和时间估算
  - 技术难点分析
  - 资源需求评估

### 📋 13.3 生成最终测试报告
- **文件**: `TEST_REPORT.md`
- **优先级**: P1
- **预计时间**: 2小时
- **内容**:
  - 测试覆盖率统计
  - 发现的问题列表（含严重程度）
  - 已修复问题记录
  - 性能测试结果
  - UAT反馈总结
  - 遗留问题清单
  - 建议优化方向

**Phase 13 总计**: 3个任务，5.5小时

---

## 📅 执行时间表

### Week 1 (40h) - P1核心功能集成
- **Day 1-2** (12h): Phase 1 质检管理 (7.5h) + Phase 2 成本分析 (4.5h)
- **Day 3** (6h): Phase 2 成本分析完成 (4.5h) + Phase 3 AI分析开始 (1.5h)
- **Day 4** (6h): Phase 3 AI分析完成 (3.5h) + Phase 4 报表功能开始 (2.5h)
- **Day 5** (6h): Phase 4 报表功能完成 (3.5h) + Phase 5 设备管理开始 (2.5h)
- **Day 6** (6h): Phase 5 设备管理完成 (5.5h) + Phase 6 考勤工时开始 (0.5h)
- **Weekend**: 休息或补充开发

### Week 2 (30h) - P2功能增强 + P3辅助功能
- **Day 7** (6h): Phase 6 考勤工时完成 (4.5h) + Phase 7 库存管理 (1.5h)
- **Day 8** (6h): Phase 7 库存管理完成 (2.5h) + Phase 8 功能增强开始 (3.5h)
- **Day 9** (6h): Phase 8 功能增强完成 (3.5h) + Phase 9 其他集成 (2.5h)
- **Day 10** (6h): Phase 9 其他集成完成 (1.5h) + Phase 10 辅助功能 (3h) + 集成测试开始 (1.5h)
- **Day 11** (6h): Phase 11 后端补充开发 (6h)
- **Weekend**: 休息或补充开发

### Week 3 (28h) - 后端补充 + 全面测试
- **Day 12** (6h): Phase 11 后端补充完成 (3h) + Phase 12 单元测试 (3h)
- **Day 13** (6h): Phase 12 集成测试 (6h)
- **Day 14** (6h): Phase 12 端到端测试 (6h)
- **Day 15** (6h): Phase 12 端到端测试完成 (2h) + 性能测试 (3h) + UAT准备 (1h)
- **Day 16** (4h): Phase 12 UAT测试 (4h)

### Week 4 (8h) - 文档输出 + 收尾
- **Day 17** (4h): Phase 13 文档输出 (4h)
- **Day 18** (4h): Phase 13 文档完善 (1.5h) + 问题修复 (2.5h)

**总计**: ~98小时 ≈ 16-17个工作日

---

## 🎯 关键里程碑

| 里程碑 | 目标日期 | 交付内容 |
|--------|---------|---------|
| **M1: P1核心功能完成** | Week 1结束 | 质检、成本、AI、报表、设备、考勤、库存P1功能全部集成 |
| **M2: 功能增强完成** | Week 2结束 | GPS、图片上传、修改密码、后端补充完成 |
| **M3: 测试完成** | Week 3结束 | 单元/集成/E2E/性能/UAT测试全部完成 |
| **M4: 文档交付** | Week 4结束 | API文档、功能报告、测试报告全部完成 |

---

## ⚠️ 风险与依赖

### 技术风险
1. **AI分析配额限制**: DeepSeek API调用成本需控制在¥30/月以内
2. **图表渲染性能**: 大数据量图表可能影响性能
3. **短信验证码服务**: 需要阿里云/腾讯云短信服务账号

### 依赖关系
- Phase 8.1 (GPS定位) 依赖 expo-location 安装
- Phase 8.2 (图片上传) 依赖 expo-image-picker 安装
- Phase 11.3 (忘记密码) 依赖短信服务集成
- Phase 12 (测试) 依赖所有功能集成完成

### 缓解措施
- 提前安装所需依赖
- 提前申请短信服务
- 设置AI调用缓存（5分钟）
- 图表数据分页加载

---

## 📊 成功指标

### 功能完整性
- [x] 所有后端已有API (126个) 全部集成
- [x] 所有缺失后端API (4个) 全部实现
- [x] 所有测试用例通过

### 性能指标
- [x] 页面加载时间 < 2秒
- [x] API响应时间 < 1秒
- [x] 应用内存占用 < 200MB
- [x] 列表滚动流畅度 > 60fps

### 质量指标
- [x] 单元测试覆盖率 > 70%
- [x] 集成测试通过率 100%
- [x] UAT用户满意度 > 80%

---

**开始执行吧！** 🚀

需要我立即开始 **Phase 1: 质检管理集成** 吗？
