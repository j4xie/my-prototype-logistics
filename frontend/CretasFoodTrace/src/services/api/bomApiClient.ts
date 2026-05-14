/**
 * M-BOM-1 BOM 配方 API Client (Track D1).
 * 后端路径: /api/mobile/{factoryId}/bom/recipes/*
 */
import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import type {
  BomRecipe,
  BomRecipeItem,
  BomRecipeItemDTO,
  BomRecipePage,
  BomRecipeStatus,
  CreateBomRecipeRequest,
  UpdateBomRecipeRequest,
} from '../../types/bom';

/** Cretas 统一响应封套. */
interface ApiEnvelope<T> {
  code: number;
  data: T;
  message: string;
  success: boolean;
}

class BomApiClient {
  private base(factoryId?: string): string {
    const id = getCurrentFactoryId(factoryId);
    if (!id) throw new Error('factoryId 是必需的, 请先登录');
    return `/api/mobile/${id}/bom/recipes`;
  }

  /** 分页查询 BOM 配方列表 (可按 status 过滤). */
  async listRecipes(params?: {
    factoryId?: string;
    status?: BomRecipeStatus;
    page?: number;
    size?: number;
  }): Promise<BomRecipePage> {
    const { factoryId, ...query } = params ?? {};
    const res = await apiClient.get<ApiEnvelope<BomRecipePage>>(this.base(factoryId), { params: query });
    return res.data;
  }

  /** 取详情 (含 items). */
  async getRecipe(recipeId: string, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.get<ApiEnvelope<BomRecipe>>(`${this.base(factoryId)}/${recipeId}`);
    return res.data;
  }

  /** 取产品当前生效 BOM (status=ACTIVE + is_current=TRUE). 无生效时抛错 (404 envelope). */
  async getCurrentRecipeByProduct(productTypeId: string, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.get<ApiEnvelope<BomRecipe>>(
      `${this.base(factoryId)}/by-product/${encodeURIComponent(productTypeId)}/current`,
    );
    return res.data;
  }

  /** 取产品所有版本 (含 ARCHIVED). */
  async getRecipeVersionsByProduct(productTypeId: string, factoryId?: string): Promise<BomRecipe[]> {
    const res = await apiClient.get<ApiEnvelope<BomRecipe[]>>(
      `${this.base(factoryId)}/by-product/${encodeURIComponent(productTypeId)}/versions`,
    );
    return res.data;
  }

  /** 创建草稿. */
  async createRecipe(body: CreateBomRecipeRequest, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.post<ApiEnvelope<BomRecipe>>(this.base(factoryId), body);
    return res.data;
  }

  /** 更新草稿 (PUT full-replace items). */
  async updateRecipe(
    recipeId: string,
    body: UpdateBomRecipeRequest,
    factoryId?: string,
  ): Promise<BomRecipe> {
    const res = await apiClient.put<ApiEnvelope<BomRecipe>>(`${this.base(factoryId)}/${recipeId}`, body);
    return res.data;
  }

  /** 激活: DRAFT → ACTIVE. */
  async activateRecipe(recipeId: string, operatorId?: number, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.post<ApiEnvelope<BomRecipe>>(
      `${this.base(factoryId)}/${recipeId}/activate`,
      undefined,
      { params: operatorId ? { operatorId } : {} },
    );
    return res.data;
  }

  /** 克隆为新版本 (version+1, status=DRAFT). */
  async cloneRecipe(recipeId: string, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.post<ApiEnvelope<BomRecipe>>(`${this.base(factoryId)}/${recipeId}/clone`);
    return res.data;
  }

  /** 归档 (→ ARCHIVED). */
  async archiveRecipe(recipeId: string, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.post<ApiEnvelope<BomRecipe>>(`${this.base(factoryId)}/${recipeId}/archive`);
    return res.data;
  }

  /** 重算成本 (返回更新后 recipe). */
  async calculateCost(recipeId: string, factoryId?: string): Promise<BomRecipe> {
    const res = await apiClient.post<ApiEnvelope<BomRecipe>>(
      `${this.base(factoryId)}/${recipeId}/calculate-cost`,
    );
    return res.data;
  }

  /** 软删 (仅 DRAFT). */
  async deleteRecipe(recipeId: string, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.base(factoryId)}/${recipeId}`);
  }

  /** 添加配方项 (仅 DRAFT). */
  async addItem(recipeId: string, item: BomRecipeItemDTO, factoryId?: string): Promise<BomRecipeItem> {
    const res = await apiClient.post<ApiEnvelope<BomRecipeItem>>(
      `${this.base(factoryId)}/${recipeId}/items`,
      item,
    );
    return res.data;
  }

  /** 更新配方项 (仅 DRAFT). */
  async updateItem(itemId: number, item: BomRecipeItemDTO, factoryId?: string): Promise<BomRecipeItem> {
    const res = await apiClient.put<ApiEnvelope<BomRecipeItem>>(
      `${this.base(factoryId)}/items/${itemId}`,
      item,
    );
    return res.data;
  }

  /** 删除配方项 (软删, 仅 DRAFT). */
  async deleteItem(itemId: number, factoryId?: string): Promise<void> {
    await apiClient.delete(`${this.base(factoryId)}/items/${itemId}`);
  }
}

export const bomApiClient = new BomApiClient();
