# 物流模块API文档

<!-- updated for: TASK-P2-007 API接口文档完善 - 创建物流模块API文档 -->

## 概述

物流模块API提供运输记录管理、车辆跟踪、仓储管理和温湿度监控功能。支持从产品出库到配送完成的完整物流过程数字化管理，确保食品在运输过程中的安全和可追溯性。

**基础路径**: `/api/v1/logistics`

**需要认证**: 所有接口需要JWT Bearer Token认证

**权限要求**: 
- 读取操作: `read:logistics`
- 写入操作: `write:logistics`
- 管理操作: `admin:logistics`

## 数据模型

### 物流公司 (LogisticsCompany)

```typescript
interface LogisticsCompany {
  id: string;                  // 公司唯一标识
  name: string;                // 公司名称
  companyCode: string;         // 公司编码
  businessLicense: string;     // 营业执照号
  transportLicense: string;    // 运输许可证号
  location: LocationInfo;      // 公司地址
  contactInfo: ContactInfo;    // 联系信息
  serviceArea: string[];       // 服务区域
  vehicleTypes: string[];      // 车辆类型
  specializations: string[];   // 专业领域(冷链、常温、危险品等)
  certifications: string[];   // 认证证书
  rating: number;              // 评级(1-5星)
  isActive: boolean;           // 是否活跃
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}
```

### 车辆信息 (Vehicle)

```typescript
interface Vehicle {
  id: string;                  // 车辆ID
  companyId: string;           // 所属物流公司ID
  plateNumber: string;         // 车牌号
  vehicleType: 'TRUCK' | 'VAN' | 'REFRIGERATED_TRUCK' | 'CONTAINER_TRUCK';
  brand: string;               // 品牌
  model: string;               // 型号
  capacity: number;            // 载重量(kg)
  volume: number;              // 容积(m³)
  fuelType: 'GASOLINE' | 'DIESEL' | 'ELECTRIC' | 'HYBRID';
  registrationDate: string;    // 注册日期
  insuranceExpiry: string;     // 保险到期日期
  inspectionExpiry: string;    // 年检到期日期
  driverId: string;            // 当前司机ID
  equipments: VehicleEquipment[];  // 车载设备
  status: 'AVAILABLE' | 'IN_TRANSIT' | 'MAINTENANCE' | 'OFFLINE';
  currentLocation?: LocationInfo;  // 当前位置
  isActive: boolean;           // 是否活跃
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}

interface VehicleEquipment {
  type: 'GPS' | 'TEMPERATURE_SENSOR' | 'HUMIDITY_SENSOR' | 'CAMERA' | 'RFID_READER';
  model: string;               // 设备型号
  serialNumber: string;        // 序列号
  installDate: string;         // 安装日期
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  lastMaintenanceDate?: string;  // 最近维护日期
}
```

### 司机信息 (Driver)

```typescript
interface Driver {
  id: string;                  // 司机ID
  name: string;                // 姓名
  phone: string;               // 联系电话
  idNumber: string;            // 身份证号
  licenseNumber: string;       // 驾驶证号
  licenseType: string;         // 驾驶证类型
  licenseExpiry: string;       // 驾驶证到期日期
  experience: number;          // 驾驶经验(年)
  certifications: string[];   // 专业认证
  rating: number;              // 评级(1-5星)
  companyId: string;           // 所属公司ID
  currentVehicleId?: string;   // 当前车辆ID
  status: 'AVAILABLE' | 'DRIVING' | 'REST' | 'OFFLINE';
  emergencyContact: ContactInfo;  // 紧急联系人
  isActive: boolean;           // 是否活跃
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}
```

### 运输记录 (ShipmentRecord)

```typescript
interface ShipmentRecord {
  id: string;                  // 运输记录ID
  shipmentNumber: string;      // 运单号
  traceId: string;             // 关联溯源批次ID
  companyId: string;           // 物流公司ID
  vehicleId: string;           // 车辆ID
  driverId: string;            // 司机ID
  cargo: CargoInfo[];          // 货物信息
  origin: LocationInfo;        // 起点
  destination: LocationInfo;   // 终点
  waypoints?: LocationInfo[];  // 途经点
  plannedDepartureTime: string;  // 计划出发时间
  actualDepartureTime?: string;  // 实际出发时间
  plannedArrivalTime: string;    // 计划到达时间
  actualArrivalTime?: string;    // 实际到达时间
  estimatedDuration: number;     // 预计时长(分钟)
  actualDuration?: number;       // 实际时长(分钟)
  distance: number;              // 距离(km)
  transportType: 'STANDARD' | 'EXPRESS' | 'COLD_CHAIN' | 'SPECIAL';
  temperature?: TemperatureRange;  // 温度要求
  status: 'PLANNED' | 'LOADING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'DELAYED';
  trackingEvents: TrackingEvent[];  // 跟踪事件
  environmentalData: EnvironmentalMonitoring[];  // 环境监控数据
  cost: number;                  // 运输成本
  insurance?: InsuranceInfo;     // 保险信息
  notes?: string;                // 备注
  createdAt: string;             // 创建时间
  updatedAt: string;             // 更新时间
}
```

### 货物信息 (CargoInfo)

```typescript
interface CargoInfo {
  id: string;                  // 货物ID
  productId: string;           // 产品ID
  productName: string;         // 产品名称
  category: string;            // 产品类别
  batchCode: string;           // 批次号
  quantity: number;            // 数量
  unit: string;                // 单位
  weight: number;              // 重量(kg)
  volume: number;              // 体积(m³)
  packagingType: string;       // 包装类型
  specialRequirements?: string[];  // 特殊要求
  value: number;               // 货值
  expiryDate?: string;         // 保质期
  storageCondition: string;    // 存储条件
  handlingInstructions?: string;  // 搬运说明
}
```

### 跟踪事件 (TrackingEvent)

```typescript
interface TrackingEvent {
  id: string;                  // 事件ID
  shipmentId: string;          // 运输记录ID
  eventType: 'PICKUP' | 'DEPARTURE' | 'ARRIVAL' | 'DELIVERY' | 'DELAY' | 
             'TEMPERATURE_ALERT' | 'ROUTE_DEVIATION' | 'EMERGENCY';
  eventTime: string;           // 事件时间
  location: LocationInfo;      // 事件位置
  description: string;         // 事件描述
  details?: any;               // 事件详情
  operatorId?: string;         // 操作员ID
  operatorName?: string;       // 操作员姓名
  photos?: string[];           // 照片记录
  signature?: string;          // 签收签名
  isAutomated: boolean;        // 是否自动记录
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';  // 严重程度
  createdAt: string;           // 创建时间
}
```

### 环境监控 (EnvironmentalMonitoring)

```typescript
interface EnvironmentalMonitoring {
  id: string;                  // 监控记录ID
  shipmentId: string;          // 运输记录ID
  vehicleId: string;           // 车辆ID
  measurementTime: string;     // 测量时间
  location: LocationInfo;      // 测量位置
  temperature: number;         // 温度(摄氏度)
  humidity: number;            // 湿度(%)
  pressure?: number;           // 压力(Pa)
  vibration?: number;          // 震动级别
  light?: number;              // 光照强度
  isWithinRange: boolean;      // 是否在正常范围内
  alerts?: EnvironmentAlert[]; // 环境警报
  sensorId: string;            // 传感器ID
  batteryLevel?: number;       // 传感器电量(%)
  signalStrength?: number;     // 信号强度
  createdAt: string;           // 创建时间
}

interface EnvironmentAlert {
  type: 'TEMPERATURE_HIGH' | 'TEMPERATURE_LOW' | 'HUMIDITY_HIGH' | 'HUMIDITY_LOW' | 'SHOCK';
  severity: 'WARNING' | 'CRITICAL';
  threshold: number;           // 阈值
  actualValue: number;         // 实际值
  duration: number;            // 持续时间(秒)
  isResolved: boolean;         // 是否已解决
}

interface TemperatureRange {
  min: number;                 // 最低温度
  max: number;                 // 最高温度
  tolerance: number;           // 允许偏差
}
```

### 仓储信息 (WarehouseInfo)

```typescript
interface WarehouseInfo {
  id: string;                  // 仓库ID
  name: string;                // 仓库名称
  warehouseCode: string;       // 仓库编码
  location: LocationInfo;      // 仓库位置
  warehouseType: 'COLD_STORAGE' | 'DRY_STORAGE' | 'FROZEN_STORAGE' | 'GENERAL';
  capacity: number;            // 总容量(m³)
  usedCapacity: number;        // 已使用容量(m³)
  temperature: TemperatureRange;  // 温度范围
  humidity: HumidityRange;     // 湿度范围
  facilities: WarehouseFacility[];  // 仓储设施
  managerId: string;           // 仓库管理员ID
  contactInfo: ContactInfo;    // 联系信息
  operatingHours: OperatingHours;  // 营业时间
  certifications: string[];   // 认证证书
  isActive: boolean;           // 是否活跃
  createdAt: string;           // 创建时间
  updatedAt: string;           // 更新时间
}

interface HumidityRange {
  min: number;                 // 最低湿度
  max: number;                 // 最高湿度
}

interface WarehouseFacility {
  type: 'LOADING_DOCK' | 'FREEZER' | 'CONVEYOR' | 'FORKLIFT' | 'SCALES';
  quantity: number;            // 数量
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE';
}
```

## 接口列表

### 物流公司管理

#### 获取物流公司列表

**请求**:
```http
GET /api/v1/logistics/companies?page=1&limit=20&filter=serviceArea:华东地区
Authorization: Bearer <token>
```

**查询参数**:
| 参数 | 类型 | 必需 | 描述 |
|------|------|------|------|
| page | 数字 | 否 | 页码，默认1 |
| limit | 数字 | 否 | 每页数量，默认20，最大100 |
| sort | 字符串 | 否 | 排序字段，默认rating |
| order | 字符串 | 否 | 排序方向，asc/desc，默认desc |
| filter | 字符串 | 否 | 筛选条件 |
| search | 字符串 | 否 | 搜索关键词 |

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "company-001",
      "name": "顺丰速运",
      "companyCode": "SF001",
      "businessLicense": "91110000123456789X",
      "location": {
        "province": "广东省",
        "city": "深圳市",
        "district": "福田区",
        "address": "深圳市福田区新洲路1号"
      },
      "contactInfo": {
        "phone": "400-111-1111",
        "email": "service@sf-express.com",
        "contactPerson": "客服中心"
      },
      "serviceArea": ["华南地区", "华东地区", "华北地区"],
      "specializations": ["冷链运输", "常温运输", "快递服务"],
      "rating": 4.8,
      "isActive": true,
      "createdAt": "2023-01-15T08:30:00Z"
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

#### 创建物流公司

**请求**:
```http
POST /api/v1/logistics/companies
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "新希望物流",
  "companyCode": "XW001",
  "businessLicense": "91110000987654321X",
  "location": {
    "province": "四川省",
    "city": "成都市",
    "district": "武侯区",
    "address": "成都市武侯区天府大道100号"
  },
  "contactInfo": {
    "phone": "028-88888888",
    "email": "logistics@newhope.com",
    "contactPerson": "物流部"
  },
  "serviceArea": ["西南地区", "华南地区"],
  "specializations": ["农产品运输", "冷链物流"]
}
```

### 运输记录管理

#### 获取运输记录列表

**请求**:
```http
GET /api/v1/logistics/shipments?page=1&limit=20&filter=status:IN_TRANSIT,transportType:COLD_CHAIN
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "shipment-001",
      "shipmentNumber": "SF20230521001",
      "traceId": "trace-123",
      "companyId": "company-001",
      "vehicleId": "vehicle-001",
      "driverId": "driver-001",
      "origin": {
        "province": "山东省",
        "city": "寿光市",
        "address": "寿光市农业园区A区"
      },
      "destination": {
        "province": "上海市",
        "city": "上海市",
        "address": "上海市浦东新区张江路100号"
      },
      "plannedDepartureTime": "2023-05-21T08:00:00Z",
      "plannedArrivalTime": "2023-05-22T18:00:00Z",
      "distance": 850,
      "transportType": "COLD_CHAIN",
      "status": "IN_TRANSIT",
      "cost": 3500,
      "createdAt": "2023-05-21T06:00:00Z"
    }
  ],
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6
  }
}
```

#### 创建运输记录

**请求**:
```http
POST /api/v1/logistics/shipments
Authorization: Bearer <token>
Content-Type: application/json

{
  "traceId": "trace-124",
  "companyId": "company-001",
  "vehicleId": "vehicle-002",
  "driverId": "driver-002",
  "cargo": [
    {
      "productName": "有机苹果",
      "category": "水果",
      "batchCode": "APPLE20230521",
      "quantity": 500,
      "unit": "kg",
      "weight": 500,
      "volume": 2.5,
      "packagingType": "纸箱",
      "value": 15000,
      "storageCondition": "2-8°C",
      "expiryDate": "2023-06-21T00:00:00Z"
    }
  ],
  "origin": {
    "province": "山东省",
    "city": "烟台市",
    "address": "烟台市福山区果园路1号"
  },
  "destination": {
    "province": "北京市",
    "city": "北京市",
    "address": "北京市朝阳区望京街10号"
  },
  "plannedDepartureTime": "2023-05-22T06:00:00Z",
  "plannedArrivalTime": "2023-05-23T20:00:00Z",
  "transportType": "COLD_CHAIN",
  "temperature": {
    "min": 2,
    "max": 8,
    "tolerance": 1
  },
  "cost": 4200
}
```

**响应** (201 Created):
```json
{
  "status": "success",
  "data": {
    "id": "shipment-002",
    "shipmentNumber": "SF20230522001",
    "status": "PLANNED",
    // ... 完整运输记录信息
  }
}
```

### 实时跟踪

#### 获取运输跟踪信息

**请求**:
```http
GET /api/v1/logistics/shipments/{shipmentId}/tracking
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "shipmentId": "shipment-001",
    "currentStatus": "IN_TRANSIT",
    "currentLocation": {
      "province": "江苏省",
      "city": "南京市",
      "latitude": 32.0584,
      "longitude": 118.7964
    },
    "estimatedArrival": "2023-05-22T16:30:00Z",
    "completionPercentage": 65,
    "events": [
      {
        "id": "event-001",
        "eventType": "DEPARTURE",
        "eventTime": "2023-05-21T08:15:00Z",
        "location": {
          "province": "山东省",
          "city": "寿光市"
        },
        "description": "货物已从寿光农业园区发出"
      },
      {
        "id": "event-002",
        "eventType": "ARRIVAL",
        "eventTime": "2023-05-21T14:30:00Z",
        "location": {
          "province": "江苏省",
          "city": "徐州市"
        },
        "description": "到达徐州中转站"
      }
    ],
    "environmentalData": {
      "currentTemperature": 5.2,
      "currentHumidity": 65,
      "temperatureRange": {
        "min": 4.8,
        "max": 6.1
      },
      "alerts": []
    }
  }
}
```

#### 添加跟踪事件

**请求**:
```http
POST /api/v1/logistics/shipments/{shipmentId}/events
Authorization: Bearer <token>
Content-Type: application/json

{
  "eventType": "ARRIVAL",
  "eventTime": "2023-05-22T10:30:00Z",
  "location": {
    "province": "江苏省",
    "city": "南京市",
    "latitude": 32.0584,
    "longitude": 118.7964
  },
  "description": "到达南京分拨中心",
  "operatorId": "user-501",
  "operatorName": "调度员张三"
}
```

### 环境监控

#### 获取环境监控数据

**请求**:
```http
GET /api/v1/logistics/shipments/{shipmentId}/environmental-data?startTime=2023-05-21T08:00:00Z&endTime=2023-05-22T08:00:00Z
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "env-001",
      "measurementTime": "2023-05-21T08:30:00Z",
      "location": {
        "latitude": 36.8641,
        "longitude": 118.7417
      },
      "temperature": 5.1,
      "humidity": 62,
      "isWithinRange": true,
      "sensorId": "TEMP-001",
      "batteryLevel": 85,
      "signalStrength": 95
    }
  ],
  "meta": {
    "total": 288,
    "timeRange": {
      "start": "2023-05-21T08:00:00Z",
      "end": "2023-05-22T08:00:00Z"
    },
    "samplingInterval": "5 minutes",
    "alertCount": 0
  }
}
```

#### 添加环境监控数据

**请求**:
```http
POST /api/v1/logistics/environmental-data
Authorization: Bearer <token>
Content-Type: application/json

{
  "shipmentId": "shipment-001",
  "vehicleId": "vehicle-001",
  "measurementTime": "2023-05-21T15:30:00Z",
  "location": {
    "latitude": 34.2619,
    "longitude": 117.1889
  },
  "temperature": 6.8,
  "humidity": 68,
  "sensorId": "TEMP-001",
  "batteryLevel": 82
}
```

### 车辆管理

#### 获取车辆列表

**请求**:
```http
GET /api/v1/logistics/vehicles?page=1&limit=20&filter=companyId:company-001,status:AVAILABLE
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "vehicle-001",
      "plateNumber": "鲁A12345",
      "vehicleType": "REFRIGERATED_TRUCK",
      "brand": "解放",
      "model": "J6P",
      "capacity": 8000,
      "volume": 40,
      "fuelType": "DIESEL",
      "driverId": "driver-001",
      "status": "AVAILABLE",
      "equipments": [
        {
          "type": "GPS",
          "model": "GPS-2000",
          "status": "ACTIVE"
        },
        {
          "type": "TEMPERATURE_SENSOR",
          "model": "TEMP-500",
          "status": "ACTIVE"
        }
      ],
      "createdAt": "2023-01-15T08:30:00Z"
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

### 仓储管理

#### 获取仓库列表

**请求**:
```http
GET /api/v1/logistics/warehouses?page=1&limit=20&filter=warehouseType:COLD_STORAGE
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": [
    {
      "id": "warehouse-001",
      "name": "华东冷链仓储中心",
      "warehouseCode": "WH-COLD-001",
      "location": {
        "province": "上海市",
        "city": "上海市",
        "district": "浦东新区",
        "address": "浦东新区物流园区1号"
      },
      "warehouseType": "COLD_STORAGE",
      "capacity": 10000,
      "usedCapacity": 6500,
      "temperature": {
        "min": -18,
        "max": 5
      },
      "facilities": [
        {
          "type": "LOADING_DOCK",
          "quantity": 8,
          "status": "AVAILABLE"
        },
        {
          "type": "FREEZER",
          "quantity": 20,
          "status": "AVAILABLE"
        }
      ],
      "isActive": true,
      "createdAt": "2023-01-15T08:30:00Z"
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

### 统计报告

#### 获取物流统计

**请求**:
```http
GET /api/v1/logistics/statistics?companyId=company-001&startDate=2023-05-01&endDate=2023-05-21
Authorization: Bearer <token>
```

**响应** (200 OK):
```json
{
  "status": "success",
  "data": {
    "totalShipments": 156,
    "completedShipments": 142,
    "inTransitShipments": 12,
    "delayedShipments": 8,
    "completionRate": 91.0,
    "onTimeDeliveryRate": 94.4,
    "averageDeliveryTime": 28.5,
    "totalDistance": 125600,
    "totalCost": 523000,
    "averageCostPerKm": 4.16,
    "fuelConsumption": {
      "totalLiters": 18500,
      "averageConsumption": 12.8,
      "totalCost": 129500
    },
    "temperatureCompliance": {
      "monitoredShipments": 89,
      "compliantShipments": 87,
      "complianceRate": 97.8,
      "alerts": 5
    },
    "vehicleUtilization": {
      "totalVehicles": 25,
      "activeVehicles": 22,
      "utilizationRate": 88.0,
      "averageLoadFactor": 78.5
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
| COMPANY_NOT_FOUND | 404 | 物流公司不存在 | 检查公司ID是否正确 |
| SHIPMENT_NOT_FOUND | 404 | 运输记录不存在 | 检查运单号或运输ID |
| VEHICLE_NOT_FOUND | 404 | 车辆不存在 | 检查车辆ID是否正确 |
| DRIVER_NOT_FOUND | 404 | 司机不存在 | 检查司机ID是否正确 |
| WAREHOUSE_NOT_FOUND | 404 | 仓库不存在 | 检查仓库ID是否正确 |
| INSUFFICIENT_PERMISSION | 403 | 权限不足 | 联系管理员获取相应权限 |
| VEHICLE_UNAVAILABLE | 422 | 车辆不可用 | 选择其他可用车辆或等待 |
| DRIVER_UNAVAILABLE | 422 | 司机不可用 | 分配其他司机或调整时间 |
| INVALID_ROUTE | 422 | 无效的运输路线 | 检查起点和终点设置 |
| TEMPERATURE_OUT_OF_RANGE | 422 | 温度超出范围 | 检查温控设备和设置 |
| CARGO_OVERWEIGHT | 422 | 货物超重 | 减少货物数量或使用更大车辆 |
| CARGO_OVERVOLUME | 422 | 货物超体积 | 重新规划货物装载 |
| SHIPMENT_ALREADY_DEPARTED | 422 | 运输已出发，无法修改 | 联系司机或调度员处理 |
| INVALID_TRACKING_EVENT | 422 | 无效的跟踪事件 | 检查事件类型和时间顺序 |

## 业务规则

1. **运输调度**:
   - 车辆和司机必须处于可用状态才能分配任务
   - 货物重量和体积不能超出车辆载重限制
   - 冷链运输必须使用配备温控设备的车辆

2. **实时跟踪**:
   - 运输过程中必须定期上报位置信息
   - 温湿度监控数据必须实时传输
   - 异常情况必须立即报警

3. **环境控制**:
   - 冷链产品必须全程温度监控
   - 温度超出范围必须立即报警
   - 环境数据必须完整记录不能断档

4. **安全管理**:
   - 司机驾驶时间不能超过规定限制
   - 车辆必须定期维护保养
   - 危险品运输需要特殊资质

5. **数据完整性**:
   - 所有跟踪事件必须按时间顺序记录
   - 环境监控数据必须连续完整
   - 货物交接必须有签收确认

## 使用示例

### 完整的物流流程示例

```javascript
// 1. 创建运输记录
const shipment = await fetch('/api/v1/logistics/shipments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    traceId: 'trace-123',
    companyId: 'company-001',
    vehicleId: 'vehicle-001',
    driverId: 'driver-001',
    cargo: [{
      productName: '有机蔬菜',
      quantity: 300,
      unit: 'kg',
      weight: 300,
      volume: 1.5,
      storageCondition: '2-8°C'
    }],
    origin: {
      province: '山东省',
      city: '寿光市'
    },
    destination: {
      province: '上海市',
      city: '上海市'
    },
    transportType: 'COLD_CHAIN',
    temperature: { min: 2, max: 8 }
  })
});

// 2. 添加跟踪事件
const trackingEvent = await fetch(`/api/v1/logistics/shipments/${shipment.data.id}/events`, {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    eventType: 'DEPARTURE',
    eventTime: '2023-05-21T08:00:00Z',
    description: '货物已装车发出',
    operatorId: 'user-501'
  })
});

// 3. 上传环境监控数据
const envData = await fetch('/api/v1/logistics/environmental-data', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    shipmentId: shipment.data.id,
    measurementTime: '2023-05-21T09:00:00Z',
    temperature: 5.2,
    humidity: 65,
    sensorId: 'TEMP-001'
  })
});
``` 