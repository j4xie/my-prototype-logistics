import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CACHE_CONFIG, STORAGE_KEYS } from '../constants';

// ==================== 类型定义 ====================

interface SavedSession {
  sessionId: string;
  lastAnalysis: string;
  timestamp: number;
  messageCount?: number;
}

interface UseAISessionReturn {
  sessionId: string;
  lastAnalysis: string;
  isRestored: boolean;
  saveSession: (sessionId: string, analysis: string, messageCount?: number) => Promise<void>;
  clearSession: () => Promise<void>;
}

// ==================== Custom Hook ====================

/**
 * AI Session持久化Hook
 * - 自动保存session到AsyncStorage
 * - 组件挂载时恢复session
 * - 24小时有效期
 * - 自动清理过期session
 *
 * @param batchId - 批次ID
 * @returns Session状态和操作方法
 */
export const useAISession = (batchId: string | number): UseAISessionReturn => {
  const [sessionId, setSessionId] = useState('');
  const [lastAnalysis, setLastAnalysis] = useState('');
  const [isRestored, setIsRestored] = useState(false);

  // 生成Storage键名
  const getStorageKey = useCallback(() => {
    return `${STORAGE_KEYS.AI_SESSION_PREFIX}${batchId}`;
  }, [batchId]);

  /**
   * 保存Session到AsyncStorage
   */
  const saveSession = useCallback(
    async (newSessionId: string, analysis: string, messageCount?: number) => {
      try {
        const storageKey = getStorageKey();
        const sessionData: SavedSession = {
          sessionId: newSessionId,
          lastAnalysis: analysis,
          timestamp: Date.now(),
          messageCount,
        };

        await AsyncStorage.setItem(storageKey, JSON.stringify(sessionData));

        // 同时更新内存状态
        setSessionId(newSessionId);
        setLastAnalysis(analysis);

        console.log(`[useAISession] Session已保存 (批次: ${batchId}, session: ${newSessionId})`);
      } catch (error) {
        console.error('[useAISession] 保存Session失败:', error);
        // 保存失败不影响功能，只是无法恢复
      }
    },
    [batchId, getStorageKey]
  );

  /**
   * 清除Session
   */
  const clearSession = useCallback(async () => {
    try {
      const storageKey = getStorageKey();
      await AsyncStorage.removeItem(storageKey);

      setSessionId('');
      setLastAnalysis('');

      console.log(`[useAISession] Session已清除 (批次: ${batchId})`);
    } catch (error) {
      console.error('[useAISession] 清除Session失败:', error);
    }
  }, [batchId, getStorageKey]);

  /**
   * 从AsyncStorage恢复Session
   */
  const restoreSession = useCallback(async () => {
    try {
      const storageKey = getStorageKey();
      const saved = await AsyncStorage.getItem(storageKey);

      if (!saved) {
        console.log(`[useAISession] 无保存的Session (批次: ${batchId})`);
        setIsRestored(true);
        return;
      }

      const sessionData: SavedSession = JSON.parse(saved);
      const now = Date.now();

      // 检查Session是否过期（24小时）
      if (now - sessionData.timestamp > CACHE_CONFIG.SESSION_DURATION) {
        console.log(`[useAISession] Session已过期 (批次: ${batchId})`);
        // 过期则删除
        await AsyncStorage.removeItem(storageKey);
        setIsRestored(true);
        return;
      }

      // 恢复Session
      setSessionId(sessionData.sessionId);
      setLastAnalysis(sessionData.lastAnalysis);
      setIsRestored(true);

      console.log(
        `[useAISession] Session已恢复 (批次: ${batchId}, session: ${sessionData.sessionId})`
      );
    } catch (error) {
      console.error('[useAISession] 恢复Session失败:', error);
      setIsRestored(true);
    }
  }, [batchId, getStorageKey]);

  // 组件挂载时恢复Session
  useEffect(() => {
    if (batchId) {
      restoreSession();
    }
  }, [batchId, restoreSession]);

  return {
    sessionId,
    lastAnalysis,
    isRestored,
    saveSession,
    clearSession,
  };
};

// ==================== 工具方法 ====================

/**
 * 清除所有过期的AI Session
 * 可在应用启动时调用，清理过期数据
 */
export const cleanExpiredSessions = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const sessionKeys = allKeys.filter(key => key.startsWith(STORAGE_KEYS.AI_SESSION_PREFIX));

    const now = Date.now();
    let cleanedCount = 0;

    for (const key of sessionKeys) {
      try {
        const saved = await AsyncStorage.getItem(key);
        if (saved) {
          const sessionData: SavedSession = JSON.parse(saved);

          // 检查是否过期
          if (now - sessionData.timestamp > CACHE_CONFIG.SESSION_DURATION) {
            await AsyncStorage.removeItem(key);
            cleanedCount++;
          }
        }
      } catch (error) {
        console.error(`[useAISession] 清理Session失败 (key: ${key}):`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`[useAISession] 已清理 ${cleanedCount} 个过期Session`);
    }
  } catch (error) {
    console.error('[useAISession] 清理过期Session失败:', error);
  }
};

/**
 * 清除所有AI Session（用于测试或用户登出）
 */
export const clearAllSessions = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const sessionKeys = allKeys.filter(key => key.startsWith(STORAGE_KEYS.AI_SESSION_PREFIX));

    await AsyncStorage.multiRemove(sessionKeys);

    console.log(`[useAISession] 已清除所有Session (共 ${sessionKeys.length} 个)`);
  } catch (error) {
    console.error('[useAISession] 清除所有Session失败:', error);
  }
};
