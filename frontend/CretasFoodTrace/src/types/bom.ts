/**
 * M-BOM-1 BOM 配方主子表 TypeScript 类型 (Track D1).
 *
 * 字段名 1:1 mirror 后端 Java entity (camelCase, per field-naming-convention.md).
 * @PriceSensitive 字段 (主表 5 / 子表 2) 对无 procurement:price:view 权限的角色返回 null.
 */

/** BomRecipe 状态: DRAFT → ACTIVE → ARCHIVED. */
export type BomRecipeStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

/** BomRecipe 来源类型. */
export type BomRecipeSourceType = 'MANUAL' | 'SAMPLE_AUTOGEN' | 'AI_GENERATED' | 'IMPORTED';

/** BomRecipeItem 物料分类. */
export type BomMaterialCategory = 'RAW' | 'AUXILIARY' | 'PACKAGING';

/** 限定单位 (服务端 CHECK 约束 + 前端 select). */
export type BomUnit = 'g' | 'kg' | 'mg' | 'ml' | 'L' | '个' | '袋' | '箱' | '瓶' | '盒';

/** BOM 配方项 (子表). */
export interface BomRecipeItem {
  id: number;
  recipeId: string;
  factoryId: string;
  materialTypeId: string;
  materialName?: string;
  standardQuantity: number;
  yieldRate: number;
  /** 折算后实际用量, 服务端缓存. 客户端可用 calculateActualQuantity 重算. */
  actualQuantity?: number;
  unit: BomUnit;
  /** @PriceSensitive — null for non-procurement-price roles. */
  unitPrice?: number;
  taxRate?: number;
  /** @PriceSensitive — null for non-procurement-price roles. */
  itemCost?: number;
  materialCategory: BomMaterialCategory;
  sortOrder: number;
  isOptional: boolean;
  substituteGroup?: string;
  remark?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** BOM 配方 (主表). */
export interface BomRecipe {
  id: string;
  factoryId: string;
  recipeCode: string;
  productTypeId: string;
  productName: string;
  version: number;
  isCurrent: boolean;
  overallYieldRate: number;
  outputQuantityPerUnit: number;
  outputUnit: string;
  /** @PriceSensitive */
  totalMaterialCost?: number;
  /** @PriceSensitive */
  totalLaborCost?: number;
  /** @PriceSensitive */
  totalOverheadCost?: number;
  /** @PriceSensitive */
  totalCost?: number;
  /** @PriceSensitive */
  standardSalePrice?: number;
  status: BomRecipeStatus;
  activatedAt?: string;
  activatedBy?: number;
  sourceType: BomRecipeSourceType;
  sourceSampleId?: string;
  notes?: string;
  items?: BomRecipeItem[];
  createdAt?: string;
  updatedAt?: string;
}

/** 客户端折算实际用量 — 跟服务端 calculateActualQuantity 公式一致.
 *  公式: standardQuantity / (yieldRate / 100), HALF_UP scale 6.
 *  Note: TypeScript 用 Number 浮点, 跟 Java BigDecimal HALF_UP 微小差异 (UI preview 可接受). */
export function calculateActualQuantity(standardQuantity: number, yieldRate: number): number {
  if (!yieldRate || yieldRate === 0) return standardQuantity;
  return standardQuantity / (yieldRate / 100);
}

/** 单位换算 — 镜像后端 UnitConversionService (Track D1 Bug-3).
 *  仅 g↔kg + ml↔L (1:1000), 不支持的换算返 null. */
export function convertUnit(value: number, from: string, to: string): number | null {
  if (value == null || !from || !to) return null;
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();
  if (f === t) return value;
  if (f === 'g' && t === 'kg') return value / 1000;
  if (f === 'kg' && t === 'g') return value * 1000;
  if (f === 'ml' && t === 'l') return value / 1000;
  if (f === 'l' && t === 'ml') return value * 1000;
  return null;
}

/** 客户原话: "我在这写的克, 那我做调包的时候会自动折换成公斤" (May10 line 263).
 *  UI 预览用: g → 自动追加 (= X.X kg) 显示; kg → 追加 (= X g). */
export function formatUnitDisplay(value: number, unit: string): string {
  const altUnit = unit === 'g' ? 'kg' : unit === 'kg' ? 'g' : unit === 'ml' ? 'L' : unit === 'L' ? 'ml' : null;
  if (!altUnit) return `${value} ${unit}`;
  const alt = convertUnit(value, unit, altUnit);
  if (alt == null) return `${value} ${unit}`;
  // Smart precision: g→kg 显示 3 位小数, 其他保留有效位
  const altStr = altUnit === 'kg' || altUnit === 'L'
    ? alt.toFixed(3).replace(/\.?0+$/, '')
    : alt.toString();
  return `${value} ${unit} (= ${altStr} ${altUnit})`;
}

/** 创建 BOM 配方请求. */
export interface CreateBomRecipeRequest {
  productTypeId: string;
  productName?: string;
  overallYieldRate?: number;
  outputQuantityPerUnit: number;
  outputUnit: string;
  sourceType?: BomRecipeSourceType;
  sourceSampleId?: string;
  items: BomRecipeItemDTO[];
  notes?: string;
}

/** 子表创建/更新 DTO. */
export interface BomRecipeItemDTO {
  materialTypeId: string;
  standardQuantity: number;
  yieldRate?: number;
  unit: BomUnit;
  unitPrice?: number;
  taxRate?: number;
  materialCategory?: BomMaterialCategory;
  sortOrder?: number;
  isOptional?: boolean;
  substituteGroup?: string;
  remark?: string;
}

/** 更新 BOM 配方请求 (PUT full-replace). */
export interface UpdateBomRecipeRequest {
  productName?: string;
  overallYieldRate?: number;
  outputQuantityPerUnit?: number;
  outputUnit?: string;
  items?: BomRecipeItemDTO[];
  notes?: string;
}

/** 分页响应. */
export interface BomRecipePage {
  content: BomRecipe[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}
