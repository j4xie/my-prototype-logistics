/**
 * 离线状态指示器组件
 *
 * 显示网络状态和待同步队列信息
 * 提供手动同步功能
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-31
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';

// ==================== 组件属性 ====================

interface OfflineIndicatorProps {
  /** 是否显示详细信息 */
  showDetails?: boolean;

  /** 自定义样式 */
  style?: object;

  /** 同步完成回调 */
  onSyncComplete?: () => void;

  /** 同步失败回调 */
  onSyncError?: (error: Error) => void;
}

// ==================== OfflineIndicator 组件 ====================

/**
 * 离线状态指示器
 *
 * 显示在屏幕顶部的横幅，提示用户当前网络状态
 *
 * @example
 * ```tsx
 * <OfflineIndicator showDetails={true} />
 * ```
 */
export function OfflineIndicator({
  showDetails = false,
  style,
  onSyncComplete,
  onSyncError,
}: OfflineIndicatorProps) {
  const { isOnline, queueStats, isSyncing, sync } = useOfflineQueue();
  const [isExpanded, setIsExpanded] = useState(false);

  // 如果在线且没有待同步项目，不显示
  if (isOnline && queueStats.pending === 0 && queueStats.failed === 0) {
    return null;
  }

  // ==================== 同步处理 ====================

  const handleSync = async () => {
    try {
      const result = await sync();
      console.log('[OfflineIndicator] Sync completed:', result);

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error) {
      console.error('[OfflineIndicator] Sync failed:', error);

      if (onSyncError && error instanceof Error) {
        onSyncError(error);
      }
    }
  };

  // ==================== 渲染 ====================

  return (
    <View style={[styles.container, style]}>
      {/* 主横幅 */}
      <TouchableOpacity
        style={[
          styles.banner,
          isOnline ? styles.bannerOnline : styles.bannerOffline,
        ]}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <View style={styles.statusRow}>
          {/* 状态指示器 */}
          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.statusDot,
                isOnline ? styles.statusDotOnline : styles.statusDotOffline,
              ]}
            />
            <Text style={styles.statusText}>
              {isOnline ? '已连接' : '离线模式'}
            </Text>
          </View>

          {/* 待同步数量 */}
          {queueStats.pending > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{queueStats.pending}</Text>
            </View>
          )}

          {/* 同步按钮 */}
          {isOnline && queueStats.pending > 0 && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.syncButtonText}>同步</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 展开箭头 */}
        {showDetails && (
          <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
        )}
      </TouchableOpacity>

      {/* 详细信息 (展开时显示) */}
      {showDetails && isExpanded && (
        <View style={styles.details}>
          <Text style={styles.detailsTitle}>队列详情</Text>

          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>待同步:</Text>
            <Text style={styles.detailsValue}>{queueStats.pending} 项</Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>已同步:</Text>
            <Text style={styles.detailsValue}>{queueStats.synced} 项</Text>
          </View>

          <View style={styles.detailsRow}>
            <Text style={styles.detailsLabel}>失败:</Text>
            <Text style={[styles.detailsValue, styles.detailsValueError]}>
              {queueStats.failed} 项
            </Text>
          </View>

          {queueStats.failed > 0 && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleSync}
              disabled={isSyncing}
            >
              <Text style={styles.retryButtonText}>重试失败项目</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ==================== 简化版组件 ====================

/**
 * 简化的离线横幅
 * 只显示状态，不显示详细信息
 *
 * @example
 * ```tsx
 * <OfflineBanner />
 * ```
 */
export function OfflineBanner() {
  return <OfflineIndicator showDetails={false} />;
}

/**
 * 带同步按钮的离线横幅
 *
 * @example
 * ```tsx
 * <OfflineBannerWithSync />
 * ```
 */
export function OfflineBannerWithSync() {
  return <OfflineIndicator showDetails={true} />;
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },

  bannerOffline: {
    backgroundColor: '#ff4d4f',
  },

  bannerOnline: {
    backgroundColor: '#52c41a',
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },

  statusDotOffline: {
    backgroundColor: '#fff',
  },

  statusDotOnline: {
    backgroundColor: '#fff',
  },

  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },

  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  syncButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
    minWidth: 60,
    alignItems: 'center',
  },

  syncButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  expandIcon: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 8,
  },

  details: {
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },

  detailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },

  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  detailsLabel: {
    fontSize: 14,
    color: '#666',
  },

  detailsValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },

  detailsValueError: {
    color: '#ff4d4f',
  },

  retryButton: {
    backgroundColor: '#1890ff',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 12,
    alignItems: 'center',
  },

  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OfflineIndicator;
