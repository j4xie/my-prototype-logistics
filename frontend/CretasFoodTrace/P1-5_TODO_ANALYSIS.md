# P1-5: TODO注释处理分析报告

**总计**: 22处TODO注释
**分析时间**: 2025-11-20

---

## 📊 TODO分类统计

根据CLAUDE.md规范，TODO注释应该：
1. **已实现功能** → 删除TODO
2. **未实现功能** → 改用 `NotImplementedError`
3. **需后端支持** → 记录到 `backend/rn-update-tableandlogic.md`

---

## 🗂️ 按类型分类

### 类型A: 需要后端API支持 (12处)

#### 1. QuickStatsPanel.tsx (4处)
**位置**: src/screens/main/components/QuickStatsPanel.tsx

```typescript
// Line 45: TODO: 以下API端点后端尚未实现
// Line 62: TODO: 等待后端实现 /dashboard/production 端点
// Line 67: TODO: 等待后端实现 /dashboard/equipment 端点
// Line 68: TODO: 等待后端实现 /dashboard/equipment 端点
```

**需要的后端API**:
- `GET /api/mobile/{factoryId}/dashboard/production` - 生产数据
- `GET /api/mobile/{factoryId}/dashboard/equipment` - 设备数据

**处理方案**: 保留TODO，记录到后端需求文档

---

#### 2. ExceptionAlertScreen.tsx (3处)
**位置**: src/screens/alerts/ExceptionAlertScreen.tsx

```typescript
// Line 109: TODO: API集成 - GET /api/mobile/{factoryId}/alerts/exceptions
// Line 253: TODO: API集成 - POST /api/mobile/{factoryId}/alerts/exceptions/{alertId}/resolve
// Line 452: TODO: 导航到详情页或相关页面
```

**需要的后端API**:
- `GET /api/mobile/{factoryId}/alerts/exceptions` - 获取异常告警列表
- `POST /api/mobile/{factoryId}/alerts/exceptions/{alertId}/resolve` - 解决告警

**处理方案**: 保留TODO，记录到后端需求文档

---

#### 3. MaterialBatchManagementScreen.tsx (1处)
**位置**: src/screens/processing/MaterialBatchManagementScreen.tsx:1047

```typescript
// TODO: API integration - POST /api/{factoryId}/materials/batches/{id}/convert-to-frozen
```

**需要的后端API**:
- `POST /api/{factoryId}/materials/batches/{id}/convert-to-frozen` - 转冻品

**处理方案**: 保留TODO，记录到后端需求文档

---

#### 4. PlatformDashboardScreen.tsx (1处)
**位置**: src/screens/platform/PlatformDashboardScreen.tsx:39

```typescript
// TODO: 从后端加载实际数据
```

**需要的后端API**:
- 平台级别的统计数据API

**处理方案**: 保留TODO，记录到后端需求文档

---

#### 5. FactoryManagementScreen.tsx (1处)
**位置**: src/screens/platform/FactoryManagementScreen.tsx:91

```typescript
// TODO: 调用后端API获取工厂列表
```

**需要的后端API**:
- `GET /api/platform/factories` - 获取工厂列表

**处理方案**: 保留TODO，记录到后端需求文档

---

#### 6. ConversionRateScreen.tsx (1处)
**位置**: src/screens/management/ConversionRateScreen.tsx:68

```typescript
// TODO: 实际API调用
```

**需要的后端API**:
- 转换率管理相关API

**处理方案**: 保留TODO，记录到后端需求文档

---

#### 7. ProductTypeManagementScreen.tsx (1处)
**位置**: src/screens/management/ProductTypeManagementScreen.tsx:54

```typescript
// TODO: 实际API调用
```

**需要的后端API**:
- 产品类型管理相关API

**处理方案**: 保留TODO，记录到后端需求文档

---

### 类型B: 前端功能未实现 (6处)

#### 1. CreateQualityRecordScreen.tsx (1处)
**位置**: Line 293

```typescript
// TODO: 未来实现真实的文件上传到后端服务器
```

**状态**: 功能未实现
**处理方案**: 改用 `NotImplementedError`

```typescript
throw new NotImplementedError(
  '文件上传功能尚未实现',
  'FILE_UPLOAD',
  { plannedPhase: 'Phase 4', trackingIssue: 'N/A' }
);
```

---

#### 2. AIAnalysisDetailScreen.tsx (1处)
**位置**: Line 296

```typescript
// TODO: 复制到剪贴板
```

**状态**: 功能未实现
**处理方案**: 改用 `NotImplementedError` 或直接实现（使用Clipboard API）

**建议**: 直接实现，Expo提供了 `expo-clipboard`

```typescript
import * as Clipboard from 'expo-clipboard';
await Clipboard.setStringAsync(text);
```

---

#### 3. QualityInspectionDetailScreen.tsx (2处)
**位置**: Line 173, 249

```typescript
// Line 173: TODO: Navigate to edit screen or enable edit mode
// Line 249: TODO: Show dialog to input rejection reason
```

**状态**: 功能未实现
**处理方案**: 改用 `NotImplementedError`

```typescript
throw new NotImplementedError(
  '编辑质检记录功能尚未实现',
  'EDIT_INSPECTION',
  { plannedPhase: 'Phase 4' }
);
```

---

#### 4. UserManagementScreen.tsx (1处)
**位置**: Line 240

```typescript
// TODO: 显示角色选择器
```

**状态**: 功能未实现
**处理方案**: 改用 `NotImplementedError` 或检查是否已实现

---

#### 5. AttendanceHistoryScreen.tsx (1处)
**位置**: Line 348

```typescript
// TODO: 导航到 DataExportScreen 或直接调用导出API
```

**状态**: 功能未实现
**处理方案**: 改用 `NotImplementedError` 或实现导航

**建议**: 如果 DataExportScreen 已存在，直接实现导航

```typescript
navigation.navigate('DataExport');
```

---

### 类型C: 类型定义问题 (3处)

#### ReportDashboardScreen.tsx (3处)
**位置**: Line 186, 239, 251

```typescript
// @ts-expect-error - TODO: 报表路由尚未在 navigation ParamList 中定义
```

**问题**: 报表路由未在 navigation types 中定义
**处理方案**: 在 `types/navigation.ts` 中添加报表路由定义

需要添加的路由类型：
```typescript
export type ReportStackParamList = {
  ReportDashboard: undefined;
  ProductionReport: undefined;
  QualityReport: undefined;
  CostReport: undefined;
  EfficiencyReport: undefined;
  TrendReport: undefined;
  PersonnelReport: undefined;
  RealtimeReport: undefined;
  AnomalyReport: undefined;
  DataExport: undefined;
};
```

---

### 类型D: 功能优化建议 (1处)

#### navigationHelper.ts (1处)
**位置**: Line 84

```typescript
// TODO: 未来可直接跳转到打卡页面
```

**状态**: 功能优化建议
**处理方案**: 保留或改为更明确的注释

---

## 📋 处理计划

### 阶段1: 立即处理 (4处)

1. ✅ **ReportDashboardScreen.tsx** (3处)
   - 添加报表路由类型定义
   - 移除 `@ts-expect-error` 和 TODO

2. ✅ **AIAnalysisDetailScreen.tsx** (1处)
   - 实现剪贴板复制功能
   - 删除 TODO

### 阶段2: 改用NotImplementedError (5处)

1. ✅ CreateQualityRecordScreen.tsx - 文件上传
2. ✅ QualityInspectionDetailScreen.tsx (2处) - 编辑和拒绝
3. ✅ UserManagementScreen.tsx - 角色选择器
4. ⚠️ AttendanceHistoryScreen.tsx - 检查DataExportScreen是否存在

### 阶段3: 记录后端需求 (12处)

将以下TODO记录到 `backend/rn-update-tableandlogic.md`:
1. ✅ QuickStatsPanel.tsx (4处)
2. ✅ ExceptionAlertScreen.tsx (3处)
3. ✅ MaterialBatchManagementScreen.tsx (1处)
4. ✅ PlatformDashboardScreen.tsx (1处)
5. ✅ FactoryManagementScreen.tsx (1处)
6. ✅ ConversionRateScreen.tsx (1处)
7. ✅ ProductTypeManagementScreen.tsx (1处)

### 阶段4: 保留或优化 (1处)

1. ⚠️ navigationHelper.ts - 评估是否需要保留

---

## 🎯 预期结果

**修复后的TODO数量**: 0处（代码中）
**记录到后端需求**: 12处
**改用NotImplementedError**: 5处
**直接实现**: 2处
**添加类型定义**: 3处

---

**下一步**: 开始执行处理计划
