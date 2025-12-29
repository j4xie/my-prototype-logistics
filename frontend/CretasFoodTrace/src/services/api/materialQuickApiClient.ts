import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';
import 'react-native-get-random-values'; // Polyfill for crypto.getRandomValues
import { v4 as uuidv4 } from 'uuid';

/**
 * 原材料快速操作API客户端
 *
 * 职责: 车间操作员快速接收原材料（简化版，自动UUID生成）
 * 用户角色: 车间操作员
 * 使用场景: MaterialTypeSelector组件
 *
 * 与其他Material API的区别:
 * - materialTypeApiClient (管理员): 完整的类型管理CRUD，13个API
 * - materialBatchApiClient (仓库): 批次入库/出库操作，22个API
 * - materialQuickApiClient (车间): 快速查询+创建，2个API，自动UUID
 *
 * 总计2个API - 路径：/api/mobile/{factoryId}/raw-material-types/*
 */

export interface MaterialType {
  id: string;
  name: string;
  category?: string;
  unit: string;
  description?: string;
}

export const materialQuickAPI = {
  /**
   * 查询活跃的原材料类型（简化版）
   * 用于车间快速选择
   */
  getMaterialTypes: async (factoryId?: string): Promise<MaterialType[]> => {
    const fId = getCurrentFactoryId(factoryId);
    if (!fId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }
    // 后端端点: /api/mobile/{factoryId}/raw-material-types/active
    // apiClient拦截器已统一返回data（外层 { code, message, data }）
    const response = await apiClient.get<any>(`/api/mobile/${fId}/raw-material-types/active`);
    // 后端返回格式: { code: 200, message: "...", data: [...] }
    if (response.data && Array.isArray(response.data)) {
      return response.data;
    }
    // 兼容旧格式
    return Array.isArray(response) ? response : [];
  },

  /**
   * 快速创建原材料类型（自动生成UUID）
   * 用于车间操作员临时添加新类型
   *
   * 特性: 自动生成唯一code，无需手动输入
   */
  createMaterialType: async (data: {
    name: string;
    category?: string;
    unit?: string;
    description?: string;
    code?: string;
  }, factoryId?: string): Promise<MaterialType> => {
    const fId = getCurrentFactoryId(factoryId);
    if (!fId) {
      throw new Error('factoryId 是必需的，请先登录或提供 factoryId 参数');
    }

    // 生成唯一code：优先使用用户提供的code，否则使用UUID确保唯一性
    // UUID格式: MAT_<8位UUID前缀>_<时间戳后6位>
    // 示例: MAT_A3F2B1C4_657890
    const generateUniqueCode = (): string => {
      const uuid = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
      const timestamp = Date.now().toString().slice(-6);
      return `MAT_${uuid}_${timestamp}`;
    };

    const materialData = {
      ...data,
      code: data.code || generateUniqueCode(),
      isActive: true,
    };

    // 后端端点: /api/mobile/{factoryId}/raw-material-types
    // apiClient拦截器已统一返回data
    const response = await apiClient.post<any>(`/api/mobile/${fId}/raw-material-types`, materialData);
    return response.data || response;
  },
};

// 向后兼容的别名（支持旧代码）
/**
 * @deprecated 请使用 materialQuickAPI，此别名将在Phase 4删除
 */
export const materialAPI = materialQuickAPI;
