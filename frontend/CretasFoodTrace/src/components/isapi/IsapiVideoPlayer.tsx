/**
 * ISAPI 视频播放器组件
 * 支持 MJPEG 流预览和快照显示
 */
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Text, ActivityIndicator, Image, TouchableOpacity } from 'react-native';
import { Icon } from 'react-native-paper';

interface Props {
  /** RTSP 流地址 (仅用于显示，实际播放需要转换) */
  rtspUrl?: string;
  /** MJPEG 流地址或抓拍图片 URL */
  mjpegUrl?: string;
  /** 通道名称 */
  channelName?: string;
  /** 是否自动刷新 (用于 MJPEG 快照模式) */
  autoRefresh?: boolean;
  /** 自动刷新间隔 (毫秒) */
  refreshInterval?: number;
  /** 错误回调 */
  onError?: (error: string) => void;
  /** 图片加载成功回调 */
  onLoad?: () => void;
  /** 容器高度 */
  height?: number;
}

export function IsapiVideoPlayer({
  rtspUrl,
  mjpegUrl,
  channelName,
  autoRefresh = false,
  refreshInterval = 3000,
  onError,
  onLoad,
  height = 200,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh && !error) {
      intervalRef.current = setInterval(() => {
        setRefreshKey(prev => prev + 1);
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh, refreshInterval, error]);

  const handleRefresh = () => {
    setLoading(true);
    setError(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleImageLoad = () => {
    setLoading(false);
    setError(null);
    setLastUpdateTime(new Date());
    onLoad?.();
  };

  const handleImageError = () => {
    setLoading(false);
    const errorMsg = '视频加载失败';
    setError(errorMsg);
    onError?.(errorMsg);
    // 停止自动刷新
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // 优先使用 MJPEG URL，否则尝试从 RTSP 构造抓拍 URL
  const imageUrl = mjpegUrl || (rtspUrl ? constructSnapshotUrl(rtspUrl) : null);

  return (
    <View style={styles.container}>
      {/* 头部信息 */}
      {channelName && (
        <View style={styles.header}>
          <Icon source="video" size={18} color="#3182ce" />
          <Text style={styles.channelName}>{channelName}</Text>
          <View style={styles.headerRight}>
            {autoRefresh && !error && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
              <Icon source="refresh" size={18} color="#718096" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 播放器主体 */}
      <View style={[styles.playerContainer, { height }]}>
        {imageUrl ? (
          <Image
            key={`${refreshKey}-${imageUrl}`}
            source={{ uri: `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}t=${refreshKey}` }}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setLoading(true)}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <View style={styles.noUrlContainer}>
            <Icon source="video-off" size={40} color="#a0aec0" />
            <Text style={styles.noUrlText}>暂无视频地址</Text>
            {rtspUrl && (
              <Text style={styles.rtspHint}>RTSP: {rtspUrl}</Text>
            )}
          </View>
        )}

        {/* 加载状态 */}
        {loading && !error && imageUrl && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#3182ce" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        )}

        {/* 错误状态 */}
        {error && (
          <View style={styles.errorOverlay}>
            <Icon source="alert-circle" size={30} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
              <Text style={styles.retryText}>重试</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 底部信息 */}
      {lastUpdateTime && !error && (
        <View style={styles.footer}>
          <Icon source="clock-outline" size={12} color="#a0aec0" />
          <Text style={styles.updateTimeText}>
            更新于 {lastUpdateTime.toLocaleTimeString()}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * 从 RTSP URL 构造抓拍 URL
 * 这是一个通用的转换方法，实际可能需要根据摄像头型号调整
 */
function constructSnapshotUrl(rtspUrl: string): string | null {
  try {
    // rtsp://admin:password@192.168.1.100:554/Streaming/Channels/101
    // -> http://192.168.1.100:80/ISAPI/Streaming/channels/101/picture
    const match = rtspUrl.match(/rtsp:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/Streaming\/Channels\/(\d+)/i);
    if (match) {
      const [, username, password, host, , channelId] = match;
      return `http://${username}:${password}@${host}/ISAPI/Streaming/channels/${channelId}/picture`;
    }
    return null;
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a202c',
    borderRadius: 12,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#2d3748',
    gap: 8,
  },
  channelName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#e2e8f0',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e53e3e',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#e53e3e',
    letterSpacing: 0.5,
  },
  refreshButton: {
    padding: 4,
  },
  playerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noUrlContainer: {
    alignItems: 'center',
    gap: 8,
    padding: 20,
  },
  noUrlText: {
    color: '#a0aec0',
    fontSize: 14,
  },
  rtspHint: {
    color: '#4a5568',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 14,
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    color: '#fc8181',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3182ce',
    borderRadius: 6,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: 8,
    backgroundColor: '#1a202c',
  },
  updateTimeText: {
    fontSize: 11,
    color: '#a0aec0',
  },
});

export default IsapiVideoPlayer;
