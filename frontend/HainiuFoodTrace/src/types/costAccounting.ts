/**
 * 成本核算系统 - TypeScript 类型定义
 * 对应后端 Phase 2 成本核算API
 */

// ==================== 工作流程1: 原材料接收 ====================

export interface MaterialReceiptData {
  rawMaterialCategory: string;  // 鱼类品种
  rawMaterialWeight: number;     // 进货重量(kg)
  rawMaterialCost: number;       // 进货成本(元)
  productCategory: 'fresh' | 'frozen';  // 产品类型
  expectedPrice?: number;        // 预期售价(元/kg)
  notes?: string;
}

export interface MaterialReceipt {
  id: string;
  batchNumber: string;
  rawMaterialCategory: string;
  rawMaterialWeight: number;
  rawMaterialCost: number;
  productCategory: 'fresh' | 'frozen';
  expectedPrice?: number;
  totalCost?: number;
  profitMargin?: number;
  profitRate?: number;
  status: string;
  startDate: string;
  createdAt: string;
  notes?: string;
}

// ==================== 工作流程2: 员工工作时段 ====================

export interface ClockInData {
  batchId: string;
  workTypeId?: string;
  notes?: string;
}

export interface ClockOutData {
  sessionId?: string;
  processedQuantity?: number;
  notes?: string;
}

export interface WorkSession {
  id: string;
  batchId: string;
  userId: number;
  workTypeId?: string;
  startTime: string;
  endTime?: string;
  totalMinutes?: number;
  processedQuantity?: number;
  ccrRate: number;  // CCR成本率(元/分钟)
  laborCost?: number;  // 人工成本(元)
  notes?: string;
  createdAt: string;
  user: {
    id: number;
    username: string;
    fullName: string;
    department?: string;
  };
  batch: {
    id: string;
    batchNumber: string;
    productType: string;
    rawMaterialCategory?: string;
  };
  workType?: {
    id: string;
    name: string;
  };
}

// ==================== 工作流程3: 设备使用 ====================

export interface EquipmentUsageData {
  batchId: string;
  equipmentId: string;
  notes?: string;
}

export interface EquipmentUsage {
  id: string;
  batchId: string;
  equipmentId: string;
  startTime: string;
  endTime?: string;
  usageDuration?: number;  // 使用时长(分钟)
  equipmentCost?: number;  // 设备成本(元)
  notes?: string;
  createdAt: string;
  batch: {
    id: string;
    batchNumber: string;
    productType: string;
  };
  equipment: {
    id: string;
    name: string;
    equipmentType: string;
    hourlyOperationCost?: number;
  };
}

export interface MaintenanceData {
  equipmentId: string;
  maintenanceType: 'routine' | 'repair' | 'emergency' | 'upgrade';
  cost: number;
  description?: string;
  performedBy?: number;
  durationMinutes?: number;
  partsReplaced?: any;
  nextScheduledDate?: string;
}

export interface EquipmentMaintenance {
  id: string;
  equipmentId: string;
  maintenanceDate: string;
  maintenanceType: 'routine' | 'repair' | 'emergency' | 'upgrade';
  cost: number;
  description?: string;
  performedBy?: number;
  durationMinutes?: number;
  partsReplaced?: any;
  nextScheduledDate?: string;
  createdAt: string;
  equipment: {
    id: string;
    name: string;
    equipmentType: string;
  };
}

// ==================== 成本分析 ====================

export interface WorkerDetail {
  workerId: number;
  workerName: string;
  department?: string;
  workType?: string;
  startTime: string;
  endTime?: string;
  totalMinutes?: number;
  processedQuantity?: number;
  ccrRate: number;
  laborCost?: number;
}

export interface EquipmentDetail {
  equipmentId: string;
  equipmentName: string;
  equipmentType: string;
  startTime: string;
  endTime?: string;
  usageDuration?: number;
  equipmentCost?: number;
}

export interface LaborStats {
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  totalMinutes: number;
  totalLaborCost: number;
  totalQuantityProcessed: number;
  workerDetails: WorkerDetail[];
}

export interface EquipmentStats {
  totalUsages: number;
  completedUsages: number;
  activeUsages: number;
  totalDuration: number;  // 总时长(分钟)
  totalEquipmentCost: number;
  equipmentDetails: EquipmentDetail[];
}

export interface CostBreakdown {
  rawMaterialCost: number;
  rawMaterialPercentage: string;  // 百分比字符串，如 "45.23"
  laborCost: number;
  laborPercentage: string;
  equipmentCost: number;
  equipmentPercentage: string;
  totalCost: number;
}

export interface ProfitAnalysis {
  expectedPrice?: number;
  rawMaterialWeight?: number;
  expectedRevenue?: number;
  totalCost: number;
  profitMargin?: number;  // 利润金额
  profitRate?: number;    // 利润率百分比
  breakEvenPrice?: string;  // 盈亏平衡价格
}

export interface CostAnalysis {
  batch: {
    id: string;
    batchNumber: string;
    productType: string;
    rawMaterialCategory?: string;
    productCategory?: 'fresh' | 'frozen';
    status: string;
    supervisor?: {
      id: number;
      fullName: string;
    };
    startDate: string;
    endDate?: string;
  };
  laborStats: LaborStats;
  equipmentStats: EquipmentStats;
  costBreakdown: CostBreakdown;
  profitAnalysis: ProfitAnalysis;
}

// ==================== 常用类型别名 ====================

export type ProductCategory = 'fresh' | 'frozen';
export type MaintenanceType = 'routine' | 'repair' | 'emergency' | 'upgrade';

// ==================== 鱼类品种数据 ====================

export interface FishType {
  id: string;
  name: string;
  code: string;
  category: string;
  image?: string;
  averagePrice?: number;  // 平均价格(元/kg)
  description?: string;
}

// 常见鱼类品种
export const FISH_TYPES: FishType[] = [
  { id: '1', name: '鲈鱼', code: 'BASS', category: '淡水鱼', averagePrice: 35 },
  { id: '2', name: '草鱼', code: 'GCARP', category: '淡水鱼', averagePrice: 15 },
  { id: '3', name: '鲤鱼', code: 'CARP', category: '淡水鱼', averagePrice: 12 },
  { id: '4', name: '鲫鱼', code: 'CRUCIAN', category: '淡水鱼', averagePrice: 18 },
  { id: '5', name: '黑鱼', code: 'SNAKEHEAD', category: '淡水鱼', averagePrice: 45 },
  { id: '6', name: '带鱼', code: 'HAIRTAIL', category: '海水鱼', averagePrice: 28 },
  { id: '7', name: '黄鱼', code: 'CROAKER', category: '海水鱼', averagePrice: 38 },
  { id: '8', name: '鲳鱼', code: 'POMFRET', category: '海水鱼', averagePrice: 42 },
  { id: '9', name: '三文鱼', code: 'SALMON', category: '海水鱼', averagePrice: 88 },
  { id: '10', name: '金枪鱼', code: 'TUNA', category: '海水鱼', averagePrice: 120 },
];

// ==================== UI 辅助函数 ====================

/**
 * 格式化金额显示
 */
export const formatCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null) return '¥0.00';
  return `¥${amount.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
};

/**
 * 格式化时长显示
 */
export const formatDuration = (minutes: number | undefined | null): string => {
  if (!minutes) return '0分钟';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) {
    return `${hours}小时${mins}分钟`;
  }
  return `${mins}分钟`;
};

/**
 * 格式化重量显示
 */
export const formatWeight = (kg: number | undefined | null): string => {
  if (!kg) return '0kg';
  return `${kg.toFixed(2)}kg`;
};

/**
 * 计算预估成本
 */
export const calculateEstimatedCost = (ccrRate: number, minutes: number): number => {
  return ccrRate * minutes;
};

/**
 * 计算工作时长(分钟)
 */
export const calculateWorkMinutes = (startTime: string, endTime?: string): number => {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : new Date();
  return Math.floor((end.getTime() - start.getTime()) / 1000 / 60);
};
