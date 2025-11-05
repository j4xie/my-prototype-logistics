import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { processingApiClient } from '../../../../services/api/processingApiClient';
import { AIQuota } from '../../../../types/processing';
import { CACHE_CONFIG } from '../constants';
import { useAISession } from './useAISession';

// ==================== 类型定义 ====================

interface CachedAIResult {
  analysis: string;
  timestamp: number;
}

interface UseAIAnalysisReturn {
  // AI分析状态
  analysis: string;
  loading: boolean;
  showSection: boolean;
  quota: AIQuota | null;

  // Session状态
  sessionId: string;
  lastAnalysis: string;
  isSessionRestored: boolean;

  // 自定义问题
  customQuestion: string;
  showQuestionInput: boolean;

  // 操作方法
  handleAIAnalysis: (question?: string) => Promise<void>;
  setCustomQuestion: (question: string) => void;
  toggleQuestionInput: () => void;
  closeAISection: () => void;
}

// ==================== 缓存管理 ====================

// AI分析结果缓存 (30分钟)
const aiAnalysisCache = new Map<string, CachedAIResult>();

/**
 * 清理过期的AI分析缓存
 */
const cleanExpiredAICache = () => {
  const now = Date.now();
  const toDelete: string[] = [];

  aiAnalysisCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_CONFIG.AI_ANALYSIS_DURATION) {
      toDelete.push(key);
    }
  });

  toDelete.forEach(key => aiAnalysisCache.delete(key));
};

// 每30分钟清理一次
setInterval(cleanExpiredAICache, CACHE_CONFIG.AI_ANALYSIS_DURATION);

// ==================== Custom Hook ====================

/**
 * AI分析管理Hook
 * - AI分析调用
 * - 30分钟智能缓存（节省配额）
 * - Session持久化
 * - Follow-up对话支持
 * - 配额管理
 *
 * @param batchId - 批次ID
 * @returns AI分析状态和操作方法
 */
export const useAIAnalysis = (batchId: string | number): UseAIAnalysisReturn => {
  // AI分析状态
  const [analysis, setAnalysis] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSection, setShowSection] = useState(false);
  const [quota, setQuota] = useState<AIQuota | null>(null);

  // 自定义问题
  const [customQuestion, setCustomQuestion] = useState('');
  const [showQuestionInput, setShowQuestionInput] = useState(false);

  // Session管理
  const {
    sessionId,
    lastAnalysis,
    isRestored: isSessionRestored,
    saveSession,
    clearSession,
  } = useAISession(batchId);

  /**
   * 生成缓存键
   * 相同批次+相同问题 = 相同缓存
   */
  const getCacheKey = useCallback((question?: string) => {
    return `${batchId}_${question || 'default'}`;
  }, [batchId]);

  /**
   * AI分析主方法
   * @param question - 可选的自定义问题
   */
  const handleAIAnalysis = useCallback(
    async (question?: string) => {
      if (!batchId) {
        Alert.alert('错误', '批次ID无效');
        return;
      }

      const cacheKey = getCacheKey(question);

      // 检查缓存（30分钟内）
      const cached = aiAnalysisCache.get(cacheKey);
      if (cached) {
        const now = Date.now();
        if (now - cached.timestamp < CACHE_CONFIG.AI_ANALYSIS_DURATION) {
          console.log(`[useAIAnalysis] 使用AI分析缓存 (批次: ${batchId}, 问题: ${question || '默认'})`);

          // 直接使用缓存结果
          setAnalysis(cached.analysis);
          setShowSection(true);
          setLoading(false);

          // 如果有自定义问题，清空输入
          if (question) {
            setCustomQuestion('');
            setShowQuestionInput(false);
          }

          return;
        } else {
          // 缓存过期，删除
          console.log(`[useAIAnalysis] AI分析缓存已过期 (批次: ${batchId})`);
          aiAnalysisCache.delete(cacheKey);
        }
      }

      // 发起AI分析请求
      setLoading(true);
      setShowSection(true);

      // 乐观UI更新 - 显示加载提示
      setAnalysis('AI正在分析您的成本数据，这可能需要几秒钟...');

      try {
        console.log(
          `[useAIAnalysis] 发起AI分析 (批次: ${batchId}, 问题: ${question || '默认'}, session: ${sessionId || '新建'})`
        );

        const response = await processingApiClient.aiCostAnalysis(
          {
            batchId: batchId.toString(),
            question: question || undefined,
            session_id: sessionId || undefined,
          }
        );

        if (response.success && response.data) {
          const { analysis: aiAnalysis, session_id, quota: responseQuota } = response.data;

          // 更新状态
          setAnalysis(aiAnalysis);

          if (responseQuota) {
            setQuota(responseQuota);
          }

          // 保存Session
          await saveSession(session_id, aiAnalysis);

          // 更新缓存
          aiAnalysisCache.set(cacheKey, {
            analysis: aiAnalysis,
            timestamp: Date.now(),
          });

          console.log(
            `[useAIAnalysis] AI分析成功 (批次: ${batchId}, session: ${session_id}, 配额: ${responseQuota?.remaining}/${responseQuota?.limit})`
          );

          // 如果有自定义问题，清空输入
          if (question) {
            setCustomQuestion('');
            setShowQuestionInput(false);
          }
        } else {
          throw new Error(response.message || 'AI分析失败');
        }
      } catch (error: any) {
        console.error('[useAIAnalysis] AI分析失败:', error);

        // 清除乐观UI的占位文本
        setAnalysis('');

        // 错误处理
        if (error.response?.status === 403) {
          Alert.alert(
            '配额不足',
            error.response.data?.message || '本周AI分析次数已用完，请等待下周重置',
            [
              {
                text: '知道了',
                onPress: () => {
                  setShowSection(false);
                },
              },
            ]
          );
        } else if (error.response?.status === 404) {
          Alert.alert('错误', '批次不存在');
          setShowSection(false);
        } else if (error.response?.status === 500) {
          Alert.alert(
            'AI服务暂时不可用',
            '抱歉，AI分析服务暂时不可用，请稍后再试',
            [
              {
                text: '确定',
                onPress: () => {
                  setShowSection(false);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'AI分析失败',
            error.response?.data?.message || error.message || '请检查网络连接后重试',
            [
              {
                text: '确定',
                onPress: () => {
                  setShowSection(false);
                },
              },
            ]
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [batchId, sessionId, getCacheKey, saveSession]
  );

  /**
   * 切换自定义问题输入框
   */
  const toggleQuestionInput = useCallback(() => {
    setShowQuestionInput(prev => !prev);
  }, []);

  /**
   * 关闭AI分析区域
   */
  const closeAISection = useCallback(() => {
    setShowSection(false);
    setAnalysis('');
    setCustomQuestion('');
    setShowQuestionInput(false);
  }, []);

  return {
    // AI分析状态
    analysis,
    loading,
    showSection,
    quota,

    // Session状态
    sessionId,
    lastAnalysis,
    isSessionRestored,

    // 自定义问题
    customQuestion,
    showQuestionInput,

    // 操作方法
    handleAIAnalysis,
    setCustomQuestion,
    toggleQuestionInput,
    closeAISection,
  };
};

// ==================== 工具方法 ====================

/**
 * 清除指定批次的AI分析缓存
 * @param batchId - 批次ID
 * @param question - 可选的问题，不传则清除该批次所有缓存
 */
export const clearAIAnalysisCache = (batchId: string | number, question?: string) => {
  if (question) {
    const cacheKey = `${batchId}_${question}`;
    aiAnalysisCache.delete(cacheKey);
    console.log(`[useAIAnalysis] 已清除缓存 (批次: ${batchId}, 问题: ${question})`);
  } else {
    // 清除该批次所有相关缓存
    const keysToDelete: string[] = [];
    aiAnalysisCache.forEach((_, key) => {
      if (key.startsWith(`${batchId}_`)) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => aiAnalysisCache.delete(key));
    console.log(`[useAIAnalysis] 已清除批次所有缓存 (批次: ${batchId}, 共 ${keysToDelete.length} 个)`);
  }
};

/**
 * 清除所有AI分析缓存
 */
export const clearAllAIAnalysisCache = () => {
  aiAnalysisCache.clear();
  console.log('[useAIAnalysis] 已清除所有AI分析缓存');
};
