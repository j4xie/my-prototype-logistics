import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 原材料规格配置API客户端
 *
 * 功能：
 * 1. 获取工厂的所有规格配置（按类别）
 * 2. 更新单个类别的规格配置
 * 3. 重置为系统默认配置
 */

// 规格配置类型定义
export interface SpecConfig {
  [category: string]: string[];
}

// 后端 ApiResponse 格式
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

/**
 * 前端默认规格配置（Fallback）
 *
 * 使用场景：
 * 1. 后端API未实现时（Phase 1-3）
 * 2. 网络请求失败时
 * 3. 后端返回空配置时
 * 4. factoryId 为空时
 */
export const DEFAULT_SPEC_CONFIG: SpecConfig = {
  '海鲜': ['整条', '切片', '去骨切片', '鱼块', '鱼排', '虾仁', '去壳'],
  '肉类': ['整块', '切片', '切丁', '绞肉', '排骨', '带骨', '去骨'],
  '蔬菜': ['整颗', '切段', '切丝', '切块', '切片'],
  '水果': ['整个', '切片', '切块', '去皮', '带皮'],
  '粉类': ['袋装', '散装', '桶装'],
  '米面': ['袋装', '散装', '包装'],
  '油类': ['瓶装', '桶装', '散装', '大桶', '小瓶'],
  '调料': ['瓶装', '袋装', '罐装', '散装', '盒装'],
  '其他': ['原装', '分装', '定制'],
};

export const materialSpecApiClient = {
  /**
   * 获取工厂的所有规格配置
   * @param factoryId 工厂ID
   * @returns 规格配置对象 { "海鲜": ["整条", "切片"], "肉类": [...] }
   */
  getSpecConfig: async (factoryId?: string): Promise<{ data: SpecConfig }> => {
    // 确保 factoryId 有值
    const currentFactoryId = getCurrentFactoryId(factoryId);
    if (!currentFactoryId) {
      console.warn('materialSpecApiClient: factoryId 为空，使用默认配置');
      return { data: DEFAULT_SPEC_CONFIG };
    }
    
    try {
      const response = await apiClient.get<ApiResponse<SpecConfig>>(
        `/api/mobile/${currentFactoryId}/material-spec-config`
      );
      // apiClient 已解包 response.data，所以 response 就是 ApiResponse
      // 需要再包装一层以匹配返回类型
      return { data: response.data || DEFAULT_SPEC_CONFIG };
    } catch (error) {
      console.warn('materialSpecApiClient: 获取规格配置失败，使用默认配置', error);
      return { data: DEFAULT_SPEC_CONFIG };
    }
  },

  /**
   * 更新单个类别的规格配置
   * @param factoryId 工厂ID
   * @param category 类别名称（如"海鲜"）
   * @param specifications 规格选项数组
   */
  updateCategorySpec: async (
    factoryId: string,
    category: string,
    specifications: string[]
  ) => {
    const response = await apiClient.put<ApiResponse<{ category: string; specifications: string[] }>>(
      `/api/mobile/${factoryId}/material-spec-config/${category}`,
      { specifications }
    );
    return response.data;
  },

  /**
   * 重置为系统默认配置
   * @param factoryId 工厂ID
   * @param category 类别名称
   */
  resetCategorySpec: async (factoryId: string, category: string) => {
    const response = await apiClient.delete<ApiResponse<{ category: string; specifications: string[] }>>(
      `/api/mobile/${factoryId}/material-spec-config/${category}`
    );
    return response.data;
  },
};
