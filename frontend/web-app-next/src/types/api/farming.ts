/**
 * 农业模块API类型声明
 * @description 涵盖田地管理、作物种植、农事记录、收获等业务场景
 * @created 2025-06-03 TASK-P3-019A Day 0
 */

import { BaseEntity, BaseResponse, PaginatedResponse, Location } from './shared/base';

// ============ 田地管理 ============

export interface Field extends BaseEntity {
  name: string;
  code: string; // 田地编号
  location: Location;
  area: number; // 面积(亩)
  soilType: 'sandy' | 'clay' | 'loam' | 'silt';
  soilPh: number;
  irrigation: 'drip' | 'sprinkler' | 'flood' | 'none';
  owner: string; // 田地所有者
  manager: string; // 田地管理员
  status: 'active' | 'inactive' | 'maintenance';
  certifications: string[]; // 认证信息(有机、绿色等)
  description?: string;
}

export interface CreateFieldRequest {
  name: string;
  code: string;
  location: Location;
  area: number;
  soilType: Field['soilType'];
  soilPh: number;
  irrigation: Field['irrigation'];
  owner: string;
  manager: string;
  certifications?: string[];
  description?: string;
}

export interface UpdateFieldRequest extends Partial<CreateFieldRequest> {
  /** 更新时间戳 */
  updatedAt?: string;
}

// ============ 作物管理 ============

export interface Crop extends BaseEntity {
  name: string; // 作物名称
  variety: string; // 品种
  category: 'grain' | 'vegetable' | 'fruit' | 'cash' | 'feed';
  growthCycle: number; // 生长周期(天)
  description?: string;
  requirements: {
    minTemperature: number;
    maxTemperature: number;
    waterNeed: 'low' | 'medium' | 'high';
    lightRequirement: 'full' | 'partial' | 'shade';
    soilType: Field['soilType'][];
  };
  nutritionInfo?: {
    protein: number;
    carbohydrate: number;
    fat: number;
    calories: number;
  };
}

export interface CreateCropRequest {
  name: string;
  variety: string;
  category: Crop['category'];
  growthCycle: number;
  requirements: Crop['requirements'];
  description?: string;
  nutritionInfo?: Crop['nutritionInfo'];
}

// ============ 种植计划 ============

export interface PlantingPlan extends BaseEntity {
  fieldId: string;
  cropId: string;
  planName: string;
  plantingDate: string;
  expectedHarvestDate: string;
  plannedArea: number; // 计划种植面积
  expectedYield: number; // 预期产量(kg)
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';

  // 关联信息
  field?: Field;
  crop?: Crop;

  // 种植细节
  seedSource: string; // 种子来源
  seedQuantity: number; // 种子用量
  plantingMethod: 'direct' | 'transplant' | 'broadcast';
  rowSpacing: number; // 行距(cm)
  plantSpacing: number; // 株距(cm)

  // 成本预算
  budgetedCost: {
    seeds: number;
    fertilizer: number;
    pesticide: number;
    labor: number;
    irrigation: number;
    other: number;
    total: number;
  };
}

export interface CreatePlantingPlanRequest {
  fieldId: string;
  cropId: string;
  planName: string;
  plantingDate: string;
  expectedHarvestDate: string;
  plannedArea: number;
  expectedYield: number;
  seedSource: string;
  seedQuantity: number;
  plantingMethod: PlantingPlan['plantingMethod'];
  rowSpacing: number;
  plantSpacing: number;
  budgetedCost: PlantingPlan['budgetedCost'];
}

// ============ 农事记录 ============

export interface FarmActivity extends BaseEntity {
  fieldId: string;
  plantingPlanId?: string;
  activityType: 'planting' | 'irrigation' | 'fertilizing' | 'pest_control' | 'weeding' | 'harvesting' | 'other';
  activityDate: string;
  description: string;

  // 活动详情
  details: {
    materials?: {
      name: string;
      quantity: number;
      unit: string;
      cost: number;
    }[];
    equipment?: string[];
    duration: number; // 持续时间(小时)
    laborCount: number; // 用工人数
    weather?: {
      temperature: number;
      humidity: number;
      rainfall: number;
      condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
    };
  };

  // 成本记录
  cost: {
    materials: number;
    labor: number;
    equipment: number;
    other: number;
    total: number;
  };

  // 关联信息
  field?: Field;
  plantingPlan?: PlantingPlan;

  status: 'completed' | 'cancelled';
  notes?: string;
}

export interface CreateFarmActivityRequest {
  fieldId: string;
  plantingPlanId?: string;
  activityType: FarmActivity['activityType'];
  activityDate: string;
  description: string;
  details: FarmActivity['details'];
  cost: FarmActivity['cost'];
  notes?: string;
}

// ============ 收获记录 ============

export interface HarvestRecord extends BaseEntity {
  fieldId: string;
  plantingPlanId: string;
  harvestDate: string;
  actualYield: number; // 实际产量(kg)
  quality: 'A' | 'B' | 'C' | 'D'; // 质量等级
  moistureContent: number; // 含水量(%)

  // 收获详情
  harvestArea: number; // 收获面积
  lossRate: number; // 损失率(%)

  // 质量检测
  qualityMetrics: {
    size: 'large' | 'medium' | 'small';
    color: string;
    defectRate: number; // 缺陷率(%)
    pestResidueTest?: boolean;
    organicCertified?: boolean;
  };

  // 收获后处理
  postHarvest: {
    drying: boolean;
    cleaning: boolean;
    sorting: boolean;
    packaging: boolean;
    storage: boolean;
  };

  // 成本记录
  harvestCost: {
    labor: number;
    equipment: number;
    processing: number;
    storage: number;
    transport: number;
    total: number;
  };

  // 关联信息
  field?: Field;
  plantingPlan?: PlantingPlan;

  notes?: string;
}

export interface CreateHarvestRecordRequest {
  fieldId: string;
  plantingPlanId: string;
  harvestDate: string;
  actualYield: number;
  quality: HarvestRecord['quality'];
  moistureContent: number;
  harvestArea: number;
  lossRate: number;
  qualityMetrics: HarvestRecord['qualityMetrics'];
  postHarvest: HarvestRecord['postHarvest'];
  harvestCost: HarvestRecord['harvestCost'];
  notes?: string;
}

// ============ API响应类型 ============

// 田地管理API
export type GetFieldsResponse = PaginatedResponse<Field>;
export type GetFieldResponse = BaseResponse<Field>;
export type CreateFieldResponse = BaseResponse<Field>;
export type UpdateFieldResponse = BaseResponse<Field>;
export type DeleteFieldResponse = BaseResponse<{ id: string }>;

// 作物管理API
export type GetCropsResponse = PaginatedResponse<Crop>;
export type GetCropResponse = BaseResponse<Crop>;
export type CreateCropResponse = BaseResponse<Crop>;

// 种植计划API
export type GetPlantingPlansResponse = PaginatedResponse<PlantingPlan>;
export type GetPlantingPlanResponse = BaseResponse<PlantingPlan>;
export type CreatePlantingPlanResponse = BaseResponse<PlantingPlan>;

// 农事记录API
export type GetFarmActivitiesResponse = PaginatedResponse<FarmActivity>;
export type GetFarmActivityResponse = BaseResponse<FarmActivity>;
export type CreateFarmActivityResponse = BaseResponse<FarmActivity>;

// 收获记录API
export type GetHarvestRecordsResponse = PaginatedResponse<HarvestRecord>;
export type GetHarvestRecordResponse = BaseResponse<HarvestRecord>;
export type CreateHarvestRecordResponse = BaseResponse<HarvestRecord>;

// 统计数据
export interface FarmingDashboard {
  fieldCount: number;
  totalArea: number;
  activePlantingPlans: number;
  upcomingHarvests: number;
  totalYieldThisYear: number;
  averageYieldPerAcre: number;
  recentActivities: FarmActivity[];
}

export type GetFarmingDashboardResponse = BaseResponse<FarmingDashboard>;
