/**
 * AI全局监控组件
 * 
 * 提供全局AI系统性能监控，仅在开发环境显示
 * 包含AI缓存、批量处理、错误处理的实时性能指标
 */

'use client';

import React, { useState, useEffect } from 'react';
import { AiPerformanceMonitor } from '@/components/ui/ai-performance-monitor';
import { useAiErrorMonitoring } from '@/hooks/useAiDataFetch';

interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  cacheHealth: 'good' | 'degraded' | 'poor';
  batchHealth: 'good' | 'degraded' | 'poor';
  errorHealth: 'good' | 'degraded' | 'poor';
  lastUpdate: string;
}

export const AiGlobalMonitor: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    cacheHealth: 'good',
    batchHealth: 'good',
    errorHealth: 'good',
    lastUpdate: new Date().toLocaleTimeString()
  });

  // 使用AI错误监控Hook
  const errorMonitoringData = useAiErrorMonitoring(5000);

  // 系统健康度计算
  useEffect(() => {
    const calculateSystemHealth = () => {
      try {
        const cacheHealth: 'good' | 'degraded' | 'poor' = 'good';
        const batchHealth: 'good' | 'degraded' | 'poor' = 'good';
        let errorHealth: 'good' | 'degraded' | 'poor' = 'good';

        // 基于错误处理器健康评分判断
        if (errorMonitoringData?.healthScore !== undefined) {
          if (errorMonitoringData.healthScore < 50) {
            errorHealth = 'poor';
          } else if (errorMonitoringData.healthScore < 80) {
            errorHealth = 'degraded';
          }
        }

        // 基于熔断器状态判断
        if (errorMonitoringData?.circuitBreakerStatus) {
          const circuitStatus = errorMonitoringData.circuitBreakerStatus;
          // 简化检查：如果熔断器处于OPEN状态就认为有问题
          if (circuitStatus.state === 'OPEN') {
            errorHealth = 'poor';
          } else if (circuitStatus.state === 'HALF_OPEN') {
            errorHealth = 'degraded';
          }
        }

        // 判断整体健康状态
        const healthStates = [cacheHealth, batchHealth, errorHealth];
        const poorCount = healthStates.filter(h => h === 'poor').length;
        const degradedCount = healthStates.filter(h => h === 'degraded').length;

        let overall: 'healthy' | 'warning' | 'critical';
        if (poorCount > 0) {
          overall = 'critical';
        } else if (degradedCount > 1) {
          overall = 'warning';
        } else {
          overall = 'healthy';
        }

        setSystemHealth({
          overall,
          cacheHealth,
          batchHealth,
          errorHealth,
          lastUpdate: new Date().toLocaleTimeString()
        });
      } catch (error) {
        console.warn('[AiGlobalMonitor] 健康度计算失败:', error);
      }
    };

    calculateSystemHealth();
    const interval = setInterval(calculateSystemHealth, 10000); // 每10秒更新

    return () => clearInterval(interval);
  }, [errorMonitoringData?.healthScore, errorMonitoringData?.circuitBreakerStatus]);

  // 开发环境才渲染
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <>
      {/* AI性能监控面板 */}
      <AiPerformanceMonitor className="max-w-lg" refreshInterval={5000} />
      
      {/* 系统健康状态指示器 */}
      <div className="fixed top-4 right-4 z-40">
        <div className={`
          inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium shadow-sm
          ${systemHealth.overall === 'healthy' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : systemHealth.overall === 'warning'
            ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
            : 'bg-red-50 text-red-700 border border-red-200'
          }
        `}>
          <div className={`w-2 h-2 rounded-full ${
            systemHealth.overall === 'healthy' ? 'bg-green-500' :
            systemHealth.overall === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
          }`} />
          <span>AI系统: {
            systemHealth.overall === 'healthy' ? '正常' :
            systemHealth.overall === 'warning' ? '警告' : '异常'
          }</span>
        </div>
        
        {/* 详细健康状态 (悬停显示) */}
        <div className="hidden group-hover:block absolute top-full right-0 mt-2 p-3 bg-white rounded-lg shadow-lg border text-xs min-w-48">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>缓存系统:</span>
              <span className={`font-medium ${
                systemHealth.cacheHealth === 'good' ? 'text-green-600' :
                systemHealth.cacheHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {systemHealth.cacheHealth === 'good' ? '正常' :
                 systemHealth.cacheHealth === 'degraded' ? '降级' : '异常'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>批量处理:</span>
              <span className={`font-medium ${
                systemHealth.batchHealth === 'good' ? 'text-green-600' :
                systemHealth.batchHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {systemHealth.batchHealth === 'good' ? '正常' :
                 systemHealth.batchHealth === 'degraded' ? '降级' : '异常'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>错误处理:</span>
              <span className={`font-medium ${
                systemHealth.errorHealth === 'good' ? 'text-green-600' :
                systemHealth.errorHealth === 'degraded' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {systemHealth.errorHealth === 'good' ? '正常' :
                 systemHealth.errorHealth === 'degraded' ? '降级' : '异常'}
              </span>
            </div>
            {errorMonitoringData?.healthScore !== undefined && (
              <div className="flex justify-between border-t pt-2">
                <span>健康评分:</span>
                <span className="font-medium text-blue-600">
                  {errorMonitoringData.healthScore.toFixed(0)}%
                </span>
              </div>
            )}
            <div className="text-gray-500 text-xs border-t pt-2">
              更新时间: {systemHealth.lastUpdate}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AiGlobalMonitor; 