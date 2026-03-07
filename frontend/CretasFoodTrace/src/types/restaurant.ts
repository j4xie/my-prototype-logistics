/**
 * Restaurant module types
 * Types for recipe, requisition, stocktaking, and wastage management
 */

// ==================== Recipe (配方) ====================

export interface Recipe {
  id: string;
  factoryId: string;
  productTypeId: string;
  productTypeName?: string;
  rawMaterialTypeId: string;
  rawMaterialTypeName?: string;
  standardQuantity: number;
  actualQuantity?: number;
  unit: string;
  netYieldRate?: number;
  isMainIngredient: boolean;
  isActive: boolean;
  createdBy?: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeCreateRequest {
  productTypeId: string;
  rawMaterialTypeId: string;
  standardQuantity: number;
  unit: string;
  netYieldRate?: number;
  isMainIngredient?: boolean;
  notes?: string;
}

// ==================== Material Requisition (领料) ====================

export type RequisitionStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type RequisitionType = 'PRODUCTION' | 'MANUAL';

export interface MaterialRequisition {
  id: string;
  factoryId: string;
  requisitionNumber: string;
  requisitionDate: string;
  type: RequisitionType;
  status: RequisitionStatus;
  productTypeId?: string;
  productTypeName?: string;
  rawMaterialTypeId: string;
  rawMaterialTypeName?: string;
  requestedQuantity: number;
  actualQuantity?: number;
  unit: string;
  requestedBy?: number;
  requestedByName?: string;
  approvedBy?: number;
  approvedByName?: string;
  approvedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RequisitionCreateRequest {
  type: RequisitionType;
  productTypeId?: string;
  rawMaterialTypeId: string;
  requestedQuantity: number;
  unit: string;
  notes?: string;
}

// ==================== Stocktaking (盘点) ====================

export type StocktakingStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type DifferenceType = 'SURPLUS' | 'SHORTAGE' | 'MATCH';

export interface StocktakingRecord {
  id: string;
  factoryId: string;
  stocktakingNumber: string;
  stocktakingDate: string;
  status: StocktakingStatus;
  rawMaterialTypeId: string;
  rawMaterialTypeName?: string;
  systemQuantity: number;
  actualQuantity?: number;
  unit: string;
  differenceQuantity?: number;
  differenceType?: DifferenceType;
  countedBy?: number;
  countedByName?: string;
  verifiedBy?: number;
  completedAt?: string;
  adjustmentReason?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==================== Wastage (损耗) ====================

export type WastageType = 'EXPIRED' | 'DAMAGED' | 'SPOILED' | 'PROCESSING_LOSS' | 'OTHER';
export type WastageStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

export interface WastageRecord {
  id: string;
  factoryId: string;
  wastageNumber: string;
  wastageDate: string;
  type: WastageType;
  status: WastageStatus;
  rawMaterialTypeId: string;
  rawMaterialTypeName?: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  reportedBy?: number;
  reportedByName?: string;
  approvedBy?: number;
  approvedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WastageCreateRequest {
  type: WastageType;
  rawMaterialTypeId: string;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  notes?: string;
}
