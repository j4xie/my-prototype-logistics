# 统一数据模型文档

<!-- updated for: TASK-P2-007 API接口文档完善 - 创建统一数据模型文档 -->
<!-- updated for: Phase-3技术栈现代化 - API文档与客户端封装同步优化 -->

## 概述

本文档定义了食品溯源系统中所有API模块共用的统一数据模型。这些数据结构确保了系统各模块间的数据一致性和互操作性。

**版本**: v1.0  
**创建日期**: 2025-05-21  
**最后更新**: 2025-05-21  

## 🚀 Phase-3 TypeScript集成

Phase-3的API客户端实现了完整的TypeScript类型支持。实际的类型定义位于：
- `web-app-next/src/types/api.ts` - 核心API类型定义
- `web-app-next/src/lib/api.ts` - API客户端和响应类型

### 💡 使用建议

开发时建议直接引用TypeScript类型定义：

```typescript
import type { 
  ApiResponse, 
  PaginatedResponse,
  User,
  Product,
  TraceRecord 
} from '@/types/api';

// 使用类型化的API调用
const userProfile = await apiClient.get<User>('/v1/profile/me');
const products = await apiClient.get<PaginatedResponse<Product>>('/v1/products');
```

## 基础数据类型

### 通用字段类型

```typescript
// 通用标识符
type ID = string;

// 时间戳 (ISO 8601格式)
type Timestamp = string;

// 枚举状态基类
type BaseStatus = 'ACTIVE' | 'INACTIVE';

// 布尔标识
type Flag = boolean;

// 数值类型
type Decimal = number;
type Integer = number;
type Float = number;

// 字符串类型
type ShortText = string;  // 最大255字符
type LongText = string;   // 最大65535字符
type TinyText = string;   // 最大50字符

// 文件类型
type FileUrl = string;
type ImageUrl = string;
```

## 核心实体模型

### 地理位置信息 (LocationInfo)

```typescript
interface LocationInfo {
  province: string;            // 省份
  city: string;                // 城市
  district?: string;           // 区县
  address?: string;            // 详细地址
  latitude?: number;           // 纬度
  longitude?: number;          // 经度
  postalCode?: string;         // 邮政编码
  country?: string;            // 国家，默认"中国"
  timezone?: string;           // 时区
}
```

### 联系信息 (ContactInfo)

```typescript
interface ContactInfo {
  phone: string;               // 联系电话
  email?: string;              // 邮箱地址
  contactPerson: string;       // 联系人姓名
  fax?: string;                // 传真号码
  website?: string;            // 网站地址
  wechat?: string;             // 微信号
  qq?: string;                 // QQ号
  emergencyContact?: EmergencyContact; // 紧急联系人
}

interface EmergencyContact {
  name: string;                // 紧急联系人姓名
  phone: string;               // 紧急联系电话
  relationship: string;        // 与联系人关系
}
```

### 环境数据 (EnvironmentalData)

```typescript
interface EnvironmentalData {
  temperature: number;         // 温度(摄氏度)
  humidity: number;            // 湿度(%)
  pressure?: number;           // 大气压力(Pa)
  windSpeed?: number;          // 风速(m/s)
  windDirection?: number;      // 风向(度)
  rainfall?: number;           // 降雨量(mm)
  lightIntensity?: number;     // 光照强度(lux)
  soilMoisture?: number;       // 土壤湿度(%)
  soilPh?: number;             // 土壤pH值
  co2Level?: number;           // CO2浓度(ppm)
  airQuality?: AirQualityInfo; // 空气质量
  measurementTime: Timestamp;  // 测量时间
  location?: LocationInfo;     // 测量位置
  deviceId?: string;           // 测量设备ID
}

interface AirQualityInfo {
  aqi: number;                 // 空气质量指数
  pm25: number;                // PM2.5浓度(μg/m³)
  pm10: number;                // PM10浓度(μg/m³)
  so2: number;                 // SO2浓度(μg/m³)
  no2: number;                 // NO2浓度(μg/m³)
  co: number;                  // CO浓度(mg/m³)
  o3: number;                  // O3浓度(μg/m³)
}
```

### 保险信息 (InsuranceInfo)

```typescript
interface InsuranceInfo {
  policyNumber: string;        // 保单号
  insuranceCompany: string;    // 保险公司
  policyType: string;          // 保险类型
  coverageAmount: number;      // 保险金额
  premium: number;             // 保险费
  startDate: Timestamp;        // 保险开始日期
  endDate: Timestamp;          // 保险结束日期
  beneficiary: string;         // 受益人
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED';
  claims?: InsuranceClaim[];   // 理赔记录
}

interface InsuranceClaim {
  claimNumber: string;         // 理赔号
  claimDate: Timestamp;        // 理赔日期
  claimAmount: number;         // 理赔金额
  description: string;         // 理赔描述
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
  attachments?: string[];      // 附件
}
```

## 业务数据模型

### 质量认证 (QualityCertification)

```typescript
interface QualityCertification {
  id: string;                  // 认证ID
  certificateNumber: string;   // 证书编号
  certificateType: CertificationType; // 证书类型
  certifyingBody: string;      // 认证机构
  productName: string;         // 产品名称
  productCategory: string;     // 产品类别
  standards: string[];         // 执行标准
  issueDate: Timestamp;        // 发证日期
  expiryDate: Timestamp;       // 有效期至
  scope: string;               // 认证范围
  status: CertificationStatus; // 证书状态
  attachments: string[];       // 证书附件
  verificationUrl?: string;    // 验证链接
  annualReview?: AnnualReview[]; // 年度审查记录
  suspensionHistory?: SuspensionRecord[]; // 暂停记录
}

type CertificationType = 
  | 'ORGANIC'                  // 有机认证
  | 'GREEN_FOOD'               // 绿色食品
  | 'POLLUTION_FREE'           // 无公害农产品
  | 'GAP'                      // 良好农业规范
  | 'HACCP'                    // 危害分析关键控制点
  | 'ISO22000'                 // 食品安全管理体系
  | 'GMP'                      // 良好生产规范
  | 'HALAL'                    // 清真认证
  | 'KOSHER'                   // 犹太认证
  | 'MSC'                      // 海洋管理委员会
  | 'FSC'                      // 森林管理委员会
  | 'FAIR_TRADE';              // 公平贸易

type CertificationStatus = 
  | 'VALID'                    // 有效
  | 'EXPIRED'                  // 过期
  | 'SUSPENDED'                // 暂停
  | 'REVOKED'                  // 吊销
  | 'PENDING_RENEWAL';         // 待续展

interface AnnualReview {
  reviewDate: Timestamp;       // 审查日期
  reviewResult: 'PASSED' | 'FAILED' | 'CONDITIONAL'; // 审查结果
  findings?: string[];         // 发现问题
  correctionActions?: string[]; // 纠正措施
  nextReviewDate: Timestamp;   // 下次审查日期
}

interface SuspensionRecord {
  suspensionDate: Timestamp;   // 暂停日期
  reason: string;              // 暂停原因
  duration: number;            // 暂停天数
  reinstatementDate?: Timestamp; // 恢复日期
  status: 'ACTIVE' | 'LIFTED'; // 状态
}
```

### 法规遵循 (RegulatoryCompliance)

```typescript
interface RegulatoryCompliance {
  id: string;                  // 合规记录ID
  regulationType: RegulationType; // 法规类型
  regulationName: string;      // 法规名称
  regulationCode: string;      // 法规代码
  applicableScope: string[];   // 适用范围
  complianceLevel: 'FULL' | 'PARTIAL' | 'NON_COMPLIANT'; // 合规程度
  lastAssessmentDate: Timestamp; // 最后评估日期
  nextAssessmentDate: Timestamp; // 下次评估日期
  complianceScore: number;     // 合规评分(0-100)
  violations?: ComplianceViolation[]; // 违规记录
  correctionActions?: CorrectionAction[]; // 纠正措施
  evidence: ComplianceEvidence[]; // 合规证据
  responsiblePerson: string;   // 负责人
  status: 'COMPLIANT' | 'UNDER_REVIEW' | 'NON_COMPLIANT'; // 状态
}

type RegulationType = 
  | 'FOOD_SAFETY'              // 食品安全法规
  | 'ENVIRONMENTAL'            // 环境保护法规
  | 'LABOR'                    // 劳动法规
  | 'ANIMAL_WELFARE'           // 动物福利法规
  | 'PESTICIDE'                // 农药使用法规
  | 'PACKAGING'                // 包装法规
  | 'IMPORT_EXPORT'            // 进出口法规
  | 'TAXATION'                 // 税务法规
  | 'ADVERTISING';             // 广告法规

interface ComplianceViolation {
  violationDate: Timestamp;    // 违规日期
  violationType: string;       // 违规类型
  description: string;         // 违规描述
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // 严重程度
  penalty?: PenaltyInfo;       // 处罚信息
  resolutionDate?: Timestamp;  // 解决日期
  status: 'OPEN' | 'RESOLVED' | 'APPEALED'; // 状态
}

interface PenaltyInfo {
  penaltyType: 'WARNING' | 'FINE' | 'SUSPENSION' | 'REVOCATION'; // 处罚类型
  amount?: number;             // 罚款金额
  description: string;         // 处罚描述
  appealDeadline?: Timestamp;  // 申诉截止日期
}

interface CorrectionAction {
  actionId: string;            // 措施ID
  description: string;         // 措施描述
  responsiblePerson: string;   // 负责人
  targetDate: Timestamp;       // 目标完成日期
  actualDate?: Timestamp;      // 实际完成日期
  status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'; // 状态
  evidence?: string[];         // 完成证据
}

interface ComplianceEvidence {
  evidenceType: 'DOCUMENT' | 'PHOTO' | 'VIDEO' | 'CERTIFICATE' | 'TEST_REPORT'; // 证据类型
  description: string;         // 证据描述
  fileUrl: string;             // 文件链接
  uploadDate: Timestamp;       // 上传日期
  expiryDate?: Timestamp;      // 有效期
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED'; // 验证状态
}
```

### 财务信息 (FinancialInfo)

```typescript
interface FinancialInfo {
  currency: string;            // 货币类型，默认"CNY"
  amount: number;              // 金额
  taxAmount?: number;          // 税费
  discountAmount?: number;     // 折扣金额
  totalAmount: number;         // 总金额
  paymentMethod?: PaymentMethod; // 支付方式
  paymentStatus: PaymentStatus; // 支付状态
  invoiceNumber?: string;      // 发票号
  transactionId?: string;      // 交易ID
  exchangeRate?: number;       // 汇率
  bankInfo?: BankInfo;         // 银行信息
}

type PaymentMethod = 
  | 'CASH'                     // 现金
  | 'BANK_TRANSFER'            // 银行转账
  | 'CREDIT_CARD'              // 信用卡
  | 'DEBIT_CARD'               // 借记卡
  | 'ALIPAY'                   // 支付宝
  | 'WECHAT_PAY'               // 微信支付
  | 'CHECK'                    // 支票
  | 'CRYPTOCURRENCY';          // 数字货币

type PaymentStatus = 
  | 'PENDING'                  // 待支付
  | 'PROCESSING'               // 处理中
  | 'PAID'                     // 已支付
  | 'FAILED'                   // 支付失败
  | 'CANCELLED'                // 已取消
  | 'REFUNDED'                 // 已退款
  | 'PARTIALLY_REFUNDED';      // 部分退款

interface BankInfo {
  bankName: string;            // 银行名称
  accountNumber: string;       // 账户号码(脱敏)
  accountName: string;         // 账户名称
  branchName?: string;         // 支行名称
  swiftCode?: string;          // SWIFT代码
  routingNumber?: string;      // 路由号码
}
```

### 操作记录 (OperationRecord)

```typescript
interface OperationRecord {
  id: string;                  // 记录ID
  operationType: OperationType; // 操作类型
  operatorId: string;          // 操作员ID
  operatorName: string;        // 操作员姓名
  operatorRole: string;        // 操作员角色
  targetResource: string;      // 目标资源
  targetResourceId: string;    // 目标资源ID
  operationTime: Timestamp;    // 操作时间
  duration?: number;           // 操作时长(秒)
  description: string;         // 操作描述
  parameters?: OperationParameters; // 操作参数
  result: OperationResult;     // 操作结果
  equipment?: EquipmentUsed[]; // 使用设备
  materials?: MaterialUsed[];  // 使用材料
  environmental?: EnvironmentalData; // 环境条件
  qualityCheck?: QualityCheckRecord; // 质量检查
  photos?: string[];           // 操作照片
  videos?: string[];           // 操作视频
  signatures?: DigitalSignature[]; // 数字签名
  approvals?: ApprovalRecord[]; // 审批记录
  location?: LocationInfo;     // 操作位置
  cost?: FinancialInfo;        // 操作成本
  notes?: string;              // 备注
  tags?: string[];             // 标签
  metadata?: Record<string, any>; // 元数据
}

type OperationType = 
  | 'CREATE'                   // 创建
  | 'UPDATE'                   // 更新
  | 'DELETE'                   // 删除
  | 'APPROVE'                  // 审批
  | 'REJECT'                   // 拒绝
  | 'TRANSFER'                 // 转移
  | 'PROCESSING'               // 加工处理
  | 'TESTING'                  // 检测
  | 'PACKAGING'                // 包装
  | 'SHIPPING'                 // 发货
  | 'RECEIVING'                // 收货
  | 'STORAGE'                  // 存储
  | 'MAINTENANCE'              // 维护
  | 'INSPECTION'               // 检查
  | 'CLEANING'                 // 清洁
  | 'HARVESTING'               // 收获
  | 'PLANTING'                 // 种植
  | 'FEEDING'                  // 喂养
  | 'TREATMENT'                // 处理
  | 'MONITORING';              // 监控

interface OperationParameters {
  temperature?: number;        // 温度参数
  pressure?: number;           // 压力参数
  speed?: number;              // 速度参数
  quantity?: number;           // 数量参数
  concentration?: number;      // 浓度参数
  ph?: number;                 // pH值参数
  custom?: Record<string, any>; // 自定义参数
}

type OperationResult = 
  | 'SUCCESS'                  // 成功
  | 'PARTIAL_SUCCESS'          // 部分成功
  | 'FAILED'                   // 失败
  | 'CANCELLED'                // 取消
  | 'PENDING'                  // 待处理
  | 'IN_PROGRESS';             // 进行中

interface EquipmentUsed {
  equipmentId: string;         // 设备ID
  equipmentName: string;       // 设备名称
  usageTime: number;           // 使用时长(分钟)
  settings?: Record<string, any>; // 设备设置
  performance?: EquipmentPerformance; // 设备性能
}

interface EquipmentPerformance {
  efficiency: number;          // 效率(%)
  accuracy: number;            // 精度(%)
  errorRate: number;           // 错误率(%)
  maintenanceStatus: 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL'; // 维护状态
}

interface MaterialUsed {
  materialId: string;          // 材料ID
  materialName: string;        // 材料名称
  quantity: number;            // 使用数量
  unit: string;                // 单位
  batchNumber?: string;        // 批次号
  expiryDate?: Timestamp;      // 过期日期
  cost?: number;               // 成本
}

interface QualityCheckRecord {
  checkId: string;             // 检查ID
  checkType: string;           // 检查类型
  checkResult: 'PASS' | 'FAIL' | 'WARNING'; // 检查结果
  score?: number;              // 评分
  issues?: QualityIssue[];     // 质量问题
  inspector: string;           // 检查员
  checkDate: Timestamp;        // 检查日期
}

interface QualityIssue {
  issueType: string;           // 问题类型
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; // 严重程度
  description: string;         // 问题描述
  correctionAction?: string;   // 纠正措施
  resolved: boolean;           // 是否已解决
}

interface DigitalSignature {
  signerId: string;            // 签名者ID
  signerName: string;          // 签名者姓名
  signatureData: string;       // 签名数据(加密)
  signatureTime: Timestamp;    // 签名时间
  signatureType: 'ELECTRONIC' | 'DIGITAL_CERTIFICATE' | 'BIOMETRIC'; // 签名类型
  verificationStatus: 'VALID' | 'INVALID' | 'EXPIRED'; // 验证状态
}

interface ApprovalRecord {
  approverId: string;          // 审批者ID
  approverName: string;        // 审批者姓名
  approvalTime: Timestamp;     // 审批时间
  decision: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CONDITIONAL'; // 审批决定
  comments?: string;           // 审批意见
  conditions?: string[];       // 审批条件
  nextApprover?: string;       // 下一级审批者
}
```

## 统计分析模型

### 时间序列数据 (TimeSeriesData)

```typescript
interface TimeSeriesData<T = number> {
  timestamp: Timestamp;        // 时间戳
  value: T;                    // 数值
  metadata?: Record<string, any>; // 元数据
}

interface TimeSeriesMetrics {
  series: TimeSeriesData[];    // 时间序列数据
  aggregation: AggregationType; // 聚合类型
  interval: TimeInterval;      // 时间间隔
  statistics: SeriesStatistics; // 统计信息
}

type AggregationType = 
  | 'SUM'                      // 求和
  | 'AVERAGE'                  // 平均值
  | 'MIN'                      // 最小值
  | 'MAX'                      // 最大值
  | 'COUNT'                    // 计数
  | 'MEDIAN'                   // 中位数
  | 'PERCENTILE_95'            // 95分位数
  | 'STANDARD_DEVIATION';      // 标准差

type TimeInterval = 
  | 'MINUTE'                   // 分钟
  | 'HOUR'                     // 小时
  | 'DAY'                      // 天
  | 'WEEK'                     // 周
  | 'MONTH'                    // 月
  | 'QUARTER'                  // 季度
  | 'YEAR';                    // 年

interface SeriesStatistics {
  total: number;               // 总计
  average: number;             // 平均值
  min: number;                 // 最小值
  max: number;                 // 最大值
  count: number;               // 数据点数量
  variance: number;            // 方差
  standardDeviation: number;   // 标准差
  trend: 'INCREASING' | 'DECREASING' | 'STABLE' | 'VOLATILE'; // 趋势
}
```

### 地理空间数据 (GeospatialData)

```typescript
interface GeospatialData {
  type: 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon';
  coordinates: number[] | number[][] | number[][][]; // 坐标数据
  properties?: Record<string, any>; // 属性数据
  crs?: CoordinateReferenceSystem; // 坐标参考系统
}

interface CoordinateReferenceSystem {
  type: string;                // CRS类型
  properties: {
    name: string;              // CRS名称
    code?: string;             // EPSG代码
  };
}

interface BoundingBox {
  minLongitude: number;        // 最小经度
  minLatitude: number;         // 最小纬度
  maxLongitude: number;        // 最大经度
  maxLatitude: number;         // 最大纬度
}

interface SpatialQuery {
  geometry: GeospatialData;    // 几何图形
  operation: SpatialOperation; // 空间操作
  distance?: number;           // 距离(米)
  buffer?: number;             // 缓冲区(米)
}

type SpatialOperation = 
  | 'INTERSECTS'               // 相交
  | 'CONTAINS'                 // 包含
  | 'WITHIN'                   // 在内部
  | 'TOUCHES'                  // 接触
  | 'CROSSES'                  // 穿越
  | 'OVERLAPS'                 // 重叠
  | 'DISJOINT'                 // 分离
  | 'NEAR';                    // 附近
```

## 通用响应模型

### API响应格式 (ApiResponse)

```typescript
interface ApiResponse<T = any> {
  status: 'success' | 'error';  // 响应状态
  data?: T;                    // 响应数据
  error?: ErrorInfo;           // 错误信息
  meta?: ResponseMetadata;     // 元数据
  timestamp: Timestamp;        // 响应时间戳
  requestId: string;           // 请求ID
}

interface ErrorInfo {
  code: string;                // 错误代码
  message: string;             // 错误消息
  details?: ErrorDetail[];     // 错误详情
  stack?: string;              // 错误堆栈(开发环境)
  suggestions?: string[];      // 解决建议
}

interface ErrorDetail {
  field?: string;              // 错误字段
  code: string;                // 详细错误代码
  message: string;             // 详细错误消息
  value?: any;                 // 错误值
}

interface ResponseMetadata {
  total?: number;              // 总数量
  page?: number;               // 当前页码
  limit?: number;              // 每页数量
  totalPages?: number;         // 总页数
  hasNext?: boolean;           // 是否有下一页
  hasPrevious?: boolean;       // 是否有上一页
  executionTime?: number;      // 执行时间(毫秒)
  cacheHit?: boolean;          // 是否命中缓存
  version?: string;            // API版本
  deprecationWarning?: string; // 弃用警告
}
```

### 分页模型 (PaginationModel)

```typescript
interface PaginationRequest {
  page: number;                // 页码，从1开始
  limit: number;               // 每页数量
  sort?: string;               // 排序字段
  order?: 'asc' | 'desc';      // 排序方向
  filter?: string;             // 筛选条件
  search?: string;             // 搜索关键词
  fields?: string[];           // 返回字段
}

interface PaginationResponse<T> {
  items: T[];                  // 数据项
  pagination: {
    total: number;             // 总数量
    page: number;              // 当前页码
    limit: number;             // 每页数量
    totalPages: number;        // 总页数
    hasNext: boolean;          // 是否有下一页
    hasPrevious: boolean;      // 是否有上一页
    startIndex: number;        // 开始索引
    endIndex: number;          // 结束索引
  };
}
```

## 数据验证模型

### 验证规则 (ValidationRules)

```typescript
interface FieldValidation {
  field: string;               // 字段名
  rules: ValidationRule[];     // 验证规则
  message?: string;            // 自定义错误消息
}

interface ValidationRule {
  type: ValidationType;        // 验证类型
  value?: any;                 // 验证值
  message?: string;            // 错误消息
  condition?: string;          // 条件表达式
}

type ValidationType = 
  | 'REQUIRED'                 // 必填
  | 'MIN_LENGTH'               // 最小长度
  | 'MAX_LENGTH'               // 最大长度
  | 'MIN_VALUE'                // 最小值
  | 'MAX_VALUE'                // 最大值
  | 'REGEX'                    // 正则表达式
  | 'EMAIL'                    // 邮箱格式
  | 'PHONE'                    // 电话格式
  | 'URL'                      // URL格式
  | 'DATE'                     // 日期格式
  | 'UUID'                     // UUID格式
  | 'ENUM'                     // 枚举值
  | 'UNIQUE'                   // 唯一性
  | 'CUSTOM';                  // 自定义验证

interface ValidationResult {
  isValid: boolean;            // 是否有效
  errors: ValidationError[];   // 验证错误
}

interface ValidationError {
  field: string;               // 错误字段
  rule: ValidationType;        // 违反的规则
  message: string;             // 错误消息
  value: any;                  // 错误值
}
```

## 版本控制

### 数据版本信息 (DataVersion)

```typescript
interface DataVersion {
  version: string;             // 版本号
  schemaVersion: string;       // 模式版本
  createdAt: Timestamp;        // 创建时间
  createdBy: string;           // 创建者
  description?: string;        // 版本描述
  changes: VersionChange[];    // 变更记录
  isBackwardCompatible: boolean; // 是否向后兼容
  migrationRequired: boolean;  // 是否需要迁移
}

interface VersionChange {
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'DEPRECATED'; // 变更类型
  target: string;              // 变更目标
  description: string;         // 变更描述
  impact: 'BREAKING' | 'NON_BREAKING'; // 影响类型
}
```

## 使用说明

### 导入方式

```typescript
// 导入特定模型
import { LocationInfo, ContactInfo, EnvironmentalData } from './data-models';

// 导入所有模型
import * as DataModels from './data-models';
```

### 扩展指南

1. **新增数据模型**：在相应分类下添加新的interface定义
2. **修改现有模型**：遵循向后兼容原则，使用可选字段
3. **弃用字段**：添加@deprecated注释，在下一个主版本中移除
4. **版本管理**：重大变更时更新schemaVersion

### 最佳实践

1. **命名规范**：使用PascalCase命名接口，camelCase命名字段
2. **类型安全**：优先使用联合类型而不是字符串
3. **文档注释**：为每个字段添加清晰的注释说明
4. **验证规则**：定义明确的数据验证规则
5. **向后兼容**：新增字段使用可选属性，避免破坏性变更

## 变更日志

### v1.0 (2025-05-21)
- 初始版本发布
- 定义基础数据类型和核心实体模型
- 建立业务数据模型和统计分析模型
- 创建通用响应模型和验证规则
- 制定版本控制机制 