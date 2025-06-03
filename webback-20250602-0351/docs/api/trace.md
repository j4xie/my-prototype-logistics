# 溯源API文档

<!-- updated for: 项目重构阶段一 - 文档统一与更新 -->

## 概述

溯源模块是食品溯源系统的核心模块，提供了一系列API用于管理溯源批次、查询溯源信息和生成溯源凭证。所有API端点都需要认证，除了公开的溯源查询接口。

## 基础信息

**基础路径**: `/v1/traces`

**需要认证**: 是（除公开查询外）

## 溯源批次管理

### 获取溯源批次列表

获取所有溯源批次的分页列表。

**请求**:

```http
GET /v1/traces
Authorization: Bearer {token}
```

**查询参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| page | 整数 | 页码，默认1 |
| limit | 整数 | 每页数量，默认10 |
| status | 字符串 | 批次状态筛选 |
| search | 字符串 | 搜索关键词 |
| fromDate | ISO日期 | 创建日期下限 |
| toDate | ISO日期 | 创建日期上限 |
| sortBy | 字符串 | 排序字段，默认createdAt |
| sortDir | 字符串 | 排序方向，asc或desc |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": [
    {
      "id": "trace-123",
      "name": "Apple Batch A123",
      "description": "Organic Apples from Farm A",
      "productId": "prod-apple-01",
      "productName": "Organic Red Apple",
      "quantity": 1000,
      "unit": "kg",
      "batchCode": "AP20230515A123",
      "qrCode": "https://example.com/qr/AP20230515A123",
      "status": "active",
      "farmId": "farm-123",
      "farmName": "Green Valley Farm",
      "processingIds": ["proc-234", "proc-235"],
      "logisticsIds": ["log-345"],
      "certifications": ["organic", "pesticide-free"],
      "createdAt": "2023-05-15T10:30:00Z",
      "updatedAt": "2023-05-16T14:20:00Z"
    },
    // 更多批次...
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalItems": 42,
    "totalPages": 5
  }
}
```

### 创建溯源批次

创建新的溯源批次。

**请求**:

```http
POST /v1/traces
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Apple Batch A123",
  "description": "Organic Apples from Farm A",
  "productId": "prod-apple-01",
  "quantity": 1000,
  "unit": "kg",
  "farmId": "farm-123",
  "harvestDate": "2023-05-15T08:00:00Z",
  "certifications": ["organic", "pesticide-free"],
  "attributes": {
    "variety": "Red Delicious",
    "grading": "Premium",
    "packaging": "Wooden Crates"
  }
}
```

**响应** (201 Created):

```json
{
  "status": "success",
  "data": {
    "id": "trace-123",
    "name": "Apple Batch A123",
    "description": "Organic Apples from Farm A",
    "productId": "prod-apple-01",
    "quantity": 1000,
    "unit": "kg",
    "batchCode": "AP20230515A123",
    "qrCode": "https://example.com/qr/AP20230515A123",
    "status": "active",
    "farmId": "farm-123",
    "harvestDate": "2023-05-15T08:00:00Z",
    "certifications": ["organic", "pesticide-free"],
    "attributes": {
      "variety": "Red Delicious",
      "grading": "Premium",
      "packaging": "Wooden Crates"
    },
    "createdAt": "2023-05-15T10:30:00Z",
    "updatedAt": "2023-05-15T10:30:00Z"
  }
}
```

### 获取溯源批次详情

获取特定溯源批次的详细信息。

**请求**:

```http
GET /v1/traces/{traceId}
Authorization: Bearer {token}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "id": "trace-123",
    "name": "Apple Batch A123",
    "description": "Organic Apples from Farm A",
    "productId": "prod-apple-01",
    "productName": "Organic Red Apple",
    "quantity": 1000,
    "unit": "kg",
    "batchCode": "AP20230515A123",
    "qrCode": "https://example.com/qr/AP20230515A123",
    "status": "active",
    "farmId": "farm-123",
    "farmName": "Green Valley Farm",
    "farmDetails": {
      "location": "California, USA",
      "owner": "John Smith",
      "certifications": ["organic", "sustainable"]
    },
    "harvestDate": "2023-05-15T08:00:00Z",
    "processing": [
      {
        "id": "proc-234",
        "type": "cleaning",
        "date": "2023-05-16T09:00:00Z",
        "facility": "Clean Process Inc.",
        "details": {
          "method": "Water Washing",
          "temperature": "15°C",
          "duration": "30 minutes"
        }
      },
      {
        "id": "proc-235",
        "type": "packaging",
        "date": "2023-05-16T14:00:00Z",
        "facility": "Pack Fresh Ltd.",
        "details": {
          "method": "Vacuum Sealing",
          "material": "Biodegradable Film",
          "batchSize": "20kg per package"
        }
      }
    ],
    "logistics": [
      {
        "id": "log-345",
        "type": "transport",
        "carrier": "Fast Delivery Co.",
        "vehicleId": "TRK-789",
        "departureTime": "2023-05-17T08:00:00Z",
        "arrivalTime": "2023-05-17T14:00:00Z",
        "origin": "Farm Storage",
        "destination": "Distribution Center",
        "temperature": "4°C",
        "conditions": "Refrigerated"
      }
    ],
    "certifications": ["organic", "pesticide-free"],
    "qualityTests": [
      {
        "id": "qt-456",
        "type": "pesticide-residue",
        "date": "2023-05-16T10:00:00Z",
        "laboratory": "Food Safety Lab",
        "results": "No residues detected",
        "status": "passed"
      }
    ],
    "attributes": {
      "variety": "Red Delicious",
      "grading": "Premium",
      "packaging": "Wooden Crates",
      "shelfLife": "30 days"
    },
    "timeline": [
      {
        "date": "2023-05-15T08:00:00Z",
        "event": "Harvested",
        "details": "Harvested at optimal ripeness"
      },
      {
        "date": "2023-05-16T09:00:00Z",
        "event": "Cleaned",
        "details": "Washed and sorted"
      },
      {
        "date": "2023-05-16T14:00:00Z",
        "event": "Packaged",
        "details": "Vacuum sealed in biodegradable packaging"
      },
      {
        "date": "2023-05-17T08:00:00Z",
        "event": "Shipped",
        "details": "Transported to distribution center"
      }
    ],
    "createdAt": "2023-05-15T10:30:00Z",
    "updatedAt": "2023-05-17T15:20:00Z"
  }
}
```

### 更新溯源批次

部分更新溯源批次信息。

**请求**:

```http
PATCH /v1/traces/{traceId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Updated Batch Name",
  "description": "Updated description",
  "status": "completed",
  "attributes": {
    "grading": "Super Premium",
    "notes": "Exceptionally good quality"
  }
}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "id": "trace-123",
    "name": "Updated Batch Name",
    "description": "Updated description",
    "status": "completed",
    // 其他字段...
    "attributes": {
      "variety": "Red Delicious",
      "grading": "Super Premium",
      "packaging": "Wooden Crates",
      "notes": "Exceptionally good quality"
    },
    "updatedAt": "2023-05-18T09:15:00Z"
  }
}
```

### 删除溯源批次

删除指定的溯源批次。

**请求**:

```http
DELETE /v1/traces/{traceId}
Authorization: Bearer {token}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**响应** (204 No Content)

## 溯源事件管理

### 添加溯源事件

为溯源批次添加新事件（如处理、检测、物流等）。

**请求**:

```http
POST /v1/traces/{traceId}/events
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "processing",
  "date": "2023-05-19T10:00:00Z",
  "title": "Heat Treatment",
  "description": "Pasteurization process",
  "location": "Processing Facility B",
  "operatorId": "user-456",
  "details": {
    "method": "Steam Pasteurization",
    "temperature": "75°C",
    "duration": "15 minutes",
    "equipment": "Pasteurizer Model P500"
  },
  "attachments": [
    {
      "type": "image",
      "url": "https://example.com/images/pasteurization-123.jpg",
      "title": "Pasteurization Process"
    },
    {
      "type": "document",
      "url": "https://example.com/docs/pasteurization-cert-123.pdf",
      "title": "Pasteurization Certificate"
    }
  ]
}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**响应** (201 Created):

```json
{
  "status": "success",
  "data": {
    "id": "event-789",
    "traceId": "trace-123",
    "type": "processing",
    "date": "2023-05-19T10:00:00Z",
    "title": "Heat Treatment",
    "description": "Pasteurization process",
    "location": "Processing Facility B",
    "operatorId": "user-456",
    "operatorName": "Jane Operator",
    "details": {
      "method": "Steam Pasteurization",
      "temperature": "75°C",
      "duration": "15 minutes",
      "equipment": "Pasteurizer Model P500"
    },
    "attachments": [
      {
        "id": "att-901",
        "type": "image",
        "url": "https://example.com/images/pasteurization-123.jpg",
        "title": "Pasteurization Process"
      },
      {
        "id": "att-902",
        "type": "document",
        "url": "https://example.com/docs/pasteurization-cert-123.pdf",
        "title": "Pasteurization Certificate"
      }
    ],
    "createdAt": "2023-05-19T10:15:00Z",
    "updatedAt": "2023-05-19T10:15:00Z"
  }
}
```

### 获取溯源事件列表

获取溯源批次的所有事件。

**请求**:

```http
GET /v1/traces/{traceId}/events
Authorization: Bearer {token}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**查询参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| type | 字符串 | 按事件类型筛选 |
| fromDate | ISO日期 | 事件日期下限 |
| toDate | ISO日期 | 事件日期上限 |
| sortDir | 字符串 | 排序方向，默认asc（按日期升序） |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": [
    {
      "id": "event-780",
      "traceId": "trace-123",
      "type": "harvest",
      "date": "2023-05-15T08:00:00Z",
      "title": "Harvesting",
      "description": "Harvested at optimal ripeness",
      "location": "Field A5",
      "operatorId": "user-123",
      "operatorName": "John Harvester",
      "details": {
        "method": "Manual Picking",
        "weather": "Sunny, 22°C",
        "batchSize": "1000kg"
      },
      "attachments": [],
      "createdAt": "2023-05-15T10:30:00Z",
      "updatedAt": "2023-05-15T10:30:00Z"
    },
    // 更多事件...
  ],
  "meta": {
    "totalItems": 5
  }
}
```

## 公开溯源查询

### 通过批次编码查询溯源信息

公开接口，允许消费者通过批次编码或扫描二维码查询产品溯源信息。

**请求**:

```http
GET /v1/traces/public/{batchCode}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| batchCode | 溯源批次编码 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "batchCode": "AP20230515A123",
    "productName": "Organic Red Apple",
    "productDescription": "Premium organic red apples grown with sustainable practices",
    "productImage": "https://example.com/images/red-apple.jpg",
    "producer": {
      "name": "Green Valley Farm",
      "location": "California, USA",
      "certifications": ["organic", "sustainable"]
    },
    "journey": [
      {
        "stage": "Farm",
        "date": "2023-05-15",
        "location": "Green Valley Farm, California",
        "description": "Harvested at optimal ripeness",
        "image": "https://example.com/images/harvest.jpg"
      },
      {
        "stage": "Processing",
        "date": "2023-05-16",
        "location": "Clean Process Inc., California",
        "description": "Washed and sorted",
        "image": "https://example.com/images/processing.jpg"
      },
      {
        "stage": "Packaging",
        "date": "2023-05-16",
        "location": "Pack Fresh Ltd., California",
        "description": "Vacuum sealed in biodegradable packaging",
        "image": "https://example.com/images/packaging.jpg"
      },
      {
        "stage": "Distribution",
        "date": "2023-05-17",
        "location": "Distribution Center, San Francisco",
        "description": "Quality checked and prepared for retail",
        "image": "https://example.com/images/distribution.jpg"
      }
    ],
    "certifications": [
      {
        "name": "Organic Certified",
        "issuer": "USDA Organic",
        "validUntil": "2024-01-01",
        "image": "https://example.com/images/organic-cert.png"
      },
      {
        "name": "Pesticide-Free",
        "issuer": "Clean Food Association",
        "validUntil": "2024-01-01",
        "image": "https://example.com/images/pesticide-free.png"
      }
    ],
    "nutritionalInfo": {
      "servingSize": "1 medium apple (182g)",
      "calories": 95,
      "protein": "0.5g",
      "carbohydrates": "25g",
      "fiber": "4g",
      "sugar": "19g",
      "fat": "0.3g"
    },
    "storageGuide": "Best stored in refrigerator. Consume within 2 weeks of purchase.",
    "verificationDate": "2023-05-20T15:40:00Z"
  }
}
```

## 溯源证书管理

### 生成溯源证书

为溯源批次生成正式的溯源证书PDF。

**请求**:

```http
POST /v1/traces/{traceId}/certificates
Content-Type: application/json
Authorization: Bearer {token}

{
  "type": "official",
  "language": "en",
  "includeDetails": true,
  "templateId": "template-standard"
}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**响应** (201 Created):

```json
{
  "status": "success",
  "data": {
    "id": "cert-567",
    "traceId": "trace-123",
    "batchCode": "AP20230515A123",
    "type": "official",
    "language": "en",
    "certificateNumber": "CERT-20230520-567",
    "issueDate": "2023-05-20T16:00:00Z",
    "validUntil": "2024-05-20T23:59:59Z",
    "pdfUrl": "https://example.com/certificates/CERT-20230520-567.pdf",
    "verificationUrl": "https://verify.example.com/cert/CERT-20230520-567",
    "createdAt": "2023-05-20T16:00:00Z",
    "updatedAt": "2023-05-20T16:00:00Z"
  }
}
```

## 统计与分析

### 获取溯源批次统计数据

获取溯源批次的统计数据，如查询次数、受欢迎程度等。

**请求**:

```http
GET /v1/traces/{traceId}/statistics
Authorization: Bearer {token}
```

**路径参数**:

| 参数 | 描述 |
|------|------|
| traceId | 溯源批次ID |

**查询参数**:

| 参数 | 类型 | 描述 |
|------|------|------|
| period | 字符串 | 统计周期，可选值：day, week, month, year, all |
| fromDate | ISO日期 | 统计开始日期 |
| toDate | ISO日期 | 统计结束日期 |

**响应** (200 OK):

```json
{
  "status": "success",
  "data": {
    "traceId": "trace-123",
    "batchCode": "AP20230515A123",
    "totalScans": 256,
    "uniqueScans": 189,
    "scansByRegion": [
      {"region": "California", "count": 98},
      {"region": "New York", "count": 45},
      {"region": "Texas", "count": 27},
      {"region": "Other", "count": 86}
    ],
    "scansByDevice": [
      {"device": "iOS", "count": 120},
      {"device": "Android", "count": 102},
      {"device": "Web", "count": 34}
    ],
    "scansByTime": [
      {"date": "2023-05-18", "count": 45},
      {"date": "2023-05-19", "count": 78},
      {"date": "2023-05-20", "count": 133}
    ],
    "averageScanDuration": 65,
    "certificateDownloads": 42,
    "feedbackCount": 18,
    "averageRating": 4.7
  }
}
```

## 错误响应示例

### 资源不存在

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "status": "error",
  "code": "RESOURCE_NOT_FOUND",
  "message": "Trace batch not found",
  "details": [
    {
      "field": "traceId",
      "message": "Trace with ID trace-999 does not exist"
    }
  ]
}
```

### 验证错误

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/json

{
  "status": "error",
  "code": "VALIDATION_FAILED",
  "message": "Validation failed",
  "details": [
    {
      "field": "quantity",
      "message": "Quantity must be a positive number"
    },
    {
      "field": "harvestDate",
      "message": "Harvest date cannot be in the future"
    }
  ]
}
```

### 权限错误

```http
HTTP/1.1 403 Forbidden
Content-Type: application/json

{
  "status": "error",
  "code": "PERMISSION_DENIED",
  "message": "You do not have permission to update this trace batch",
  "details": []
}
``` 