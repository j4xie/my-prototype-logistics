import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { processingApiClient } from '../../../../services/api/processingApiClient';
import { BatchCostAnalysis } from '../../../../types/processing';
import { CACHE_CONFIG } from '../constants';

// ==================== 类型定义 ====================

interface CachedCostData {
  data: BatchCostAnalysis;
  timestamp: number;
}

interface UseCostDataReturn {
  costData: BatchCostAnalysis | null;
  loading: boolean;
  refreshing: boolean;
  loadCostData: (forceRefresh?: boolean) => Promise<void>;
  handleRefresh: () => Promise<void>;
}

// ==================== 缓存管理 ====================

// 使用Map作为内存缓存，提供最快的访问速度
const costDataCache = new Map<string, CachedCostData>();

/**
 * 清理过期缓存（可选，防止内存泄漏）
 */
const cleanExpiredCache = () => {
  const now = Date.now();
  const toDelete: string[] = [];

  costDataCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_CONFIG.COST_DATA_DURATION) {
      toDelete.push(key);
    }
  });

  toDelete.forEach(key => costDataCache.delete(key));
};

// 每5分钟清理一次过期缓存
setInterval(cleanExpiredCache, CACHE_CONFIG.COST_DATA_DURATION);

// ==================== Custom Hook ====================

/**
 * 成本数据管理Hook
 * - 自动加载成本数据
 * - 5分钟智能缓存
 * - 下拉刷新支持
 * - Loading/Error状态管理
 *
 * @param batchId - 批次ID
 * @returns 成本数据和操作方法
 */
export const useCostData = (batchId: string | number): UseCostDataReturn => {
  const navigation = useNavigation();

  // 状态管理
  const [costData, setCostData] = useState<BatchCostAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 加载成本数据（支持缓存）
   * @param forceRefresh - 是否强制刷新，跳过缓存
   */
  const loadCostData = useCallback(async (forceRefresh = false) => {
    if (!batchId) {
      Alert.alert('提示', '请先选择批次');
      navigation.goBack();
      return;
    }

    const cacheKey = `batch_${batchId}`;

    // 检查缓存（非强制刷新时）
    if (!forceRefresh) {
      const cached = costDataCache.get(cacheKey);
      if (cached) {
        const now = Date.now();
        // 缓存未过期，直接使用
        if (now - cached.timestamp < CACHE_CONFIG.COST_DATA_DURATION) {
          console.log(`[useCostData] 使用缓存数据 (批次: ${batchId})`);
          setCostData(cached.data);
          setLoading(false);
          return;
        } else {
          console.log(`[useCostData] 缓存已过期 (批次: ${batchId})`);
          // 缓存过期，删除旧缓存
          costDataCache.delete(cacheKey);
        }
      }
    }

    // 发起网络请求
    try {
      setLoading(true);
      console.log(`[useCostData] 加载成本数据 (批次: ${batchId}, 强制刷新: ${forceRefresh})`);

      const response = await processingApiClient.getBatchCostAnalysis(batchId);

      if (response.success && response.data) {
        setCostData(response.data);

        // 更新缓存
        costDataCache.set(cacheKey, {
          data: response.data,
          timestamp: Date.now(),
        });

        console.log(`[useCostData] 成本数据加载成功并缓存 (批次: ${batchId})`);
      } else {
        throw new Error(response.message || '加载失败');
      }
    } catch (error: any) {
      console.error('[useCostData] 加载成本数据失败:', error);

      // 错误处理
      if (error.response?.status === 404) {
        Alert.alert('错误', '批次不存在或已被删除');
        navigation.goBack();
      } else if (error.response?.status === 403) {
        Alert.alert('权限不足', '您没有查看此批次成本的权限');
        navigation.goBack();
      } else {
        Alert.alert(
          '加载失败',
          error.response?.data?.message || error.message || '加载成本数据失败，请稍后重试'
        );
      }
    } finally {
      setLoading(false);
    }
  }, [batchId, navigation]);

  /**
   * 下拉刷新处理
   * 强制刷新数据，跳过缓存
   */
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadCostData(true); // 强制刷新
    } finally {
      setRefreshing(false);
    }
  }, [loadCostData]);

  // 组件挂载时自动加载
  useEffect(() => {
    if (batchId) {
      loadCostData();
    }
  }, [batchId, loadCostData]);

  return {
    costData,
    loading,
    refreshing,
    loadCostData,
    handleRefresh,
  };
};

// ==================== 工具方法 ====================

/**
 * 手动清除指定批次的缓存
 * @param batchId - 批次ID
 */
export const clearCostDataCache = (batchId: string | number) => {
  const cacheKey = `batch_${batchId}`;
  costDataCache.delete(cacheKey);
  console.log(`[useCostData] 已清除缓存 (批次: ${batchId})`);
};

/**
 * 清除所有成本数据缓存
 */
export const clearAllCostDataCache = () => {
  costDataCache.clear();
  console.log('[useCostData] 已清除所有缓存');
};
