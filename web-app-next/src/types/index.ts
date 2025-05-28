/**
 * @module Types
 * @description 食品溯源系统 - 类型定义 (Phase-3)
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

// ============================================================================
// 基础类型
// ============================================================================

export type ID = string;
export type Timestamp = Date | string;

// ============================================================================
// 用户和认证相关类型
// ============================================================================

export type UserRole = 'farmer' | 'processor' | 'logistics' | 'retailer' | 'consumer' | 'admin';

export interface User {
  id: ID;
  username: string;
  email: string;
  role: UserRole;
  name: string;
  avatar?: string;
  organization?: Organization;
  permissions: Permission[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Organization {
  id: ID;
  name: string;
  type: 'farm' | 'processor' | 'logistics' | 'retailer';
  address: string;
  contact: string;
  certifications: Certification[];
}

export interface Permission {
  id: ID;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete';
}

// ============================================================================
// 产品和批次相关类型
// ============================================================================

export type ProductCategory = 'vegetable' | 'fruit' | 'meat' | 'dairy' | 'grain' | 'seafood';
export type BatchStatus = 'active' | 'processing' | 'shipped' | 'delivered' | 'recalled';

export interface Product {
  id: ID;
  name: string;
  category: ProductCategory;
  description?: string;
  batchId: ID;
  sku?: string;
  barcode?: string;
  images: string[];
  specifications: Record<string, any>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Batch {
  id: ID;
  batchNumber: string;
  products: Product[];
  quantity: number;
  unit: string;
  status: BatchStatus;
  qrCode: string;
  expiryDate: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // 溯源数据
  farmingData?: FarmingData;
  processingData?: ProcessingData;
  logisticsData?: LogisticsData;
}

// ============================================================================
// 溯源记录相关类型
// ============================================================================

export type TraceStage = 'farming' | 'processing' | 'logistics' | 'retail';

export interface TraceRecord {
  id: ID;
  batchId: ID;
  stage: TraceStage;
  timestamp: Timestamp;
  location: Location;
  operator: User;
  data: Record<string, any>;
  images: string[];
  documents: Document[];
  verified: boolean;
  verifiedBy?: User;
  verifiedAt?: Timestamp;
}

export interface Location {
  id: ID;
  name: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  type: 'farm' | 'facility' | 'warehouse' | 'store' | 'transport';
}

// ============================================================================
// 农业/养殖相关类型
// ============================================================================

export interface FarmingData {
  farmId: ID;
  plotId?: ID;
  seedSource: string;
  plantingDate: Timestamp;
  harvestDate: Timestamp;
  environmentData: EnvironmentData[];
  treatments: Treatment[];
  certifications: Certification[];
}

export interface EnvironmentData {
  id: ID;
  timestamp: Timestamp;
  temperature: number;
  humidity: number;
  soilPh?: number;
  rainfall?: number;
  sunlight?: number;
  airQuality?: number;
}

export interface Treatment {
  id: ID;
  type: 'fertilizer' | 'pesticide' | 'medicine' | 'vaccine';
  name: string;
  dosage: string;
  appliedDate: Timestamp;
  operator: User;
  reason: string;
  documents: Document[];
}

// ============================================================================
// 加工相关类型
// ============================================================================

export interface ProcessingData {
  facilityId: ID;
  processType: string;
  startTime: Timestamp;
  endTime: Timestamp;
  temperature?: number;
  pressure?: number;
  additives: Additive[];
  qualityChecks: QualityCheck[];
  equipment: Equipment[];
}

export interface Additive {
  id: ID;
  name: string;
  type: string;
  quantity: number;
  unit: string;
  supplier: string;
  batchNumber: string;
}

export interface QualityCheck {
  id: ID;
  type: string;
  result: 'pass' | 'fail' | 'warning';
  value?: number;
  unit?: string;
  standard: string;
  inspector: User;
  timestamp: Timestamp;
  notes?: string;
}

export interface Equipment {
  id: ID;
  name: string;
  model: string;
  serialNumber: string;
  lastMaintenance: Timestamp;
  status: 'active' | 'maintenance' | 'inactive';
}

// ============================================================================
// 物流相关类型
// ============================================================================

export interface LogisticsData {
  shipmentId: ID;
  vehicle: Vehicle;
  driver: User;
  route: RoutePoint[];
  startTime: Timestamp;
  endTime?: Timestamp;
  temperature?: TemperatureLog[];
  status: 'pending' | 'in_transit' | 'delivered' | 'delayed';
}

export interface Vehicle {
  id: ID;
  plateNumber: string;
  type: 'truck' | 'van' | 'refrigerated' | 'container';
  capacity: number;
  gpsDevice?: string;
  temperatureControl: boolean;
}

export interface RoutePoint {
  id: ID;
  location: Location;
  timestamp: Timestamp;
  type: 'pickup' | 'waypoint' | 'delivery';
  status: 'planned' | 'arrived' | 'departed';
}

export interface TemperatureLog {
  timestamp: Timestamp;
  temperature: number;
  humidity?: number;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// ============================================================================
// 认证和文档相关类型
// ============================================================================

export interface Certification {
  id: ID;
  name: string;
  type: 'organic' | 'gmp' | 'haccp' | 'iso' | 'halal' | 'kosher';
  issuer: string;
  issueDate: Timestamp;
  expiryDate: Timestamp;
  certificateNumber: string;
  documentUrl: string;
  verified: boolean;
}

export interface Document {
  id: ID;
  name: string;
  type: 'certificate' | 'report' | 'invoice' | 'permit' | 'photo';
  url: string;
  size: number;
  mimeType: string;
  uploadedBy: User;
  uploadedAt: Timestamp;
  verified: boolean;
}

// ============================================================================
// API响应类型
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: Timestamp;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// 状态管理相关类型
// ============================================================================

export interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  language: 'zh-CN' | 'en-US';
  offline: boolean;
  loading: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  loading: boolean;
  error: string | null;
}

// ============================================================================
// 组件Props类型
// ============================================================================

export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface LoadingState {
  loading: boolean;
  error?: string | null;
}

// ============================================================================
// 表单相关类型
// ============================================================================

export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'password' | 'number' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

export interface FormData {
  [key: string]: any;
}

export interface FormErrors {
  [key: string]: string;
} 