# 农业模块API文档

<!-- updated for: TASK-P2-007 API接口文档完善 - 创建农业模块API文档 -->

## 概述

农业模块API提供种植/养殖记录管理、环境数据采集、农事活动记录和农场信息管理功能。支持从种植到收获的完整农业生产过程数字化管理。

**基础路径**: `/api/v1/farming`

**需要认证**: 所有接口需要JWT Bearer Token认证

**权限要求**: 
- 读取操作: `read:farms`
- 写入操作: `write:farms`
- 管理操作: `admin:farms`

## 数据模型

### 农场信息 (Farm)

```typescript
interface Farm {
  id: string;                    // 农场唯一标识
  name: string;                  // 农场名称
  location: LocationInfo;        // 地理位置信息
  farmType: 'CROP' | 'LIVESTOCK' | 'MIXED';  // 农场类型
  certifications: string[];      // 认证证书列表
  ownerId: string;              // 农场主用户ID
  contactInfo: ContactInfo;      // 联系信息
  totalArea: number;            // 总面积(平方米)
  establishedDate: string;      // 建立日期
  description?: string;         // 农场描述
  isActive: boolean;            // 是否活跃状态
  createdAt: string;            // 创建时间
  updatedAt: string;            // 更新时间
}

interface LocationInfo {
  province: string;             // 省份
  city: string;                // 城市
  district: string;            // 区县
  address: string;             // 详细地址
  latitude?: number;           // 纬度
  longitude?: number;          // 经度
}

interface ContactInfo {
  phone: string;               // 联系电话
  email?: string;             // 邮箱
  contactPerson: string;       // 联系人
}
```

### 种植/养殖记录 (FarmingRecord)

```typescript
interface FarmingRecord {
  id: string;                  // 记录唯一标识
  farmId: string;              // 所属农场ID
  traceId: string;             // 关联溯源批次ID
  recordType: 'CROP' | 'LIVESTOCK';  // 记录类型
  cropType?: string;           // 作物类型(种植记录)
  livestockType?: string;      // 牲畜类型(养殖记录)
  variety: string;             // 品种
  plantingDate?: string;       // 种植日期
  breedingStartDate?: string;  // 养殖开始日期
  harvestDate?: string;        // 收获日期
  area?: number;               // 种植面积(平方米)
  quantity?: number;           // 养殖数量(头/只)
  environmentData: EnvironmentData[];  // 环境数据
  activities: FarmingActivity[];       // 农事活动
  status: 'PLANTED' | 'GROWING' | 'HARVESTED' | 'BREEDING' | 'COMPLETED';
  yield?: number;              // 产量(kg)
  qualityGrade?: string;       // 质量等级
  notes?: string;              // 备注信息
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}
```

### 环境数据 (EnvironmentData)

```typescript
interface EnvironmentData {
  id: string;                  // 环境数据ID
  farmingRecordId: string;     // 关联种植记录ID
  measurementDate: string;     // 测量日期
  temperature: number;         // 温度(摄氏度)
  humidity: number;            // 湿度(%)
  soilPh?: number;            // 土壤pH值
  soilMoisture?: number;      // 土壤湿度(%)
  rainfall?: number;          // 降雨量(mm)
  sunlightHours?: number;     // 光照时间(小时)
  windSpeed?: number;         // 风速(m/s)
  airQuality?: string;        // 空气质量等级
  notes?: string;             // 备注
  createdAt: string;          // 创建时间
}
```

### 农事活动 (FarmingActivity)

```typescript
interface FarmingActivity {
  id: string;                  // 活动ID
  farmingRecordId: string;     // 关联种植记录ID
  activityType: 'SEEDING' | 'WATERING' | 'FERTILIZING' | 'PESTICIDE' | 
                'PRUNING' | 'HARVESTING' | 'FEEDING' | 'VACCINATION' | 'HEALTH_CHECK';
  activityDate: string;        // 活动日期
  operatorId: string;          // 操作员ID
  operatorName: string;        // 操作员姓名
  materials?: Material[];      // 使用的材料
  equipment?: string[];        // 使用的设备
  dosage?: string;            // 用量/剂量
  method?: string;            // 操作方法
  weatherCondition?: string;   // 天气条件
  duration?: number;          // 持续时间(分钟)
  result?: string;            // 活动结果
  photos?: string[];          // 照片附件
  notes?: string;             // 备注
  createdAt: string;          // 创建时间
}

interface Material {
  name: string;               // 材料名称
  type: string;               // 材料类型
  brand?: string;             // 品牌
  specification?: string;     // 规格
  quantity: number;           // 用量
  unit: string;               // 单位
}
```

## 接口列表

### 农场管理

#### 获取农场列表

获取当前用户可访问的农场列表，支持分页和筛选。

**请求**:
```http
GET /api/v1/farming/farms?page=1&limit=20&sort=createdAt&order=desc&filter=farmType:CROP
Authorization: Bearer <token>
```

**查询参数**:
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| page | 数字 | 否 | 页码，默认1 |
| limit | 数字 | 否 | 每页数量，默认20，最大100 |
| sort | 字符串 | 否 | 排序字段，默认createdAt |
| order | 字符串 | 否 | 排序方向，asc/desc，默认asc |
| filter | 字符串 | 否 | 筛选条件，格式：字段:值,字段:值 |
| search | 字符串 | 否 | 搜索关键词，匹配农场名称 |

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "farm-001",
      "name": "绿色生态农场",
      "location": {
        "province": "山东省",
        "city": "寿光市",
        "district": "洛城街道",
        "address": "寿光市农业园区A区101号",
        "latitude": 36.8641,
        "longitude": 118.7417
      },
      "farmType": "CROP",
      "certifications": ["有机认证", "绿色食品认证"],
      "ownerId": "user-123",
      "contactInfo": {
        "phone": "13800138001",
        "email": "farm@example.com",
        "contactPerson": "张三"
      },
      "totalArea": 50000,
      "establishedDate": "2020-01-01T00:00:00Z",
      "description": "专业种植有机蔬菜的现代化农场",
      "isActive": true,
      "createdAt": "2023-01-15T08:30:00Z",
      "updatedAt": "2023-05-21T10:15:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### 获取单个农场信息

**请求**:
```http
GET /api/v1/farming/farms/{farmId}
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "id": "farm-001",
    "name": "绿色生态农场",
    // ... 完整农场信息
  }
}
```

#### 创建农场

**请求**:
```http
POST /api/v1/farming/farms
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新建生态农场",
  "location": {
    "province": "山东省",
    "city": "寿光市",
    "district": "洛城街道",
    "address": "寿光市农业园区B区201号",
    "latitude": 36.8641,
    "longitude": 118.7417
  },
  "farmType": "CROP",
  "contactInfo": {
    "phone": "13800138002",
    "email": "newfarm@example.com",
    "contactPerson": "李四"
  },
  "totalArea": 30000,
  "establishedDate": "2024-01-01T00:00:00Z",
  "description": "新建的有机蔬菜种植基地"
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "farm-002",
    // ... 创建的农场信息
  }
}
```

#### 更新农场信息

**请求**:
```http
PATCH /api/v1/farming/farms/{farmId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "description": "更新后的农场描述",
  "totalArea": 35000
}
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    // ... 更新后的农场信息
  }
}
```

#### 删除农场

**请求**:
```http
DELETE /api/v1/farming/farms/{farmId}
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "message": "农场删除成功"
  }
}
```

### 种植/养殖记录管理

#### 获取种植记录列表

**请求**:
```http
GET /api/v1/farming/records?page=1&limit=20&filter=farmId:farm-001,status:GROWING
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "record-001",
      "farmId": "farm-001",
      "traceId": "trace-123",
      "recordType": "CROP",
      "cropType": "蔬菜",
      "variety": "有机西红柿",
      "plantingDate": "2023-03-01T00:00:00Z",
      "area": 1000,
      "status": "GROWING",
      "qualityGrade": "A级",
      "createdAt": "2023-03-01T08:00:00Z",
      "updatedAt": "2023-05-21T10:30:00Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

#### 创建种植记录

**请求**:
```http
POST /api/v1/farming/records
Authorization: Bearer <token>
Content-Type: application/json

{
  "farmId": "farm-001",
  "traceId": "trace-124",
  "recordType": "CROP",
  "cropType": "蔬菜",
  "variety": "有机黄瓜",
  "plantingDate": "2023-05-21T00:00:00Z",
  "area": 800,
  "notes": "春季第二批种植"
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "record-002",
    // ... 创建的记录信息
  }
}
```

### 环境数据管理

#### 添加环境数据

**请求**:
```http
POST /api/v1/farming/environment-data
Authorization: Bearer <token>
Content-Type: application/json

{
  "farmingRecordId": "record-001",
  "measurementDate": "2023-05-21T14:00:00Z",
  "temperature": 24.5,
  "humidity": 65,
  "soilPh": 6.8,
  "soilMoisture": 55,
  "rainfall": 2.3,
  "sunlightHours": 8.5
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "env-001",
    // ... 环境数据信息
  }
}
```

#### 获取环境数据历史

**请求**:
```http
GET /api/v1/farming/records/{recordId}/environment-data?startDate=2023-05-01&endDate=2023-05-21
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "env-001",
      "measurementDate": "2023-05-21T14:00:00Z",
      "temperature": 24.5,
      "humidity": 65,
      "soilPh": 6.8,
      "soilMoisture": 55,
      "rainfall": 2.3,
      "sunlightHours": 8.5,
      "createdAt": "2023-05-21T14:05:00Z"
    }
  ],
  "meta": {
    "total": 30,
    "dateRange": {
      "start": "2023-05-01T00:00:00Z",
      "end": "2023-05-21T23:59:59Z"
    }
  }
}
```

### 农事活动管理

#### 记录农事活动

**请求**:
```http
POST /api/v1/farming/activities
Authorization: Bearer <token>
Content-Type: application/json

{
  "farmingRecordId": "record-001",
  "activityType": "FERTILIZING",
  "activityDate": "2023-05-21T09:00:00Z",
  "operatorId": "user-456",
  "operatorName": "王五",
  "materials": [
    {
      "name": "有机肥料",
      "type": "肥料",
      "brand": "绿康",
      "quantity": 50,
      "unit": "kg"
    }
  ],
  "method": "穴施",
  "weatherCondition": "晴天",
  "duration": 120,
  "notes": "根据作物生长情况进行追肥"
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "activity-001",
    // ... 活动记录信息
  }
}
```

#### 获取农事活动历史

**请求**:
```http
GET /api/v1/farming/records/{recordId}/activities?page=1&limit=20&sort=activityDate&order=desc
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "activity-001",
      "activityType": "FERTILIZING",
      "activityDate": "2023-05-21T09:00:00Z",
      "operatorName": "王五",
      "materials": [
        {
          "name": "有机肥料",
          "quantity": 50,
          "unit": "kg"
        }
      ],
      "method": "穴施",
      "result": "施肥完成，作物生长良好",
      "createdAt": "2023-05-21T09:30:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 批量操作

#### 批量导入种植记录

**请求**:
```http
POST /api/v1/farming/records/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "records": [
    {
      "farmId": "farm-001",
      "traceId": "trace-125",
      "recordType": "CROP",
      "cropType": "水果",
      "variety": "苹果",
      "plantingDate": "2023-04-01T00:00:00Z",
      "area": 2000
    }
    // ... 更多记录
  ]
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "imported": 10,
    "failed": 0,
    "results": [
      {
        "id": "record-003",
        "status": "success"
      }
      // ... 更多结果
    ]
  }
}
```

## 错误码表

| 错误码 | HTTP状态码 | 描述 | 解决方案 |
|--------|------------|------|----------|
| FARM_NOT_FOUND | 404 | 农场不存在 | 检查农场ID是否正确 |
| RECORD_NOT_FOUND | 404 | 种植记录不存在 | 检查记录ID是否正确 |
| INSUFFICIENT_PERMISSION | 403 | 权限不足 | 联系管理员获取相应权限 |
| INVALID_FARM_TYPE | 422 | 无效的农场类型 | farmType必须为CROP、LIVESTOCK或MIXED |
| INVALID_DATE_RANGE | 422 | 无效的日期范围 | 检查startDate和endDate格式和逻辑 |
| DUPLICATE_FARM_NAME | 422 | 农场名称重复 | 使用不同的农场名称 |
| AREA_EXCEEDED | 422 | 种植面积超出农场总面积 | 检查种植面积设置 |
| ENVIRONMENT_DATA_INVALID | 422 | 环境数据无效 | 检查温度、湿度等数值范围 |

## 业务规则

1. **权限控制**:
   - 农场主只能管理自己的农场
   - 管理员可以查看所有农场信息
   - 操作员只能记录分配的农事活动

2. **数据完整性**:
   - 种植记录必须关联有效的农场和溯源批次
   - 环境数据和农事活动必须关联有效的种植记录
   - 删除农场前必须处理所有关联的种植记录

3. **时间逻辑**:
   - 收获日期不能早于种植日期
   - 农事活动日期必须在种植和收获日期范围内
   - 环境数据测量日期必须合理

4. **数据验证**:
   - 面积和数量必须为正数
   - 温度、湿度等环境参数必须在合理范围内
   - 联系方式必须符合格式要求

## 使用示例

### 完整的种植流程示例

```javascript
// 1. 创建农场
const farm = await fetch('/api/v1/farming/farms', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: '示例有机农场',
    farmType: 'CROP',
    location: {
      province: '山东省',
      city: '寿光市',
      district: '洛城街道',
      address: '示例地址'
    },
    contactInfo: {
      phone: '13800138000',
      contactPerson: '示例联系人'
    },
    totalArea: 10000
  })
});

// 2. 创建种植记录
const record = await fetch('/api/v1/farming/records', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    farmId: farm.data.id,
    traceId: 'trace-example',
    recordType: 'CROP',
    cropType: '蔬菜',
    variety: '有机番茄',
    plantingDate: '2023-05-21T00:00:00Z',
    area: 1000
  })
});

// 3. 记录农事活动
const activity = await fetch('/api/v1/farming/activities', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    farmingRecordId: record.data.id,
    activityType: 'SEEDING',
    activityDate: '2023-05-21T08:00:00Z',
    operatorId: 'user-001',
    operatorName: '操作员姓名'
  })
});
``` 