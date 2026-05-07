import { apiClient } from './apiClient';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

/**
 * 字典 API 客户端
 *
 * 后端: SystemConfigController (/api/mobile/{factoryId}/system-config/*)
 * - enums/{enumGroup}: system_enums 表 (类别/储存类型 等枚举)
 * - units: unit_of_measurements 表 (kg/箱/袋 等计量单位)
 *
 * 工厂级 enum 优先于全局 (factoryId='*'). 后端 10min 缓存,
 * 前端再加 5min 内存缓存避免页面切换重复请求.
 */

export interface DictionaryItem {
  enumCode: string;
  enumLabel: string;
  enumDescription?: string;
  sortOrder: number;
  metadata?: string;
  color?: string;
  icon?: string;
}

export interface UnitItem {
  unitCode: string;
  unitName: string;
  unitSymbol?: string;
  baseUnit: string;
  conversionFactor: number;
  category?: string;
  decimalPlaces: number;
  isBaseUnit: boolean;
  sortOrder: number;
}

interface CacheEntry<T> {
  data: T;
  expiry: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5min
const enumCache = new Map<string, CacheEntry<DictionaryItem[]>>();
const unitCache = new Map<string, CacheEntry<UnitItem[]>>();

function cacheKey(factoryId: string, key: string): string {
  return `${factoryId}::${key}`;
}

export const dictionaryApiClient = {
  /**
   * 获取枚举字典 (类别/储存类型 等).
   * @param enumGroup 例如 MATERIAL_CATEGORY / MATERIAL_STORAGE_TYPE
   */
  async getEnums(enumGroup: string, factoryId?: string): Promise<DictionaryItem[]> {
    const fid = getCurrentFactoryId(factoryId);
    if (!fid) {
      throw new Error('factoryId 必填');
    }

    const ck = cacheKey(fid, enumGroup);
    const cached = enumCache.get(ck);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const response = await apiClient.get<{ success: boolean; data: DictionaryItem[]; message: string }>(
      `/api/mobile/${fid}/system-config/enums/${enumGroup}`,
    );
    const data = (response?.data || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    enumCache.set(ck, { data, expiry: Date.now() + CACHE_TTL });
    return data;
  },

  /**
   * 获取计量单位字典 (kg/箱/袋 等).
   * @param category 可选筛选 WEIGHT/VOLUME/COUNT/LENGTH/TEMPERATURE
   */
  async getUnits(category?: string, factoryId?: string): Promise<UnitItem[]> {
    const fid = getCurrentFactoryId(factoryId);
    if (!fid) {
      throw new Error('factoryId 必填');
    }

    const ck = cacheKey(fid, `units::${category || 'all'}`);
    const cached = unitCache.get(ck);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const response = await apiClient.get<{ success: boolean; data: UnitItem[]; message: string }>(
      `/api/mobile/${fid}/system-config/units`,
      { params: category ? { category } : undefined },
    );
    const data = (response?.data || []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
    unitCache.set(ck, { data, expiry: Date.now() + CACHE_TTL });
    return data;
  },

  /**
   * 智能默认单位: 按名称 + 类别查找最近相似原料的单位.
   * 无匹配时返回 null, 调用方保留默认值.
   */
  async suggestUnit(name: string, category?: string, factoryId?: string): Promise<string | null> {
    if (!name || !name.trim()) {
      return null;
    }
    const fid = getCurrentFactoryId(factoryId);
    if (!fid) {
      return null;
    }
    try {
      const response = await apiClient.get<{ success: boolean; data: string | null; message: string }>(
        `/api/mobile/${fid}/raw-material-types/suggest-unit`,
        { params: { name: name.trim(), ...(category ? { category } : {}) } },
      );
      return response?.data ?? null;
    } catch {
      return null;
    }
  },

  /**
   * 清缓存. 字典管理页修改后调用, 让下次拉取拿新数据.
   */
  invalidate(): void {
    enumCache.clear();
    unitCache.clear();
  },
};
