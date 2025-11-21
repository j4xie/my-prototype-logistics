# PRD-API-QualityInspectionController（质检管理控制器）

**文档版本**: v1.0.0
**创建日期**: 2025-11-20
**Controller路径**: `/api/mobile/{factoryId}/quality-inspections`
**所属模块**: 质量管理模块
**Controller文件**: `QualityInspectionController.java` (107行)

---

## 📋 目录 (Table of Contents)

1. [Controller概述](#controller概述)
2. [端点清单](#端点清单)
3. [详细API文档](#详细api文档)
   - [3.1 获取质量检验记录列表](#31-获取质量检验记录列表)
   - [3.2 获取质量检验记录详情](#32-获取质量检验记录详情)
   - [3.3 创建质量检验记录](#33-创建质量检验记录)
   - [3.4 更新质量检验记录](#34-更新质量检验记录)
4. [数据模型](#数据模型)
5. [业务规则](#业务规则)
6. [错误处理](#错误处理)
7. [前端集成指南](#前端集成指南)

---

## Controller概述

### 功能描述

**QualityInspectionController** 负责管理食品生产过程中的质量检验记录，是食品安全追溯系统的核心模块。

**核心功能**:
- ✅ **质检记录管理**: CRUD操作（创建、查询、更新、删除）
- ✅ **质检数据统计**: 合格率、抽检样本数、不合格数量
- ✅ **批次关联**: 与生产批次关联，追溯质检历史
- ✅ **检验员追踪**: 记录检验员信息，责任到人
- ✅ **质检结果判定**: PASS（合格）、FAIL（不合格）、CONDITIONAL（有条件通过）

**业务价值**:
- 🛡️ **食品安全保障**: 严格的质检流程确保产品质量
- 📊 **数据追溯**: 完整记录质检历史，支持问题追溯
- 📈 **质量分析**: 合格率统计，发现质量趋势
- 👤 **责任追踪**: 检验员信息记录，明确责任

**使用场景**:
1. 生产批次完成后，质检员进行抽样检验
2. 记录抽样数量、合格数、不合格数
3. 自动计算合格率，判定结果
4. 质检不合格时记录问题详情
5. 查看历史质检记录，分析质量趋势

---

## 端点清单

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 | E2E验证 |
|---|----------|----------|----------|----------|---------|
| 1 | GET | `/api/mobile/{factoryId}/quality-inspections` | 获取质量检验记录列表（分页） | factory_* | ⚪ 未验证 |
| 2 | GET | `/api/mobile/{factoryId}/quality-inspections/{inspectionId}` | 获取质量检验记录详情 | factory_* | ⚪ 未验证 |
| 3 | POST | `/api/mobile/{factoryId}/quality-inspections` | 创建质量检验记录 | factory_*, workshop_manager | ⚪ 未验证 |
| 4 | PUT | `/api/mobile/{factoryId}/quality-inspections/{inspectionId}` | 更新质量检验记录 | factory_*, workshop_manager | ⚪ 未验证 |

**图例**:
- ✅ E2E已验证 (100%通过)
- ⚠️ E2E部分验证
- ⚪ 未验证（需要添加测试）

**端点统计**:
- **总计**: 4个端点
- **CRUD**: 4个（创建、查询、更新、删除）
- **查询端点**: 2个（列表、详情）
- **写操作端点**: 2个（创建、更新）

---

## 详细API文档

### 3.1 获取质量检验记录列表

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/quality-inspections` |
| **功能** | 分页获取质量检验记录列表，支持按生产批次筛选 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 100次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;  // 工厂ID，例如 "CRETAS_2024_001"
}
```

**查询参数**:
```typescript
interface QueryParams {
  productionBatchId?: string;  // 可选，筛选特定生产批次的质检记录
  page?: number;               // 页码，默认1
  size?: number;               // 每页大小，默认20
}
```

**参数验证**:
- `factoryId`: 必填，字符串格式
- `productionBatchId`: 可选，存在时必须是有效的批次ID
- `page`: 整数，≥1
- `size`: 整数，1-100之间

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "操作成功";
  success: true;
  data: {
    content: QualityInspection[];  // 质检记录列表
    totalElements: number;          // 总记录数
    totalPages: number;             // 总页数
    currentPage: number;            // 当前页码
    size: number;                   // 每页大小
    hasNext: boolean;               // 是否有下一页
    hasPrevious: boolean;           // 是否有上一页
  };
}

interface QualityInspection {
  id: string;                      // 质检记录ID
  factoryId: string;               // 工厂ID
  productionBatchId: string;       // 生产批次ID
  inspectorId: number;             // 检验员ID
  inspectionDate: string;          // 检验日期 "2025-01-15"
  sampleSize: number;              // 抽样数量
  passCount: number;               // 合格数量
  failCount: number;               // 不合格数量
  passRate: number;                // 合格率 (%)
  result: "PASS" | "FAIL" | "CONDITIONAL";  // 检验结果
  notes?: string;                  // 备注信息
  createdAt: string;               // 创建时间
  updatedAt: string;               // 更新时间
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "content": [
      {
        "id": "QI-20250115-001",
        "factoryId": "CRETAS_2024_001",
        "productionBatchId": "BATCH-20250115-001",
        "inspectorId": 5,
        "inspectionDate": "2025-01-15",
        "sampleSize": 100,
        "passCount": 98,
        "failCount": 2,
        "passRate": 98.0,
        "result": "PASS",
        "notes": "整体质量良好，发现2个包装瑕疵",
        "createdAt": "2025-01-15T14:30:00",
        "updatedAt": "2025-01-15T14:30:00"
      },
      {
        "id": "QI-20250114-003",
        "factoryId": "CRETAS_2024_001",
        "productionBatchId": "BATCH-20250114-002",
        "inspectorId": 6,
        "inspectionDate": "2025-01-14",
        "sampleSize": 50,
        "passCount": 45,
        "failCount": 5,
        "passRate": 90.0,
        "result": "CONDITIONAL",
        "notes": "5个样本重量略低于标准，已要求返工",
        "createdAt": "2025-01-14T16:20:00",
        "updatedAt": "2025-01-14T16:20:00"
      }
    ],
    "totalElements": 87,
    "totalPages": 5,
    "currentPage": 1,
    "size": 20,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

#### 核心业务逻辑

**分页查询流程**:
```
1. 验证factoryId和用户权限
2. 如果提供productionBatchId，筛选该批次的质检记录
3. 按检验日期倒序排序（最新的在前）
4. 应用分页参数
5. 返回分页结果
```

**排序规则**:
- 默认按 `inspectionDate DESC` 排序（最新的检验记录在前）
- 同一天的记录按 `createdAt DESC` 排序

**数据计算**:
- `passRate` = (`passCount` / `sampleSize`) × 100，保留2位小数

#### TypeScript代码示例

**API调用**:
```typescript
import { apiClient } from '@/services/api/apiClient';

interface GetInspectionsParams {
  factoryId: string;
  productionBatchId?: string;
  page?: number;
  size?: number;
}

/**
 * 获取质量检验记录列表
 */
export const getQualityInspections = async (
  params: GetInspectionsParams
): Promise<ApiResponse<PageResponse<QualityInspection>>> => {
  const { factoryId, productionBatchId, page = 1, size = 20 } = params;

  const response = await apiClient.get(
    `/api/mobile/${factoryId}/quality-inspections`,
    {
      params: {
        productionBatchId,
        page,
        size,
      },
    }
  );

  return response.data;
};
```

**React Native组件使用**:
```typescript
import React, { useState, useEffect } from 'react';
import { View, FlatList, Text } from 'react-native';
import { getQualityInspections } from '@/services/api/qualityInspectionApiClient';

const QualityInspectionListScreen: React.FC = () => {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const factoryId = 'CRETAS_2024_001';

  const loadInspections = async () => {
    try {
      setLoading(true);
      const result = await getQualityInspections({
        factoryId,
        page,
        size: 20,
      });

      if (result.success) {
        setInspections(result.data.content);
      }
    } catch (error) {
      console.error('加载质检记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections();
  }, [page]);

  const renderItem = ({ item }: { item: QualityInspection }) => (
    <View style={{ padding: 16, borderBottomWidth: 1 }}>
      <Text>批次: {item.productionBatchId}</Text>
      <Text>检验日期: {item.inspectionDate}</Text>
      <Text>抽样数: {item.sampleSize}</Text>
      <Text>合格率: {item.passRate}%</Text>
      <Text
        style={{
          color: item.result === 'PASS' ? 'green' :
                 item.result === 'FAIL' ? 'red' : 'orange'
        }}
      >
        结果: {item.result}
      </Text>
    </View>
  );

  return (
    <FlatList
      data={inspections}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      refreshing={loading}
      onRefresh={loadInspections}
    />
  );
};
```

---

### 3.2 获取质量检验记录详情

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `GET /api/mobile/{factoryId}/quality-inspections/{inspectionId}` |
| **功能** | 根据ID获取单个质量检验记录的详细信息 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 200次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;     // 工厂ID
  inspectionId: string;  // 质检记录ID
}
```

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "操作成功";
  success: true;
  data: QualityInspection;  // 质检记录详情
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "操作成功",
  "success": true,
  "data": {
    "id": "QI-20250115-001",
    "factoryId": "CRETAS_2024_001",
    "productionBatchId": "BATCH-20250115-001",
    "inspectorId": 5,
    "inspectionDate": "2025-01-15",
    "sampleSize": 100,
    "passCount": 98,
    "failCount": 2,
    "passRate": 98.0,
    "result": "PASS",
    "notes": "整体质量良好，发现2个包装瑕疵。已要求包装部门改进操作流程。",
    "createdAt": "2025-01-15T14:30:00",
    "updatedAt": "2025-01-15T14:30:00"
  }
}
```

#### 核心业务逻辑

**查询流程**:
```
1. 验证factoryId和inspectionId
2. 验证用户权限（必须属于同一工厂）
3. 从数据库查询质检记录
4. 如果不存在，返回404错误
5. 返回质检记录详情
```

#### TypeScript代码示例

```typescript
/**
 * 获取质量检验记录详情
 */
export const getQualityInspectionById = async (
  factoryId: string,
  inspectionId: string
): Promise<ApiResponse<QualityInspection>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/quality-inspections/${inspectionId}`
  );

  return response.data;
};

// 使用示例
const loadInspectionDetail = async (inspectionId: string) => {
  try {
    const result = await getQualityInspectionById('CRETAS_2024_001', inspectionId);

    if (result.success) {
      const inspection = result.data;
      console.log(`质检合格率: ${inspection.passRate}%`);
      console.log(`检验结果: ${inspection.result}`);
    }
  } catch (error) {
    if (error.response?.status === 404) {
      Alert.alert('错误', '质检记录不存在');
    } else {
      Alert.alert('错误', '加载质检记录失败');
    }
  }
};
```

---

### 3.3 创建质量检验记录

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `POST /api/mobile/{factoryId}/quality-inspections` |
| **功能** | 创建新的质量检验记录 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;  // 工厂ID
}
```

**请求体**:
```typescript
interface CreateInspectionRequest {
  productionBatchId: string;  // 必填，生产批次ID
  inspectorId: number;        // 必填，检验员ID
  inspectionDate: string;     // 必填，检验日期 "2025-01-15"
  sampleSize: number;         // 必填，抽样数量，>0
  passCount: number;          // 必填，合格数量，≥0
  failCount: number;          // 必填，不合格数量，≥0
  notes?: string;             // 可选，备注信息
}
```

**参数验证**:
- `productionBatchId`: 必须是存在的批次ID
- `inspectorId`: 必须是存在的用户ID，且角色为 `workshop_manager` 或更高
- `inspectionDate`: 日期格式 `YYYY-MM-DD`
- `sampleSize`: 必须 > 0
- `passCount`: 必须 ≥ 0
- `failCount`: 必须 ≥ 0
- `passCount + failCount`: 必须等于 `sampleSize`

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "质量检验记录创建成功";
  success: true;
  data: QualityInspection;  // 创建的质检记录，包含自动生成的ID和计算字段
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "质量检验记录创建成功",
  "success": true,
  "data": {
    "id": "QI-20250116-005",
    "factoryId": "CRETAS_2024_001",
    "productionBatchId": "BATCH-20250116-002",
    "inspectorId": 5,
    "inspectionDate": "2025-01-16",
    "sampleSize": 50,
    "passCount": 48,
    "failCount": 2,
    "passRate": 96.0,
    "result": "PASS",
    "notes": "常规抽检，质量稳定",
    "createdAt": "2025-01-16T10:15:00",
    "updatedAt": "2025-01-16T10:15:00"
  }
}
```

#### 核心业务逻辑

**创建流程**:
```
1. 验证请求参数完整性和有效性
2. 验证生产批次存在且属于同一工厂
3. 验证检验员存在且具有检验权限
4. 验证 passCount + failCount = sampleSize
5. 自动计算 passRate = (passCount / sampleSize) × 100
6. 自动判定结果:
   - passRate ≥ 95% → result = "PASS"
   - 90% ≤ passRate < 95% → result = "CONDITIONAL"
   - passRate < 90% → result = "FAIL"
7. 生成唯一质检记录ID（格式: QI-{日期}-{序号}）
8. 保存到数据库
9. 如果result = "FAIL"，触发告警通知
10. 返回创建的质检记录
```

**自动计算字段**:
- `passRate`: 自动计算，前端不需要传递
- `result`: 根据合格率自动判定
- `id`: 自动生成
- `createdAt`, `updatedAt`: 自动设置

**质检结果判定规则**:
```typescript
const determineResult = (passRate: number): InspectionResult => {
  if (passRate >= 95) {
    return 'PASS';       // 合格率 ≥ 95%，完全通过
  } else if (passRate >= 90) {
    return 'CONDITIONAL'; // 90% ≤ 合格率 < 95%，有条件通过
  } else {
    return 'FAIL';       // 合格率 < 90%，不合格
  }
};
```

**告警触发**:
- 当 `result = "FAIL"` 时，自动创建设备告警或质量告警
- 告警级别: WARNING（合格率 80-90%）或 CRITICAL（合格率 < 80%）
- 通知对象: 车间主管、工厂管理员

#### TypeScript代码示例

**API调用**:
```typescript
/**
 * 创建质量检验记录
 */
export const createQualityInspection = async (
  factoryId: string,
  inspection: CreateInspectionRequest
): Promise<ApiResponse<QualityInspection>> => {
  // 前端验证
  if (inspection.passCount + inspection.failCount !== inspection.sampleSize) {
    throw new Error('合格数+不合格数必须等于抽样数量');
  }

  const response = await apiClient.post(
    `/api/mobile/${factoryId}/quality-inspections`,
    inspection
  );

  return response.data;
};
```

**React Native表单组件**:
```typescript
import React, { useState } from 'react';
import { View, TextInput, Button, Alert } from 'react-native';
import { createQualityInspection } from '@/services/api/qualityInspectionApiClient';

const CreateInspectionScreen: React.FC = () => {
  const [formData, setFormData] = useState({
    productionBatchId: '',
    inspectorId: 5,
    inspectionDate: new Date().toISOString().split('T')[0],
    sampleSize: '',
    passCount: '',
    failCount: '',
    notes: '',
  });

  const handleSubmit = async () => {
    try {
      // 前端验证
      const sampleSize = parseInt(formData.sampleSize);
      const passCount = parseInt(formData.passCount);
      const failCount = parseInt(formData.failCount);

      if (passCount + failCount !== sampleSize) {
        Alert.alert('验证失败', '合格数+不合格数必须等于抽样数量');
        return;
      }

      // 调用API
      const result = await createQualityInspection('CRETAS_2024_001', {
        productionBatchId: formData.productionBatchId,
        inspectorId: formData.inspectorId,
        inspectionDate: formData.inspectionDate,
        sampleSize,
        passCount,
        failCount,
        notes: formData.notes || undefined,
      });

      if (result.success) {
        const passRate = result.data.passRate;
        const resultText = result.data.result;

        Alert.alert(
          '质检记录创建成功',
          `合格率: ${passRate}%\n结果: ${resultText}`,
          [
            {
              text: '确定',
              onPress: () => navigation.goBack(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('创建质检记录失败:', error);
      Alert.alert('错误', '创建质检记录失败，请重试');
    }
  };

  return (
    <View style={{ padding: 16 }}>
      <TextInput
        placeholder="生产批次ID"
        value={formData.productionBatchId}
        onChangeText={(text) => setFormData({ ...formData, productionBatchId: text })}
      />
      <TextInput
        placeholder="抽样数量"
        keyboardType="numeric"
        value={formData.sampleSize}
        onChangeText={(text) => setFormData({ ...formData, sampleSize: text })}
      />
      <TextInput
        placeholder="合格数量"
        keyboardType="numeric"
        value={formData.passCount}
        onChangeText={(text) => setFormData({ ...formData, passCount: text })}
      />
      <TextInput
        placeholder="不合格数量"
        keyboardType="numeric"
        value={formData.failCount}
        onChangeText={(text) => setFormData({ ...formData, failCount: text })}
      />
      <TextInput
        placeholder="备注（可选）"
        multiline
        value={formData.notes}
        onChangeText={(text) => setFormData({ ...formData, notes: text })}
      />
      <Button title="提交质检记录" onPress={handleSubmit} />
    </View>
  );
};
```

---

### 3.4 更新质量检验记录

#### 基本信息

| 属性 | 值 |
|------|-----|
| **端点路径** | `PUT /api/mobile/{factoryId}/quality-inspections/{inspectionId}` |
| **功能** | 更新现有的质量检验记录 |
| **权限** | `factory_super_admin`, `factory_admin`, `workshop_manager` |
| **限流** | 60次/分钟 |

#### 请求参数

**路径参数**:
```typescript
interface PathParams {
  factoryId: string;     // 工厂ID
  inspectionId: string;  // 质检记录ID
}
```

**请求体**:
```typescript
interface UpdateInspectionRequest {
  productionBatchId?: string;  // 可选，生产批次ID
  inspectorId?: number;        // 可选，检验员ID
  inspectionDate?: string;     // 可选，检验日期
  sampleSize?: number;         // 可选，抽样数量
  passCount?: number;          // 可选，合格数量
  failCount?: number;          // 可选，不合格数量
  notes?: string;              // 可选，备注信息
}
```

**参数验证**:
- 所有字段都是可选的（部分更新）
- 如果更新 `sampleSize`, `passCount`, `failCount`，必须满足: `passCount + failCount = sampleSize`
- 其他验证规则与创建接口相同

#### 响应结构

**成功响应** (200 OK):
```typescript
interface Response {
  code: 200;
  message: "质量检验记录更新成功";
  success: true;
  data: QualityInspection;  // 更新后的质检记录
}
```

**响应示例**:
```json
{
  "code": 200,
  "message": "质量检验记录更新成功",
  "success": true,
  "data": {
    "id": "QI-20250116-005",
    "factoryId": "CRETAS_2024_001",
    "productionBatchId": "BATCH-20250116-002",
    "inspectorId": 5,
    "inspectionDate": "2025-01-16",
    "sampleSize": 50,
    "passCount": 47,
    "failCount": 3,
    "passRate": 94.0,
    "result": "CONDITIONAL",
    "notes": "复检后更新数据，发现1个额外不合格品",
    "createdAt": "2025-01-16T10:15:00",
    "updatedAt": "2025-01-16T14:20:00"
  }
}
```

#### 核心业务逻辑

**更新流程**:
```
1. 验证质检记录存在且属于同一工厂
2. 验证用户权限（只有创建者或管理员可以更新）
3. 部分更新允许的字段
4. 如果更新了数量字段，重新计算 passRate 和 result
5. 更新 updatedAt 时间戳
6. 保存到数据库
7. 如果result从PASS变为FAIL，触发告警
8. 返回更新后的质检记录
```

**权限控制**:
- `factory_super_admin`, `factory_admin`: 可以更新任何质检记录
- `workshop_manager`: 只能更新自己创建的质检记录（inspectorId匹配）

#### TypeScript代码示例

```typescript
/**
 * 更新质量检验记录
 */
export const updateQualityInspection = async (
  factoryId: string,
  inspectionId: string,
  updates: UpdateInspectionRequest
): Promise<ApiResponse<QualityInspection>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/quality-inspections/${inspectionId}`,
    updates
  );

  return response.data;
};

// 使用示例：更新备注
const updateNotes = async (inspectionId: string, notes: string) => {
  try {
    const result = await updateQualityInspection(
      'CRETAS_2024_001',
      inspectionId,
      { notes }
    );

    if (result.success) {
      Alert.alert('成功', '备注已更新');
    }
  } catch (error) {
    console.error('更新失败:', error);
    Alert.alert('错误', '更新质检记录失败');
  }
};

// 使用示例：复检更新数量
const updateCounts = async (
  inspectionId: string,
  passCount: number,
  failCount: number
) => {
  try {
    const result = await updateQualityInspection(
      'CRETAS_2024_001',
      inspectionId,
      {
        passCount,
        failCount,
        // sampleSize保持不变
      }
    );

    if (result.success) {
      Alert.alert(
        '复检完成',
        `新合格率: ${result.data.passRate}%\n结果: ${result.data.result}`
      );
    }
  } catch (error) {
    console.error('更新失败:', error);
  }
};
```

---

## 数据模型

### QualityInspection（质量检验记录）

```typescript
/**
 * 质量检验记录实体
 */
interface QualityInspection {
  // 主键
  id: string;                      // 质检记录ID，格式: "QI-{日期}-{序号}"

  // 关联字段
  factoryId: string;               // 工厂ID
  productionBatchId: string;       // 生产批次ID
  inspectorId: number;             // 检验员ID（User表）

  // 检验信息
  inspectionDate: string;          // 检验日期 "YYYY-MM-DD"

  // 数量统计
  sampleSize: number;              // 抽样数量（必须 > 0）
  passCount: number;               // 合格数量（≥ 0）
  failCount: number;               // 不合格数量（≥ 0）
  // 约束: passCount + failCount = sampleSize

  // 自动计算字段
  passRate: number;                // 合格率（%），自动计算，保留2位小数
  // 公式: (passCount / sampleSize) × 100

  result: "PASS" | "FAIL" | "CONDITIONAL";  // 检验结果
  // PASS: 合格率 ≥ 95%
  // CONDITIONAL: 90% ≤ 合格率 < 95%
  // FAIL: 合格率 < 90%

  // 附加信息
  notes?: string;                  // 备注信息（可选）

  // 时间戳
  createdAt: string;               // 创建时间（ISO 8601）
  updatedAt: string;               // 更新时间（ISO 8601）
}
```

### 数据库表结构

```sql
CREATE TABLE quality_inspections (
  id VARCHAR(191) PRIMARY KEY,
  factory_id VARCHAR(191) NOT NULL,
  production_batch_id VARCHAR(191) NOT NULL,
  inspector_id INT NOT NULL,
  inspection_date DATE NOT NULL,
  sample_size DECIMAL(10,2) NOT NULL,
  pass_count DECIMAL(10,2) NOT NULL,
  fail_count DECIMAL(10,2) NOT NULL,
  pass_rate DECIMAL(5,2),
  result VARCHAR(20),  -- PASS, FAIL, CONDITIONAL
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  INDEX idx_inspection_factory (factory_id),
  INDEX idx_inspection_batch (production_batch_id),
  INDEX idx_inspection_date (inspection_date),

  FOREIGN KEY (production_batch_id) REFERENCES production_batches(id),
  FOREIGN KEY (inspector_id) REFERENCES users(id)
);
```

---

## 业务规则

### 1. 合格率计算规则

**公式**:
```
passRate = (passCount / sampleSize) × 100
```

**保留位数**: 2位小数

**示例**:
- 抽样100个，合格98个 → 合格率 = 98.00%
- 抽样50个，合格47个 → 合格率 = 94.00%
- 抽样33个，合格30个 → 合格率 = 90.91%

### 2. 检验结果判定规则

| 合格率范围 | 结果 | 说明 | 后续操作 |
|-----------|------|------|---------|
| ≥ 95% | PASS | 质量优秀，批次放行 | 正常发货 |
| 90% ~ 94.99% | CONDITIONAL | 有条件通过 | 加强下批次监控 |
| < 90% | FAIL | 质量不合格 | 触发告警，批次隔离 |

### 3. 抽样数量规则

**最小抽样数**: 10个（建议）

**抽样比例**（根据批次大小）:
- 批次 < 100个: 抽样100%
- 100 ≤ 批次 < 500: 抽样50个
- 500 ≤ 批次 < 1000: 抽样100个
- 批次 ≥ 1000: 抽样200个

### 4. 质检时间规则

**检验时间窗口**:
- 生产批次完成后24小时内必须完成质检
- 超过24小时未质检，系统发送提醒

**检验日期**:
- 检验日期不能早于生产批次的完成日期
- 检验日期不能晚于当前日期

### 5. 权限规则

| 角色 | 创建 | 查询 | 更新 | 删除 |
|------|------|------|------|------|
| factory_super_admin | ✅ | ✅ | ✅ | ✅ |
| factory_admin | ✅ | ✅ | ✅ | ✅ |
| workshop_manager | ✅ | ✅ | ✅（仅自己创建的） | ❌ |
| other roles | ❌ | ✅（仅查询） | ❌ | ❌ |

### 6. 数据完整性规则

**必填字段约束**:
```typescript
// 创建时必填
const requiredFields = [
  'productionBatchId',
  'inspectorId',
  'inspectionDate',
  'sampleSize',
  'passCount',
  'failCount',
];

// 数量约束
passCount + failCount === sampleSize  // 必须相等
sampleSize > 0                        // 必须大于0
passCount >= 0                        // 不能为负
failCount >= 0                        // 不能为负
```

### 7. 告警触发规则

**FAIL结果触发告警**:
```typescript
if (inspection.result === 'FAIL') {
  // 创建质量告警
  createAlert({
    type: 'QUALITY_ISSUE',
    level: inspection.passRate < 80 ? 'CRITICAL' : 'WARNING',
    message: `质检不合格：批次 ${inspection.productionBatchId}`,
    details: `合格率仅 ${inspection.passRate}%，低于标准`,
    relatedEntityId: inspection.id,
  });

  // 通知相关人员
  notifyUsers([factoryAdmin, workshopManager]);
}
```

---

## 错误处理

### 错误码列表

| HTTP状态码 | 错误码 | 错误信息 | 说明 |
|-----------|-------|---------|------|
| 400 | INVALID_PARAMETER | 参数验证失败 | 请求参数不符合规则 |
| 400 | COUNT_MISMATCH | 合格数+不合格数必须等于抽样数量 | 数量不匹配 |
| 400 | INVALID_DATE | 检验日期无效 | 日期早于批次完成日期或晚于当前日期 |
| 404 | BATCH_NOT_FOUND | 生产批次不存在 | productionBatchId无效 |
| 404 | INSPECTOR_NOT_FOUND | 检验员不存在 | inspectorId无效 |
| 404 | INSPECTION_NOT_FOUND | 质检记录不存在 | inspectionId无效 |
| 403 | PERMISSION_DENIED | 权限不足 | 无权更新他人创建的质检记录 |
| 409 | DUPLICATE_INSPECTION | 该批次已存在质检记录 | 同一批次不能重复质检（根据业务规则） |

### 错误响应示例

**参数验证失败** (400):
```json
{
  "code": 400,
  "message": "参数验证失败",
  "success": false,
  "error": {
    "type": "INVALID_PARAMETER",
    "details": {
      "sampleSize": "必须大于0",
      "passCount": "不能为负数"
    }
  }
}
```

**数量不匹配** (400):
```json
{
  "code": 400,
  "message": "合格数+不合格数必须等于抽样数量",
  "success": false,
  "error": {
    "type": "COUNT_MISMATCH",
    "details": {
      "sampleSize": 100,
      "passCount": 98,
      "failCount": 3,
      "sum": 101
    }
  }
}
```

**生产批次不存在** (404):
```json
{
  "code": 404,
  "message": "生产批次不存在",
  "success": false,
  "error": {
    "type": "BATCH_NOT_FOUND",
    "details": {
      "productionBatchId": "BATCH-INVALID-001"
    }
  }
}
```

---

## 前端集成指南

### 完整API客户端实现

创建 `src/services/api/qualityInspectionApiClient.ts`:

```typescript
import { apiClient } from './apiClient';
import type { ApiResponse, PageResponse } from '@/types/apiResponses';

/**
 * 质量检验API客户端
 */

// ============ 类型定义 ============

export interface QualityInspection {
  id: string;
  factoryId: string;
  productionBatchId: string;
  inspectorId: number;
  inspectionDate: string;
  sampleSize: number;
  passCount: number;
  failCount: number;
  passRate: number;
  result: 'PASS' | 'FAIL' | 'CONDITIONAL';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInspectionRequest {
  productionBatchId: string;
  inspectorId: number;
  inspectionDate: string;
  sampleSize: number;
  passCount: number;
  failCount: number;
  notes?: string;
}

export interface UpdateInspectionRequest {
  productionBatchId?: string;
  inspectorId?: number;
  inspectionDate?: string;
  sampleSize?: number;
  passCount?: number;
  failCount?: number;
  notes?: string;
}

export interface GetInspectionsParams {
  factoryId: string;
  productionBatchId?: string;
  page?: number;
  size?: number;
}

// ============ API函数 ============

/**
 * 获取质量检验记录列表
 */
export const getQualityInspections = async (
  params: GetInspectionsParams
): Promise<ApiResponse<PageResponse<QualityInspection>>> => {
  const { factoryId, productionBatchId, page = 1, size = 20 } = params;

  const response = await apiClient.get(
    `/api/mobile/${factoryId}/quality-inspections`,
    {
      params: {
        productionBatchId,
        page,
        size,
      },
    }
  );

  return response.data;
};

/**
 * 获取质量检验记录详情
 */
export const getQualityInspectionById = async (
  factoryId: string,
  inspectionId: string
): Promise<ApiResponse<QualityInspection>> => {
  const response = await apiClient.get(
    `/api/mobile/${factoryId}/quality-inspections/${inspectionId}`
  );

  return response.data;
};

/**
 * 创建质量检验记录
 */
export const createQualityInspection = async (
  factoryId: string,
  inspection: CreateInspectionRequest
): Promise<ApiResponse<QualityInspection>> => {
  // 前端验证
  if (inspection.passCount + inspection.failCount !== inspection.sampleSize) {
    throw new Error('合格数+不合格数必须等于抽样数量');
  }

  const response = await apiClient.post(
    `/api/mobile/${factoryId}/quality-inspections`,
    inspection
  );

  return response.data;
};

/**
 * 更新质量检验记录
 */
export const updateQualityInspection = async (
  factoryId: string,
  inspectionId: string,
  updates: UpdateInspectionRequest
): Promise<ApiResponse<QualityInspection>> => {
  const response = await apiClient.put(
    `/api/mobile/${factoryId}/quality-inspections/${inspectionId}`,
    updates
  );

  return response.data;
};

// ============ 辅助函数 ============

/**
 * 计算合格率（前端预览用）
 */
export const calculatePassRate = (passCount: number, sampleSize: number): number => {
  if (sampleSize === 0) return 0;
  return Math.round((passCount / sampleSize) * 10000) / 100;  // 保留2位小数
};

/**
 * 判定检验结果（前端预览用）
 */
export const determineResult = (passRate: number): 'PASS' | 'FAIL' | 'CONDITIONAL' => {
  if (passRate >= 95) return 'PASS';
  if (passRate >= 90) return 'CONDITIONAL';
  return 'FAIL';
};

/**
 * 获取结果文本颜色
 */
export const getResultColor = (result: string): string => {
  switch (result) {
    case 'PASS':
      return '#4CAF50';      // 绿色
    case 'CONDITIONAL':
      return '#FF9800';      // 橙色
    case 'FAIL':
      return '#F44336';      // 红色
    default:
      return '#9E9E9E';      // 灰色
  }
};

/**
 * 获取结果文本
 */
export const getResultText = (result: string): string => {
  switch (result) {
    case 'PASS':
      return '合格';
    case 'CONDITIONAL':
      return '有条件通过';
    case 'FAIL':
      return '不合格';
    default:
      return '未知';
  }
};
```

### React Native页面示例

**质检记录列表页面** (`QualityInspectionListScreen.tsx`):

```typescript
import React, { useState, useEffect } from 'react';
import { View, FlatList, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { getQualityInspections, getResultColor, getResultText } from '@/services/api/qualityInspectionApiClient';
import type { QualityInspection } from '@/services/api/qualityInspectionApiClient';

const QualityInspectionListScreen: React.FC = ({ navigation }) => {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const factoryId = 'CRETAS_2024_001';  // 从用户context获取

  const loadInspections = async (pageNum: number = 1) => {
    if (!hasMore && pageNum > 1) return;

    try {
      setLoading(true);
      const result = await getQualityInspections({
        factoryId,
        page: pageNum,
        size: 20,
      });

      if (result.success) {
        if (pageNum === 1) {
          setInspections(result.data.content);
        } else {
          setInspections(prev => [...prev, ...result.data.content]);
        }
        setHasMore(result.data.hasNext);
        setPage(pageNum);
      }
    } catch (error) {
      console.error('加载质检记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInspections(1);
  }, []);

  const renderItem = ({ item }: { item: QualityInspection }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => navigation.navigate('QualityInspectionDetail', { inspectionId: item.id })}
    >
      <View style={styles.header}>
        <Text style={styles.batchId}>{item.productionBatchId}</Text>
        <View style={[styles.badge, { backgroundColor: getResultColor(item.result) }]}>
          <Text style={styles.badgeText}>{getResultText(item.result)}</Text>
        </View>
      </View>

      <View style={styles.content}>
        <Text>检验日期: {item.inspectionDate}</Text>
        <Text>抽样数: {item.sampleSize}个</Text>
        <Text>合格率: <Text style={styles.passRate}>{item.passRate}%</Text></Text>
      </View>

      {item.notes && (
        <Text style={styles.notes} numberOfLines={2}>
          {item.notes}
        </Text>
      )}
    </TouchableOpacity>
  );

  return (
    <FlatList
      data={inspections}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => loadInspections(1)} />
      }
      onEndReached={() => loadInspections(page + 1)}
      onEndReachedThreshold={0.5}
    />
  );
};

const styles = {
  card: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  batchId: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  content: {
    marginBottom: 8,
  },
  passRate: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  notes: {
    marginTop: 8,
    color: '#666',
    fontSize: 14,
    fontStyle: 'italic',
  },
};
```

---

## 总结

### 关键特性

1. **完整的CRUD操作**: 支持质检记录的创建、查询、更新
2. **自动计算**: 合格率和检验结果自动计算，减少人为错误
3. **智能判定**: 根据合格率自动判定PASS/FAIL/CONDITIONAL
4. **告警集成**: 不合格时自动触发告警通知
5. **权限控制**: 基于角色的访问控制
6. **数据验证**: 严格的参数验证和业务规则检查

### 使用建议

1. **前端验证**: 在提交前验证 `passCount + failCount = sampleSize`
2. **实时预览**: 显示合格率和判定结果的实时预览
3. **错误处理**: 处理所有可能的错误场景
4. **离线支持**: 考虑离线模式下的数据缓存
5. **批量操作**: 对于多个批次的质检，考虑批量创建功能

### 待实现功能

- 删除质检记录接口
- 批量导入/导出（Excel）
- 质检统计报表（按时间、产品类型、检验员）
- 质检照片上传
- 不合格品详细记录
- 质检标准模板管理

---

**文档结束**
