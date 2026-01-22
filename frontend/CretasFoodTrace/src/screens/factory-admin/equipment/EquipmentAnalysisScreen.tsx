/**
 * 设备智能分析页面
 * Equipment Intelligent Analysis Screen
 *
 * 功能:
 * - 设备运行状态概览 (在线/离线/告警)
 * - 设备效率分析图表 (OEE、利用率)
 * - 预测性维护建议
 * - 异常事件时间线
 * - 设备对比分析
 * - ISAPI智能分析结果展示
 *
 * 后端API:
 * - GET /api/mobile/{factoryId}/equipment/analysis/overview
 * - GET /api/mobile/{factoryId}/equipment/analysis/efficiency
 * - GET /api/mobile/{factoryId}/equipment/analysis/maintenance
 * - GET /api/mobile/{factoryId}/equipment/analysis/anomalies
 * - GET /api/mobile/{factoryId}/equipment/isapi/events
 * - GET /api/mobile/{factoryId}/edge-gateway/status
 *
 * 角色: factory_super_admin, equipment_admin
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Icon,
  Surface,
  ProgressBar,
  ActivityIndicator,
  Chip,
  Button,
  Divider,
  SegmentedButtons,
} from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { FAManagementStackParamList } from '../../../types/navigation';
import { apiClient } from '../../../services/api/apiClient';
import { getCurrentFactoryId } from '../../../utils/factoryIdHelper';
import { useAuthStore } from '../../../store/authStore';
import { logger } from '../../../utils/logger';

// Create context logger
const analysisLogger = logger.createContextLogger('EquipmentAnalysis');

const screenWidth = Dimensions.get('window').width;

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'EquipmentAnalysis'>;

// ========== Type Definitions ==========

interface EquipmentStatusOverview {
  totalCount: number;
  onlineCount: number;
  offlineCount: number;
  alertCount: number;
  maintenanceCount: number;
  utilizationRate: number;
}

interface EquipmentEfficiency {
  overallOEE: number;
  availability: number;
  performance: number;
  quality: number;
  avgUtilizationRate: number;
  topPerformers: EquipmentPerformer[];
  bottomPerformers: EquipmentPerformer[];
}

interface EquipmentPerformer {
  id: number;
  name: string;
  oee: number;
  utilizationRate: number;
}

interface MaintenanceSuggestion {
  id: number;
  equipmentId: number;
  equipmentName: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  type: 'PREDICTIVE' | 'SCHEDULED' | 'CORRECTIVE';
  description: string;
  estimatedDate: string;
  confidence: number;
  potentialImpact: string;
}

interface AnomalyEvent {
  id: number;
  equipmentId: number;
  equipmentName: string;
  eventType: string;
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  description: string;
  timestamp: string;
  status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
  aiAnalysis?: string;
}

interface IsapiEvent {
  id: string;
  deviceId: string;
  deviceName: string;
  eventType: string;
  eventTime: string;
  smartResult?: {
    objectType: string;
    confidence: number;
    description: string;
  };
}

interface EdgeGatewayStatus {
  online: boolean;
  lastHeartbeat: string;
  connectedDevices: number;
  dataFlowRate: number;
  alerts: number;
}

// ========== Tab Types ==========

type AnalysisTab = 'overview' | 'efficiency' | 'maintenance' | 'anomalies' | 'isapi';

// ========== Component ==========

export function EquipmentAnalysisScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('equipment');
  const { user } = useAuthStore();
  const factoryId = getCurrentFactoryId();

  // Tab state
  const [activeTab, setActiveTab] = useState<AnalysisTab>('overview');

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [overview, setOverview] = useState<EquipmentStatusOverview | null>(null);
  const [efficiency, setEfficiency] = useState<EquipmentEfficiency | null>(null);
  const [maintenanceSuggestions, setMaintenanceSuggestions] = useState<MaintenanceSuggestion[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalyEvent[]>([]);
  const [isapiEvents, setIsapiEvents] = useState<IsapiEvent[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<EdgeGatewayStatus | null>(null);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Fetch all data
  const fetchData = useCallback(async () => {
    if (!factoryId) {
      setError('Factory ID not found');
      setLoading(false);
      return;
    }

    try {
      analysisLogger.info('Fetching equipment analysis data', { factoryId, activeTab });

      // Fetch data based on active tab
      const basePath = `/api/mobile/${factoryId}/equipment`;

      // Always fetch overview
      const overviewResponse = await apiClient.get(`${basePath}/analysis/overview`);
      if (overviewResponse.success && overviewResponse.data) {
        setOverview(overviewResponse.data);
      }

      // Fetch tab-specific data
      switch (activeTab) {
        case 'efficiency':
          const effResponse = await apiClient.get(`${basePath}/analysis/efficiency`);
          if (effResponse.success && effResponse.data) {
            setEfficiency(effResponse.data);
          }
          break;

        case 'maintenance':
          const maintResponse = await apiClient.get(`${basePath}/analysis/maintenance`);
          if (maintResponse.success && maintResponse.data) {
            setMaintenanceSuggestions(maintResponse.data);
          }
          break;

        case 'anomalies':
          const anomalyResponse = await apiClient.get(`${basePath}/analysis/anomalies`);
          if (anomalyResponse.success && anomalyResponse.data) {
            setAnomalies(anomalyResponse.data);
          }
          break;

        case 'isapi':
          const [isapiResponse, gatewayResponse] = await Promise.all([
            apiClient.get(`${basePath}/isapi/events`),
            apiClient.get(`/api/mobile/${factoryId}/edge-gateway/status`),
          ]);

          if (isapiResponse.success && isapiResponse.data) {
            setIsapiEvents(isapiResponse.data);
          }
          if (gatewayResponse.success && gatewayResponse.data) {
            setGatewayStatus(gatewayResponse.data);
          }
          break;
      }

      setError(null);
    } catch (err) {
      analysisLogger.error('Failed to fetch equipment analysis data', err as Error);
      setError('Failed to load analysis data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [factoryId, activeTab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  // ========== Status Overview Section ==========

  const renderStatusOverview = () => {
    if (!overview) return null;

    const statusItems = [
      {
        label: 'Online',
        value: overview.onlineCount,
        color: '#52c41a',
        icon: 'check-circle',
        percentage: overview.totalCount > 0 ? (overview.onlineCount / overview.totalCount) * 100 : 0,
      },
      {
        label: 'Offline',
        value: overview.offlineCount,
        color: '#8c8c8c',
        icon: 'close-circle',
        percentage: overview.totalCount > 0 ? (overview.offlineCount / overview.totalCount) * 100 : 0,
      },
      {
        label: 'Alert',
        value: overview.alertCount,
        color: '#ff4d4f',
        icon: 'alert-circle',
        percentage: overview.totalCount > 0 ? (overview.alertCount / overview.totalCount) * 100 : 0,
      },
      {
        label: 'Maintenance',
        value: overview.maintenanceCount,
        color: '#faad14',
        icon: 'wrench',
        percentage: overview.totalCount > 0 ? (overview.maintenanceCount / overview.totalCount) * 100 : 0,
      },
    ];

    return (
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Icon source="chart-donut" size={20} color="#667eea" />
          <Text style={styles.sectionTitle}>Equipment Status Overview</Text>
        </View>

        {/* Total Count */}
        <View style={styles.totalCountCard}>
          <Text style={styles.totalCountLabel}>Total Equipment</Text>
          <Text style={styles.totalCountValue}>{overview.totalCount}</Text>
          <View style={styles.utilizationRow}>
            <Text style={styles.utilizationLabel}>Overall Utilization</Text>
            <Text style={styles.utilizationValue}>{(overview.utilizationRate * 100).toFixed(1)}%</Text>
          </View>
          <ProgressBar
            progress={overview.utilizationRate}
            color="#667eea"
            style={styles.utilizationBar}
          />
        </View>

        {/* Status Grid */}
        <View style={styles.statusGrid}>
          {statusItems.map((item, index) => (
            <View key={index} style={styles.statusCard}>
              <View style={[styles.statusIcon, { backgroundColor: `${item.color}20` }]}>
                <Icon source={item.icon} size={24} color={item.color} />
              </View>
              <Text style={styles.statusValue}>{item.value}</Text>
              <Text style={styles.statusLabel}>{item.label}</Text>
              <Text style={[styles.statusPercentage, { color: item.color }]}>
                {item.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      </Surface>
    );
  };

  // ========== Efficiency Analysis Section ==========

  const renderEfficiencyAnalysis = () => {
    if (!efficiency) {
      return (
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <Icon source="chart-line" size={20} color="#667eea" />
            <Text style={styles.sectionTitle}>Efficiency Analysis</Text>
          </View>
          <View style={styles.emptyState}>
            <Icon source="chart-timeline-variant" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No efficiency data available</Text>
          </View>
        </Surface>
      );
    }

    const oeeComponents = [
      { label: 'Availability', value: efficiency.availability, color: '#52c41a' },
      { label: 'Performance', value: efficiency.performance, color: '#1890ff' },
      { label: 'Quality', value: efficiency.quality, color: '#722ed1' },
    ];

    return (
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Icon source="chart-line" size={20} color="#667eea" />
          <Text style={styles.sectionTitle}>Efficiency Analysis</Text>
        </View>

        {/* Overall OEE */}
        <View style={styles.oeeCard}>
          <View style={styles.oeeCircle}>
            <Text style={styles.oeeValue}>{(efficiency.overallOEE * 100).toFixed(1)}%</Text>
            <Text style={styles.oeeLabel}>OEE</Text>
          </View>
          <View style={styles.oeeComponents}>
            {oeeComponents.map((comp, index) => (
              <View key={index} style={styles.oeeComponentItem}>
                <View style={styles.oeeComponentHeader}>
                  <Text style={styles.oeeComponentLabel}>{comp.label}</Text>
                  <Text style={[styles.oeeComponentValue, { color: comp.color }]}>
                    {(comp.value * 100).toFixed(1)}%
                  </Text>
                </View>
                <ProgressBar
                  progress={comp.value}
                  color={comp.color}
                  style={styles.oeeComponentBar}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Top Performers */}
        {efficiency.topPerformers && efficiency.topPerformers.length > 0 && (
          <View style={styles.performersSection}>
            <Text style={styles.performersTitle}>Top Performers</Text>
            {efficiency.topPerformers.slice(0, 3).map((equipment, index) => (
              <TouchableOpacity
                key={equipment.id}
                style={styles.performerItem}
                onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: equipment.id })}
              >
                <View style={[styles.performerRank, { backgroundColor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : '#cd7f32' }]}>
                  <Text style={styles.performerRankText}>{index + 1}</Text>
                </View>
                <View style={styles.performerInfo}>
                  <Text style={styles.performerName}>{equipment.name}</Text>
                  <Text style={styles.performerOee}>OEE: {(equipment.oee * 100).toFixed(1)}%</Text>
                </View>
                <Icon source="chevron-right" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom Performers */}
        {efficiency.bottomPerformers && efficiency.bottomPerformers.length > 0 && (
          <View style={styles.performersSection}>
            <Text style={[styles.performersTitle, { color: '#ff4d4f' }]}>Needs Improvement</Text>
            {efficiency.bottomPerformers.slice(0, 3).map((equipment) => (
              <TouchableOpacity
                key={equipment.id}
                style={styles.performerItem}
                onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: equipment.id })}
              >
                <View style={[styles.performerRank, { backgroundColor: '#ff4d4f20' }]}>
                  <Icon source="alert" size={16} color="#ff4d4f" />
                </View>
                <View style={styles.performerInfo}>
                  <Text style={styles.performerName}>{equipment.name}</Text>
                  <Text style={[styles.performerOee, { color: '#ff4d4f' }]}>
                    OEE: {(equipment.oee * 100).toFixed(1)}%
                  </Text>
                </View>
                <Icon source="chevron-right" size={20} color="#999" />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Surface>
    );
  };

  // ========== Maintenance Suggestions Section ==========

  const renderMaintenanceSuggestions = () => {
    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'HIGH':
          return '#ff4d4f';
        case 'MEDIUM':
          return '#faad14';
        case 'LOW':
          return '#52c41a';
        default:
          return '#8c8c8c';
      }
    };

    const getTypeIcon = (type: string) => {
      switch (type) {
        case 'PREDICTIVE':
          return 'brain';
        case 'SCHEDULED':
          return 'calendar-clock';
        case 'CORRECTIVE':
          return 'wrench';
        default:
          return 'cog';
      }
    };

    return (
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Icon source="wrench-clock" size={20} color="#667eea" />
          <Text style={styles.sectionTitle}>Predictive Maintenance</Text>
        </View>

        {maintenanceSuggestions.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="check-circle" size={48} color="#52c41a" />
            <Text style={styles.emptyText}>All equipment in good condition</Text>
            <Text style={styles.emptySubtext}>No maintenance required</Text>
          </View>
        ) : (
          maintenanceSuggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.id}
              style={styles.maintenanceCard}
              onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: suggestion.equipmentId })}
            >
              <View style={styles.maintenanceHeader}>
                <View style={styles.maintenanceLeft}>
                  <View style={[styles.maintenanceIcon, { backgroundColor: `${getPriorityColor(suggestion.priority)}20` }]}>
                    <Icon source={getTypeIcon(suggestion.type)} size={20} color={getPriorityColor(suggestion.priority)} />
                  </View>
                  <View style={styles.maintenanceInfo}>
                    <Text style={styles.maintenanceName}>{suggestion.equipmentName}</Text>
                    <Chip
                      mode="flat"
                      style={[styles.priorityChip, { backgroundColor: `${getPriorityColor(suggestion.priority)}20` }]}
                      textStyle={{ color: getPriorityColor(suggestion.priority), fontSize: 10 }}
                    >
                      {suggestion.priority} PRIORITY
                    </Chip>
                  </View>
                </View>
                <View style={styles.confidenceBadge}>
                  <Text style={styles.confidenceValue}>{(suggestion.confidence * 100).toFixed(0)}%</Text>
                  <Text style={styles.confidenceLabel}>Confidence</Text>
                </View>
              </View>

              <Text style={styles.maintenanceDescription}>{suggestion.description}</Text>

              <View style={styles.maintenanceFooter}>
                <View style={styles.maintenanceDate}>
                  <Icon source="calendar" size={14} color="#999" />
                  <Text style={styles.maintenanceDateText}>
                    Est. {new Date(suggestion.estimatedDate).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.maintenanceImpact}>{suggestion.potentialImpact}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </Surface>
    );
  };

  // ========== Anomalies Timeline Section ==========

  const renderAnomaliesTimeline = () => {
    const getSeverityColor = (severity: string) => {
      switch (severity) {
        case 'CRITICAL':
          return '#ff4d4f';
        case 'WARNING':
          return '#faad14';
        case 'INFO':
          return '#1890ff';
        default:
          return '#8c8c8c';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'ACTIVE':
          return 'alert-circle';
        case 'ACKNOWLEDGED':
          return 'eye';
        case 'RESOLVED':
          return 'check-circle';
        default:
          return 'help-circle';
      }
    };

    return (
      <Surface style={styles.section} elevation={1}>
        <View style={styles.sectionHeader}>
          <Icon source="timeline-clock" size={20} color="#667eea" />
          <Text style={styles.sectionTitle}>Anomaly Events Timeline</Text>
        </View>

        {anomalies.length === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="shield-check" size={48} color="#52c41a" />
            <Text style={styles.emptyText}>No anomalies detected</Text>
            <Text style={styles.emptySubtext}>Equipment running normally</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {anomalies.map((anomaly, index) => (
              <TouchableOpacity
                key={anomaly.id}
                style={styles.timelineItem}
                onPress={() => navigation.navigate('EquipmentDetail', { equipmentId: anomaly.equipmentId })}
              >
                {/* Timeline connector */}
                {index < anomalies.length - 1 && <View style={styles.timelineConnector} />}

                {/* Timeline dot */}
                <View style={[styles.timelineDot, { backgroundColor: getSeverityColor(anomaly.severity) }]}>
                  <Icon source={getStatusIcon(anomaly.status)} size={12} color="#fff" />
                </View>

                {/* Content */}
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <Text style={styles.timelineEquipment}>{anomaly.equipmentName}</Text>
                    <Chip
                      mode="flat"
                      style={[styles.severityChip, { backgroundColor: `${getSeverityColor(anomaly.severity)}20` }]}
                      textStyle={{ color: getSeverityColor(anomaly.severity), fontSize: 10 }}
                    >
                      {anomaly.severity}
                    </Chip>
                  </View>
                  <Text style={styles.timelineDescription}>{anomaly.description}</Text>
                  {anomaly.aiAnalysis && (
                    <View style={styles.aiAnalysisBox}>
                      <Icon source="robot" size={14} color="#667eea" />
                      <Text style={styles.aiAnalysisText}>{anomaly.aiAnalysis}</Text>
                    </View>
                  )}
                  <Text style={styles.timelineTime}>
                    {new Date(anomaly.timestamp).toLocaleString()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Surface>
    );
  };

  // ========== ISAPI Events Section ==========

  const renderIsapiEvents = () => {
    return (
      <>
        {/* Edge Gateway Status */}
        {gatewayStatus && (
          <Surface style={styles.section} elevation={1}>
            <View style={styles.sectionHeader}>
              <Icon source="router-wireless" size={20} color="#667eea" />
              <Text style={styles.sectionTitle}>Edge Gateway Status</Text>
            </View>

            <View style={styles.gatewayStatusCard}>
              <View style={styles.gatewayStatusRow}>
                <View style={styles.gatewayStatusItem}>
                  <View style={[
                    styles.gatewayStatusDot,
                    { backgroundColor: gatewayStatus.online ? '#52c41a' : '#ff4d4f' }
                  ]} />
                  <Text style={styles.gatewayStatusLabel}>
                    {gatewayStatus.online ? 'Online' : 'Offline'}
                  </Text>
                </View>
                <Text style={styles.gatewayLastHeartbeat}>
                  Last: {new Date(gatewayStatus.lastHeartbeat).toLocaleTimeString()}
                </Text>
              </View>

              <View style={styles.gatewayMetrics}>
                <View style={styles.gatewayMetricItem}>
                  <Icon source="devices" size={20} color="#1890ff" />
                  <Text style={styles.gatewayMetricValue}>{gatewayStatus.connectedDevices}</Text>
                  <Text style={styles.gatewayMetricLabel}>Devices</Text>
                </View>
                <View style={styles.gatewayMetricItem}>
                  <Icon source="swap-vertical" size={20} color="#52c41a" />
                  <Text style={styles.gatewayMetricValue}>{gatewayStatus.dataFlowRate}</Text>
                  <Text style={styles.gatewayMetricLabel}>Data/s</Text>
                </View>
                <View style={styles.gatewayMetricItem}>
                  <Icon source="alert" size={20} color="#faad14" />
                  <Text style={styles.gatewayMetricValue}>{gatewayStatus.alerts}</Text>
                  <Text style={styles.gatewayMetricLabel}>Alerts</Text>
                </View>
              </View>
            </View>
          </Surface>
        )}

        {/* ISAPI Smart Events */}
        <Surface style={styles.section} elevation={1}>
          <View style={styles.sectionHeader}>
            <Icon source="camera-iris" size={20} color="#667eea" />
            <Text style={styles.sectionTitle}>ISAPI Smart Analysis Events</Text>
          </View>

          {isapiEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Icon source="camera-off" size={48} color="#ccc" />
              <Text style={styles.emptyText}>No ISAPI events</Text>
              <Text style={styles.emptySubtext}>Configure smart analysis in device settings</Text>
            </View>
          ) : (
            isapiEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={styles.isapiEventCard}
                onPress={() => navigation.navigate('IsapiDeviceDetail', { deviceId: event.deviceId })}
              >
                <View style={styles.isapiEventHeader}>
                  <View style={styles.isapiEventIcon}>
                    <Icon source="cctv" size={20} color="#667eea" />
                  </View>
                  <View style={styles.isapiEventInfo}>
                    <Text style={styles.isapiEventDevice}>{event.deviceName}</Text>
                    <Text style={styles.isapiEventType}>{event.eventType}</Text>
                  </View>
                  <Text style={styles.isapiEventTime}>
                    {new Date(event.eventTime).toLocaleTimeString()}
                  </Text>
                </View>

                {event.smartResult && (
                  <View style={styles.smartResultBox}>
                    <View style={styles.smartResultHeader}>
                      <Icon source="robot" size={14} color="#667eea" />
                      <Text style={styles.smartResultTitle}>AI Analysis Result</Text>
                      <Chip
                        mode="flat"
                        style={styles.confidenceChip}
                        textStyle={{ fontSize: 10, color: '#667eea' }}
                      >
                        {(event.smartResult.confidence * 100).toFixed(0)}%
                      </Chip>
                    </View>
                    <Text style={styles.smartResultDescription}>
                      <Text style={styles.smartResultLabel}>Object: </Text>
                      {event.smartResult.objectType}
                    </Text>
                    <Text style={styles.smartResultDescription}>
                      {event.smartResult.description}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </Surface>
      </>
    );
  };

  // ========== Tab Content Renderer ==========

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderStatusOverview();
      case 'efficiency':
        return renderEfficiencyAnalysis();
      case 'maintenance':
        return renderMaintenanceSuggestions();
      case 'anomalies':
        return renderAnomaliesTimeline();
      case 'isapi':
        return renderIsapiEvents();
      default:
        return null;
    }
  };

  // ========== Loading State ==========

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon source="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Equipment Analysis</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading analysis data...</Text>
        </View>
      </View>
    );
  }

  // ========== Error State ==========

  if (error && !overview) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon source="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Equipment Analysis</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#ff4d4f" />
          <Text style={styles.errorText}>{error}</Text>
          <Button mode="contained" onPress={fetchData} style={styles.retryButton}>
            Retry
          </Button>
        </View>
      </View>
    );
  }

  // ========== Main Render ==========

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Equipment Analysis</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('EquipmentList')}
          style={styles.headerAction}
        >
          <Icon source="cog" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScrollContent}
        >
          {[
            { key: 'overview', label: 'Overview', icon: 'chart-donut' },
            { key: 'efficiency', label: 'Efficiency', icon: 'chart-line' },
            { key: 'maintenance', label: 'Maintenance', icon: 'wrench-clock' },
            { key: 'anomalies', label: 'Anomalies', icon: 'timeline-clock' },
            { key: 'isapi', label: 'ISAPI', icon: 'camera-iris' },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key as AnalysisTab)}
            >
              <Icon
                source={tab.icon}
                size={18}
                color={activeTab === tab.key ? '#667eea' : '#999'}
              />
              <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#667eea']}
          />
        }
      >
        {renderTabContent()}
        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

// ========== Styles ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
    backgroundColor: '#667eea',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerAction: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 14,
    color: '#ff4d4f',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabScrollContent: {
    paddingHorizontal: 12,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#667eea',
  },
  tabLabel: {
    marginLeft: 6,
    fontSize: 14,
    color: '#999',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#667eea',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 12,
    color: '#999',
  },

  // Status Overview Styles
  totalCountCard: {
    backgroundColor: '#f0f3ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalCountLabel: {
    fontSize: 13,
    color: '#666',
  },
  totalCountValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#667eea',
    marginVertical: 8,
  },
  utilizationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  utilizationLabel: {
    fontSize: 13,
    color: '#666',
  },
  utilizationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  utilizationBar: {
    height: 8,
    borderRadius: 4,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statusCard: {
    width: (screenWidth - 32 - 16 - 24) / 2,
    margin: 6,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a202c',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  statusPercentage: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  // OEE Styles
  oeeCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  oeeCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f3ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  oeeValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#667eea',
  },
  oeeLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  oeeComponents: {
    flex: 1,
    justifyContent: 'center',
  },
  oeeComponentItem: {
    marginBottom: 12,
  },
  oeeComponentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  oeeComponentLabel: {
    fontSize: 13,
    color: '#666',
  },
  oeeComponentValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  oeeComponentBar: {
    height: 6,
    borderRadius: 3,
  },
  performersSection: {
    marginTop: 8,
  },
  performersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#52c41a',
    marginBottom: 12,
  },
  performerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  performerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  performerRankText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  performerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  performerName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a202c',
  },
  performerOee: {
    fontSize: 12,
    color: '#52c41a',
    marginTop: 2,
  },

  // Maintenance Styles
  maintenanceCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  maintenanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  maintenanceLeft: {
    flexDirection: 'row',
    flex: 1,
  },
  maintenanceIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maintenanceInfo: {
    marginLeft: 12,
    flex: 1,
  },
  maintenanceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 4,
  },
  priorityChip: {
    alignSelf: 'flex-start',
  },
  confidenceBadge: {
    alignItems: 'center',
  },
  confidenceValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#667eea',
  },
  confidenceLabel: {
    fontSize: 10,
    color: '#999',
  },
  maintenanceDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  maintenanceFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  maintenanceDate: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  maintenanceDateText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#999',
  },
  maintenanceImpact: {
    fontSize: 12,
    color: '#ff4d4f',
    fontWeight: '500',
  },

  // Timeline Styles
  timeline: {
    paddingLeft: 8,
  },
  timelineItem: {
    flexDirection: 'row',
    paddingLeft: 16,
    paddingBottom: 20,
    position: 'relative',
  },
  timelineConnector: {
    position: 'absolute',
    left: 11,
    top: 24,
    width: 2,
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineEquipment: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  severityChip: {
    height: 22,
  },
  timelineDescription: {
    fontSize: 13,
    color: '#666',
    lineHeight: 20,
  },
  aiAnalysisBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f0f3ff',
    borderRadius: 8,
  },
  aiAnalysisText: {
    flex: 1,
    marginLeft: 6,
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
  },
  timelineTime: {
    marginTop: 8,
    fontSize: 11,
    color: '#999',
  },

  // ISAPI Styles
  gatewayStatusCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
  },
  gatewayStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gatewayStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gatewayStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  gatewayStatusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  gatewayLastHeartbeat: {
    fontSize: 12,
    color: '#999',
  },
  gatewayMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  gatewayMetricItem: {
    alignItems: 'center',
  },
  gatewayMetricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a202c',
    marginTop: 4,
  },
  gatewayMetricLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  isapiEventCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  isapiEventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  isapiEventIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f3ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  isapiEventInfo: {
    flex: 1,
    marginLeft: 12,
  },
  isapiEventDevice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a202c',
  },
  isapiEventType: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  isapiEventTime: {
    fontSize: 11,
    color: '#999',
  },
  smartResultBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f0f3ff',
    borderRadius: 8,
  },
  smartResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  smartResultTitle: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
  },
  confidenceChip: {
    marginLeft: 8,
    backgroundColor: '#fff',
  },
  smartResultDescription: {
    fontSize: 12,
    color: '#4a5568',
    lineHeight: 18,
  },
  smartResultLabel: {
    fontWeight: '600',
  },
});

export default EquipmentAnalysisScreen;
