import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SystemService } from '../../services/system/systemService';
import { SystemPerformance, SystemStatistics } from '../../services/api/systemApiClient';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';

const { width: screenWidth } = Dimensions.get('window');

export const SystemMonitorScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  // 状态管理
  const [performance, setPerformance] = useState<SystemPerformance | null>(null);
  const [statistics, setStatistics] = useState<SystemStatistics | null>(null);
  const [realTimeMetrics, setRealTimeMetrics] = useState<{
    cpu: number;
    memory: number;
    disk: number;
    activeUsers: number;
    requestsPerSecond: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 权限检查
  const canViewSystemInfo = hasPermission('system:view') || hasPermission('admin:all');
  const canManageSystem = hasPermission('system:manage') || hasPermission('admin:all');

  // 加载系统性能数据
  const loadPerformanceData = async () => {
    try {
      setError(null);

      const [perfResponse, statsResponse] = await Promise.all([
        SystemService.getSystemPerformance(false),
        SystemService.getSystemStatistics(false)
      ]);

      if (perfResponse.success && perfResponse.performance) {
        setPerformance(perfResponse.performance);
      } else {
        throw new Error(perfResponse.message || '获取性能数据失败');
      }

      if (statsResponse.success && statsResponse.statistics) {
        setStatistics(statsResponse.statistics);
      } else {
        console.warn('获取统计数据失败:', statsResponse.message);
      }

      console.log('系统监控数据加载成功');
    } catch (error) {
      console.error('加载系统监控数据失败:', error);
      setError(error.message || '加载失败');
      
      if (!refreshing && loading) {
        Alert.alert('加载失败', error.message || '无法获取系统监控数据，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 加载实时指标
  const loadRealTimeMetrics = async () => {
    try {
      const response = await SystemService.getRealTimeMetrics();
      
      if (response.success && response.metrics) {
        setRealTimeMetrics(response.metrics);
      }
    } catch (error) {
      console.error('加载实时指标失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    loadPerformanceData();
    loadRealTimeMetrics();
  }, []);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        loadRealTimeMetrics();
      }, 5000); // 5秒刷新一次
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [autoRefresh]);

  // 页面聚焦时刷新
  useFocusEffect(
    useCallback(() => {
      loadPerformanceData();
      setAutoRefresh(true);

      return () => {
        setAutoRefresh(false);
      };
    }, [])
  );

  // 刷新数据
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadPerformanceData();
    loadRealTimeMetrics();
  }, []);

  // 渲染性能指标卡片
  const renderPerformanceCard = (
    title: string,
    value: number,
    max: number,
    unit: string,
    icon: string,
    color: string
  ) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const isWarning = percentage > 80;
    const isCritical = percentage > 90;
    
    const statusColor = isCritical ? '#FF4444' : isWarning ? '#FFBB33' : color;

    return (
      <View style={styles.performanceCard}>
        <View style={styles.performanceHeader}>
          <Ionicons name={icon as any} size={24} color={statusColor} />
          <Text style={styles.performanceTitle}>{title}</Text>
        </View>
        
        <View style={styles.performanceValue}>
          <Text style={[styles.performanceNumber, { color: statusColor }]}>
            {value.toFixed(1)}
          </Text>
          <Text style={styles.performanceUnit}>{unit}</Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarBackground}>
            <View 
              style={[
                styles.progressBarFill,
                { 
                  width: `${Math.min(percentage, 100)}%`,
                  backgroundColor: statusColor
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{percentage.toFixed(1)}%</Text>
        </View>
        
        <Text style={styles.performanceLimit}>最大: {max}{unit}</Text>
      </View>
    );
  };

  // 渲染统计卡片
  const renderStatCard = (
    title: string,
    value: number | string,
    subtitle?: string,
    icon?: string,
    color: string = '#007AFF'
  ) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      {icon && (
        <Ionicons name={icon as any} size={20} color={color} style={styles.statIcon} />
      )}
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
        {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  // 渲染实时指标
  const renderRealTimeMetrics = () => {
    if (!realTimeMetrics) return null;

    return (
      <View style={styles.realTimeContainer}>
        <View style={styles.realTimeHeader}>
          <Text style={styles.sectionTitle}>实时监控</Text>
          <TouchableOpacity
            onPress={() => setAutoRefresh(!autoRefresh)}
            style={styles.autoRefreshButton}
          >
            <Ionicons 
              name={autoRefresh ? "pause" : "play"} 
              size={16} 
              color="#007AFF" 
            />
            <Text style={styles.autoRefreshText}>
              {autoRefresh ? '暂停' : '开始'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.realTimeMetrics}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>CPU</Text>
            <Text style={[
              styles.metricValue,
              realTimeMetrics.cpu > 80 && styles.metricWarning,
              realTimeMetrics.cpu > 90 && styles.metricCritical
            ]}>
              {realTimeMetrics.cpu.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>内存</Text>
            <Text style={[
              styles.metricValue,
              realTimeMetrics.memory > 80 && styles.metricWarning,
              realTimeMetrics.memory > 90 && styles.metricCritical
            ]}>
              {realTimeMetrics.memory.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>磁盘</Text>
            <Text style={[
              styles.metricValue,
              realTimeMetrics.disk > 80 && styles.metricWarning,
              realTimeMetrics.disk > 90 && styles.metricCritical
            ]}>
              {realTimeMetrics.disk.toFixed(1)}%
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>在线用户</Text>
            <Text style={styles.metricValue}>
              {realTimeMetrics.activeUsers}
            </Text>
          </View>
          
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>QPS</Text>
            <Text style={styles.metricValue}>
              {realTimeMetrics.requestsPerSecond.toFixed(1)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>系统监控</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('SystemHealth' as never)}
          >
            <Ionicons name="heart" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('SystemLogs' as never)}
          >
            <Ionicons name="document-text" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 内容 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载系统监控数据...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* 实时指标 */}
          {renderRealTimeMetrics()}

          {/* 性能指标 */}
          {performance && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>性能指标</Text>
              <View style={styles.performanceGrid}>
                {renderPerformanceCard(
                  'CPU使用率',
                  performance.cpu.usage,
                  100,
                  '%',
                  'speedometer',
                  '#007AFF'
                )}
                {renderPerformanceCard(
                  '内存使用',
                  performance.memory.used / (1024 * 1024 * 1024),
                  performance.memory.total / (1024 * 1024 * 1024),
                  'GB',
                  'hardware-chip',
                  '#00AA88'
                )}
                {renderPerformanceCard(
                  '磁盘使用',
                  performance.disk.used / (1024 * 1024 * 1024),
                  performance.disk.total / (1024 * 1024 * 1024),
                  'GB',
                  'server',
                  '#FF8800'
                )}
                {renderPerformanceCard(
                  '数据库连接',
                  performance.database.connections,
                  performance.database.maxConnections,
                  '',
                  'git-network',
                  '#8B4513'
                )}
              </View>
            </View>
          )}

          {/* API性能 */}
          {performance && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>API性能</Text>
              <View style={styles.apiMetrics}>
                <View style={styles.apiMetricCard}>
                  <Text style={styles.apiMetricLabel}>请求速率</Text>
                  <Text style={styles.apiMetricValue}>
                    {performance.api.requestsPerMinute}
                  </Text>
                  <Text style={styles.apiMetricUnit}>请求/分钟</Text>
                </View>
                
                <View style={styles.apiMetricCard}>
                  <Text style={styles.apiMetricLabel}>平均响应</Text>
                  <Text style={styles.apiMetricValue}>
                    {performance.api.averageResponseTime.toFixed(0)}
                  </Text>
                  <Text style={styles.apiMetricUnit}>毫秒</Text>
                </View>
                
                <View style={styles.apiMetricCard}>
                  <Text style={styles.apiMetricLabel}>错误率</Text>
                  <Text style={[
                    styles.apiMetricValue,
                    performance.api.errorRate > 5 && styles.metricWarning,
                    performance.api.errorRate > 10 && styles.metricCritical
                  ]}>
                    {performance.api.errorRate.toFixed(2)}%
                  </Text>
                  <Text style={styles.apiMetricUnit}>错误</Text>
                </View>
                
                <View style={styles.apiMetricCard}>
                  <Text style={styles.apiMetricLabel}>活跃连接</Text>
                  <Text style={styles.apiMetricValue}>
                    {performance.api.activeConnections}
                  </Text>
                  <Text style={styles.apiMetricUnit}>连接</Text>
                </View>
              </View>
            </View>
          )}

          {/* 业务统计 */}
          {statistics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>业务统计</Text>
              <View style={styles.statsGrid}>
                {renderStatCard(
                  '用户总数',
                  statistics.users.total,
                  `${statistics.users.active} 活跃`,
                  'people',
                  '#007AFF'
                )}
                {renderStatCard(
                  '在线用户',
                  statistics.users.online,
                  `${statistics.users.newToday} 今日新增`,
                  'person',
                  '#00AA88'
                )}
                {renderStatCard(
                  '工厂数量',
                  statistics.factories.total,
                  `${statistics.factories.active} 活跃`,
                  'business',
                  '#FF8800'
                )}
                {renderStatCard(
                  '今日批次',
                  statistics.processing.batchesToday,
                  `总计 ${statistics.processing.batchesTotal}`,
                  'cube',
                  '#8B4513'
                )}
                {renderStatCard(
                  '质检通过率',
                  `${statistics.quality.passRate.toFixed(1)}%`,
                  `${statistics.quality.inspectionsToday} 今日检验`,
                  'shield-checkmark',
                  '#00AA88'
                )}
                {renderStatCard(
                  '活跃告警',
                  statistics.alerts.activeAlerts,
                  `${statistics.alerts.criticalAlerts} 紧急`,
                  'warning',
                  statistics.alerts.criticalAlerts > 0 ? '#FF4444' : '#FFBB33'
                )}
              </View>
            </View>
          )}

          {/* 存储信息 */}
          {statistics && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>存储信息</Text>
              <View style={styles.storageInfo}>
                <View style={styles.storageRow}>
                  <Text style={styles.storageLabel}>文件总数</Text>
                  <Text style={styles.storageValue}>{statistics.storage.filesCount}</Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.storageLabel}>总大小</Text>
                  <Text style={styles.storageValue}>
                    {SystemService.formatBytes(statistics.storage.totalSize)}
                  </Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.storageLabel}>图片数量</Text>
                  <Text style={styles.storageValue}>{statistics.storage.imagesCount}</Text>
                </View>
                <View style={styles.storageRow}>
                  <Text style={styles.storageLabel}>文档数量</Text>
                  <Text style={styles.storageValue}>{statistics.storage.documentsCount}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 数据库信息 */}
          {performance && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>数据库状态</Text>
              <View style={styles.databaseInfo}>
                <View style={styles.databaseRow}>
                  <Text style={styles.databaseLabel}>当前连接</Text>
                  <Text style={styles.databaseValue}>
                    {performance.database.connections} / {performance.database.maxConnections}
                  </Text>
                </View>
                <View style={styles.databaseRow}>
                  <Text style={styles.databaseLabel}>平均查询时间</Text>
                  <Text style={styles.databaseValue}>
                    {performance.database.queryTime.toFixed(2)} ms
                  </Text>
                </View>
                <View style={styles.databaseRow}>
                  <Text style={styles.databaseLabel}>慢查询数量</Text>
                  <Text style={[
                    styles.databaseValue,
                    performance.database.slowQueries > 10 && styles.metricWarning
                  ]}>
                    {performance.database.slowQueries}
                  </Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 12,
  },
  realTimeContainer: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  realTimeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  autoRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#E3F2FD',
  },
  autoRefreshText: {
    fontSize: 12,
    color: '#007AFF',
    marginLeft: 4,
  },
  realTimeMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  metricWarning: {
    color: '#FFBB33',
  },
  metricCritical: {
    color: '#FF4444',
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  performanceCard: {
    width: (screenWidth - 40) / 2,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  performanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  performanceTitle: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 8,
  },
  performanceValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  performanceNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  performanceUnit: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 4,
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
    width: 40,
    textAlign: 'right',
  },
  performanceLimit: {
    fontSize: 12,
    color: '#999999',
  },
  apiMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  apiMetricCard: {
    width: (screenWidth - 40) / 2,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    margin: 4,
    alignItems: 'center',
  },
  apiMetricLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  apiMetricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  apiMetricUnit: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  statCard: {
    width: (screenWidth - 40) / 2,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    margin: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
  },
  statIcon: {
    marginRight: 8,
  },
  statContent: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  statTitle: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999999',
    marginTop: 2,
  },
  storageInfo: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
  },
  storageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  storageLabel: {
    fontSize: 14,
    color: '#666666',
  },
  storageValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  databaseInfo: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
  },
  databaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  databaseLabel: {
    fontSize: 14,
    color: '#666666',
  },
  databaseValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default SystemMonitorScreen;