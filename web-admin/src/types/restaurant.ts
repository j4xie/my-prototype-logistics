/**
 * 餐饮模块实体类型
 */

export interface RecipeItem {
  id: string;
  productTypeId: string;
  rawMaterialTypeId: string;
  standardQuantity: number;
  unit: string;
  netYieldRate?: number;
  isMainIngredient: boolean;
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RequisitionItem {
  id: string;
  requisitionNumber?: string;
  requisitionDate?: string;
  type: 'PRODUCTION' | 'MANUAL';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  productTypeId?: string;
  dishQuantity?: number;
  rawMaterialTypeId: string;
  requestedQuantity: number;
  actualQuantity?: number;
  unit: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StocktakingRecord {
  id: string;
  stocktakingNumber?: string;
  stocktakingDate?: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  rawMaterialTypeId: string;
  unit: string;
  systemQuantity: number;
  actualQuantity?: number;
  differenceType?: 'SURPLUS' | 'SHORTAGE' | 'MATCH';
  differenceQuantity?: number;
  adjustmentReason?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WastageRecord {
  id: string;
  wastageNumber?: string;
  wastageDate?: string;
  type: 'EXPIRED' | 'DAMAGED' | 'SPOILED' | 'PROCESSING' | 'OTHER';
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  rawMaterialTypeId: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  reason?: string;
  createdAt?: string;
  updatedAt?: string;
}
