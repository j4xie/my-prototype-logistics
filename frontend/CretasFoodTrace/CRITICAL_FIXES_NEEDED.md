# 关键修复清单

**创建时间**: 2025-11-20
**优先级**: 🔴 **P0 - 阻塞测试**

---

## 📊 问题概览

| 问题 | 严重程度 | 影响 | 预计修复时间 |
|------|---------|------|------------|
| 后端启动失败 | 🔴 Critical | 阻塞所有API测试 | 5分钟 |
| AlertDTO字段不匹配 | 🔴 Critical | ExceptionAlertScreen无法编译 | 10分钟 |
| 导航类型错误 | 🟡 Medium | PlatformDashboard导航受影响 | 2分钟 |
| 导入路径错误 | 🟢 Low | CostAnalysisDashboard功能受影响 | 2分钟 |

**总预计修复时间**: 19分钟

---

## 🔴 问题 1: 后端启动失败

### 错误信息
```
org.hibernate.QueryException: could not resolve property: productionEfficiency
of: com.cretas.aims.entity.ProcessingBatch
```

### 根本原因
`ProcessingBatch`实体缺少`productionEfficiency`字段，但某个查询尝试访问该字段。

### 修复方案A: 添加字段到实体（推荐）

**文件**: `backend-java/src/main/java/com/cretas/aims/entity/ProcessingBatch.java`

```java
@Entity
@Table(name = "processing_batches")
public class ProcessingBatch {

    // ... 现有字段 ...

    /**
     * 生产效率（百分比）
     * 用于Dashboard KPI计算
     */
    @Column(name = "production_efficiency")
    private Double productionEfficiency;

    // Getter and Setter
    public Double getProductionEfficiency() {
        return productionEfficiency;
    }

    public void setProductionEfficiency(Double productionEfficiency) {
        this.productionEfficiency = productionEfficiency;
    }
}
```

**数据库迁移** (如果字段不存在):
```sql
ALTER TABLE processing_batches
ADD COLUMN production_efficiency DOUBLE DEFAULT 0.0 COMMENT '生产效率(%)';
```

### 修复方案B: 修改查询（临时方案）

如果不需要`productionEfficiency`字段，可以修改查询：

**可能位置**:
- `backend-java/src/main/java/com/cretas/aims/service/DashboardService.java`
- `backend-java/src/main/java/com/cretas/aims/repository/ProcessingBatchRepository.java`

**修改**:
```java
// ❌ 移除productionEfficiency的查询
// 或者
// ✅ 使用其他字段计算
```

### 验证
```bash
# 修复后重启后端
cd backend-java
mvn spring-boot:run

# 验证端口监听
lsof -i :10010

# 测试API
curl http://localhost:10010/api/mobile/dashboard/1
```

---

## 🔴 问题 2: ExceptionAlertScreen - AlertDTO字段不匹配

### 错误详情
```typescript
// ExceptionAlertScreen.tsx:171-178

// ❌ 当前代码（错误）:
level: mapSeverityToLevel(dto.severity),      // ❌ AlertDTO没有severity
title: dto.title,                              // ❌ AlertDTO没有title
message: dto.description,                      // ❌ AlertDTO没有description
triggeredAt: new Date(dto.createdAt),         // ❌ AlertDTO没有createdAt
relatedId: dto.sourceId,                      // ❌ AlertDTO没有sourceId
```

### AlertDTO实际字段
```typescript
// src/services/api/alertApiClient.ts

export interface AlertDTO {
  id: number | string;
  factoryId: string;
  equipmentId: string;          // ✅ 设备ID
  equipmentName?: string;        // ✅ 设备名称
  alertType: string;             // ✅ 告警类型
  level: 'CRITICAL' | 'WARNING' | 'INFO';  // ✅ 级别（不是severity）
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';  // ✅ 状态
  message: string;               // ✅ 消息
  details?: string;              // ✅ 详情
  triggeredAt: string;           // ✅ 触发时间（不是createdAt）
  resolvedAt?: string;           // ✅ 解决时间
  // ❌ 没有: severity, title, description, createdAt, sourceId
}
```

### 修复代码

**文件**: `src/screens/alerts/ExceptionAlertScreen.tsx`

**位置**: 第167-179行

**修改**:
```typescript
// ✅ 正确的字段映射 (2025-11-20修复)
const mappedAlerts: ExceptionAlert[] = response.data.content.map((dto: AlertDTO) => ({
  id: String(dto.id),                           // ✅ 确保ID为string类型
  type: mapAlertTypeFromBackend(dto.alertType),
  level: mapSeverityToLevel(dto.level),         // ✅ 使用level代替severity
  status: mapStatusFromBackend(dto.status),
  title: dto.equipmentName || dto.alertType || '未知告警',  // ✅ 使用equipmentName作为标题
  message: dto.message,                         // ✅ 使用message
  details: dto.details || dto.message,          // ✅ 使用details
  triggeredAt: new Date(dto.triggeredAt),       // ✅ 使用triggeredAt
  resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
  relatedId: dto.equipmentId,                   // ✅ 使用equipmentId代替sourceId
}));
```

### 完整修复步骤

1. **打开文件**:
   ```bash
   code src/screens/alerts/ExceptionAlertScreen.tsx
   ```

2. **查找第167-179行的映射代码**

3. **替换为上面的正确代码**

4. **验证TypeScript编译**:
   ```bash
   npx tsc --noEmit | grep ExceptionAlertScreen
   ```

---

## 🟡 问题 3: PlatformDashboardScreen导航类型错误

### 错误信息
```
PlatformDashboardScreen.tsx:225:62
error TS2345: Argument of type 'string' is not assignable to parameter of type
'keyof PlatformStackParamList'
```

### 修复方案

**文件**: `src/screens/platform/PlatformDashboardScreen.tsx`

**位置**: 第225行（需要确认具体代码）

**可能的修复**:
```typescript
// ❌ Before
navigation.navigate('FactoryManagement');

// ✅ After
navigation.navigate('FactoryManagement' as keyof PlatformStackParamList);

// 或者更好的方式（如果FactoryManagement在ParamList中）
import { PlatformStackParamList } from '../../navigation/PlatformStackNavigator';
// 确保'FactoryManagement'在PlatformStackParamList中定义
```

### 步骤

1. **读取第225行代码**:
   ```bash
   sed -n '225p' src/screens/platform/PlatformDashboardScreen.tsx
   ```

2. **检查PlatformStackParamList定义**:
   ```bash
   grep -A 20 "type PlatformStackParamList" src/navigation/PlatformStackNavigator.tsx
   ```

3. **添加类型断言或修复ParamList定义**

---

## 🟢 问题 4: CostAnalysisDashboard导入路径错误

### 错误信息
```
Cannot find module '../../../utils/errorHandler'
```

### 受影响文件
- `src/screens/processing/CostAnalysisDashboard/hooks/useAIAnalysis.ts`
- `src/screens/processing/CostAnalysisDashboard/hooks/useCostData.ts`

### 修复方案

#### 方案A: 修正导入路径

**文件**: `useAIAnalysis.ts`, `useCostData.ts`

**修改**:
```typescript
// ❌ 错误路径
import { handleError } from '../../../utils/errorHandler';

// ✅ 正确路径 (从CostAnalysisDashboard/hooks到utils)
// CostAnalysisDashboard/hooks -> CostAnalysisDashboard -> processing -> screens -> src -> utils
import { handleError } from '../../../../utils/errorHandler';
```

#### 方案B: 使用绝对导入（推荐）

**修改tsconfig.json**:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/utils/*": ["src/utils/*"],
      "@/components/*": ["src/components/*"]
    }
  }
}
```

**修改导入**:
```typescript
// ✅ 使用绝对导入
import { handleError } from '@/utils/errorHandler';
```

### 验证路径

```bash
# 从hooks目录到errorHandler.ts的相对路径
# src/screens/processing/CostAnalysisDashboard/hooks/useAIAnalysis.ts
#                                                         └─> ../../../../utils/errorHandler.ts
```

---

## ✅ 修复验证清单

### 1. 后端修复验证
```bash
# 启动后端
cd backend-java
mvn spring-boot:run

# 验证端口
lsof -i :10010
# 预期: 显示java进程监听10010端口

# 测试API
curl http://localhost:10010/api/mobile/dashboard/1
# 预期: 返回JSON数据，包含todayStats对象
```

### 2. 前端TypeScript验证
```bash
cd frontend/CretasFoodTrace

# 完整编译检查
npx tsc --noEmit

# 预期: 0 errors（或仅剩测试文件错误）

# 检查特定文件
npx tsc --noEmit | grep -E "(ExceptionAlertScreen|PlatformDashboardScreen|CostAnalysisDashboard)"
# 预期: 无输出
```

### 3. 功能测试验证

**ExceptionAlertScreen测试**:
```bash
# 启动应用
npm start

# 导航到: Processing -> ExceptionAlerts
# 预期: 页面正常加载，无TypeError
```

**PlatformDashboardScreen测试**:
```bash
# 登录: admin / Admin@123456
# 导航到: Platform -> Dashboard
# 预期: 统计数据正常显示，导航按钮可点击
```

---

## 📝 修复后的测试流程

### 第一步: 修复代码

1. ✅ 修复`ProcessingBatch.productionEfficiency`
2. ✅ 修复`ExceptionAlertScreen`字段映射
3. ✅ 修复`PlatformDashboardScreen`导航类型
4. ✅ 修复导入路径

### 第二步: 验证编译

```bash
npx tsc --noEmit
```

预期输出:
```
Found 0 errors.
```

或仅剩测试文件错误（可忽略）。

### 第三步: 启动服务

```bash
# Terminal 1: 后端
cd backend-java
mvn spring-boot:run

# Terminal 2: 前端
cd frontend/CretasFoodTrace
npm start
```

### 第四步: 执行测试

按照[OPTIMIZATION_TEST_GUIDE.md](OPTIMIZATION_TEST_GUIDE.md)执行6个测试项。

---

## 🚀 快速修复脚本

### ExceptionAlertScreen字段映射修复

创建以下文件: `fix-exception-alert-fields.sh`

```bash
#!/bin/bash

FILE="src/screens/alerts/ExceptionAlertScreen.tsx"

# 备份原文件
cp "$FILE" "$FILE.backup"

# 修复字段映射
sed -i '' \
  -e 's/dto\.severity/dto.level/g' \
  -e 's/dto\.title/dto.equipmentName || dto.alertType/g' \
  -e 's/dto\.description/dto.message/g' \
  -e 's/dto\.createdAt/dto.triggeredAt/g' \
  -e 's/dto\.sourceId/dto.equipmentId/g' \
  "$FILE"

echo "✅ ExceptionAlertScreen.tsx 字段已修复"
echo "📁 备份文件: $FILE.backup"
```

运行:
```bash
chmod +x fix-exception-alert-fields.sh
./fix-exception-alert-fields.sh
```

---

## 📞 需要协助的问题

### 后端团队

1. **确认`production_efficiency`字段需求**
   - 是否需要在`processing_batches`表中添加此字段？
   - 或者移除Dashboard查询中的该字段？

2. **AlertDTO字段标准化**
   - 确认告警实体的标准字段名
   - 是否需要添加`title`、`description`等额外字段？

### 前端团队

1. **验证AlertDTO类型定义**
   - 确认`alertApiClient.ts`中的AlertDTO是否与后端一致

2. **导航ParamList检查**
   - 确认`PlatformStackParamList`是否包含所有必要的路由

---

## ✅ 完成标准

所有以下检查项通过后，才能进行功能测试：

- [ ] 后端成功启动（`lsof -i :10010`有输出）
- [ ] TypeScript编译通过（`npx tsc --noEmit`返回0 errors）
- [ ] ExceptionAlertScreen无类型错误
- [ ] PlatformDashboardScreen无类型错误
- [ ] CostAnalysisDashboard导入正常
- [ ] 可以访问平台统计API（`curl http://localhost:10010/api/platform/dashboard/statistics`）
- [ ] 可以访问Dashboard API（`curl http://localhost:10010/api/mobile/dashboard/1`）

---

**下一步**: 完成所有P0/P1修复后，执行[OPTIMIZATION_TEST_GUIDE.md](OPTIMIZATION_TEST_GUIDE.md)中的完整测试流程

**预计时间**: 修复19分钟 + 测试30分钟 = **总计49分钟**

---

**创建人**: Claude Code
**创建时间**: 2025-11-20 23:10:00
**相关文档**:
- [TEST_EXECUTION_REPORT.md](TEST_EXECUTION_REPORT.md) - 测试执行报告
- [OPTIMIZATION_TEST_GUIDE.md](OPTIMIZATION_TEST_GUIDE.md) - 测试指南
