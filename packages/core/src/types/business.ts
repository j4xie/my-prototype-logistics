/**
 * 业务相关类型定义
 */

import { BaseEntity, Coordinates, Address, Attachment, Tag } from './common';

/**
 * 产品类型枚举
 */
export enum ProductType {
  VEGETABLE = 'vegetable',
  FRUIT = 'fruit',
  GRAIN = 'grain',
  MEAT = 'meat',
  DAIRY = 'dairy',
  SEAFOOD = 'seafood',
  PROCESSED = 'processed',
  ORGANIC = 'organic'
}

/**
 * 生产阶段枚举
 */
export enum ProductionStage {
  FARMING = 'farming',         // 种植/养殖
  HARVESTING = 'harvesting',   // 收获
  PROCESSING = 'processing',   // 加工
  PACKAGING = 'packaging',     // 包装
  STORAGE = 'storage',         // 存储
  LOGISTICS = 'logistics',     // 物流
  RETAIL = 'retail'            // 零售
}

/**
 * 质量等级
 */
export enum QualityGrade {
  A = 'A',
  B = 'B',
  C = 'C',
  PREMIUM = 'premium',
  STANDARD = 'standard',
  BASIC = 'basic'
}

/**
 * 产品信息
 */
export interface Product extends BaseEntity {
  name: string;
  type: ProductType;
  category: string;
  subcategory?: string;
  description?: string;
  specifications: Record<string, any>;
  
  // 质量标准
  qualityStandards: QualityStandard[];
  certifications: Certification[];
  
  // 图片和文档
  images: Attachment[];
  documents: Attachment[];
  
  // 标签和元数据
  tags: Tag[];
  metadata: Record<string, any>;
  
  // 状态
  isActive: boolean;
}

/**
 * 批次信息
 */
export interface Batch extends BaseEntity {
  batchNumber: string;
  product: Product;
  productId: string;
  
  // 生产信息
  productionDate: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  
  // 质量信息
  quality: QualityInfo;
  
  // 当前状态
  currentStage: ProductionStage;
  status: 'active' | 'completed' | 'recalled' | 'expired';
  
  // 生产过程
  stages: ProductionStageDetail[];
  
  // 溯源信息
  traceability: TraceabilityInfo;
  
  // 位置信息
  currentLocation?: Location;
  
  // QR码
  qrCode: string;
  
  // 附件
  attachments: Attachment[];
  
  // 元数据
  metadata: Record<string, any>;
}

/**
 * 生产阶段详情
 */
export interface ProductionStageDetail extends BaseEntity {
  stage: ProductionStage;
  name: string;
  description?: string;
  
  // 时间信息
  startTime: string;
  endTime?: string;
  duration?: number; // 秒
  
  // 位置信息
  location: Location;
  
  // 操作人员
  operator: {
    id: string;
    name: string;
    role: string;
  };
  
  // 设备信息
  equipment?: Equipment[];
  
  // 过程数据
  processData: Record<string, any>;
  
  // 质量检测
  qualityChecks: QualityCheck[];
  
  // 环境数据
  environmentData?: EnvironmentData;
  
  // 输入材料
  inputs?: MaterialInput[];
  
  // 输出产品
  outputs?: MaterialOutput[];
  
  // 文档和图片
  documents: Attachment[];
  images: Attachment[];
  
  // 状态
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  
  // 备注
  notes?: string;
}

/**
 * 位置信息
 */
export interface Location extends BaseEntity {
  name: string;
  type: 'farm' | 'facility' | 'warehouse' | 'transport' | 'retail' | 'laboratory';
  
  // 地址信息
  address: Address;
  coordinates?: Coordinates;
  
  // 设施信息
  facility?: Facility;
  
  // 联系信息
  contact?: {
    person?: string;
    phone?: string;
    email?: string;
  };
  
  // 认证信息
  certifications: Certification[];
  
  // 状态
  isActive: boolean;
}

/**
 * 设施信息
 */
export interface Facility extends BaseEntity {
  name: string;
  type: 'farm' | 'processing_plant' | 'warehouse' | 'laboratory' | 'office';
  capacity?: number;
  area?: number; // 平方米
  
  // 设备列表
  equipment: Equipment[];
  
  // 环境控制
  environmentControl?: {
    temperature?: { min: number; max: number; unit: string };
    humidity?: { min: number; max: number; unit: string };
    lighting?: { type: string; intensity?: number };
    ventilation?: { type: string; rate?: number };
  };
  
  // 安全信息
  safety?: {
    fireProtection: boolean;
    securitySystem: boolean;
    emergencyExits: number;
    firstAidStation: boolean;
  };
  
  // 认证
  certifications: Certification[];
  
  // 状态
  isOperational: boolean;
}

/**
 * 设备信息
 */
export interface Equipment extends BaseEntity {
  name: string;
  type: string;
  model?: string;
  manufacturer?: string;
  serialNumber?: string;
  
  // 技术规格
  specifications: Record<string, any>;
  
  // 维护信息
  maintenance: {
    lastMaintenance?: string;
    nextMaintenance?: string;
    maintenanceInterval: number; // 天数
    maintenanceHistory: MaintenanceRecord[];
  };
  
  // 校准信息
  calibration?: {
    lastCalibration?: string;
    nextCalibration?: string;
    calibrationInterval: number; // 天数
    calibrationHistory: CalibrationRecord[];
  };
  
  // 状态
  status: 'operational' | 'maintenance' | 'broken' | 'retired';
  location?: Location;
}

/**
 * 维护记录
 */
export interface MaintenanceRecord extends BaseEntity {
  type: 'preventive' | 'corrective' | 'emergency';
  description: string;
  performedBy: string;
  performedAt: string;
  duration?: number; // 分钟
  cost?: number;
  partsReplaced?: string[];
  notes?: string;
  attachments: Attachment[];
}

/**
 * 校准记录
 */
export interface CalibrationRecord extends BaseEntity {
  standard: string;
  method: string;
  performedBy: string;
  performedAt: string;
  results: Record<string, any>;
  passed: boolean;
  certificate?: Attachment;
  notes?: string;
}

/**
 * 质量信息
 */
export interface QualityInfo {
  grade: QualityGrade;
  score?: number; // 0-100
  standards: QualityStandard[];
  checks: QualityCheck[];
  certifications: Certification[];
  defects?: QualityDefect[];
  overall: 'pass' | 'fail' | 'pending' | 'conditional';
}

/**
 * 质量标准
 */
export interface QualityStandard extends BaseEntity {
  name: string;
  version: string;
  description?: string;
  category: string;
  
  // 标准参数
  parameters: QualityParameter[];
  
  // 测试方法
  testMethods: TestMethod[];
  
  // 适用范围
  applicableProducts: ProductType[];
  applicableStages: ProductionStage[];
  
  // 发布信息
  publisher: string;
  publishedAt: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  
  // 状态
  isActive: boolean;
}

/**
 * 质量参数
 */
export interface QualityParameter {
  name: string;
  type: 'numeric' | 'text' | 'boolean' | 'selection';
  unit?: string;
  
  // 数值型参数
  minValue?: number;
  maxValue?: number;
  targetValue?: number;
  tolerance?: number;
  
  // 文本型参数
  allowedValues?: string[];
  pattern?: string;
  
  // 其他属性
  mandatory: boolean;
  description?: string;
  testMethod?: string;
}

/**
 * 测试方法
 */
export interface TestMethod extends BaseEntity {
  name: string;
  code: string;
  description: string;
  procedure: string;
  
  // 设备要求
  requiredEquipment: string[];
  
  // 环境要求
  environmentRequirements?: {
    temperature?: { min: number; max: number };
    humidity?: { min: number; max: number };
    lighting?: string;
  };
  
  // 样本要求
  sampleRequirements: {
    size: number;
    preparation: string;
    storage?: string;
  };
  
  // 测试时间
  duration: number; // 分钟
  
  // 精度要求
  precision?: number;
  accuracy?: number;
  
  // 参考标准
  referenceStandards: string[];
}

/**
 * 质量检查
 */
export interface QualityCheck extends BaseEntity {
  type: 'visual' | 'measurement' | 'test' | 'sampling';
  name: string;
  description?: string;
  
  // 检查信息
  performedBy: string;
  performedAt: string;
  location?: Location;
  equipment?: Equipment[];
  
  // 检查项目
  checkItems: QualityCheckItem[];
  
  // 结果
  result: 'pass' | 'fail' | 'warning' | 'pending';
  score?: number;
  
  // 样本信息
  sampleId?: string;
  sampleSize?: number;
  
  // 环境条件
  environmentData?: EnvironmentData;
  
  // 附件
  images: Attachment[];
  documents: Attachment[];
  
  // 备注
  notes?: string;
}

/**
 * 质量检查项目
 */
export interface QualityCheckItem {
  parameter: string;
  method?: string;
  measuredValue: any;
  expectedValue?: any;
  unit?: string;
  tolerance?: number;
  result: 'pass' | 'fail' | 'warning';
  deviation?: number;
  notes?: string;
}

/**
 * 质量缺陷
 */
export interface QualityDefect {
  type: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  location?: string;
  size?: number;
  quantity?: number;
  cause?: string;
  correctiveAction?: string;
  preventiveAction?: string;
  images: Attachment[];
}

/**
 * 认证信息
 */
export interface Certification extends BaseEntity {
  name: string;
  type: 'organic' | 'gmp' | 'haccp' | 'iso' | 'halal' | 'kosher' | 'other';
  number: string;
  
  // 发证信息
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  
  // 适用范围
  scope: string;
  applicableProducts?: ProductType[];
  applicableStages?: ProductionStage[];
  
  // 证书状态
  status: 'valid' | 'expired' | 'suspended' | 'revoked';
  
  // 证书文件
  certificate: Attachment;
  
  // 验证信息
  verificationUrl?: string;
  verificationCode?: string;
  
  // 备注
  notes?: string;
}

/**
 * 溯源信息
 */
export interface TraceabilityInfo {
  // 上游批次
  parentBatches: string[];
  
  // 下游批次
  childBatches: string[];
  
  // 原料来源
  sources: MaterialSource[];
  
  // 供应链
  supplyChain: SupplyChainNode[];
  
  // 变换记录
  transformations: TransformationRecord[];
  
  // 完整性
  completeness: number; // 0-100
  confidence: number; // 0-100
}

/**
 * 原料来源
 */
export interface MaterialSource {
  materialType: string;
  materialName: string;
  quantity: number;
  unit: string;
  
  // 来源信息
  supplier?: Supplier;
  origin?: Location;
  harvestDate?: string;
  
  // 批次信息
  sourceBatch?: string;
  
  // 认证
  certifications: Certification[];
}

/**
 * 供应商信息
 */
export interface Supplier extends BaseEntity {
  name: string;
  code: string;
  type: 'farmer' | 'processor' | 'distributor' | 'retailer';
  
  // 联系信息
  contact: {
    person: string;
    phone: string;
    email: string;
    address: Address;
  };
  
  // 业务信息
  businessLicense?: string;
  taxId?: string;
  
  // 质量评级
  qualityRating?: number; // 0-100
  reliabilityRating?: number; // 0-100
  
  // 认证
  certifications: Certification[];
  
  // 状态
  status: 'active' | 'inactive' | 'blacklisted';
  
  // 审核信息
  lastAuditDate?: string;
  nextAuditDate?: string;
  auditHistory: AuditRecord[];
}

/**
 * 审核记录
 */
export interface AuditRecord extends BaseEntity {
  type: 'initial' | 'surveillance' | 'recertification' | 'special';
  auditor: string;
  auditDate: string;
  scope: string;
  
  // 结果
  result: 'passed' | 'failed' | 'conditional';
  score?: number;
  
  // 发现问题
  findings: AuditFinding[];
  
  // 报告
  report: Attachment;
  
  // 跟踪
  followUpRequired: boolean;
  followUpDate?: string;
}

/**
 * 审核发现
 */
export interface AuditFinding {
  category: string;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  requirement: string;
  evidence?: string;
  correctiveAction?: string;
  targetDate?: string;
  responsible?: string;
  status: 'open' | 'closed' | 'verified';
}

/**
 * 供应链节点
 */
export interface SupplyChainNode {
  id: string;
  type: 'supplier' | 'processor' | 'distributor' | 'retailer';
  name: string;
  location: Location;
  role: string;
  
  // 时间信息
  entryTime?: string;
  exitTime?: string;
  duration?: number;
  
  // 处理信息
  operations?: string[];
  transformations?: TransformationRecord[];
  
  // 质量检查
  qualityChecks?: QualityCheck[];
  
  // 存储条件
  storageConditions?: StorageCondition[];
}

/**
 * 变换记录
 */
export interface TransformationRecord extends BaseEntity {
  type: 'processing' | 'packaging' | 'mixing' | 'splitting' | 'assembly';
  operation: string;
  description?: string;
  
  // 时间信息
  startTime: string;
  endTime: string;
  
  // 操作人员
  operator: string;
  
  // 输入
  inputs: MaterialInput[];
  
  // 输出
  outputs: MaterialOutput[];
  
  // 参数
  parameters: Record<string, any>;
  
  // 设备
  equipment?: Equipment[];
  
  // 质量检查
  qualityChecks: QualityCheck[];
}

/**
 * 物料输入
 */
export interface MaterialInput {
  materialId: string;
  materialName: string;
  batchId?: string;
  quantity: number;
  unit: string;
  
  // 质量信息
  quality?: QualityInfo;
  
  // 来源
  source?: MaterialSource;
}

/**
 * 物料输出
 */
export interface MaterialOutput {
  materialId: string;
  materialName: string;
  batchId?: string;
  quantity: number;
  unit: string;
  
  // 质量信息
  quality?: QualityInfo;
  
  // 去向
  destination?: string;
}

/**
 * 存储条件
 */
export interface StorageCondition {
  parameter: string;
  value: any;
  unit?: string;
  requirement?: any;
  compliance: boolean;
  recordedAt: string;
  recordedBy?: string;
}

/**
 * 环境数据
 */
export interface EnvironmentData {
  temperature?: number;
  humidity?: number;
  pressure?: number;
  ph?: number;
  oxygen?: number;
  co2?: number;
  light?: number;
  
  // 单位
  units?: Record<string, string>;
  
  // 记录信息
  recordedAt: string;
  recordedBy?: string;
  location?: Location;
  equipment?: Equipment;
}