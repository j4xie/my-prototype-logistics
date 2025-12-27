/**
 * API 响应类型定义
 */

// 统一API响应格式
export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message: string;
  code?: string;
}

// 分页响应
export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;  // 当前页码 (0-based)
  size: number;
}

// 分页请求参数
export interface PageRequest {
  page?: number;
  size?: number;
  sort?: string;
}

// API 错误
export class ApiError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// 常用业务类型
export interface Factory {
  id: string;
  factoryId: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductType {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  category?: string;
  unit: string;
  unitPrice?: number;
  description?: string;
  isActive: boolean;
}

export interface MaterialType {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  unit: string;
  category?: string;
  unitPrice?: number;
}

export interface MaterialBatch {
  id: string;
  batchNumber: string;
  factoryId: string;
  materialTypeId: string;
  materialTypeName?: string;
  quantity: number;
  remainingQuantity: number;
  unitPrice?: number;
  supplierId?: string;
  supplierName?: string;
  receivedDate: string;
  expiryDate?: string;
  storageLocation?: string;
  status: 'available' | 'reserved' | 'depleted';
  createdAt: string;
  updatedAt: string;
}

export interface ProductionBatch {
  id: number;
  batchNumber: string;
  factoryId: string;
  productTypeId: string;
  productTypeName?: string;
  plannedQuantity: number;
  actualQuantity?: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  supervisorId?: number;
  supervisorName?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QualityInspection {
  id: string;
  factoryId: string;
  batchId: number;
  batchNumber?: string;
  inspectorId: number;
  inspectorName?: string;
  inspectionType: 'incoming' | 'process' | 'final';
  result: 'pass' | 'fail' | 'conditional';
  score?: number;
  notes?: string;
  inspectedAt: string;
  createdAt: string;
}

export interface Equipment {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  type?: string;
  location?: string;
  status: 'running' | 'idle' | 'maintenance' | 'fault';
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
}

export interface EquipmentAlert {
  id: string;
  factoryId: string;
  equipmentId: string;
  equipmentName?: string;
  alertType: 'warning' | 'error' | 'critical';
  title: string;
  description?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
  resolvedAt?: string;
}

export interface Supplier {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  rating?: number;
  status: 'active' | 'inactive';
}

export interface Customer {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: 'active' | 'inactive';
}

export interface Shipment {
  id: string;
  factoryId: string;
  shipmentNumber: string;
  customerId?: string;
  customerName?: string;
  batchIds?: number[];
  totalQuantity: number;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  shippedAt?: string;
  deliveredAt?: string;
  createdAt: string;
}

export interface TimeclockRecord {
  id: number;
  userId: number;
  factoryId: string;
  clockInTime?: string;
  clockOutTime?: string;
  workDuration?: number;
  status: 'clocked_in' | 'clocked_out' | 'absent';
  notes?: string;
  createdAt: string;
}

export interface Department {
  id: string;
  factoryId: string;
  name: string;
  code: string;
  description?: string;
  managerUserId?: number;
  managerName?: string;
  isActive: boolean;
}

// Dashboard 统计类型
export interface DashboardOverview {
  todayOutput: number;
  completedBatches: number;
  activeEquipment: number;
  pendingTasks: number;
  qualityRate: number;
  equipmentUtilization: number;
}

export interface ProductionStats {
  period: string;
  totalOutput: number;
  completedBatches: number;
  inProgressBatches: number;
  avgEfficiency: number;
  trend: Array<{ date: string; output: number }>;
}

export interface QualityStats {
  passRate: number;
  failRate: number;
  conditionalRate: number;
  totalInspections: number;
  byType: {
    incoming: { pass: number; fail: number };
    process: { pass: number; fail: number };
    final: { pass: number; fail: number };
  };
}

export interface EquipmentStats {
  totalEquipment: number;
  running: number;
  idle: number;
  maintenance: number;
  fault: number;
  activeAlerts: number;
  avgUtilization: number;
}
