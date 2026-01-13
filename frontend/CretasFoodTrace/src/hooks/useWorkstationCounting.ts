/**
 * useWorkstationCounting Hook - 工位计数会话管理
 *
 * 功能：
 * - 管理工位计数会话的完整生命周期
 * - 支持定时抓帧（3秒间隔）进行AI识别
 * - 状态管理：初始化、监控中、暂停、已停止
 * - 提供手动计数和标签验证功能
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initWorkstation,
  processFrame,
  manualCount as apiManualCount,
  verifyLabel as apiVerifyLabel,
  getWorkstationStatus,
  stopWorkstation,
  WorkstationConfig,
  CountingResult,
  LabelVerifyResult,
  WorkstationStatusInfo,
  WorkstationInitResult,
  WorkstationStopResult,
} from '../services/api/workstationApiClient';
import { capturePicture, IsapiCapture } from '../services/api/isapiApiClient';

// ========== 类型定义 ==========

/**
 * 工位计数状态枚举
 */
export type WorkstationState = 'idle' | 'initializing' | 'monitoring' | 'paused' | 'stopped' | 'error';

/**
 * Hook 配置选项
 */
export interface UseWorkstationCountingOptions {
  /** 摄像头设备ID */
  cameraId?: string;
  /** 摄像头通道ID */
  channelId?: number;
  /** 抓帧间隔（毫秒），默认3000ms */
  frameInterval?: number;
  /** 是否自动开始监控 */
  autoStart?: boolean;
  /** 帧处理失败后的重试次数 */
  maxFrameRetries?: number;
  /** 是否在初始化后自动开始监控 */
  autoMonitorAfterInit?: boolean;
}

/**
 * Hook 返回值
 */
export interface UseWorkstationCountingReturn {
  // ===== 状态 =====
  /** 工位ID */
  workstationId: string | null;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 是否正在监控 */
  isMonitoring: boolean;
  /** 是否已暂停 */
  isPaused: boolean;
  /** 当前状态 */
  state: WorkstationState;
  /** 计数 */
  count: number;
  /** 总重量 */
  totalWeight: number;
  /** 最近一次识别结果 */
  lastResult: CountingResult | null;
  /** 错误信息 */
  error: string | null;
  /** 是否正在加载 */
  loading: boolean;
  /** 工位配置 */
  config: WorkstationConfig | null;
  /** 详细状态信息 */
  statusInfo: WorkstationStatusInfo | null;
  /** 帧处理统计 */
  frameStats: {
    totalFrames: number;
    successFrames: number;
    failedFrames: number;
    lastFrameTime: Date | null;
  };

  // ===== 操作 =====
  /** 初始化工位 */
  initialize: (config: WorkstationConfig) => Promise<WorkstationInitResult | null>;
  /** 开始监控 */
  startMonitoring: () => void;
  /** 暂停监控 */
  pauseMonitoring: () => void;
  /** 恢复监控 */
  resumeMonitoring: () => void;
  /** 停止工位会话 */
  stop: () => Promise<WorkstationStopResult | null>;
  /** 手动计数 */
  manualCount: (weight?: number) => Promise<CountingResult | null>;
  /** 验证标签 */
  verifyLabel: (imageBase64: string) => Promise<LabelVerifyResult | null>;
  /** 刷新状态 */
  refreshStatus: () => Promise<void>;
  /** 清除错误 */
  clearError: () => void;
  /** 重置Hook状态 */
  reset: () => void;
}

// ========== 常量 ==========

/** 默认抓帧间隔（3秒，大于后端2秒防抖） */
const DEFAULT_FRAME_INTERVAL = 3000;

/** 默认最大帧重试次数 */
const DEFAULT_MAX_FRAME_RETRIES = 3;

// ========== Hook 实现 ==========

export function useWorkstationCounting(
  options: UseWorkstationCountingOptions = {}
): UseWorkstationCountingReturn {
  const {
    cameraId: initialCameraId,
    channelId: initialChannelId = 1,
    frameInterval = DEFAULT_FRAME_INTERVAL,
    autoStart = false,
    maxFrameRetries = DEFAULT_MAX_FRAME_RETRIES,
    autoMonitorAfterInit = false,
  } = options;

  // ===== 状态定义 =====
  const [workstationId, setWorkstationId] = useState<string | null>(null);
  const [state, setState] = useState<WorkstationState>('idle');
  const [count, setCount] = useState(0);
  const [totalWeight, setTotalWeight] = useState(0);
  const [lastResult, setLastResult] = useState<CountingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<WorkstationConfig | null>(null);
  const [statusInfo, setStatusInfo] = useState<WorkstationStatusInfo | null>(null);
  const [frameStats, setFrameStats] = useState({
    totalFrames: 0,
    successFrames: 0,
    failedFrames: 0,
    lastFrameTime: null as Date | null,
  });

  // ===== Refs =====
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRetryCountRef = useRef(0);
  const isProcessingFrameRef = useRef(false);
  const cameraIdRef = useRef(initialCameraId);
  const channelIdRef = useRef(initialChannelId);

  // 更新 refs 当 props 变化时
  useEffect(() => {
    cameraIdRef.current = initialCameraId;
  }, [initialCameraId]);

  useEffect(() => {
    channelIdRef.current = initialChannelId;
  }, [initialChannelId]);

  // ===== 计算属性 =====
  const isInitialized = state !== 'idle' && state !== 'initializing';
  const isMonitoring = state === 'monitoring';
  const isPaused = state === 'paused';

  // ===== 清理定时器 =====
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // ===== 单帧处理 =====
  const processFrameOnce = useCallback(async () => {
    if (!workstationId || !cameraIdRef.current || isProcessingFrameRef.current) {
      return;
    }

    isProcessingFrameRef.current = true;

    try {
      // 从摄像头抓拍
      const capture: IsapiCapture = await capturePicture(
        cameraIdRef.current,
        channelIdRef.current
      );

      if (!capture.success || !capture.pictureBase64) {
        throw new Error(capture.error || '抓拍失败：未获取到图像');
      }

      // 发送到后端进行AI识别
      const result = await processFrame(workstationId, capture.pictureBase64);

      // 更新帧统计
      setFrameStats(prev => ({
        ...prev,
        totalFrames: prev.totalFrames + 1,
        successFrames: prev.successFrames + 1,
        lastFrameTime: new Date(),
      }));

      // 重置重试计数
      frameRetryCountRef.current = 0;

      // 更新结果
      setLastResult(result);

      // 如果识别到计数，更新计数和重量
      if (result.counted) {
        if (result.currentCount !== undefined) {
          setCount(result.currentCount);
        } else {
          setCount(prev => prev + 1);
        }

        if (result.totalWeight !== undefined) {
          setTotalWeight(result.totalWeight);
        }
      }
    } catch (err) {
      console.error('抓帧处理失败:', err);

      // 更新帧统计
      setFrameStats(prev => ({
        ...prev,
        totalFrames: prev.totalFrames + 1,
        failedFrames: prev.failedFrames + 1,
        lastFrameTime: new Date(),
      }));

      // 增加重试计数
      frameRetryCountRef.current += 1;

      // 如果超过最大重试次数，设置错误但不停止监控
      if (frameRetryCountRef.current >= maxFrameRetries) {
        const errorMessage = err instanceof Error ? err.message : '帧处理连续失败';
        console.warn(`帧处理连续失败 ${maxFrameRetries} 次: ${errorMessage}`);
        // 不设置全局错误，只记录日志，避免因单帧失败影响整体监控
      }
    } finally {
      isProcessingFrameRef.current = false;
    }
  }, [workstationId, maxFrameRetries]);

  // ===== 开始监控 =====
  const startMonitoring = useCallback(() => {
    if (!workstationId) {
      setError('工位未初始化，无法开始监控');
      return;
    }

    if (!cameraIdRef.current) {
      setError('未配置摄像头，无法开始监控');
      return;
    }

    // 清除之前的定时器
    clearTimer();

    // 重置帧重试计数
    frameRetryCountRef.current = 0;

    // 设置状态为监控中
    setState('monitoring');
    setError(null);

    // 立即执行一次
    processFrameOnce();

    // 设置定时器
    timerRef.current = setInterval(processFrameOnce, frameInterval);
  }, [workstationId, clearTimer, processFrameOnce, frameInterval]);

  // ===== 暂停监控 =====
  const pauseMonitoring = useCallback(() => {
    clearTimer();
    setState('paused');
  }, [clearTimer]);

  // ===== 恢复监控 =====
  const resumeMonitoring = useCallback(() => {
    if (workstationId && cameraIdRef.current) {
      setState('monitoring');
      frameRetryCountRef.current = 0;

      // 立即执行一次
      processFrameOnce();

      // 设置定时器
      timerRef.current = setInterval(processFrameOnce, frameInterval);
    }
  }, [workstationId, processFrameOnce, frameInterval]);

  // ===== 初始化工位 =====
  const initialize = useCallback(async (initConfig: WorkstationConfig): Promise<WorkstationInitResult | null> => {
    setLoading(true);
    setState('initializing');
    setError(null);

    try {
      const result = await initWorkstation(initConfig);

      if (result.success) {
        setWorkstationId(result.workstationId);
        setConfig(result.config);
        setCount(result.initialState?.count || 0);
        setTotalWeight(result.initialState?.totalWeight || 0);

        // 更新摄像头配置
        if (initConfig.cameraId) {
          cameraIdRef.current = initConfig.cameraId;
        }
        if (initConfig.cameraChannelId !== undefined) {
          channelIdRef.current = initConfig.cameraChannelId;
        }

        setState('paused'); // 初始化后默认暂停

        // 如果配置了自动开始监控
        if (autoMonitorAfterInit && cameraIdRef.current) {
          // 延迟一帧再开始，确保状态更新完成
          setTimeout(() => {
            startMonitoring();
          }, 0);
        }

        return result;
      } else {
        throw new Error(result.message || '工位初始化失败');
      }
    } catch (err) {
      console.error('工位初始化失败:', err);
      const errorMessage = err instanceof Error ? err.message : '工位初始化失败';
      setError(errorMessage);
      setState('error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [autoMonitorAfterInit, startMonitoring]);

  // ===== 停止工位会话 =====
  const stop = useCallback(async (): Promise<WorkstationStopResult | null> => {
    // 先停止定时器
    clearTimer();

    if (!workstationId) {
      setState('idle');
      return null;
    }

    setLoading(true);

    try {
      const result = await stopWorkstation(workstationId);
      setState('stopped');
      return result;
    } catch (err) {
      console.error('停止工位失败:', err);
      const errorMessage = err instanceof Error ? err.message : '停止工位失败';
      setError(errorMessage);
      setState('error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [workstationId, clearTimer]);

  // ===== 手动计数 =====
  const manualCount = useCallback(async (weight?: number): Promise<CountingResult | null> => {
    if (!workstationId) {
      setError('工位未初始化');
      return null;
    }

    setLoading(true);

    try {
      const result = await apiManualCount(workstationId, weight);

      setLastResult(result);

      if (result.counted) {
        if (result.currentCount !== undefined) {
          setCount(result.currentCount);
        } else {
          setCount(prev => prev + 1);
        }

        if (result.totalWeight !== undefined) {
          setTotalWeight(result.totalWeight);
        }
      }

      return result;
    } catch (err) {
      console.error('手动计数失败:', err);
      const errorMessage = err instanceof Error ? err.message : '手动计数失败';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [workstationId]);

  // ===== 验证标签 =====
  const verifyLabel = useCallback(async (imageBase64: string): Promise<LabelVerifyResult | null> => {
    if (!workstationId) {
      setError('工位未初始化');
      return null;
    }

    setLoading(true);

    try {
      const result = await apiVerifyLabel(workstationId, imageBase64);
      return result;
    } catch (err) {
      console.error('标签验证失败:', err);
      const errorMessage = err instanceof Error ? err.message : '标签验证失败';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [workstationId]);

  // ===== 刷新状态 =====
  const refreshStatus = useCallback(async (): Promise<void> => {
    if (!workstationId) {
      return;
    }

    try {
      const status = await getWorkstationStatus(workstationId);
      setStatusInfo(status);
      setCount(status.count);
      setTotalWeight(status.totalWeight);
    } catch (err) {
      console.error('刷新状态失败:', err);
      // 不设置错误，刷新失败不影响正常操作
    }
  }, [workstationId]);

  // ===== 清除错误 =====
  const clearError = useCallback(() => {
    setError(null);
    if (state === 'error') {
      setState(workstationId ? 'paused' : 'idle');
    }
  }, [state, workstationId]);

  // ===== 重置状态 =====
  const reset = useCallback(() => {
    clearTimer();
    setWorkstationId(null);
    setState('idle');
    setCount(0);
    setTotalWeight(0);
    setLastResult(null);
    setError(null);
    setLoading(false);
    setConfig(null);
    setStatusInfo(null);
    setFrameStats({
      totalFrames: 0,
      successFrames: 0,
      failedFrames: 0,
      lastFrameTime: null,
    });
    frameRetryCountRef.current = 0;
    isProcessingFrameRef.current = false;
  }, [clearTimer]);

  // ===== 自动启动 =====
  useEffect(() => {
    if (autoStart && workstationId && cameraIdRef.current && state === 'paused') {
      startMonitoring();
    }
  }, [autoStart, workstationId, state, startMonitoring]);

  // ===== 组件卸载时清理 =====
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  // ===== 返回 =====
  return {
    // 状态
    workstationId,
    isInitialized,
    isMonitoring,
    isPaused,
    state,
    count,
    totalWeight,
    lastResult,
    error,
    loading,
    config,
    statusInfo,
    frameStats,

    // 操作
    initialize,
    startMonitoring,
    pauseMonitoring,
    resumeMonitoring,
    stop,
    manualCount,
    verifyLabel,
    refreshStatus,
    clearError,
    reset,
  };
}

export default useWorkstationCounting;
