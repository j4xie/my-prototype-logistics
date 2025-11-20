# 待实现功能清单 (Pending Features TODO)

**创建日期**: 2025-11-20
**项目阶段**: Phase 3 → Phase 4 过渡
**总体完成度**: 约 75-80%
**参考文档**: 基于代码审查和 `backend/rn-update-tableandlogic.md`

---

## 🔴 P0 - 立即处理 (Phase 3 收尾)

### 1. 转冻品功能 ❌

**优先级**: P0
**工作量**: 2-3 天
**前端状态**: 已就绪 (`MaterialBatchManagementScreen.tsx`)
**后端状态**: ❌ 未实现

**后端任务**:
- [ ] 在 `MaterialBatchController.java` 添加 `POST /api/mobile/{factoryId}/material-batches/{batchId}/freeze` 端点
- [ ] 实现冻品转换业务逻辑
  - [ ] 更新批次状态为 `FROZEN`
  - [ ] 记录冻结时间和操作人
  - [ ] 更新库存状态
- [ ] 添加批次状态验证（只能转换特定状态的批次）
- [ ] 添加日志记录

**API 设计参考**:
```java
@PostMapping("/{factoryId}/material-batches/{batchId}/freeze")
@Operation(summary = "批次转冻品")
public ApiResponse<MaterialBatch> freezeBatch(
    @PathVariable String factoryId,
    @PathVariable String batchId,
    @RequestBody FreezeRequest request
) {
    // 实现逻辑
}
```

---

### 2. 推送通知前端集成 ⚠️ 60%

**优先级**: P0
**工作量**: 2-3 天
**后端状态**: ✅ 完成 (`MobileController.java`)
**前端状态**: ⚠️ API 客户端已实现，缺少集成

**前端任务**:
- [ ] 创建 `src/services/NotificationManager.ts`
  - [ ] 实现 `registerForPushNotifications()` 方法
  - [ ] 实现通知权限请求流程
  - [ ] 获取设备推送 token
- [ ] 在 `App.tsx` 中初始化推送通知
  - [ ] App 启动时调用 `registerForPushNotifications()`
  - [ ] 登录成功后注册设备 token
- [ ] 实现通知处理器
  - [ ] Foreground 通知显示
  - [ ] Background 通知点击处理
  - [ ] 通知数据解析和路由跳转
- [ ] 添加通知设置页面
  - [ ] 开启/关闭推送通知
  - [ ] 通知类型偏好设置

**依赖**:
- ✅ `expo-notifications` 已安装
- ✅ 后端 API: `POST /api/mobile/push/register`

---

### 3. 仪表板剩余 API (15%) ⚠️ 85%

**优先级**: P1
**工作量**: 1-2 天
**状态**: 大部分已实现，需验证和补充

**任务**:
- [ ] 验证前端需求与后端 API 一致性
  - [ ] `QuickStatsPanel.tsx` 所需数据
  - [ ] `ProcessingDashboard.tsx` 所需数据
- [ ] 补充缺失的统计计算逻辑
  - [ ] 设备利用率计算
  - [ ] 生产进度百分比
- [ ] 添加数据缓存优化
  - [ ] Redis 缓存仪表板数据（5分钟）
  - [ ] 减少数据库查询压力
- [ ] 测试所有 Dashboard 端点

**已实现端点**:
- ✅ `GET /api/mobile/{factoryId}/dashboard`
- ✅ `GET /api/mobile/{factoryId}/processing/dashboard/production`
- ✅ `GET /api/mobile/{factoryId}/processing/dashboard/equipment`
- ✅ `GET /api/mobile/{factoryId}/processing/dashboard/alerts`

---

## 🟡 P1 - Phase 4 核心任务

### 4. 离线数据自动同步调度器 ⚠️ 70%

**优先级**: P1
**工作量**: 3-4 天
**基础设施**: ✅ 完成 (`StorageService.ts`, `NetworkManager.ts`)
**后端 API**: ✅ 完成 (`POST /api/mobile/sync/{factoryId}`)

**前端任务**:
- [ ] 创建 `src/services/SyncScheduler.ts`
  - [ ] 实现后台同步调度器
  - [ ] 网络恢复时自动触发同步
  - [ ] 定时检查未同步数据
- [ ] 实现同步冲突解决策略
  - [ ] 服务器时间戳优先
  - [ ] 用户手动选择
- [ ] 实现增量同步优化
  - [ ] 只同步变更数据
  - [ ] 断点续传支持
- [ ] 添加同步状态 UI
  - [ ] 同步进度指示器
  - [ ] 同步失败提示
  - [ ] 手动同步按钮

**后端优化**:
- [ ] 优化批量数据同步性能
- [ ] 添加同步日志记录
- [ ] 实现数据版本控制

---

### 5. 通用 QR 扫码组件 ⚠️ 60%

**优先级**: P1
**工作量**: 2 天
**当前状态**: 分散在多个页面中，代码重复

**任务**:
- [ ] 创建 `src/components/common/QRScannerComponent.tsx`
  - [ ] 支持单次扫码
  - [ ] 支持连续扫码模式
  - [ ] 可自定义扫码回调
  - [ ] 支持手动输入备选
- [ ] 重构现有页面使用通用组件
  - [ ] `TimeClockScreen.tsx` - 考勤打卡
  - [ ] `MaterialBatchManagementScreen.tsx` - 原料批次
  - [ ] `CreateQualityRecordScreen.tsx` - 质检记录
  - [ ] `MaterialReceiptScreen.tsx` - 原料入库
- [ ] 添加批量扫码功能
  - [ ] 批量扫码列表
  - [ ] 扫码去重
  - [ ] 批量提交
- [ ] 添加扫码历史记录
  - [ ] 本地存储扫码记录
  - [ ] 历史记录查看
  - [ ] 快速重新扫码

**依赖**:
- ✅ `expo-barcode-scanner` 已安装

---

### 6. GPS 功能扩展 ⚠️ 40%

**优先级**: P1
**工作量**: 3-5 天
**当前状态**: 仅在 `TimeClockScreen.tsx` 用于考勤打卡

**前端任务**:
- [ ] 创建 `src/services/LocationManager.ts` 统一服务
  - [ ] 位置权限管理
  - [ ] 后台位置追踪
  - [ ] 位置缓存和上报
- [ ] 实现物流追踪功能
  - [ ] 批次运输路径实时记录
  - [ ] 地图显示运输轨迹
  - [ ] 预计到达时间计算
- [ ] 实现地理围栏功能
  - [ ] 工厂区域定义管理
  - [ ] 进出围栏事件触发
  - [ ] 围栏告警通知
- [ ] 位置历史记录
  - [ ] 历史轨迹查看
  - [ ] 路径回放功能

**后端任务**:
- [ ] 创建 `LocationController.java`
  - [ ] `POST /api/mobile/{factoryId}/locations` - 上报位置
  - [ ] `GET /api/mobile/{factoryId}/locations/track/{batchId}` - 批次轨迹
  - [ ] `POST /api/mobile/{factoryId}/geofences` - 创建地理围栏
- [ ] 数据库表设计
  - [ ] `location_records` - 位置记录表
  - [ ] `geofences` - 地理围栏表
  - [ ] `geofence_events` - 围栏事件表

**依赖**:
- ✅ `expo-location` 已安装

---

### 7. 异常告警前端页面 ⚠️ 50%

**优先级**: P1
**工作量**: 2-3 天
**后端状态**: ✅ 完成 (`MobileController.java` - 设备告警)
**前端状态**: ⚠️ 页面存在但可能需要更新

**任务**:
- [ ] 验证 `ExceptionAlertScreen.tsx` 与后端 API 集成
- [ ] 实现告警列表展示
  - [ ] 按严重程度分类（严重/警告/提示）
  - [ ] 按时间排序
  - [ ] 下拉刷新
- [ ] 实现告警操作
  - [ ] 确认告警 (`POST /{factoryId}/equipment/alerts/{id}/acknowledge`)
  - [ ] 解决告警 (`POST /{factoryId}/equipment/alerts/{id}/resolve`)
  - [ ] 忽略告警 (`POST /{factoryId}/equipment/alerts/{id}/ignore`)
- [ ] 添加告警统计看板
  - [ ] 告警数量趋势
  - [ ] 告警类型分布

**后端 API**: ✅ 已实现
- `GET /{factoryId}/equipment-alerts`
- `GET /{factoryId}/equipment-alerts/statistics`
- `POST /{factoryId}/equipment/alerts/{alertId}/acknowledge`
- `POST /{factoryId}/equipment/alerts/{alertId}/resolve`
- `POST /{factoryId}/equipment/alerts/{alertId}/ignore`

---

## 🟢 P2 - Phase 5 高级功能

### 8. 生物识别认证 ❌ 0%

**优先级**: P2
**工作量**: 5-7 天
**依赖**: ✅ `expo-local-authentication` 已安装
**当前状态**: ❌ 所有方法抛出 `NotImplementedError`

**任务**:
- [ ] 实现 `src/services/biometricManager.ts` 所有方法
  - [ ] `isAvailable()` - 检测设备是否支持生物识别
  - [ ] `isEnrolled()` - 检查是否已注册生物识别
  - [ ] `authenticate(options)` - 执行生物识别认证
  - [ ] `enableBiometricLogin(username, password)` - 启用生物识别登录
  - [ ] `saveBiometricCredentials()` - 安全存储凭据
  - [ ] `getBiometricCredentials()` - 获取已保存凭据
  - [ ] `disableBiometricLogin()` - 禁用生物识别
- [ ] 在登录页面添加生物识别选项
  - [ ] 首次登录后提示启用生物识别
  - [ ] 下次登录显示生物识别图标
  - [ ] 生物识别失败降级到密码登录
- [ ] 添加生物识别设置页面
  - [ ] 在 `ProfileScreen.tsx` 添加设置入口
  - [ ] 开启/关闭生物识别
  - [ ] 重新注册生物识别凭据
- [ ] 安全性增强
  - [ ] 生物识别失败次数限制
  - [ ] 自动回退到密码登录
  - [ ] 定期重新验证

**实现参考**:
```typescript
import * as LocalAuthentication from 'expo-local-authentication';

static async authenticate(options?: BiometricAuthOptions): Promise<boolean> {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  if (!hasHardware) {
    throw new Error('设备不支持生物识别');
  }

  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  if (!isEnrolled) {
    throw new Error('未注册生物识别，请先设置');
  }

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: options?.promptMessage || '请验证身份',
    fallbackLabel: '使用密码',
  });

  return result.success;
}
```

---

### 9. 批量导出功能 ❌ 0%

**优先级**: P2
**工作量**: 4-6 天
**功能范围**: 批次数据、质检报告、考勤记录等

**前端任务**:
- [ ] 创建 `src/services/ExportManager.ts`
  - [ ] PDF 导出功能
  - [ ] Excel 导出功能
  - [ ] 导出进度跟踪
- [ ] 添加导出UI组件
  - [ ] 导出选项对话框（格式、范围、字段）
  - [ ] 导出进度条
  - [ ] 导出历史列表
- [ ] 实现各模块导出
  - [ ] 批次数据导出
  - [ ] 质检报告导出
  - [ ] 考勤记录导出
  - [ ] 成本分析报告导出

**后端任务**:
- [ ] 创建 `ExportController.java`
  - [ ] `POST /api/mobile/{factoryId}/export/batches` - 批次导出
  - [ ] `POST /api/mobile/{factoryId}/export/quality-reports` - 质检报告
  - [ ] `GET /api/mobile/{factoryId}/export/history` - 导出历史
- [ ] 集成 Apache POI (Excel) 和 iText (PDF)
- [ ] 实现异步导出任务队列
  - [ ] 大数据量分批导出
  - [ ] 导出完成通知

**依赖**:
- [ ] 需要安装: `react-native-pdf` 或 `react-native-share`
- [ ] 后端: Apache POI, iText PDF

---

### 10. 高级报表与可视化 ❌ 0%

**优先级**: P2
**工作量**: 7-10 天
**功能范围**: 趋势分析、成本对比、多维度报表

**前端任务**:
- [ ] 集成图表库
  - [ ] 选择方案: `react-native-chart-kit` 或 `victory-native`
  - [ ] 封装通用图表组件
- [ ] 实现趋势分析图表
  - [ ] 生产量趋势（折线图）
  - [ ] 成本趋势对比（柱状图）
  - [ ] 质量评分分布（饼图）
- [ ] 实现成本对比可视化
  - [ ] 批次成本对比（堆叠柱状图）
  - [ ] 时间范围成本分析（面积图）
- [ ] 添加自定义报表配置
  - [ ] 报表模板管理
  - [ ] 字段选择器
  - [ ] 时间范围选择

**后端优化**:
- [ ] 优化报表查询性能
  - [ ] 添加聚合查询优化
  - [ ] 实现数据预计算
- [ ] 实现报表缓存
  - [ ] Redis 缓存常用报表

---

### 11. 应用激活系统增强 ⚠️ 80%

**优先级**: P3
**工作量**: 2-3 天
**后端状态**: ✅ API 已实现 (`POST /api/mobile/activation/activate`)
**前端状态**: ⚠️ 基础功能可能已实现，需验证

**任务**:
- [ ] 验证现有激活流程
  - [ ] 首次启动引导激活
  - [ ] 激活码输入和验证
- [ ] 完善激活 UI
  - [ ] 激活引导页面美化
  - [ ] 激活成功动画
  - [ ] 激活失败错误提示
- [ ] 添加激活码管理（管理员功能）
  - [ ] 激活码批量生成
  - [ ] 激活码状态查看
  - [ ] 激活设备列表

---

## 🔵 P3 - 未来增强

### 12. 多语言支持 ❌ 0%

**优先级**: P3
**工作量**: 5-7 天
**功能范围**: 中英文切换、日期/数字格式本地化

**任务**:
- [ ] 集成 i18n 库
  - [ ] 安装 `react-i18next` 或 `i18n-js`
  - [ ] 配置语言文件结构
- [ ] 提取所有文案到语言文件
  - [ ] 页面文案
  - [ ] 错误提示
  - [ ] 表单标签
- [ ] 实现语言切换
  - [ ] 添加语言设置页面
  - [ ] 支持中文/英文切换
  - [ ] 保存用户语言偏好
- [ ] 日期/数字格式本地化
  - [ ] 日期格式 (YYYY-MM-DD vs MM/DD/YYYY)
  - [ ] 数字千分位
  - [ ] 货币符号

---

### 13. 高级搜索与筛选 ❌ 0%

**优先级**: P3
**工作量**: 3-4 天
**功能范围**: 批次搜索、质检记录筛选、考勤记录查询

**任务**:
- [ ] 实现通用搜索组件
  - [ ] 关键词搜索
  - [ ] 多条件筛选
  - [ ] 搜索历史保存
- [ ] 批次高级搜索
  - [ ] 按批次号、产品类型、时间范围搜索
  - [ ] 按状态筛选
- [ ] 质检记录筛选
  - [ ] 按评分、检验员、时间筛选
- [ ] 添加搜索结果导出

---

## 📊 总体统计

| 优先级 | 任务数 | 总工作量 | 完成度 | 说明 |
|--------|--------|---------|--------|------|
| **P0** | 3 个 | 5-8 天 | 60% | Phase 3 收尾，立即处理 |
| **P1** | 4 个 | 10-13 天 | 50% | Phase 4 核心任务 |
| **P2** | 4 个 | 21-30 天 | 10% | Phase 5 高级功能 |
| **P3** | 2 个 | 8-11 天 | 0% | 未来增强 |
| **总计** | **13 个** | **44-62 天** | **~35%** | 约 2-3 个月 |

---

## 🎯 推荐实施顺序

### 第一周 (P0 - Phase 3 收尾)
**目标**: 完成 Phase 3 所有剩余功能
1. Day 1-2: 转冻品功能
2. Day 3-4: 推送通知前端集成
3. Day 5: 仪表板剩余 API 验证

### 第二周 (P1 开始)
**目标**: 核心移动端特性完善
4. Day 1-4: 离线数据自动同步调度器
5. Day 5: 通用 QR 扫码组件（启动）

### 第三周 (P1 继续)
**目标**: 完成 QR 扫码和启动 GPS
6. Day 1: 完成通用 QR 扫码组件
7. Day 2-5: GPS 功能扩展

### 第四周 (P1 收尾 + P2 启动)
**目标**: 完成 P1，启动高级功能
8. Day 1-3: 完成 GPS 功能扩展
9. Day 4-5: 异常告警前端页面

### 第五-六周 (P2 - 高级功能)
**目标**: 生物识别和导出功能
10. Day 1-7: 生物识别认证
11. Day 8-14: 批量导出功能

### 第七-八周 (P2 继续)
**目标**: 报表可视化
12. Day 1-10: 高级报表与可视化
13. Day 11-12: 应用激活系统增强

### 第九周+ (P3 - 未来增强)
**目标**: 国际化和高级搜索
14. 多语言支持
15. 高级搜索与筛选

---

## 📝 开发规范

### 每个功能完成标准
- [ ] ✅ 代码实现完成
- [ ] ✅ 单元测试通过 (覆盖率 >70%)
- [ ] ✅ 集成测试通过
- [ ] ✅ 代码审查通过
- [ ] ✅ 文档更新
- [ ] ✅ 部署到测试环境
- [ ] ✅ 用户验收测试

### 技术债务管理
- 在实现新功能的同时，**重构旧代码**
- 每周至少 20% 时间用于代码优化
- 保持代码覆盖率 >70%

### 沟通与同步
- 每日站会：同步进度，识别阻塞
- 每周复盘：回顾本周工作，调整下周计划
- 及时更新 TODO 清单

---

## 🔗 相关文档

- **项目概览**: `CLAUDE.md`
- **PRD 文档**: `docs/prd/PRD-白垩纪食品溯源系统-完整版.md`
- **后端需求**: `backend/rn-update-tableandlogic.md`
- **API 文档**: Apifox / `backend-java/src/main/java/com/cretas/aims/controller/`

---

## 📌 备注

- **工作量估算**: 基于单人开发，实际可根据团队规模调整
- **优先级可调整**: 根据业务需求动态调整
- **持续更新**: 完成一项打勾 ✅，并及时更新此文档
- **定期审查**: 每两周审查一次待办清单，调整优先级

**最后更新**: 2025-11-20
**下次审查**: 2025-12-04
