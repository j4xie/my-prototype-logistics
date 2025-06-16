# 加工模块API文档

<!-- updated for: TASK-P2-007 API接口文档完善 - 创建加工模块API文档 -->

## 概述

加工模块API提供生产工艺记录、质量检测数据管理、设备监控和加工批次管理功能。支持从原料入库到成品出库的完整加工过程数字化管理。

**基础路径**: `/api/v1/processing`

**需要认证**: 所有接口需要JWT Bearer Token认证

**权限要求**: 
- 读取操作: `read:processing`
- 写入操作: `write:processing`
- 管理操作: `admin:processing`

## 数据模型

### 加工设施 (ProcessingFacility)

```typescript
interface ProcessingFacility {
  id: string;                  // 设施唯一标识
  name: string;                // 设施名称
  facilityType: 'FACTORY' | 'WORKSHOP' | 'PROCESSING_PLANT';  // 设施类型
  location: LocationInfo;      // 地理位置
  capacity: number;            // 日处理能力(kg)
  certifications: string[];   // 认证证书
  managerId: string;           // 管理员ID
  contactInfo: ContactInfo;    // 联系信息
  equipment: Equipment[];      // 设备列表
  operatingHours: OperatingHours;  // 运营时间
  isActive: boolean;           // 是否活跃
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}

interface Equipment {
  id: string;                  // 设备ID
  name: string;                // 设备名称
  model: string;               // 型号
  manufacturer: string;        // 制造商
  installDate: string;         // 安装日期
  maintenanceDate?: string;    // 最近维护日期
  status: 'ACTIVE' | 'MAINTENANCE' | 'OFFLINE';  // 设备状态
}

interface OperatingHours {
  monday: TimeSlot;
  tuesday: TimeSlot;
  wednesday: TimeSlot;
  thursday: TimeSlot;
  friday: TimeSlot;
  saturday: TimeSlot;
  sunday: TimeSlot;
}

interface TimeSlot {
  isOpen: boolean;             // 是否营业
  openTime?: string;           // 开始时间
  closeTime?: string;          // 结束时间
}
```

### 加工记录 (ProcessingRecord)

```typescript
interface ProcessingRecord {
  id: string;                  // 记录唯一标识
  facilityId: string;          // 加工设施ID
  traceId: string;             // 关联溯源批次ID
  batchNumber: string;         // 加工批次号
  processType: string;         // 加工类型
  rawMaterials: RawMaterial[]; // 原料信息
  processes: ProcessStep[];    // 加工步骤
  qualityTests: QualityTest[]; // 质量检测
  outputProducts: Product[];   // 输出产品
  startTime: string;           // 开始时间
  endTime?: string;            // 结束时间
  duration?: number;           // 加工时长(分钟)
  operatorId: string;          // 操作员ID
  operatorName: string;        // 操作员姓名
  supervisorId?: string;       // 监督员ID
  status: 'PREPARATION' | 'IN_PROGRESS' | 'QUALITY_CHECK' | 'COMPLETED' | 'FAILED';
  yieldRate: number;           // 出料率(%)
  wastage: number;             // 损耗率(%)
  energyConsumption?: EnergyData;  // 能耗数据
  environmentalData?: EnvironmentalData;  // 环境数据
  notes?: string;              // 备注
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}
```

### 原料信息 (RawMaterial)

```typescript
interface RawMaterial {
  id: string;                  // 原料ID
  name: string;                // 原料名称
  category: string;            // 原料类别
  specification: string;       // 规格
  quantity: number;            // 数量
  unit: string;                // 单位
  supplierId?: string;         // 供应商ID
  supplierName?: string;       // 供应商名称
  batchCode?: string;          // 原料批次号
  expiryDate?: string;         // 保质期
  qualityGrade: string;        // 质量等级
  storageCondition: string;    // 存储条件
  receivedDate: string;        // 入库日期
  cost?: number;               // 成本
  traceabilityCode?: string;   // 溯源码
}
```

### 加工步骤 (ProcessStep)

```typescript
interface ProcessStep {
  id: string;                  // 步骤ID
  stepNumber: number;          // 步骤序号
  stepName: string;            // 步骤名称
  description: string;         // 描述
  equipmentId?: string;        // 使用设备ID
  equipmentName?: string;      // 设备名称
  parameters: ProcessParameter[];  // 工艺参数
  startTime: string;           // 开始时间
  endTime?: string;            // 结束时间
  duration?: number;           // 持续时间(分钟)
  operatorId: string;          // 操作员ID
  operatorName: string;        // 操作员姓名
  temperature?: number;        // 温度(摄氏度)
  pressure?: number;           // 压力(Pa)
  humidity?: number;           // 湿度(%)
  speed?: number;              // 速度(rpm)
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  qualityCheck?: boolean;      // 是否通过质检
  notes?: string;              // 备注
  photos?: string[];           // 照片记录
}

interface ProcessParameter {
  name: string;                // 参数名称
  value: number;               // 参数值
  unit: string;                // 单位
  targetValue?: number;        // 目标值
  tolerance?: number;          // 允许偏差
  isInRange: boolean;          // 是否在范围内
}
```

### 质量检测 (QualityTest)

```typescript
interface QualityTest {
  id: string;                  // 检测ID
  testType: 'INCOMING' | 'IN_PROCESS' | 'FINAL' | 'MICROBIOLOGICAL' | 'CHEMICAL' | 'PHYSICAL';
  testName: string;            // 检测项目名称
  testDate: string;            // 检测日期
  testerId: string;            // 检测员ID
  testerName: string;          // 检测员姓名
  sampleId: string;            // 样品ID
  sampleSize: number;          // 样品数量
  testMethod: string;          // 检测方法
  testParameters: TestParameter[];  // 检测参数
  result: 'PASS' | 'FAIL' | 'PENDING';  // 检测结果
  score?: number;              // 检测分数
  certificateNumber?: string;  // 证书编号
  labName?: string;            // 检测机构
  notes?: string;              // 备注
  attachments?: string[];      // 附件
  createdAt: string;           // 创建时间
}

interface TestParameter {
  name: string;                // 参数名称
  measuredValue: number;       // 实测值
  unit: string;                // 单位
  standardValue?: number;      // 标准值
  minValue?: number;           // 最小值
  maxValue?: number;           // 最大值
  result: 'PASS' | 'FAIL';     // 参数结果
}
```

### 输出产品 (Product)

```typescript
interface Product {
  id: string;                  // 产品ID
  name: string;                // 产品名称
  category: string;            // 产品类别
  specification: string;       // 规格
  quantity: number;            // 数量
  unit: string;                // 单位
  grade: string;               // 等级
  packagingType: string;       // 包装类型
  packagingDate: string;       // 包装日期
  expiryDate?: string;         // 保质期
  batchCode: string;           // 产品批次号
  barcode?: string;            // 条形码
  qrCode?: string;             // 二维码
  cost: number;                // 成本
  price?: number;              // 售价
  storageCondition: string;    // 存储条件
  certifications?: string[];   // 产品认证
}
```

### 能耗数据 (EnergyData)

```typescript
interface EnergyData {
  electricity: number;         // 电耗(kWh)
  gas?: number;               // 燃气消耗(m³)
  water: number;              // 用水量(L)
  steam?: number;             // 蒸汽消耗(kg)
  totalCost: number;          // 总能耗成本
  efficiency: number;         // 能效比(%)
}
```

## 接口列表

### 加工设施管理

#### 获取加工设施列表

**请求**:
```http
GET /api/v1/processing/facilities?page=1&limit=20&filter=facilityType:FACTORY
Authorization: Bearer <token>
```

**查询参数**:
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| page | 数字 | 否 | 页码，默认1 |
| limit | 数字 | 否 | 每页数量，默认20，最大100 |
| sort | 字符串 | 否 | 排序字段，默认createdAt |
| order | 字符串 | 否 | 排序方向，asc/desc，默认asc |
| filter | 字符串 | 否 | 筛选条件 |
| search | 字符串 | 否 | 搜索关键词 |

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "facility-001",
      "name": "现代化食品加工厂",
      "facilityType": "FACTORY",
      "location": {
        "province": "山东省",
        "city": "青岛市",
        "district": "黄岛区",
        "address": "青岛市黄岛区工业园区1号"
      },
      "capacity": 10000,
      "certifications": ["ISO22000", "HACCP", "GMP"],
      "managerId": "user-201",
      "contactInfo": {
        "phone": "0532-88888888",
        "email": "factory@example.com",
        "contactPerson": "李经理"
      },
      "isActive": true,
      "createdAt": "2023-01-15T08:30:00Z",
      "updatedAt": "2023-05-21T10:15:00Z"
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

#### 创建加工设施

**请求**:
```http
POST /api/v1/processing/facilities
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新建加工车间",
  "facilityType": "WORKSHOP",
  "location": {
    "province": "山东省",
    "city": "青岛市",
    "district": "市南区",
    "address": "青岛市市南区加工园区2号"
  },
  "capacity": 5000,
  "contactInfo": {
    "phone": "0532-77777777",
    "email": "workshop@example.com",
    "contactPerson": "王主管"
  },
  "equipment": [
    {
      "name": "自动包装机",
      "model": "PKG-2000",
      "manufacturer": "青岛机械",
      "installDate": "2023-05-01T00:00:00Z",
      "status": "ACTIVE"
    }
  ]
}
```

### 加工记录管理

#### 获取加工记录列表

**请求**:
```http
GET /api/v1/processing/records?page=1&limit=20&filter=facilityId:facility-001,status:COMPLETED
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "record-001",
      "facilityId": "facility-001",
      "traceId": "trace-123",
      "batchNumber": "PRO20230521001",
      "processType": "蔬菜清洗包装",
      "startTime": "2023-05-21T08:00:00Z",
      "endTime": "2023-05-21T12:00:00Z",
      "duration": 240,
      "operatorName": "张师傅",
      "status": "COMPLETED",
      "yieldRate": 95.5,
      "wastage": 4.5,
      "createdAt": "2023-05-21T08:00:00Z",
      "updatedAt": "2023-05-21T12:30:00Z"
    }
  ],
  "meta": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

#### 创建加工记录

**请求**:
```http
POST /api/v1/processing/records
Authorization: Bearer <token>
Content-Type: application/json

{
  "facilityId": "facility-001",
  "traceId": "trace-124",
  "batchNumber": "PRO20230521002",
  "processType": "水果清洗分拣",
  "rawMaterials": [
    {
      "name": "有机苹果",
      "category": "水果",
      "specification": "特级",
      "quantity": 1000,
      "unit": "kg",
      "supplierName": "山东果业",
      "qualityGrade": "A级",
      "receivedDate": "2023-05-21T06:00:00Z"
    }
  ],
  "operatorId": "user-301",
  "operatorName": "赵师傅",
  "startTime": "2023-05-21T14:00:00Z"
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "record-002",
    "batchNumber": "PRO20230521002",
    "status": "PREPARATION",
    // ... 完整记录信息
  }
}
```

#### 更新加工记录

**请求**:
```http
PATCH /api/v1/processing/records/{recordId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "IN_PROGRESS",
  "processes": [
    {
      "stepNumber": 1,
      "stepName": "清洗",
      "description": "使用清水冲洗水果表面",
      "startTime": "2023-05-21T14:05:00Z",
      "operatorId": "user-301",
      "operatorName": "赵师傅",
      "temperature": 25,
      "status": "IN_PROGRESS"
    }
  ]
}
```

### 质量检测管理

#### 添加质量检测记录

**请求**:
```http
POST /api/v1/processing/quality-tests
Authorization: Bearer <token>
Content-Type: application/json

{
  "processingRecordId": "record-001",
  "testType": "FINAL",
  "testName": "成品质量检测",
  "testDate": "2023-05-21T11:30:00Z",
  "testerId": "user-401",
  "testerName": "质检员小李",
  "sampleId": "SAMPLE-001",
  "sampleSize": 10,
  "testMethod": "GB/T 20014.1-2005",
  "testParameters": [
    {
      "name": "水分含量",
      "measuredValue": 85.2,
      "unit": "%",
      "standardValue": 85,
      "minValue": 80,
      "maxValue": 90,
      "result": "PASS"
    },
    {
      "name": "糖分含量",
      "measuredValue": 12.8,
      "unit": "°Brix",
      "minValue": 12,
      "maxValue": 15,
      "result": "PASS"
    }
  ],
  "result": "PASS",
  "score": 95
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "test-001",
    "result": "PASS",
    "score": 95,
    // ... 完整检测记录
  }
}
```

#### 获取质量检测历史

**请求**:
```http
GET /api/v1/processing/records/{recordId}/quality-tests?testType=FINAL
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "test-001",
      "testType": "FINAL",
      "testName": "成品质量检测",
      "testDate": "2023-05-21T11:30:00Z",
      "testerName": "质检员小李",
      "result": "PASS",
      "score": 95,
      "testParameters": [
        {
          "name": "水分含量",
          "measuredValue": 85.2,
          "unit": "%",
          "result": "PASS"
        }
      ],
      "createdAt": "2023-05-21T11:35:00Z"
    }
  ],
  "meta": {
    "total": 3,
    "passRate": 100,
    "averageScore": 94.5
  }
}
```

### 设备监控

#### 获取设备状态

**请求**:
```http
GET /api/v1/processing/facilities/{facilityId}/equipment
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "equipment-001",
      "name": "自动包装机",
      "model": "PKG-2000",
      "status": "ACTIVE",
      "lastMaintenanceDate": "2023-05-01T00:00:00Z",
      "nextMaintenanceDate": "2023-08-01T00:00:00Z",
      "operatingHours": 1250,
      "efficiency": 98.5
    }
  ]
}
```

#### 更新设备状态

**请求**:
```http
PATCH /api/v1/processing/equipment/{equipmentId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "MAINTENANCE",
  "maintenanceDate": "2023-05-21T16:00:00Z",
  "maintenanceNotes": "定期保养，更换滤芯"
}
```

### 统计报告

#### 获取加工统计

**请求**:
```http
GET /api/v1/processing/statistics?facilityId=facility-001&startDate=2023-05-01&endDate=2023-05-21
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "totalRecords": 45,
    "completedRecords": 42,
    "failedRecords": 3,
    "successRate": 93.3,
    "totalProcessingTime": 2100,
    "averageProcessingTime": 46.7,
    "totalYield": 125000,
    "averageYieldRate": 94.2,
    "totalWastage": 7500,
    "averageWastageRate": 5.8,
    "qualityTestStats": {
      "totalTests": 126,
      "passedTests": 120,
      "passRate": 95.2,
      "averageScore": 92.5
    },
    "energyConsumption": {
      "totalElectricity": 15600,
      "totalWater": 89000,
      "totalCost": 12500,
      "averageEfficiency": 87.3
    }
  },
  "meta": {
    "dateRange": {
      "start": "2023-05-01T00:00:00Z",
      "end": "2023-05-21T23:59:59Z"
    },
    "period": "21 days"
  }
}
```

## 错误码表

| 错误码 | HTTP状态码 | 描述 | 解决方案 |
|--------|------------|------|----------|
| FACILITY_NOT_FOUND | 404 | 加工设施不存在 | 检查设施ID是否正确 |
| RECORD_NOT_FOUND | 404 | 加工记录不存在 | 检查记录ID是否正确 |
| EQUIPMENT_NOT_FOUND | 404 | 设备不存在 | 检查设备ID是否正确 |
| INSUFFICIENT_PERMISSION | 403 | 权限不足 | 联系管理员获取相应权限 |
| INVALID_PROCESS_TYPE | 422 | 无效的加工类型 | 检查加工类型是否符合规范 |
| INVALID_BATCH_NUMBER | 422 | 批次号格式错误 | 使用正确的批次号格式 |
| QUALITY_TEST_FAILED | 422 | 质量检测不合格 | 检查产品质量和检测参数 |
| EQUIPMENT_OFFLINE | 422 | 设备离线或维护中 | 检查设备状态，等待设备恢复 |
| CAPACITY_EXCEEDED | 422 | 超出加工能力 | 调整加工数量或分批处理 |
| INVALID_DATE_RANGE | 422 | 无效的时间范围 | 检查开始和结束时间设置 |
| RAW_MATERIAL_EXPIRED | 422 | 原料已过期 | 检查原料保质期 |
| PROCESS_STEP_INCOMPLETE | 422 | 加工步骤未完成 | 完成所有必要的加工步骤 |

## 业务规则

1. **加工流程控制**:
   - 加工必须按照预定义的步骤顺序进行
   - 每个步骤完成后才能进入下一步骤
   - 关键控制点必须进行质量检测

2. **质量管控**:
   - 原料入库必须进行质量检验
   - 加工过程中必须进行过程检测
   - 成品出库前必须通过最终质检

3. **设备管理**:
   - 设备维护期间不能进行生产
   - 设备运行参数必须在安全范围内
   - 定期维护记录必须完整

4. **可追溯性**:
   - 每个加工批次必须关联溯源批次
   - 原料来源必须可追溯
   - 成品去向必须记录

5. **数据完整性**:
   - 加工记录必须包含完整的工艺参数
   - 质量检测数据必须真实准确
   - 能耗数据必须及时记录

## 使用示例

### 完整的加工流程示例

```javascript
// 1. 创建加工记录
const record = await fetch('/api/v1/processing/records', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    facilityId: 'facility-001',
    traceId: 'trace-123',
    batchNumber: 'PRO20230521001',
    processType: '蔬菜清洗包装',
    rawMaterials: [{
      name: '有机白菜',
      quantity: 500,
      unit: 'kg',
      qualityGrade: 'A级'
    }],
    operatorId: 'user-301',
    startTime: '2023-05-21T08:00:00Z'
  })
});

// 2. 添加加工步骤
const step = await fetch(`/api/v1/processing/records/${record.data.id}`, {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    processes: [{
      stepNumber: 1,
      stepName: '清洗',
      startTime: '2023-05-21T08:10:00Z',
      temperature: 15,
      status: 'IN_PROGRESS'
    }]
  })
});

// 3. 进行质量检测
const qualityTest = await fetch('/api/v1/processing/quality-tests', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    processingRecordId: record.data.id,
    testType: 'FINAL',
    testName: '成品检测',
    testDate: '2023-05-21T11:30:00Z',
    testerId: 'user-401',
    result: 'PASS'
  })
});
``` 