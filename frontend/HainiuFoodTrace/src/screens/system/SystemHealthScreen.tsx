import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SystemService } from '../../services/system/systemService';
import { SystemHealth } from '../../services/api/systemApiClient';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';

export const SystemHealthScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  // 状态管理
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());

  // 权限检查
  const canViewSystemHealth = hasPermission('system:health') || hasPermission('admin:all');
  const canManageSystem = hasPermission('system:manage') || hasPermission('admin:all');

  // 加载健康状态
  const loadHealthStatus = async () => {
    try {
      setError(null);

      const response = await SystemService.getSystemHealth(false);

      if (response.success && response.health) {
        setHealth(response.health);
        setLastCheckTime(new Date());
        console.log('系统健康状态加载成功:', response.health.status);
      } else {
        throw new Error(response.message || '获取健康状态失败');
      }
    } catch (error) {
      console.error('加载系统健康状态失败:', error);
      setError(error.message || '加载失败');
      
      if (!refreshing && loading) {
        Alert.alert('加载失败', error.message || '无法获取系统健康状态，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadHealthStatus();
  }, []);

  // 页面聚焦时刷新
  useFocusEffect(
    useCallback(() => {
      loadHealthStatus();
    }, [])
  );

  // 刷新数据
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadHealthStatus();
  }, []);

  // 执行健康检查
  const performHealthCheck = () => {
    Alert.alert(
      '执行健康检查',
      '确定要立即执行完整的系统健康检查吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '执行',
          onPress: () => {
            setLoading(true);
            loadHealthStatus();
          }
        }
      ]
    );
  };

  // 渲染服务状态
  const renderServiceStatus = (
    serviceName: string,
    service: { status: 'up' | 'down'; responseTime?: number; latency?: number; available?: boolean; message?: string },
    icon: string
  ) => {
    const statusInfo = SystemService.getServiceStatusInfo(service.status);
    const responseTime = service.responseTime || service.latency || 0;
    
    return (
      <View style={styles.serviceCard}>
        <View style={styles.serviceHeader}>
          <View style={styles.serviceInfo}>
            <Ionicons name={icon as any} size={24} color={statusInfo.color} />
            <Text style={styles.serviceName}>{serviceName}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={16} color="white" />
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>
        </View>
        
        {responseTime > 0 && (
          <View style={styles.serviceMetrics}>
            <Text style={styles.metricLabel}>响应时间</Text>
            <Text style={[
              styles.metricValue,
              responseTime > 1000 && styles.metricWarning,
              responseTime > 3000 && styles.metricCritical
            ]}>
              {responseTime.toFixed(0)} ms
            </Text>
          </View>
        )}
        
        {service.message && (
          <Text style={[
            styles.serviceMessage,
            service.status === 'down' && styles.serviceMessageError
          ]}>
            {service.message}
          </Text>
        )}
      </View>
    );
  };

  // 渲染整体状态
  const renderOverallStatus = () => {
    if (!health) return null;

    const statusInfo = SystemService.getHealthStatusInfo(health.status);
    const uptime = SystemService.formatUptime(health.uptime);

    return (
      <View style={[styles.overallCard, { borderColor: statusInfo.color }]}>
        <View style={styles.overallHeader}>
          <Ionicons name={statusInfo.icon as any} size={48} color={statusInfo.color} />
          <View style={styles.overallInfo}>
            <Text style={styles.overallStatus}>{statusInfo.label}</Text>
            <Text style={styles.overallTimestamp}>
              最后检查: {new Date(health.timestamp).toLocaleTimeString('zh-CN')}
            </Text>
          </View>
        </View>
        
        <View style={styles.overallMetrics}>
          <View style={styles.overallMetricItem}>
            <Text style={styles.overallMetricLabel}>运行时间</Text>
            <Text style={styles.overallMetricValue}>{uptime}</Text>
          </View>
          <View style={styles.overallMetricItem}>
            <Text style={styles.overallMetricLabel}>系统版本</Text>
            <Text style={styles.overallMetricValue}>{health.version}</Text>
          </View>
        </View>
        
        {health.status !== 'healthy' && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={20} color="#FFBB33" />
            <Text style={styles.warningText}>
              {health.status === 'degraded' 
                ? '系统处于降级状态，部分服务可能不可用'
                : '系统异常，请立即检查'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // 渲染快速操作
  const renderQuickActions = () => {
    if (!canManageSystem) return null;

    return (
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>快速操作</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={performHealthCheck}
          >
            <Ionicons name="heart" size={24} color="#007AFF" />
            <Text style={styles.actionButtonText}>健康检查</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SystemLogs' as never)}
          >
            <Ionicons name="document-text" size={24} color="#FF8800" />
            <Text style={styles.actionButtonText}>查看日志</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => navigation.navigate('SystemMonitor' as never)}
          >
            <Ionicons name="speedometer" size={24} color="#00AA88" />
            <Text style={styles.actionButtonText}>性能监控</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              Alert.alert(
                '清理缓存',
                '确定要清理系统缓存吗？',
                [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '清理',
                    onPress: async () => {
                      try {
                        await SystemService.cleanupLogs(30);
                        Alert.alert('成功', '缓存清理完成');
                      } catch (error) {
                        Alert.alert('失败', '缓存清理失败');
                      }
                    },
                    style: 'destructive'
                  }
                ]
              );
            }}
          >
            <Ionicons name="trash" size={24} color="#FF4444" />
            <Text style={styles.actionButtonText}>清理缓存</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染健康建议
  const renderHealthSuggestions = () => {
    if (!health || health.status === 'healthy') return null;

    const suggestions = [];
    
    if (health.services.database.status === 'down') {
      suggestions.push({
        icon: 'server',
        text: '数据库连接异常，请检查数据库服务状态',
        severity: 'critical'
      });
    }
    
    if (health.services.redis?.status === 'down') {
      suggestions.push({
        icon: 'cube',
        text: 'Redis服务不可用，缓存功能可能受影响',
        severity: 'warning'
      });
    }
    
    if (health.services.storage.status === 'down' || !health.services.storage.available) {
      suggestions.push({
        icon: 'folder',
        text: '存储服务异常，文件上传功能可能不可用',
        severity: 'warning'
      });
    }
    
    if (health.services.network.status === 'down' || (health.services.network.latency || 0) > 1000) {
      suggestions.push({
        icon: 'wifi',
        text: '网络延迟过高，可能影响用户体验',
        severity: 'warning'
      });
    }

    if (suggestions.length === 0) return null;

    return (
      <View style={styles.suggestionsSection}>
        <Text style={styles.sectionTitle}>健康建议</Text>
        {suggestions.map((suggestion, index) => (
          <View 
            key={index} 
            style={[
              styles.suggestionItem,
              suggestion.severity === 'critical' && styles.suggestionCritical
            ]}
          >
            <Ionicons 
              name={suggestion.icon as any} 
              size={20} 
              color={suggestion.severity === 'critical' ? '#FF4444' : '#FFBB33'} 
            />
            <Text style={styles.suggestionText}>{suggestion.text}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>系统健康</Text>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
        >
          <Ionicons name="refresh" size={20} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* 内容 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>检查系统健康状态...</Text>
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
          {/* 整体状态 */}
          {renderOverallStatus()}

          {/* 快速操作 */}
          {renderQuickActions()}

          {/* 服务状态 */}
          {health && (
            <View style={styles.servicesSection}>
              <Text style={styles.sectionTitle}>服务状态</Text>
              <View style={styles.servicesGrid}>
                {renderServiceStatus('数据库', health.services.database, 'server')}
                {health.services.redis && renderServiceStatus('Redis缓存', health.services.redis, 'cube')}
                {renderServiceStatus('存储服务', health.services.storage, 'folder')}
                {renderServiceStatus('网络连接', health.services.network, 'wifi')}
              </View>
            </View>
          )}

          {/* 健康建议 */}
          {renderHealthSuggestions()}

          {/* 最后检查时间 */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              上次刷新: {lastCheckTime.toLocaleString('zh-CN')}
            </Text>
            <TouchableOpacity onPress={onRefresh}>
              <Text style={styles.footerLink}>立即刷新</Text>
            </TouchableOpacity>
          </View>
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
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  refreshButton: {
    padding: 4,
  },
  content: {
    flex: 1,
  },
  overallCard: {
    backgroundColor: 'white',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  overallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  overallInfo: {
    flex: 1,
    marginLeft: 16,
  },
  overallStatus: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 4,
  },
  overallTimestamp: {
    fontSize: 14,
    color: '#666666',
  },
  overallMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  overallMetricItem: {
    alignItems: 'center',
  },
  overallMetricLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  overallMetricValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#F57C00',
    marginLeft: 8,
  },
  quickActions: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 12,
    color: '#333333',
    marginTop: 4,
  },
  servicesSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  servicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  serviceCard: {
    flex: 1,
    minWidth: '48%',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 16,
    margin: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  serviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    marginLeft: 4,
    fontWeight: '500',
  },
  serviceMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  metricLabel: {
    fontSize: 12,
    color: '#666666',
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333333',
  },
  metricWarning: {
    color: '#FFBB33',
  },
  metricCritical: {
    color: '#FF4444',
  },
  serviceMessage: {
    fontSize: 12,
    color: '#666666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  serviceMessageError: {
    color: '#FF4444',
  },
  suggestionsSection: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#FFBB33',
  },
  suggestionCritical: {
    borderLeftColor: '#FF4444',
    backgroundColor: '#FFF5F5',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: '#333333',
    marginLeft: 12,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#999999',
  },
  footerLink: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
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

export default SystemHealthScreen;