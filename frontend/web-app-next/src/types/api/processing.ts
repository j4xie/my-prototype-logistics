/**
 * 加工模块API类型声明
 * @description 涵盖原料管理、加工生产、质量控制、成品管理等业务场景
 * @created 2025-06-03 TASK-P3-019A Day 0
 */

import { BaseEntity, BaseResponse, PaginatedResponse, Location } from './shared/base';

// ============ 原料管理 ============

export interface RawMaterial extends BaseEntity {
  name: string;
  code: string; // 原料编码
  category: 'grain' | 'vegetable' | 'fruit' | 'meat' | 'dairy' | 'additive';
  supplier: string;
  batchNumber: string;
  sourceLocation: Location;

  // 质量信息
  quality: {
    grade: 'A' | 'B' | 'C';
    moistureContent: number;
    purity: number; // 纯度(%)
    contaminants: string[];
    certifications: string[]; // 认证信息
  };

  // 库存信息
  inventory: {
    quantity: number;
    unit: 'kg' | 'ton' | 'liter' | 'piece';
    expiryDate: string;
    storageLocation: string;
    storageConditions: {
      temperature: number;
      humidity: number;
      lightExposure: 'none' | 'low' | 'medium' | 'high';
    };
  };

  // 成本信息
  cost: {
    unitPrice: number;
    totalCost: number;
    currency: string;
  };

  status: 'received' | 'in_storage' | 'in_use' | 'expired' | 'disposed';
  receivedDate: string;
  notes?: string;
}

export interface CreateRawMaterialRequest {
  name: string;
  code: string;
  category: RawMaterial['category'];
  supplier: string;
  batchNumber: string;
  sourceLocation: Location;
  quality: RawMaterial['quality'];
  inventory: RawMaterial['inventory'];
  cost: RawMaterial['cost'];
  receivedDate: string;
  notes?: string;
}

// ============ 加工生产 ============

export interface ProductionBatch extends BaseEntity {
  batchNumber: string;
  productId: string;
  productName: string;
  productionDate: string;
  plannedQuantity: number;
  actualQuantity: number;

  // 原料使用
  rawMaterials: {
    materialId: string;
    materialName: string;
    usedQuantity: number;
    unit: string;
    batchNumber: string;
  }[];

  // 生产流程
  productionSteps: {
    stepId: string;
    stepName: string;
    description: string;
    startTime: string;
    endTime: string;
    parameters: {
      temperature?: number;
      pressure?: number;
      duration: number;
      speed?: number;
    };
    operator: string;
    equipment: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    notes?: string;
  }[];

  // 质量控制
  qualityChecks: {
    checkId: string;
    checkType: 'incoming' | 'in_process' | 'final';
    checkTime: string;
    inspector: string;
    parameters: {
      temperature?: number;
      ph?: number;
      moisture?: number;
      weight?: number;
      dimension?: {
        length: number;
        width: number;
        height: number;
      };
    };
    result: 'pass' | 'fail' | 'conditional';
    defects?: string[];
    notes?: string;
  }[];

  // 成本追踪
  productionCost: {
    rawMaterials: number;
    labor: number;
    energy: number;
    equipment: number;
    overhead: number;
    total: number;
  };

  status: 'planned' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  completedDate?: string;
  yield: number; // 成品率(%)
  notes?: string;
}

export interface CreateProductionBatchRequest {
  productId: string;
  productName: string;
  productionDate: string;
  plannedQuantity: number;
  rawMaterials: ProductionBatch['rawMaterials'];
  productionSteps: ProductionBatch['productionSteps'];
  notes?: string;
}

// ============ 成品管理 ============

export interface FinishedProduct extends BaseEntity {
  name: string;
  code: string; // 产品编码
  category: 'food' | 'beverage' | 'supplement' | 'cosmetic' | 'pharmaceutical';
  batchNumber: string;
  productionBatchId: string;

  // 产品规格
  specifications: {
    weight: number;
    dimensions: {
      length: number;
      width: number;
      height: number;
    };
    volume?: number;
    packaging: string;
    shelfLife: number; // 保质期(天)
  };

  // 质量信息
  quality: {
    grade: 'Premium' | 'Standard' | 'Basic';
    qualityScore: number; // 质量分数(0-100)
    defects: string[];
    certifications: string[];
    nutritionalInfo?: {
      calories: number;
      protein: number;
      carbohydrates: number;
      fat: number;
      sodium: number;
      sugar: number;
    };
  };

  // 库存信息
  inventory: {
    quantity: number;
    unit: 'piece' | 'box' | 'kg' | 'liter';
    location: string;
    productionDate: string;
    expiryDate: string;
    storageConditions: {
      temperature: number;
      humidity: number;
      lightProtection: boolean;
    };
  };

  // 定价信息
  pricing: {
    costPrice: number;
    sellingPrice: number;
    margin: number; // 利润率(%)
    currency: string;
  };

  status: 'produced' | 'in_storage' | 'shipped' | 'sold' | 'expired' | 'recalled';
  notes?: string;
}

export interface CreateFinishedProductRequest {
  name: string;
  code: string;
  category: FinishedProduct['category'];
  batchNumber: string;
  productionBatchId: string;
  specifications: FinishedProduct['specifications'];
  quality: FinishedProduct['quality'];
  inventory: FinishedProduct['inventory'];
  pricing: FinishedProduct['pricing'];
  notes?: string;
}

// ============ 质量检测 ============

export interface QualityTest extends BaseEntity {
  testNumber: string;
  testType: 'microbiological' | 'chemical' | 'physical' | 'sensory' | 'nutritional';
  sampleId: string;
  sampleType: 'raw_material' | 'in_process' | 'finished_product';
  testDate: string;

  // 测试参数
  testParameters: {
    parameter: string;
    standardValue: number | string;
    actualValue: number | string;
    unit: string;
    tolerance: number;
    result: 'pass' | 'fail' | 'warning';
  }[];

  // 测试设备和人员
  equipment: {
    name: string;
    model: string;
    calibrationDate: string;
    accuracy: string;
  }[];

  inspector: {
    id: string;
    name: string;
    certification: string[];
  };

  // 测试结果
  overallResult: 'pass' | 'fail' | 'conditional';
  failureReasons?: string[];
  recommendations?: string[];

  // 合规性
  compliance: {
    standards: string[]; // 执行标准
    regulations: string[]; // 法规要求
    certificationBodies?: string[];
  };

  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  reportGenerated: boolean;
  notes?: string;
}

export interface CreateQualityTestRequest {
  testType: QualityTest['testType'];
  sampleId: string;
  sampleType: QualityTest['sampleType'];
  testDate: string;
  testParameters: QualityTest['testParameters'];
  equipment: QualityTest['equipment'];
  inspector: QualityTest['inspector'];
  compliance: QualityTest['compliance'];
  notes?: string;
}

// ============ API响应类型 ============

// 原料管理API
export type GetRawMaterialsResponse = PaginatedResponse<RawMaterial>;
export type GetRawMaterialResponse = BaseResponse<RawMaterial>;
export type CreateRawMaterialResponse = BaseResponse<RawMaterial>;
export type UpdateRawMaterialResponse = BaseResponse<RawMaterial>;

// 生产批次API
export type GetProductionBatchesResponse = PaginatedResponse<ProductionBatch>;
export type GetProductionBatchResponse = BaseResponse<ProductionBatch>;
export type CreateProductionBatchResponse = BaseResponse<ProductionBatch>;
export type UpdateProductionBatchResponse = BaseResponse<ProductionBatch>;

// 成品管理API
export type GetFinishedProductsResponse = PaginatedResponse<FinishedProduct>;
export type GetFinishedProductResponse = BaseResponse<FinishedProduct>;
export type CreateFinishedProductResponse = BaseResponse<FinishedProduct>;

// 质量检测API
export type GetQualityTestsResponse = PaginatedResponse<QualityTest>;
export type GetQualityTestResponse = BaseResponse<QualityTest>;
export type CreateQualityTestResponse = BaseResponse<QualityTest>;

// 统计数据
export interface ProcessingDashboard {
  activeBatches: number;
  completedBatchesToday: number;
  totalProduction: number;
  qualityPassRate: number;
  rawMaterialStock: number;
  finishedProductStock: number;
  averageYield: number;
  pendingQualityTests: number;
}

export type GetProcessingDashboardResponse = BaseResponse<ProcessingDashboard>;
