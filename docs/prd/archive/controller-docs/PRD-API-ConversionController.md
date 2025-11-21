# PRD-API-ConversionController

**文档版本**: v1.0.0
**创建日期**: 2025-01-20
**Controller**: `ConversionController.java`
**基础路径**: `/api/mobile/{factoryId}/conversions`
**功能模块**: 转换率管理 (原材料到产品转换率配置与计算)

---

## 📋 目录

- [概述](#概述)
- [端点列表](#端点列表)
- [数据模型](#数据模型)
- [API详细说明](#api详细说明)
  - [1. 创建转换率配置](#1-创建转换率配置)
  - [2. 更新转换率配置](#2-更新转换率配置)
  - [3. 删除转换率配置](#3-删除转换率配置)
  - [4. 获取转换率详情](#4-获取转换率详情)
  - [5. 分页查询转换率配置](#5-分页查询转换率配置)
  - [6. 根据原材料类型查询转换率](#6-根据原材料类型查询转换率)
  - [7. 根据产品类型查询转换率](#7-根据产品类型查询转换率)
  - [8. 获取特定原材料和产品的转换率](#8-获取特定原材料和产品的转换率)
  - [9. 计算原材料需求量](#9-计算原材料需求量)
  - [10. 计算产品产出量](#10-计算产品产出量)
  - [11. 批量激活/停用转换率配置](#11-批量激活停用转换率配置)
  - [12. 批量导入转换率配置](#12-批量导入转换率配置)
  - [13. 导出转换率配置](#13-导出转换率配置)
  - [14. 验证转换率配置](#14-验证转换率配置)
  - [15. 获取转换率统计信息](#15-获取转换率统计信息)
- [核心业务逻辑](#核心业务逻辑)
- [前端集成指南](#前端集成指南)
- [错误处理](#错误处理)
- [测试建议](#测试建议)

---

## 概述

**ConversionController** 负责管理原材料到产品的转换率配置，是生产规划和成本核算的核心模块。

### 核心功能

1. **转换率配置管理**
   - 创建、更新、删除转换率配置
   - 分页查询和条件筛选
   - 批量激活/停用

2. **转换率查询**
   - 根据原材料类型查询
   - 根据产品类型查询
   - 精准查询特定原材料-产品转换率

3. **生产计算功能**
   - 计算原材料需求量（反向计算）
   - 计算产品产出量（正向计算）
   - 考虑损耗率的实际用量计算

4. **批量操作**
   - 批量导入转换率配置
   - 导出转换率数据
   - 批量状态管理

5. **数据验证与统计**
   - 转换率配置验证
   - 统计信息汇总

### 业务价值

- **生产规划**: 根据订单需求自动计算原材料用量
- **库存管理**: 预测原材料需求，优化库存水平
- **成本核算**: 准确计算生产成本和物料损耗
- **质量控制**: 标准化生产配比，确保产品质量

---

## 端点列表

| # | HTTP方法 | 端点路径 | 功能描述 | 权限要求 |
|---|----------|---------|---------|---------|
| 1 | POST | `/api/mobile/{factoryId}/conversions` | 创建转换率配置 | 工厂管理员 |
| 2 | PUT | `/api/mobile/{factoryId}/conversions/{id}` | 更新转换率配置 | 工厂管理员 |
| 3 | DELETE | `/api/mobile/{factoryId}/conversions/{id}` | 删除转换率配置 | 超级管理员 |
| 4 | GET | `/api/mobile/{factoryId}/conversions/{id}` | 获取转换率详情 | 所有角色 |
| 5 | GET | `/api/mobile/{factoryId}/conversions` | 分页查询转换率配置 | 所有角色 |
| 6 | GET | `/api/mobile/{factoryId}/conversions/material/{materialTypeId}` | 根据原材料类型查询 | 所有角色 |
| 7 | GET | `/api/mobile/{factoryId}/conversions/product/{productTypeId}` | 根据产品类型查询 | 所有角色 |
| 8 | GET | `/api/mobile/{factoryId}/conversions/rate` | 获取特定转换率 | 所有角色 |
| 9 | POST | `/api/mobile/{factoryId}/conversions/calculate/material-requirement` | 计算原材料需求量 | 生产相关角色 |
| 10 | POST | `/api/mobile/{factoryId}/conversions/calculate/product-output` | 计算产品产出量 | 生产相关角色 |
| 11 | PUT | `/api/mobile/{factoryId}/conversions/batch/activate` | 批量激活/停用 | 工厂管理员 |
| 12 | POST | `/api/mobile/{factoryId}/conversions/import` | 批量导入 | 工厂管理员 |
| 13 | GET | `/api/mobile/{factoryId}/conversions/export` | 导出配置 | 工厂管理员 |
| 14 | POST | `/api/mobile/{factoryId}/conversions/validate` | 验证配置 | 工厂管理员 |
| 15 | GET | `/api/mobile/{factoryId}/conversions/statistics` | 获取统计信息 | 工厂管理员 |

**共计**: 15个端点

---

## 数据模型

### ConversionDTO

```typescript
interface ConversionDTO {
  id?: number;                    // 转换率ID（主键）
  materialTypeId: string;         // 原材料类型ID（必填）
  materialTypeName?: string;      // 原材料类型名称
  materialUnit?: string;          // 原材料单位
  productTypeId: string;          // 产品类型ID（必填）
  productTypeName?: string;       // 产品类型名称
  productCode?: string;           // 产品编码
  productUnit?: string;           // 产品单位
  conversionRate: number;         // 转换率（必填，0.0001-9999.9999）
  wastageRate?: number;           // 损耗率（0-100%）
  standardUsage?: number;         // 标准用量（自动计算，1/conversionRate）
  minBatchSize?: number;          // 最小批量（≥0）
  maxBatchSize?: number;          // 最大批量（≥0）
  isActive?: boolean;             // 是否启用
  notes?: string;                 // 备注说明
}
```

### 核心字段说明

#### 1. conversionRate（转换率）
- **定义**: 1单位原材料可生产的产品数量
- **示例**:
  - 1公斤面粉生产2公斤面包 → `conversionRate = 2.0`
  - 1公斤鸡肉生产0.8公斤鸡肉丸 → `conversionRate = 0.8`
- **取值范围**: 0.0001 - 9999.9999
- **精度**: 小数点后4位

#### 2. standardUsage（标准用量）
- **定义**: 生产1单位产品需要的原材料数量
- **计算公式**: `standardUsage = 1 / conversionRate`
- **示例**:
  - 如果 `conversionRate = 2.0`，则 `standardUsage = 0.5`
  - 表示生产1公斤面包需要0.5公斤面粉
- **自动计算**: 在 `@PrePersist` 和 `@PreUpdate` 时自动计算

#### 3. wastageRate（损耗率）
- **定义**: 生产过程中的原材料损耗比例（百分比）
- **取值范围**: 0 - 100
- **示例**:
  - `wastageRate = 5` 表示5%的损耗
  - 实际用量 = 标准用量 × (1 + 5%)

#### 4. actualUsage（实际用量）
- **定义**: 考虑损耗后的实际原材料用量
- **计算公式**:
  ```
  actualUsage = standardUsage × quantity × (1 + wastageRate/100)
  ```
- **示例**:
  - 生产100公斤面包，标准用量0.5，损耗率5%
  - `actualUsage = 0.5 × 100 × 1.05 = 52.5公斤`

#### 5. 批量限制
- **minBatchSize**: 最小生产批量要求（例如：10公斤）
- **maxBatchSize**: 最大生产批量限制（例如：1000公斤）
- **用途**: 约束生产计划，确保批量合理

### 数据库设计

**表名**: `material_product_conversions`

**唯一约束**:
```sql
UNIQUE KEY `uk_conversion` (`factory_id`, `material_type_id`, `product_type_id`)
```
- **含义**: 同一工厂中，同一原材料和产品的转换率配置唯一

**索引**:
```sql
INDEX `idx_conversion_factory` (`factory_id`)
INDEX `idx_conversion_material` (`material_type_id`)
INDEX `idx_conversion_product` (`product_type_id`)
```

**关联关系**:
- `factory` → `Factory` (多对一)
- `materialType` → `RawMaterialType` (多对一)
- `productType` → `ProductType` (多对一)

---

## API详细说明

### 1. 创建转换率配置

**端点**: `POST /api/mobile/{factoryId}/conversions`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**请求体** (`application/json`):
```json
{
  "materialTypeId": "MAT-001",
  "productTypeId": "PROD-001",
  "conversionRate": 2.0,
  "wastageRate": 5.0,
  "minBatchSize": 10.0,
  "maxBatchSize": 1000.0,
  "isActive": true,
  "notes": "标准配方：1公斤面粉生产2公斤面包，损耗率5%"
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "id": 1,
    "materialTypeId": "MAT-001",
    "materialTypeName": "高筋面粉",
    "materialUnit": "kg",
    "productTypeId": "PROD-001",
    "productTypeName": "全麦面包",
    "productCode": "BREAD-001",
    "productUnit": "kg",
    "conversionRate": 2.0,
    "wastageRate": 5.0,
    "standardUsage": 0.5,
    "minBatchSize": 10.0,
    "maxBatchSize": 1000.0,
    "isActive": true,
    "notes": "标准配方：1公斤面粉生产2公斤面包，损耗率5%"
  },
  "timestamp": "2025-01-20T10:30:00"
}
```

**错误响应**:
- `400 Bad Request`: 参数验证失败
  - `conversionRate` 不在范围内 (0.0001-9999.9999)
  - `wastageRate` 不在范围内 (0-100)
  - `minBatchSize` 或 `maxBatchSize` 为负数
- `409 Conflict`: 转换率配置已存在（同一工厂、原材料、产品）

#### 业务逻辑

```java
// ConversionService.createConversion()
public ConversionDTO createConversion(String factoryId, ConversionDTO dto) {
    // 1. 验证工厂存在
    validateFactory(factoryId);

    // 2. 验证原材料类型和产品类型存在
    validateMaterialType(factoryId, dto.getMaterialTypeId());
    validateProductType(factoryId, dto.getProductTypeId());

    // 3. 检查转换率配置是否已存在
    Optional<MaterialProductConversion> existing = conversionRepository
        .findByFactoryIdAndMaterialTypeIdAndProductTypeId(
            factoryId,
            dto.getMaterialTypeId(),
            dto.getProductTypeId()
        );
    if (existing.isPresent()) {
        throw new DuplicateConversionException("转换率配置已存在");
    }

    // 4. 创建转换率实体
    MaterialProductConversion conversion = new MaterialProductConversion();
    conversion.setFactoryId(factoryId);
    conversion.setMaterialTypeId(dto.getMaterialTypeId());
    conversion.setProductTypeId(dto.getProductTypeId());
    conversion.setConversionRate(dto.getConversionRate());
    conversion.setWastageRate(dto.getWastageRate() != null ? dto.getWastageRate() : BigDecimal.ZERO);
    conversion.setMinBatchSize(dto.getMinBatchSize());
    conversion.setMaxBatchSize(dto.getMaxBatchSize());
    conversion.setIsActive(dto.getIsActive() != null ? dto.getIsActive() : true);
    conversion.setNotes(dto.getNotes());

    // 5. 保存前自动计算standardUsage（@PrePersist钩子）
    // standardUsage = 1 / conversionRate

    // 6. 保存到数据库
    conversion = conversionRepository.save(conversion);

    // 7. 填充关联数据（原材料名称、产品名称等）
    return toDTO(conversion);
}
```

#### 前端集成示例

```typescript
// src/services/api/conversionApiClient.ts
export const conversionApiClient = {
  createConversion: async (
    factoryId: string,
    data: CreateConversionRequest
  ): Promise<ConversionDTO> => {
    const response = await apiClient.post<ApiResponse<ConversionDTO>>(
      `/api/mobile/${factoryId}/conversions`,
      data
    );
    return response.data.data;
  },
};

// 使用示例
const handleCreateConversion = async () => {
  try {
    const newConversion = await conversionApiClient.createConversion(
      'CRETAS_2024_001',
      {
        materialTypeId: 'MAT-001',
        productTypeId: 'PROD-001',
        conversionRate: 2.0,
        wastageRate: 5.0,
        minBatchSize: 10.0,
        maxBatchSize: 1000.0,
        isActive: true,
        notes: '标准配方',
      }
    );

    Alert.alert('成功', `转换率配置已创建，ID: ${newConversion.id}`);
  } catch (error) {
    if (error.code === 'DUPLICATE_CONVERSION') {
      Alert.alert('错误', '该转换率配置已存在');
    } else {
      Alert.alert('错误', '创建失败，请重试');
    }
  }
};
```

---

### 2. 更新转换率配置

**端点**: `PUT /api/mobile/{factoryId}/conversions/{id}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `id` (integer, 必填): 转换率ID

**请求体** (`application/json`):
```json
{
  "conversionRate": 2.2,
  "wastageRate": 4.5,
  "minBatchSize": 20.0,
  "maxBatchSize": 1500.0,
  "isActive": true,
  "notes": "更新配方：优化损耗率至4.5%"
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "id": 1,
    "materialTypeId": "MAT-001",
    "materialTypeName": "高筋面粉",
    "productTypeId": "PROD-001",
    "productTypeName": "全麦面包",
    "conversionRate": 2.2,
    "wastageRate": 4.5,
    "standardUsage": 0.4545,
    "minBatchSize": 20.0,
    "maxBatchSize": 1500.0,
    "isActive": true,
    "notes": "更新配方：优化损耗率至4.5%"
  },
  "timestamp": "2025-01-20T10:35:00"
}
```

**错误响应**:
- `404 Not Found`: 转换率ID不存在
- `403 Forbidden`: 无权限修改其他工厂的转换率

#### 业务逻辑

```java
// ConversionService.updateConversion()
public ConversionDTO updateConversion(String factoryId, Integer id, ConversionDTO dto) {
    // 1. 查找转换率配置
    MaterialProductConversion conversion = conversionRepository
        .findById(id)
        .orElseThrow(() -> new ConversionNotFoundException("转换率配置不存在"));

    // 2. 验证工厂归属
    if (!conversion.getFactoryId().equals(factoryId)) {
        throw new ForbiddenException("无权限修改其他工厂的转换率");
    }

    // 3. 更新字段
    if (dto.getConversionRate() != null) {
        conversion.setConversionRate(dto.getConversionRate());
    }
    if (dto.getWastageRate() != null) {
        conversion.setWastageRate(dto.getWastageRate());
    }
    if (dto.getMinBatchSize() != null) {
        conversion.setMinBatchSize(dto.getMinBatchSize());
    }
    if (dto.getMaxBatchSize() != null) {
        conversion.setMaxBatchSize(dto.getMaxBatchSize());
    }
    if (dto.getIsActive() != null) {
        conversion.setIsActive(dto.getIsActive());
    }
    if (dto.getNotes() != null) {
        conversion.setNotes(dto.getNotes());
    }

    // 4. 保存前重新计算standardUsage（@PreUpdate钩子）

    // 5. 保存更新
    conversion = conversionRepository.save(conversion);

    return toDTO(conversion);
}
```

#### 前端集成示例

```typescript
const handleUpdateConversion = async (id: number) => {
  try {
    const updated = await conversionApiClient.updateConversion(
      'CRETAS_2024_001',
      id,
      {
        conversionRate: 2.2,
        wastageRate: 4.5,
        notes: '优化配方',
      }
    );

    Alert.alert('成功', '转换率配置已更新');
  } catch (error) {
    Alert.alert('错误', '更新失败');
  }
};
```

---

### 3. 删除转换率配置

**端点**: `DELETE /api/mobile/{factoryId}/conversions/{id}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `id` (integer, 必填): 转换率ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": null,
  "timestamp": "2025-01-20T10:40:00"
}
```

**错误响应**:
- `404 Not Found`: 转换率ID不存在
- `409 Conflict`: 转换率正在被生产计划使用，无法删除

#### 业务逻辑

```java
// ConversionService.deleteConversion()
public void deleteConversion(String factoryId, Integer id) {
    // 1. 查找转换率配置
    MaterialProductConversion conversion = conversionRepository
        .findById(id)
        .orElseThrow(() -> new ConversionNotFoundException("转换率配置不存在"));

    // 2. 验证工厂归属
    if (!conversion.getFactoryId().equals(factoryId)) {
        throw new ForbiddenException("无权限删除其他工厂的转换率");
    }

    // 3. 检查是否被生产计划引用
    boolean isUsed = productionPlanRepository.existsByConversionId(id);
    if (isUsed) {
        throw new ConversionInUseException("转换率正在被生产计划使用，无法删除");
    }

    // 4. 执行删除（硬删除）
    conversionRepository.deleteById(id);

    log.info("转换率配置已删除: factoryId={}, id={}", factoryId, id);
}
```

#### 前端集成示例

```typescript
const handleDeleteConversion = async (id: number) => {
  Alert.alert(
    '确认删除',
    '删除后无法恢复，确定要删除该转换率配置吗？',
    [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await conversionApiClient.deleteConversion('CRETAS_2024_001', id);
            Alert.alert('成功', '转换率配置已删除');
            refreshList();
          } catch (error) {
            if (error.code === 'CONVERSION_IN_USE') {
              Alert.alert('无法删除', '该转换率正在被生产计划使用');
            } else {
              Alert.alert('错误', '删除失败');
            }
          }
        },
      },
    ]
  );
};
```

---

### 4. 获取转换率详情

**端点**: `GET /api/mobile/{factoryId}/conversions/{id}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `id` (integer, 必填): 转换率ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "id": 1,
    "materialTypeId": "MAT-001",
    "materialTypeName": "高筋面粉",
    "materialUnit": "kg",
    "productTypeId": "PROD-001",
    "productTypeName": "全麦面包",
    "productCode": "BREAD-001",
    "productUnit": "kg",
    "conversionRate": 2.0,
    "wastageRate": 5.0,
    "standardUsage": 0.5,
    "minBatchSize": 10.0,
    "maxBatchSize": 1000.0,
    "isActive": true,
    "notes": "标准配方"
  },
  "timestamp": "2025-01-20T10:45:00"
}
```

**错误响应**:
- `404 Not Found`: 转换率ID不存在

#### 业务逻辑

```java
// ConversionService.getConversion()
public ConversionDTO getConversion(String factoryId, Integer id) {
    MaterialProductConversion conversion = conversionRepository
        .findById(id)
        .orElseThrow(() -> new ConversionNotFoundException("转换率配置不存在"));

    // 验证工厂归属
    if (!conversion.getFactoryId().equals(factoryId)) {
        throw new ForbiddenException("无权限访问其他工厂的转换率");
    }

    return toDTO(conversion);
}
```

#### 前端集成示例

```typescript
const ConversionDetailScreen: React.FC = ({ route }) => {
  const { id } = route.params;
  const [conversion, setConversion] = useState<ConversionDTO | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const data = await conversionApiClient.getConversion('CRETAS_2024_001', id);
        setConversion(data);
      } catch (error) {
        Alert.alert('错误', '加载失败');
      }
    };

    fetchDetail();
  }, [id]);

  if (!conversion) return <LoadingSpinner />;

  return (
    <ScrollView>
      <Text>原材料: {conversion.materialTypeName} ({conversion.materialUnit})</Text>
      <Text>产品: {conversion.productTypeName} ({conversion.productUnit})</Text>
      <Text>转换率: {conversion.conversionRate}</Text>
      <Text>标准用量: {conversion.standardUsage}</Text>
      <Text>损耗率: {conversion.wastageRate}%</Text>
      {/* ... */}
    </ScrollView>
  );
};
```

---

### 5. 分页查询转换率配置

**端点**: `GET /api/mobile/{factoryId}/conversions`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**查询参数**:
- `isActive` (boolean, 可选): 是否启用（不传则查询全部）
- `page` (integer, 可选, 默认0): 页码
- `size` (integer, 可选, 默认20): 每页大小
- `sort` (string, 可选, 默认"id"): 排序字段
- `direction` (string, 可选, 默认"DESC"): 排序方向（ASC/DESC）

**示例请求**:
```
GET /api/mobile/CRETAS_2024_001/conversions?isActive=true&page=0&size=20&sort=id&direction=DESC
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "content": [
      {
        "id": 2,
        "materialTypeId": "MAT-002",
        "materialTypeName": "鸡肉",
        "materialUnit": "kg",
        "productTypeId": "PROD-002",
        "productTypeName": "鸡肉丸",
        "productUnit": "kg",
        "conversionRate": 0.8,
        "wastageRate": 10.0,
        "standardUsage": 1.25,
        "isActive": true
      },
      {
        "id": 1,
        "materialTypeId": "MAT-001",
        "materialTypeName": "高筋面粉",
        "productTypeId": "PROD-001",
        "productTypeName": "全麦面包",
        "conversionRate": 2.0,
        "wastageRate": 5.0,
        "standardUsage": 0.5,
        "isActive": true
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 2,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  },
  "timestamp": "2025-01-20T10:50:00"
}
```

#### 业务逻辑

```java
// ConversionService.getConversions()
public PageResponse<ConversionDTO> getConversions(
    String factoryId,
    Boolean isActive,
    Pageable pageable
) {
    Page<MaterialProductConversion> page;

    if (isActive != null) {
        // 按激活状态筛选
        page = conversionRepository.findByFactoryIdAndIsActive(factoryId, isActive, pageable);
    } else {
        // 查询全部
        page = conversionRepository.findByFactoryId(factoryId, pageable);
    }

    List<ConversionDTO> dtos = page.getContent()
        .stream()
        .map(this::toDTO)
        .collect(Collectors.toList());

    return PageResponse.<ConversionDTO>builder()
        .content(dtos)
        .page(page.getNumber())
        .size(page.getSize())
        .totalElements(page.getTotalElements())
        .totalPages(page.getTotalPages())
        .hasNext(page.hasNext())
        .hasPrevious(page.hasPrevious())
        .build();
}
```

#### 前端集成示例

```typescript
const ConversionListScreen: React.FC = () => {
  const [conversions, setConversions] = useState<ConversionDTO[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [filterActive, setFilterActive] = useState<boolean | undefined>(true);

  const loadConversions = async (pageNum: number) => {
    try {
      const response = await conversionApiClient.getConversions(
        'CRETAS_2024_001',
        {
          isActive: filterActive,
          page: pageNum,
          size: 20,
          sort: 'id',
          direction: 'DESC',
        }
      );

      if (pageNum === 0) {
        setConversions(response.content);
      } else {
        setConversions(prev => [...prev, ...response.content]);
      }

      setHasMore(response.hasNext);
    } catch (error) {
      Alert.alert('错误', '加载失败');
    }
  };

  useEffect(() => {
    loadConversions(0);
  }, [filterActive]);

  const handleLoadMore = () => {
    if (hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadConversions(nextPage);
    }
  };

  return (
    <View>
      {/* 筛选器 */}
      <Picker
        selectedValue={filterActive}
        onValueChange={value => {
          setFilterActive(value);
          setPage(0);
        }}
      >
        <Picker.Item label="全部" value={undefined} />
        <Picker.Item label="启用" value={true} />
        <Picker.Item label="停用" value={false} />
      </Picker>

      {/* 列表 */}
      <FlatList
        data={conversions}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <ConversionCard conversion={item} />
        )}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
};
```

---

### 6. 根据原材料类型查询转换率

**端点**: `GET /api/mobile/{factoryId}/conversions/material/{materialTypeId}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `materialTypeId` (string, 必填): 原材料类型ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "materialTypeId": "MAT-001",
      "materialTypeName": "高筋面粉",
      "productTypeId": "PROD-001",
      "productTypeName": "全麦面包",
      "conversionRate": 2.0,
      "standardUsage": 0.5,
      "isActive": true
    },
    {
      "id": 3,
      "materialTypeId": "MAT-001",
      "materialTypeName": "高筋面粉",
      "productTypeId": "PROD-003",
      "productTypeName": "法式面包",
      "conversionRate": 1.8,
      "standardUsage": 0.5556,
      "isActive": true
    }
  ],
  "timestamp": "2025-01-20T11:00:00"
}
```

#### 业务逻辑

```java
// ConversionService.getConversionsByMaterial()
public List<ConversionDTO> getConversionsByMaterial(String factoryId, String materialTypeId) {
    List<MaterialProductConversion> conversions = conversionRepository
        .findByFactoryIdAndMaterialTypeIdAndIsActive(factoryId, materialTypeId, true);

    return conversions.stream()
        .map(this::toDTO)
        .collect(Collectors.toList());
}
```

#### 前端集成示例

```typescript
// 用途：在选择原材料后，显示可生产的产品列表
const MaterialSelectionScreen: React.FC = () => {
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null);
  const [availableProducts, setAvailableProducts] = useState<ConversionDTO[]>([]);

  const handleMaterialSelect = async (materialTypeId: string) => {
    setSelectedMaterial(materialTypeId);

    try {
      const conversions = await conversionApiClient.getConversionsByMaterial(
        'CRETAS_2024_001',
        materialTypeId
      );
      setAvailableProducts(conversions);
    } catch (error) {
      Alert.alert('错误', '加载可生产产品失败');
    }
  };

  return (
    <View>
      <Text>已选原材料: {selectedMaterial}</Text>
      <Text>可生产的产品:</Text>
      {availableProducts.map(conv => (
        <View key={conv.id}>
          <Text>{conv.productTypeName}</Text>
          <Text>转换率: {conv.conversionRate}</Text>
        </View>
      ))}
    </View>
  );
};
```

---

### 7. 根据产品类型查询转换率

**端点**: `GET /api/mobile/{factoryId}/conversions/product/{productTypeId}`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID
- `productTypeId` (string, 必填): 产品类型ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "materialTypeId": "MAT-001",
      "materialTypeName": "高筋面粉",
      "productTypeId": "PROD-001",
      "productTypeName": "全麦面包",
      "conversionRate": 2.0,
      "standardUsage": 0.5,
      "isActive": true
    },
    {
      "id": 5,
      "materialTypeId": "MAT-005",
      "materialTypeName": "酵母",
      "productTypeId": "PROD-001",
      "productTypeName": "全麦面包",
      "conversionRate": 100.0,
      "standardUsage": 0.01,
      "isActive": true
    }
  ],
  "timestamp": "2025-01-20T11:05:00"
}
```

#### 业务逻辑

```java
// ConversionService.getConversionsByProduct()
public List<ConversionDTO> getConversionsByProduct(String factoryId, String productTypeId) {
    List<MaterialProductConversion> conversions = conversionRepository
        .findByFactoryIdAndProductTypeIdAndIsActive(factoryId, productTypeId, true);

    return conversions.stream()
        .map(this::toDTO)
        .collect(Collectors.toList());
}
```

#### 前端集成示例

```typescript
// 用途：在生产计划中，显示生产某产品需要的所有原材料
const ProductionPlanScreen: React.FC = () => {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [requiredMaterials, setRequiredMaterials] = useState<ConversionDTO[]>([]);

  const handleProductSelect = async (productTypeId: string) => {
    setSelectedProduct(productTypeId);

    try {
      const conversions = await conversionApiClient.getConversionsByProduct(
        'CRETAS_2024_001',
        productTypeId
      );
      setRequiredMaterials(conversions);
    } catch (error) {
      Alert.alert('错误', '加载所需原材料失败');
    }
  };

  return (
    <View>
      <Text>生产产品: {selectedProduct}</Text>
      <Text>所需原材料:</Text>
      {requiredMaterials.map(conv => (
        <View key={conv.id}>
          <Text>{conv.materialTypeName}</Text>
          <Text>标准用量: {conv.standardUsage} {conv.materialUnit}/单位</Text>
          <Text>损耗率: {conv.wastageRate}%</Text>
        </View>
      ))}
    </View>
  );
};
```

---

### 8. 获取特定原材料和产品的转换率

**端点**: `GET /api/mobile/{factoryId}/conversions/rate`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**查询参数**:
- `materialTypeId` (string, 必填): 原材料类型ID
- `productTypeId` (string, 必填): 产品类型ID

**示例请求**:
```
GET /api/mobile/CRETAS_2024_001/conversions/rate?materialTypeId=MAT-001&productTypeId=PROD-001
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "id": 1,
    "materialTypeId": "MAT-001",
    "materialTypeName": "高筋面粉",
    "materialUnit": "kg",
    "productTypeId": "PROD-001",
    "productTypeName": "全麦面包",
    "productUnit": "kg",
    "conversionRate": 2.0,
    "wastageRate": 5.0,
    "standardUsage": 0.5,
    "isActive": true
  },
  "timestamp": "2025-01-20T11:10:00"
}
```

**错误响应**:
- `404 Not Found`: 未找到对应的转换率配置

#### 业务逻辑

```java
// ConversionService.getConversionRate()
public ConversionDTO getConversionRate(String factoryId, String materialTypeId, String productTypeId) {
    MaterialProductConversion conversion = conversionRepository
        .findByFactoryIdAndMaterialTypeIdAndProductTypeId(factoryId, materialTypeId, productTypeId)
        .orElseThrow(() -> new ConversionNotFoundException(
            String.format("未找到转换率配置: material=%s, product=%s", materialTypeId, productTypeId)
        ));

    return toDTO(conversion);
}
```

#### 前端集成示例

```typescript
// 用途：在生产时实时查询转换率
const ProductionScreen: React.FC = () => {
  const [materialId, setMaterialId] = useState('MAT-001');
  const [productId, setProductId] = useState('PROD-001');
  const [conversion, setConversion] = useState<ConversionDTO | null>(null);

  useEffect(() => {
    const fetchConversionRate = async () => {
      if (!materialId || !productId) return;

      try {
        const rate = await conversionApiClient.getConversionRate(
          'CRETAS_2024_001',
          materialId,
          productId
        );
        setConversion(rate);
      } catch (error) {
        if (error.status === 404) {
          Alert.alert('警告', '未配置该原材料到产品的转换率');
        }
      }
    };

    fetchConversionRate();
  }, [materialId, productId]);

  return (
    <View>
      {conversion && (
        <>
          <Text>转换率: {conversion.conversionRate}</Text>
          <Text>标准用量: {conversion.standardUsage}</Text>
          <Text>损耗率: {conversion.wastageRate}%</Text>
        </>
      )}
    </View>
  );
};
```

---

### 9. 计算原材料需求量

**端点**: `POST /api/mobile/{factoryId}/conversions/calculate/material-requirement`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**查询参数**:
- `productTypeId` (string, 必填): 产品类型ID
- `productQuantity` (number, 必填): 产品数量

**示例请求**:
```
POST /api/mobile/CRETAS_2024_001/conversions/calculate/material-requirement?productTypeId=PROD-001&productQuantity=100
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": [
    {
      "materialTypeId": "MAT-001",
      "materialTypeName": "高筋面粉",
      "materialUnit": "kg",
      "standardQuantity": 50.0,
      "actualQuantity": 52.5,
      "wastageRate": 5.0,
      "wastageQuantity": 2.5,
      "conversionRate": 2.0,
      "notes": "生产100kg面包需要52.5kg面粉（含5%损耗）"
    },
    {
      "materialTypeId": "MAT-005",
      "materialTypeName": "酵母",
      "materialUnit": "kg",
      "standardQuantity": 1.0,
      "actualQuantity": 1.2,
      "wastageRate": 20.0,
      "wastageQuantity": 0.2,
      "conversionRate": 100.0,
      "notes": "生产100kg面包需要1.2kg酵母（含20%损耗）"
    }
  ],
  "timestamp": "2025-01-20T11:15:00"
}
```

#### 业务逻辑

```java
// ConversionService.calculateMaterialRequirement()
public List<MaterialRequirement> calculateMaterialRequirement(
    String factoryId,
    String productTypeId,
    BigDecimal productQuantity
) {
    // 1. 查询该产品所有相关的转换率配置
    List<MaterialProductConversion> conversions = conversionRepository
        .findByFactoryIdAndProductTypeIdAndIsActive(factoryId, productTypeId, true);

    if (conversions.isEmpty()) {
        throw new NoConversionException("该产品未配置转换率");
    }

    // 2. 遍历每个转换率，计算原材料需求
    List<MaterialRequirement> requirements = new ArrayList<>();

    for (MaterialProductConversion conversion : conversions) {
        MaterialRequirement req = new MaterialRequirement();

        // 2.1 获取原材料信息
        req.setMaterialTypeId(conversion.getMaterialTypeId());
        req.setMaterialTypeName(conversion.getMaterialType().getName());
        req.setMaterialUnit(conversion.getMaterialType().getUnit());

        // 2.2 计算标准用量（不含损耗）
        // standardQuantity = standardUsage × productQuantity
        BigDecimal standardQuantity = conversion.getStandardUsage()
            .multiply(productQuantity);
        req.setStandardQuantity(standardQuantity);

        // 2.3 计算实际用量（含损耗）
        // actualQuantity = standardQuantity × (1 + wastageRate/100)
        BigDecimal wastageRate = conversion.getWastageRate();
        BigDecimal wastageMultiplier = BigDecimal.ONE
            .add(wastageRate.divide(new BigDecimal(100)));
        BigDecimal actualQuantity = standardQuantity.multiply(wastageMultiplier);
        req.setActualQuantity(actualQuantity);

        // 2.4 计算损耗量
        BigDecimal wastageQuantity = actualQuantity.subtract(standardQuantity);
        req.setWastageQuantity(wastageQuantity);
        req.setWastageRate(wastageRate);

        // 2.5 其他信息
        req.setConversionRate(conversion.getConversionRate());
        req.setNotes(String.format(
            "生产%.2f%s%s需要%.2f%s%s（含%.1f%%损耗）",
            productQuantity,
            conversion.getProductType().getUnit(),
            conversion.getProductType().getName(),
            actualQuantity,
            req.getMaterialUnit(),
            req.getMaterialTypeName(),
            wastageRate
        ));

        requirements.add(req);
    }

    return requirements;
}

// MaterialRequirement内部类
@Data
@Builder
public static class MaterialRequirement {
    private String materialTypeId;
    private String materialTypeName;
    private String materialUnit;
    private BigDecimal standardQuantity;    // 标准用量（不含损耗）
    private BigDecimal actualQuantity;      // 实际用量（含损耗）
    private BigDecimal wastageRate;         // 损耗率
    private BigDecimal wastageQuantity;     // 损耗量
    private BigDecimal conversionRate;      // 转换率
    private String notes;
}
```

#### 前端集成示例

```typescript
// 用途：生产计划-计算所需原材料
const ProductionPlanCalculator: React.FC = () => {
  const [productId, setProductId] = useState('PROD-001');
  const [quantity, setQuantity] = useState(100);
  const [requirements, setRequirements] = useState<MaterialRequirement[]>([]);

  const handleCalculate = async () => {
    try {
      const results = await conversionApiClient.calculateMaterialRequirement(
        'CRETAS_2024_001',
        productId,
        quantity
      );
      setRequirements(results);
    } catch (error) {
      Alert.alert('错误', '计算失败');
    }
  };

  return (
    <View>
      <TextInput
        placeholder="产品数量"
        value={quantity.toString()}
        onChangeText={text => setQuantity(parseFloat(text))}
        keyboardType="numeric"
      />
      <Button title="计算原材料需求" onPress={handleCalculate} />

      <Text>所需原材料清单:</Text>
      {requirements.map((req, index) => (
        <View key={index} style={styles.materialCard}>
          <Text style={styles.materialName}>{req.materialTypeName}</Text>
          <Text>标准用量: {req.standardQuantity} {req.materialUnit}</Text>
          <Text>实际用量: {req.actualQuantity} {req.materialUnit}</Text>
          <Text>损耗: {req.wastageQuantity} {req.materialUnit} ({req.wastageRate}%)</Text>
          <Text style={styles.notes}>{req.notes}</Text>
        </View>
      ))}
    </View>
  );
};
```

---

### 10. 计算产品产出量

**端点**: `POST /api/mobile/{factoryId}/conversions/calculate/product-output`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**查询参数**:
- `materialTypeId` (string, 必填): 原材料类型ID
- `materialQuantity` (number, 必填): 原材料数量

**示例请求**:
```
POST /api/mobile/CRETAS_2024_001/conversions/calculate/product-output?materialTypeId=MAT-001&materialQuantity=100
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": [
    {
      "productTypeId": "PROD-001",
      "productTypeName": "全麦面包",
      "productUnit": "kg",
      "theoreticalOutput": 200.0,
      "actualOutput": 190.0,
      "wastageRate": 5.0,
      "conversionRate": 2.0,
      "notes": "100kg面粉理论可生产200kg面包，考虑5%损耗后实际产出190kg"
    },
    {
      "productTypeId": "PROD-003",
      "productTypeName": "法式面包",
      "productUnit": "kg",
      "theoreticalOutput": 180.0,
      "actualOutput": 171.0,
      "wastageRate": 5.0,
      "conversionRate": 1.8,
      "notes": "100kg面粉理论可生产180kg法式面包，考虑5%损耗后实际产出171kg"
    }
  ],
  "timestamp": "2025-01-20T11:20:00"
}
```

#### 业务逻辑

```java
// ConversionService.calculateProductOutput()
public List<ProductOutput> calculateProductOutput(
    String factoryId,
    String materialTypeId,
    BigDecimal materialQuantity
) {
    // 1. 查询该原材料所有相关的转换率配置
    List<MaterialProductConversion> conversions = conversionRepository
        .findByFactoryIdAndMaterialTypeIdAndIsActive(factoryId, materialTypeId, true);

    if (conversions.isEmpty()) {
        throw new NoConversionException("该原材料未配置转换率");
    }

    // 2. 遍历每个转换率，计算产品产出
    List<ProductOutput> outputs = new ArrayList<>();

    for (MaterialProductConversion conversion : conversions) {
        ProductOutput output = new ProductOutput();

        // 2.1 获取产品信息
        output.setProductTypeId(conversion.getProductTypeId());
        output.setProductTypeName(conversion.getProductType().getName());
        output.setProductUnit(conversion.getProductType().getUnit());

        // 2.2 计算理论产出（不考虑损耗）
        // theoreticalOutput = materialQuantity × conversionRate
        BigDecimal theoreticalOutput = materialQuantity
            .multiply(conversion.getConversionRate());
        output.setTheoreticalOutput(theoreticalOutput);

        // 2.3 计算实际产出（考虑损耗）
        // actualOutput = theoreticalOutput × (1 - wastageRate/100)
        BigDecimal wastageRate = conversion.getWastageRate();
        BigDecimal yieldRate = BigDecimal.ONE
            .subtract(wastageRate.divide(new BigDecimal(100)));
        BigDecimal actualOutput = theoreticalOutput.multiply(yieldRate);
        output.setActualOutput(actualOutput);

        // 2.4 其他信息
        output.setWastageRate(wastageRate);
        output.setConversionRate(conversion.getConversionRate());
        output.setNotes(String.format(
            "%.2f%s%s理论可生产%.2f%s%s，考虑%.1f%%损耗后实际产出%.2f%s",
            materialQuantity,
            conversion.getMaterialType().getUnit(),
            conversion.getMaterialType().getName(),
            theoreticalOutput,
            output.getProductUnit(),
            output.getProductTypeName(),
            wastageRate,
            actualOutput,
            output.getProductUnit()
        ));

        outputs.add(output);
    }

    return outputs;
}

// ProductOutput内部类
@Data
@Builder
public static class ProductOutput {
    private String productTypeId;
    private String productTypeName;
    private String productUnit;
    private BigDecimal theoreticalOutput;   // 理论产出（不考虑损耗）
    private BigDecimal actualOutput;        // 实际产出（考虑损耗）
    private BigDecimal wastageRate;         // 损耗率
    private BigDecimal conversionRate;      // 转换率
    private String notes;
}
```

#### 前端集成示例

```typescript
// 用途：原材料盘点-计算可生产的产品数量
const MaterialInventoryScreen: React.FC = () => {
  const [materialId, setMaterialId] = useState('MAT-001');
  const [quantity, setQuantity] = useState(100);
  const [outputs, setOutputs] = useState<ProductOutput[]>([]);

  const handleCalculate = async () => {
    try {
      const results = await conversionApiClient.calculateProductOutput(
        'CRETAS_2024_001',
        materialId,
        quantity
      );
      setOutputs(results);
    } catch (error) {
      Alert.alert('错误', '计算失败');
    }
  };

  return (
    <View>
      <Text>原材料: {materialId}</Text>
      <TextInput
        placeholder="库存数量"
        value={quantity.toString()}
        onChangeText={text => setQuantity(parseFloat(text))}
        keyboardType="numeric"
      />
      <Button title="计算可生产产品" onPress={handleCalculate} />

      <Text>可生产的产品:</Text>
      {outputs.map((output, index) => (
        <View key={index} style={styles.productCard}>
          <Text style={styles.productName}>{output.productTypeName}</Text>
          <Text>理论产出: {output.theoreticalOutput} {output.productUnit}</Text>
          <Text>实际产出: {output.actualOutput} {output.productUnit}</Text>
          <Text>转换率: {output.conversionRate}</Text>
          <Text>损耗率: {output.wastageRate}%</Text>
          <Text style={styles.notes}>{output.notes}</Text>
        </View>
      ))}
    </View>
  );
};
```

---

### 11. 批量激活/停用转换率配置

**端点**: `PUT /api/mobile/{factoryId}/conversions/batch/activate`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**查询参数**:
- `isActive` (boolean, 必填): 激活状态（true=激活，false=停用）

**请求体** (`application/json`):
```json
[1, 2, 3, 4, 5]
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": null,
  "timestamp": "2025-01-20T11:25:00"
}
```

#### 业务逻辑

```java
// ConversionService.updateActiveStatus()
public void updateActiveStatus(String factoryId, List<Integer> ids, Boolean isActive) {
    // 1. 批量查询转换率配置
    List<MaterialProductConversion> conversions = conversionRepository.findAllById(ids);

    // 2. 验证工厂归属并更新状态
    for (MaterialProductConversion conversion : conversions) {
        if (!conversion.getFactoryId().equals(factoryId)) {
            throw new ForbiddenException("无权限修改其他工厂的转换率");
        }
        conversion.setIsActive(isActive);
    }

    // 3. 批量保存
    conversionRepository.saveAll(conversions);

    log.info("批量更新转换率状态: factoryId={}, count={}, isActive={}",
        factoryId, ids.size(), isActive);
}
```

#### 前端集成示例

```typescript
const ConversionListScreen: React.FC = () => {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const handleBatchActivate = async (isActive: boolean) => {
    if (selectedIds.length === 0) {
      Alert.alert('提示', '请先选择转换率配置');
      return;
    }

    try {
      await conversionApiClient.updateActiveStatus(
        'CRETAS_2024_001',
        selectedIds,
        isActive
      );

      Alert.alert('成功', `已${isActive ? '激活' : '停用'}${selectedIds.length}个转换率配置`);
      refreshList();
    } catch (error) {
      Alert.alert('错误', '批量操作失败');
    }
  };

  return (
    <View>
      <View style={styles.toolbar}>
        <Button title="批量激活" onPress={() => handleBatchActivate(true)} />
        <Button title="批量停用" onPress={() => handleBatchActivate(false)} />
      </View>

      <FlatList
        data={conversions}
        renderItem={({ item }) => (
          <CheckBox
            title={`${item.materialTypeName} → ${item.productTypeName}`}
            checked={selectedIds.includes(item.id)}
            onPress={() => toggleSelection(item.id)}
          />
        )}
      />
    </View>
  );
};
```

---

### 12. 批量导入转换率配置

**端点**: `POST /api/mobile/{factoryId}/conversions/import`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**请求体** (`application/json`):
```json
[
  {
    "materialTypeId": "MAT-001",
    "productTypeId": "PROD-001",
    "conversionRate": 2.0,
    "wastageRate": 5.0,
    "minBatchSize": 10.0,
    "maxBatchSize": 1000.0,
    "isActive": true,
    "notes": "标准配方"
  },
  {
    "materialTypeId": "MAT-002",
    "productTypeId": "PROD-002",
    "conversionRate": 0.8,
    "wastageRate": 10.0,
    "isActive": true
  }
]
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "materialTypeId": "MAT-001",
      "productTypeId": "PROD-001",
      "conversionRate": 2.0,
      "isActive": true
    },
    {
      "id": 2,
      "materialTypeId": "MAT-002",
      "productTypeId": "PROD-002",
      "conversionRate": 0.8,
      "isActive": true
    }
  ],
  "timestamp": "2025-01-20T11:30:00"
}
```

#### 业务逻辑

```java
// ConversionService.importConversions()
@Transactional
public List<ConversionDTO> importConversions(String factoryId, List<ConversionDTO> conversions) {
    List<ConversionDTO> importedList = new ArrayList<>();

    for (ConversionDTO dto : conversions) {
        try {
            // 1. 检查是否已存在
            Optional<MaterialProductConversion> existing = conversionRepository
                .findByFactoryIdAndMaterialTypeIdAndProductTypeId(
                    factoryId,
                    dto.getMaterialTypeId(),
                    dto.getProductTypeId()
                );

            MaterialProductConversion conversion;
            if (existing.isPresent()) {
                // 更新已存在的配置
                conversion = existing.get();
                conversion.setConversionRate(dto.getConversionRate());
                conversion.setWastageRate(dto.getWastageRate());
                conversion.setMinBatchSize(dto.getMinBatchSize());
                conversion.setMaxBatchSize(dto.getMaxBatchSize());
                conversion.setIsActive(dto.getIsActive());
                conversion.setNotes(dto.getNotes());
            } else {
                // 创建新配置
                conversion = new MaterialProductConversion();
                conversion.setFactoryId(factoryId);
                conversion.setMaterialTypeId(dto.getMaterialTypeId());
                conversion.setProductTypeId(dto.getProductTypeId());
                conversion.setConversionRate(dto.getConversionRate());
                conversion.setWastageRate(dto.getWastageRate());
                conversion.setMinBatchSize(dto.getMinBatchSize());
                conversion.setMaxBatchSize(dto.getMaxBatchSize());
                conversion.setIsActive(dto.getIsActive());
                conversion.setNotes(dto.getNotes());
            }

            conversion = conversionRepository.save(conversion);
            importedList.add(toDTO(conversion));

        } catch (Exception e) {
            log.error("导入转换率失败: {}", dto, e);
            // 继续处理下一条
        }
    }

    log.info("批量导入转换率完成: factoryId={}, total={}, success={}",
        factoryId, conversions.size(), importedList.size());

    return importedList;
}
```

#### 前端集成示例

```typescript
const ConversionImportScreen: React.FC = () => {
  const [importData, setImportData] = useState<ConversionDTO[]>([]);

  const handleImport = async () => {
    try {
      const results = await conversionApiClient.importConversions(
        'CRETAS_2024_001',
        importData
      );

      Alert.alert(
        '导入完成',
        `成功导入${results.length}/${importData.length}条转换率配置`
      );
    } catch (error) {
      Alert.alert('错误', '导入失败');
    }
  };

  return (
    <View>
      <Button title="选择Excel文件" onPress={pickExcelFile} />
      <Button title="导入" onPress={handleImport} />

      <Text>预览数据:</Text>
      {importData.map((item, index) => (
        <Text key={index}>
          {item.materialTypeId} → {item.productTypeId}: {item.conversionRate}
        </Text>
      ))}
    </View>
  );
};
```

---

### 13. 导出转换率配置

**端点**: `GET /api/mobile/{factoryId}/conversions/export`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": [
    {
      "id": 1,
      "materialTypeId": "MAT-001",
      "materialTypeName": "高筋面粉",
      "productTypeId": "PROD-001",
      "productTypeName": "全麦面包",
      "conversionRate": 2.0,
      "wastageRate": 5.0,
      "standardUsage": 0.5,
      "isActive": true
    },
    {
      "id": 2,
      "materialTypeId": "MAT-002",
      "materialTypeName": "鸡肉",
      "productTypeId": "PROD-002",
      "productTypeName": "鸡肉丸",
      "conversionRate": 0.8,
      "wastageRate": 10.0,
      "standardUsage": 1.25,
      "isActive": true
    }
  ],
  "timestamp": "2025-01-20T11:35:00"
}
```

#### 业务逻辑

```java
// ConversionService.exportConversions()
public List<ConversionDTO> exportConversions(String factoryId) {
    List<MaterialProductConversion> conversions = conversionRepository
        .findByFactoryId(factoryId);

    return conversions.stream()
        .map(this::toDTO)
        .collect(Collectors.toList());
}
```

#### 前端集成示例

```typescript
const ConversionListScreen: React.FC = () => {
  const handleExport = async () => {
    try {
      const data = await conversionApiClient.exportConversions('CRETAS_2024_001');

      // 转换为CSV格式
      const csv = convertToCSV(data);

      // 保存文件
      const fileName = `转换率配置_${new Date().toISOString().split('T')[0]}.csv`;
      await FileSystem.writeAsStringAsync(
        FileSystem.documentDirectory + fileName,
        csv,
        { encoding: FileSystem.EncodingType.UTF8 }
      );

      Alert.alert('成功', `已导出${data.length}条记录到${fileName}`);
    } catch (error) {
      Alert.alert('错误', '导出失败');
    }
  };

  const convertToCSV = (data: ConversionDTO[]): string => {
    const headers = ['原材料ID', '原材料名称', '产品ID', '产品名称', '转换率', '损耗率', '状态'];
    const rows = data.map(item => [
      item.materialTypeId,
      item.materialTypeName,
      item.productTypeId,
      item.productTypeName,
      item.conversionRate,
      item.wastageRate,
      item.isActive ? '启用' : '停用',
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  };

  return (
    <View>
      <Button title="导出转换率配置" onPress={handleExport} />
    </View>
  );
};
```

---

### 14. 验证转换率配置

**端点**: `POST /api/mobile/{factoryId}/conversions/validate`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

**请求体** (`application/json`):
```json
{
  "materialTypeId": "MAT-001",
  "productTypeId": "PROD-001",
  "conversionRate": 2.0,
  "wastageRate": 5.0
}
```

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "isValid": true,
    "errors": [],
    "warnings": [
      "损耗率5%高于行业平均水平3%"
    ],
    "suggestions": [
      "建议设置最小批量以提高生产效率"
    ]
  },
  "timestamp": "2025-01-20T11:40:00"
}
```

**验证失败响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "isValid": false,
    "errors": [
      "转换率不能为0",
      "损耗率不能超过100%"
    ],
    "warnings": [],
    "suggestions": []
  },
  "timestamp": "2025-01-20T11:40:00"
}
```

#### 业务逻辑

```java
// ConversionService.validateConversion()
public ValidationResult validateConversion(String factoryId, ConversionDTO dto) {
    ValidationResult result = new ValidationResult();
    List<String> errors = new ArrayList<>();
    List<String> warnings = new ArrayList<>();
    List<String> suggestions = new ArrayList<>();

    // 1. 必填字段验证
    if (dto.getMaterialTypeId() == null || dto.getMaterialTypeId().isEmpty()) {
        errors.add("原材料类型ID不能为空");
    }
    if (dto.getProductTypeId() == null || dto.getProductTypeId().isEmpty()) {
        errors.add("产品类型ID不能为空");
    }
    if (dto.getConversionRate() == null) {
        errors.add("转换率不能为空");
    }

    // 2. 转换率范围验证
    if (dto.getConversionRate() != null) {
        if (dto.getConversionRate().compareTo(BigDecimal.ZERO) <= 0) {
            errors.add("转换率必须大于0");
        }
        if (dto.getConversionRate().compareTo(new BigDecimal("9999.9999")) > 0) {
            errors.add("转换率不能超过9999.9999");
        }
    }

    // 3. 损耗率验证
    if (dto.getWastageRate() != null) {
        if (dto.getWastageRate().compareTo(BigDecimal.ZERO) < 0) {
            errors.add("损耗率不能为负数");
        }
        if (dto.getWastageRate().compareTo(new BigDecimal(100)) > 0) {
            errors.add("损耗率不能超过100%");
        }

        // 损耗率过高警告
        if (dto.getWastageRate().compareTo(new BigDecimal(10)) > 0) {
            warnings.add(String.format("损耗率%.1f%%较高，请确认是否合理", dto.getWastageRate()));
        }
    }

    // 4. 批量限制验证
    if (dto.getMinBatchSize() != null && dto.getMaxBatchSize() != null) {
        if (dto.getMinBatchSize().compareTo(dto.getMaxBatchSize()) > 0) {
            errors.add("最小批量不能大于最大批量");
        }
    }

    // 5. 原材料和产品类型验证
    if (dto.getMaterialTypeId() != null && !dto.getMaterialTypeId().isEmpty()) {
        boolean materialExists = materialTypeRepository
            .existsByIdAndFactoryId(dto.getMaterialTypeId(), factoryId);
        if (!materialExists) {
            errors.add("原材料类型不存在");
        }
    }

    if (dto.getProductTypeId() != null && !dto.getProductTypeId().isEmpty()) {
        boolean productExists = productTypeRepository
            .existsByIdAndFactoryId(dto.getProductTypeId(), factoryId);
        if (!productExists) {
            errors.add("产品类型不存在");
        }
    }

    // 6. 重复性验证
    if (dto.getMaterialTypeId() != null && dto.getProductTypeId() != null) {
        boolean exists = conversionRepository
            .existsByFactoryIdAndMaterialTypeIdAndProductTypeId(
                factoryId, dto.getMaterialTypeId(), dto.getProductTypeId()
            );
        if (exists) {
            errors.add("该转换率配置已存在");
        }
    }

    // 7. 建议
    if (dto.getMinBatchSize() == null) {
        suggestions.add("建议设置最小批量以提高生产效率");
    }
    if (dto.getMaxBatchSize() == null) {
        suggestions.add("建议设置最大批量以控制生产规模");
    }
    if (dto.getNotes() == null || dto.getNotes().isEmpty()) {
        suggestions.add("建议添加备注说明，便于理解转换率配置");
    }

    result.setIsValid(errors.isEmpty());
    result.setErrors(errors);
    result.setWarnings(warnings);
    result.setSuggestions(suggestions);

    return result;
}

// ValidationResult内部类
@Data
@Builder
public static class ValidationResult {
    private Boolean isValid;
    private List<String> errors;
    private List<String> warnings;
    private List<String> suggestions;
}
```

#### 前端集成示例

```typescript
const ConversionFormScreen: React.FC = () => {
  const [formData, setFormData] = useState<ConversionDTO>({
    materialTypeId: '',
    productTypeId: '',
    conversionRate: 0,
    wastageRate: 0,
  });

  const handleValidate = async () => {
    try {
      const result = await conversionApiClient.validateConversion(
        'CRETAS_2024_001',
        formData
      );

      if (!result.isValid) {
        Alert.alert('验证失败', result.errors.join('\n'));
      } else if (result.warnings.length > 0) {
        Alert.alert('警告', result.warnings.join('\n'));
      } else {
        Alert.alert('验证通过', '转换率配置有效');
      }

      if (result.suggestions.length > 0) {
        console.log('建议:', result.suggestions);
      }
    } catch (error) {
      Alert.alert('错误', '验证失败');
    }
  };

  return (
    <View>
      <Button title="验证配置" onPress={handleValidate} />
    </View>
  );
};
```

---

### 15. 获取转换率统计信息

**端点**: `GET /api/mobile/{factoryId}/conversions/statistics`

#### 请求参数

**路径参数**:
- `factoryId` (string, 必填): 工厂ID

#### 响应结构

**成功响应** (200 OK):
```json
{
  "code": "SUCCESS",
  "message": "操作成功",
  "data": {
    "totalCount": 25,
    "activeCount": 20,
    "inactiveCount": 5,
    "materialTypeCount": 10,
    "productTypeCount": 8,
    "averageConversionRate": 1.5,
    "averageWastageRate": 6.5,
    "highWastageCount": 3,
    "topMaterials": [
      {
        "materialTypeId": "MAT-001",
        "materialTypeName": "高筋面粉",
        "conversionCount": 5,
        "products": ["全麦面包", "法式面包", "吐司"]
      }
    ],
    "topProducts": [
      {
        "productTypeId": "PROD-001",
        "productTypeName": "全麦面包",
        "conversionCount": 3,
        "materials": ["高筋面粉", "酵母", "水"]
      }
    ]
  },
  "timestamp": "2025-01-20T11:45:00"
}
```

#### 业务逻辑

```java
// ConversionService.getStatistics()
public ConversionStatistics getStatistics(String factoryId) {
    // 1. 基础统计
    long totalCount = conversionRepository.countByFactoryId(factoryId);
    long activeCount = conversionRepository.countByFactoryIdAndIsActive(factoryId, true);
    long inactiveCount = totalCount - activeCount;

    // 2. 原材料和产品类型统计
    long materialTypeCount = conversionRepository.countDistinctMaterialTypesByFactoryId(factoryId);
    long productTypeCount = conversionRepository.countDistinctProductTypesByFactoryId(factoryId);

    // 3. 平均转换率和损耗率
    List<MaterialProductConversion> allConversions = conversionRepository
        .findByFactoryIdAndIsActive(factoryId, true);

    BigDecimal avgConversionRate = allConversions.stream()
        .map(MaterialProductConversion::getConversionRate)
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .divide(new BigDecimal(allConversions.size()), 4, BigDecimal.ROUND_HALF_UP);

    BigDecimal avgWastageRate = allConversions.stream()
        .map(MaterialProductConversion::getWastageRate)
        .reduce(BigDecimal.ZERO, BigDecimal::add)
        .divide(new BigDecimal(allConversions.size()), 2, BigDecimal.ROUND_HALF_UP);

    // 4. 高损耗率统计（>10%）
    long highWastageCount = allConversions.stream()
        .filter(c -> c.getWastageRate().compareTo(new BigDecimal(10)) > 0)
        .count();

    // 5. Top原材料（按转换率配置数量排序）
    List<TopMaterialStat> topMaterials = conversionRepository
        .findTopMaterialsByConversionCount(factoryId, PageRequest.of(0, 5));

    // 6. Top产品（按转换率配置数量排序）
    List<TopProductStat> topProducts = conversionRepository
        .findTopProductsByConversionCount(factoryId, PageRequest.of(0, 5));

    return ConversionStatistics.builder()
        .totalCount(totalCount)
        .activeCount(activeCount)
        .inactiveCount(inactiveCount)
        .materialTypeCount(materialTypeCount)
        .productTypeCount(productTypeCount)
        .averageConversionRate(avgConversionRate)
        .averageWastageRate(avgWastageRate)
        .highWastageCount(highWastageCount)
        .topMaterials(topMaterials)
        .topProducts(topProducts)
        .build();
}

// ConversionStatistics内部类
@Data
@Builder
public static class ConversionStatistics {
    private Long totalCount;
    private Long activeCount;
    private Long inactiveCount;
    private Long materialTypeCount;
    private Long productTypeCount;
    private BigDecimal averageConversionRate;
    private BigDecimal averageWastageRate;
    private Long highWastageCount;
    private List<TopMaterialStat> topMaterials;
    private List<TopProductStat> topProducts;
}
```

#### 前端集成示例

```typescript
const ConversionStatisticsScreen: React.FC = () => {
  const [stats, setStats] = useState<ConversionStatistics | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await conversionApiClient.getStatistics('CRETAS_2024_001');
        setStats(data);
      } catch (error) {
        Alert.alert('错误', '加载统计信息失败');
      }
    };

    fetchStats();
  }, []);

  if (!stats) return <LoadingSpinner />;

  return (
    <ScrollView>
      <Card title="转换率配置概览">
        <Text>总配置数: {stats.totalCount}</Text>
        <Text>启用: {stats.activeCount}</Text>
        <Text>停用: {stats.inactiveCount}</Text>
      </Card>

      <Card title="覆盖范围">
        <Text>原材料类型数: {stats.materialTypeCount}</Text>
        <Text>产品类型数: {stats.productTypeCount}</Text>
      </Card>

      <Card title="平均指标">
        <Text>平均转换率: {stats.averageConversionRate}</Text>
        <Text>平均损耗率: {stats.averageWastageRate}%</Text>
        <Text>高损耗配置数: {stats.highWastageCount}</Text>
      </Card>

      <Card title="Top原材料">
        {stats.topMaterials.map(material => (
          <View key={material.materialTypeId}>
            <Text>{material.materialTypeName}</Text>
            <Text>转换配置数: {material.conversionCount}</Text>
            <Text>可生产产品: {material.products.join(', ')}</Text>
          </View>
        ))}
      </Card>

      <Card title="Top产品">
        {stats.topProducts.map(product => (
          <View key={product.productTypeId}>
            <Text>{product.productTypeName}</Text>
            <Text>转换配置数: {product.conversionCount}</Text>
            <Text>所需原材料: {product.materials.join(', ')}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
};
```

---

## 核心业务逻辑

### 1. 转换率计算公式

#### 1.1 基础转换率
```
conversionRate = 产品产出量 / 原材料投入量
```

**示例**:
- 1公斤面粉生产2公斤面包 → `conversionRate = 2.0`
- 1公斤鸡肉生产0.8公斤鸡肉丸 → `conversionRate = 0.8`

#### 1.2 标准用量（自动计算）
```
standardUsage = 1 / conversionRate
```

**示例**:
- `conversionRate = 2.0` → `standardUsage = 0.5`（生产1kg产品需要0.5kg原材料）
- `conversionRate = 0.8` → `standardUsage = 1.25`（生产1kg产品需要1.25kg原材料）

#### 1.3 实际用量（考虑损耗）
```
actualUsage = standardUsage × productQuantity × (1 + wastageRate/100)
```

**示例**:
- 生产100kg面包，标准用量0.5，损耗率5%
- `actualUsage = 0.5 × 100 × 1.05 = 52.5kg`

#### 1.4 理论产出（不考虑损耗）
```
theoreticalOutput = materialQuantity × conversionRate
```

#### 1.5 实际产出（考虑损耗）
```
actualOutput = theoreticalOutput × (1 - wastageRate/100)
```

**示例**:
- 100kg面粉，转换率2.0，损耗率5%
- 理论产出: `100 × 2.0 = 200kg`
- 实际产出: `200 × (1 - 0.05) = 190kg`

---

### 2. 数据库钩子函数

#### @PrePersist 和 @PreUpdate
```java
@PrePersist
@PreUpdate
public void calculateStandardUsage() {
    if (conversionRate != null && conversionRate.compareTo(BigDecimal.ZERO) > 0) {
        // 标准用量 = 1 / 转换率
        this.standardUsage = BigDecimal.ONE.divide(
            conversionRate,
            4,
            BigDecimal.ROUND_HALF_UP
        );
    }
}
```

**作用**: 在保存或更新转换率时，自动计算并更新 `standardUsage` 字段。

---

### 3. 唯一约束保证

**约束**: `UNIQUE(factory_id, material_type_id, product_type_id)`

**含义**: 同一工厂中，同一原材料和产品的转换率配置唯一。

**示例**:
- ✅ 允许: 工厂A - 面粉 → 面包 (转换率2.0)
- ✅ 允许: 工厂B - 面粉 → 面包 (转换率1.8)
- ❌ 禁止: 工厂A - 面粉 → 面包 (再次配置，会冲突)

---

### 4. 批量限制验证

```java
// 验证批量范围
if (minBatchSize != null && maxBatchSize != null) {
    if (minBatchSize.compareTo(maxBatchSize) > 0) {
        throw new ValidationException("最小批量不能大于最大批量");
    }
}

// 验证生产计划数量
if (plannedQuantity.compareTo(minBatchSize) < 0) {
    throw new ValidationException("生产数量不能小于最小批量");
}
if (plannedQuantity.compareTo(maxBatchSize) > 0) {
    throw new ValidationException("生产数量不能超过最大批量");
}
```

---

## 前端集成指南

### 完整API客户端

```typescript
// src/services/api/conversionApiClient.ts
import { apiClient } from './apiClient';
import type { ApiResponse, PageResponse } from '@/types/api';
import type { ConversionDTO, MaterialRequirement, ProductOutput, ValidationResult, ConversionStatistics } from '@/types/conversion';

export const conversionApiClient = {
  // 1. CRUD操作
  createConversion: async (
    factoryId: string,
    data: Omit<ConversionDTO, 'id'>
  ): Promise<ConversionDTO> => {
    const response = await apiClient.post<ApiResponse<ConversionDTO>>(
      `/api/mobile/${factoryId}/conversions`,
      data
    );
    return response.data.data;
  },

  updateConversion: async (
    factoryId: string,
    id: number,
    data: Partial<ConversionDTO>
  ): Promise<ConversionDTO> => {
    const response = await apiClient.put<ApiResponse<ConversionDTO>>(
      `/api/mobile/${factoryId}/conversions/${id}`,
      data
    );
    return response.data.data;
  },

  deleteConversion: async (factoryId: string, id: number): Promise<void> => {
    await apiClient.delete(`/api/mobile/${factoryId}/conversions/${id}`);
  },

  getConversion: async (factoryId: string, id: number): Promise<ConversionDTO> => {
    const response = await apiClient.get<ApiResponse<ConversionDTO>>(
      `/api/mobile/${factoryId}/conversions/${id}`
    );
    return response.data.data;
  },

  // 2. 查询操作
  getConversions: async (
    factoryId: string,
    params: {
      isActive?: boolean;
      page?: number;
      size?: number;
      sort?: string;
      direction?: 'ASC' | 'DESC';
    }
  ): Promise<PageResponse<ConversionDTO>> => {
    const response = await apiClient.get<ApiResponse<PageResponse<ConversionDTO>>>(
      `/api/mobile/${factoryId}/conversions`,
      { params }
    );
    return response.data.data;
  },

  getConversionsByMaterial: async (
    factoryId: string,
    materialTypeId: string
  ): Promise<ConversionDTO[]> => {
    const response = await apiClient.get<ApiResponse<ConversionDTO[]>>(
      `/api/mobile/${factoryId}/conversions/material/${materialTypeId}`
    );
    return response.data.data;
  },

  getConversionsByProduct: async (
    factoryId: string,
    productTypeId: string
  ): Promise<ConversionDTO[]> => {
    const response = await apiClient.get<ApiResponse<ConversionDTO[]>>(
      `/api/mobile/${factoryId}/conversions/product/${productTypeId}`
    );
    return response.data.data;
  },

  getConversionRate: async (
    factoryId: string,
    materialTypeId: string,
    productTypeId: string
  ): Promise<ConversionDTO> => {
    const response = await apiClient.get<ApiResponse<ConversionDTO>>(
      `/api/mobile/${factoryId}/conversions/rate`,
      { params: { materialTypeId, productTypeId } }
    );
    return response.data.data;
  },

  // 3. 计算功能
  calculateMaterialRequirement: async (
    factoryId: string,
    productTypeId: string,
    productQuantity: number
  ): Promise<MaterialRequirement[]> => {
    const response = await apiClient.post<ApiResponse<MaterialRequirement[]>>(
      `/api/mobile/${factoryId}/conversions/calculate/material-requirement`,
      null,
      { params: { productTypeId, productQuantity } }
    );
    return response.data.data;
  },

  calculateProductOutput: async (
    factoryId: string,
    materialTypeId: string,
    materialQuantity: number
  ): Promise<ProductOutput[]> => {
    const response = await apiClient.post<ApiResponse<ProductOutput[]>>(
      `/api/mobile/${factoryId}/conversions/calculate/product-output`,
      null,
      { params: { materialTypeId, materialQuantity } }
    );
    return response.data.data;
  },

  // 4. 批量操作
  updateActiveStatus: async (
    factoryId: string,
    ids: number[],
    isActive: boolean
  ): Promise<void> => {
    await apiClient.put(
      `/api/mobile/${factoryId}/conversions/batch/activate`,
      ids,
      { params: { isActive } }
    );
  },

  importConversions: async (
    factoryId: string,
    conversions: ConversionDTO[]
  ): Promise<ConversionDTO[]> => {
    const response = await apiClient.post<ApiResponse<ConversionDTO[]>>(
      `/api/mobile/${factoryId}/conversions/import`,
      conversions
    );
    return response.data.data;
  },

  exportConversions: async (factoryId: string): Promise<ConversionDTO[]> => {
    const response = await apiClient.get<ApiResponse<ConversionDTO[]>>(
      `/api/mobile/${factoryId}/conversions/export`
    );
    return response.data.data;
  },

  // 5. 验证与统计
  validateConversion: async (
    factoryId: string,
    data: ConversionDTO
  ): Promise<ValidationResult> => {
    const response = await apiClient.post<ApiResponse<ValidationResult>>(
      `/api/mobile/${factoryId}/conversions/validate`,
      data
    );
    return response.data.data;
  },

  getStatistics: async (factoryId: string): Promise<ConversionStatistics> => {
    const response = await apiClient.get<ApiResponse<ConversionStatistics>>(
      `/api/mobile/${factoryId}/conversions/statistics`
    );
    return response.data.data;
  },
};
```

---

## 错误处理

### 常见错误码

| 错误码 | HTTP状态码 | 说明 | 前端处理 |
|--------|-----------|------|---------|
| `CONVERSION_NOT_FOUND` | 404 | 转换率配置不存在 | 提示用户并返回列表页 |
| `DUPLICATE_CONVERSION` | 409 | 转换率配置已存在 | 提示重复并建议编辑已有配置 |
| `CONVERSION_IN_USE` | 409 | 转换率被生产计划引用 | 提示无法删除，建议停用 |
| `INVALID_CONVERSION_RATE` | 400 | 转换率值无效 | 显示验证错误 |
| `INVALID_WASTAGE_RATE` | 400 | 损耗率值无效 | 显示验证错误 |
| `MATERIAL_TYPE_NOT_FOUND` | 404 | 原材料类型不存在 | 提示并刷新原材料列表 |
| `PRODUCT_TYPE_NOT_FOUND` | 404 | 产品类型不存在 | 提示并刷新产品列表 |
| `NO_CONVERSION_CONFIGURED` | 404 | 未配置转换率 | 提示并引导配置 |

### 错误处理示例

```typescript
try {
  const conversion = await conversionApiClient.createConversion(factoryId, data);
} catch (error) {
  if (error.code === 'DUPLICATE_CONVERSION') {
    Alert.alert(
      '转换率已存在',
      '该原材料到产品的转换率已配置，是否编辑已有配置？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '编辑',
          onPress: () => navigation.navigate('EditConversion', { id: error.data.existingId })
        },
      ]
    );
  } else if (error.code === 'MATERIAL_TYPE_NOT_FOUND') {
    Alert.alert('错误', '原材料类型不存在，请刷新列表');
  } else {
    Alert.alert('错误', '创建失败，请重试');
  }
}
```

---

## 测试建议

### 1. 单元测试

```java
// ConversionServiceTest.java
@SpringBootTest
class ConversionServiceTest {

    @Autowired
    private ConversionService conversionService;

    @Test
    void testCreateConversion_Success() {
        ConversionDTO dto = ConversionDTO.builder()
            .materialTypeId("MAT-001")
            .productTypeId("PROD-001")
            .conversionRate(new BigDecimal("2.0"))
            .wastageRate(new BigDecimal("5.0"))
            .build();

        ConversionDTO result = conversionService.createConversion("FACTORY-001", dto);

        assertNotNull(result.getId());
        assertEquals(new BigDecimal("0.5"), result.getStandardUsage());
    }

    @Test
    void testCalculateStandardUsage() {
        MaterialProductConversion conversion = new MaterialProductConversion();
        conversion.setConversionRate(new BigDecimal("2.0"));
        conversion.calculateStandardUsage();

        assertEquals(new BigDecimal("0.5000"), conversion.getStandardUsage());
    }

    @Test
    void testCalculateActualUsage() {
        MaterialProductConversion conversion = new MaterialProductConversion();
        conversion.setStandardUsage(new BigDecimal("0.5"));
        conversion.setWastageRate(new BigDecimal("5.0"));

        BigDecimal actualUsage = conversion.calculateActualUsage(new BigDecimal("100"));

        assertEquals(new BigDecimal("52.5"), actualUsage);
    }
}
```

### 2. 集成测试

```bash
#!/bin/bash
# test_conversion_apis.sh

FACTORY_ID="CRETAS_2024_001"
BASE_URL="http://localhost:10010"
TOKEN="your_jwt_token"

# 1. 创建转换率配置
echo "1. 创建转换率配置"
CONVERSION_ID=$(curl -s -X POST \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/conversions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "materialTypeId": "MAT-001",
    "productTypeId": "PROD-001",
    "conversionRate": 2.0,
    "wastageRate": 5.0,
    "minBatchSize": 10.0,
    "maxBatchSize": 1000.0,
    "isActive": true
  }' | jq -r '.data.id')

echo "创建成功，ID: $CONVERSION_ID"

# 2. 计算原材料需求量
echo "2. 计算原材料需求量"
curl -s -X POST \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/conversions/calculate/material-requirement?productTypeId=PROD-001&productQuantity=100" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

# 3. 计算产品产出量
echo "3. 计算产品产出量"
curl -s -X POST \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/conversions/calculate/product-output?materialTypeId=MAT-001&materialQuantity=100" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

# 4. 获取统计信息
echo "4. 获取统计信息"
curl -s -X GET \
  "${BASE_URL}/api/mobile/${FACTORY_ID}/conversions/statistics" \
  -H "Authorization: Bearer ${TOKEN}" | jq '.data'

echo "✅ 所有测试完成"
```

### 3. 前端测试

```typescript
// __tests__/conversionApiClient.test.ts
import { conversionApiClient } from '@/services/api/conversionApiClient';

describe('ConversionApiClient', () => {
  const factoryId = 'CRETAS_2024_001';

  it('should create conversion', async () => {
    const data = {
      materialTypeId: 'MAT-001',
      productTypeId: 'PROD-001',
      conversionRate: 2.0,
      wastageRate: 5.0,
      isActive: true,
    };

    const result = await conversionApiClient.createConversion(factoryId, data);

    expect(result.id).toBeDefined();
    expect(result.standardUsage).toBe(0.5);
  });

  it('should calculate material requirement', async () => {
    const results = await conversionApiClient.calculateMaterialRequirement(
      factoryId,
      'PROD-001',
      100
    );

    expect(results).toHaveLength(1);
    expect(results[0].actualQuantity).toBeGreaterThan(results[0].standardQuantity);
  });
});
```

---

## 总结

**ConversionController** 是生产管理的核心模块，提供了完整的转换率配置和计算功能：

1. **15个API端点**: 涵盖CRUD、查询、计算、批量操作和统计
2. **双向计算**: 正向计算产品产出，反向计算原材料需求
3. **损耗管理**: 支持损耗率配置和实际用量计算
4. **批量限制**: 最小/最大批量约束
5. **数据验证**: 完整的验证逻辑和友好的错误提示

**关键业务价值**:
- 生产规划自动化
- 成本核算精准化
- 库存管理智能化
- 质量控制标准化

---

**文档完成日期**: 2025-01-20
**端点覆盖**: 15/15 (100%)
**预估文档字数**: ~18,000 words
