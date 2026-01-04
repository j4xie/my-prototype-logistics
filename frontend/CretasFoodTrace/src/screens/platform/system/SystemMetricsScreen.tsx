import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  IconButton,
  ProgressBar,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

type Props = NativeStackScreenProps<PlatformStackParamList, 'SystemMetrics'>;

interface CoreMetric {
  label: string;
  value: number;
  status: 'normal' | 'warning' | 'danger';
  color: string;
}

interface DatabaseStatus {
  name: string;
  icon: string;
  color: string;
  status: string;
  metric: string;
  metricLabel: string;
}

interface JvmStats {
  heapUsed: string;
  heapMax: string;
  heapPercent: number;
  nonHeapUsed: string;
  nonHeapMax: string;
  nonHeapPercent: number;
  youngGc: number;
  fullGc: number;
  threads: number;
}

const { width } = Dimensions.get('window');

export default function SystemMetricsScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // System status
  const [systemStatus, setSystemStatus] = useState({
    status: 'running',
    uptime: '15d 8h',
    lastUpdate: 'now',
  });

  // Core metrics
  const [coreMetrics, setCoreMetrics] = useState<CoreMetric[]>([
    { label: 'CPU', value: 32, status: 'normal', color: '#52c41a' },
    { label: 'Memory', value: 68, status: 'warning', color: '#faad14' },
    { label: 'Disk', value: 45, status: 'normal', color: '#1890ff' },
    { label: 'Network', value: 23, status: 'normal', color: '#722ed1' },
  ]);

  // API performance
  const [apiStats, setApiStats] = useState({
    requestsPerMin: 1256,
    avgResponse: 128,
    successRate: 99.8,
  });

  // Database status
  const [databaseStatus, setDatabaseStatus] = useState<DatabaseStatus[]>([
    { name: 'MySQL Master', icon: 'M', color: '#1890ff', status: 'Connected', metric: '45/100', metricLabel: 'Connections' },
    { name: 'MySQL Slave', icon: 'S', color: '#52c41a', status: 'Synced', metric: '0ms', metricLabel: 'Latency' },
    { name: 'Redis Cache', icon: 'R', color: '#f5222d', status: 'Running', metric: '85%', metricLabel: 'Hit Rate' },
  ]);

  // JVM stats
  const [jvmStats, setJvmStats] = useState<JvmStats>({
    heapUsed: '1.2G',
    heapMax: '2G',
    heapPercent: 60,
    nonHeapUsed: '180M',
    nonHeapMax: '512M',
    nonHeapPercent: 35,
    youngGc: 23,
    fullGc: 2,
    threads: 156,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoading(false);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'normal': return 'Normal';
      case 'warning': return 'High';
      case 'danger': return 'Critical';
      default: return 'Normal';
    }
  };

  const getMetricGradient = (status: string): [string, string] => {
    switch (status) {
      case 'warning': return ['#faad14', '#ffc53d'];
      case 'danger': return ['#ff4d4f', '#ff7875'];
      default: return ['#52c41a', '#73d13d'];
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
          <View style={styles.headerContent}>
            <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>System Metrics</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading metrics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>System Metrics</Text>
          <IconButton icon="refresh" iconColor="#fff" onPress={handleRefresh} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* System Status Overview */}
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={styles.statusLabel}>System Status</Text>
              <Text style={styles.statusValue}>Running Normal</Text>
            </View>
            <View style={styles.statusIcon}>
              <IconButton icon="check" iconColor="#52c41a" size={24} />
            </View>
          </View>
          <View style={styles.statusTags}>
            <View style={styles.statusTag}>
              <Text style={styles.statusTagText}>Uptime: {systemStatus.uptime}</Text>
            </View>
            <View style={styles.statusTag}>
              <Text style={styles.statusTagText}>Last Update: {systemStatus.lastUpdate}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Core Metrics */}
        <Text style={styles.sectionTitle}>Core Metrics</Text>
        <View style={styles.metricsGrid}>
          {coreMetrics.map((metric, index) => (
            <Card key={index} style={styles.metricCard} mode="elevated">
              <Card.Content style={styles.metricCardContent}>
                <View style={styles.metricHeader}>
                  <Text style={styles.metricLabel}>{metric.label} Usage</Text>
                  <Text style={[styles.metricStatus, { color: metric.color }]}>
                    {getStatusLabel(metric.status)}
                  </Text>
                </View>
                <Text style={styles.metricValue}>{metric.value}%</Text>
                <View style={styles.progressContainer}>
                  <ProgressBar
                    progress={metric.value / 100}
                    color={metric.color}
                    style={styles.progressBar}
                  />
                </View>
              </Card.Content>
            </Card>
          ))}
        </View>

        {/* API Performance */}
        <Text style={styles.sectionTitle}>API Performance</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            <View style={styles.apiStatsRow}>
              <View style={styles.apiStatItem}>
                <Text style={[styles.apiStatValue, { color: '#1890ff' }]}>{apiStats.requestsPerMin.toLocaleString()}</Text>
                <Text style={styles.apiStatLabel}>Req/min</Text>
              </View>
              <View style={styles.apiStatItem}>
                <Text style={[styles.apiStatValue, { color: '#52c41a' }]}>{apiStats.avgResponse}ms</Text>
                <Text style={styles.apiStatLabel}>Avg Response</Text>
              </View>
              <View style={styles.apiStatItem}>
                <Text style={[styles.apiStatValue, { color: '#722ed1' }]}>{apiStats.successRate}%</Text>
                <Text style={styles.apiStatLabel}>Success Rate</Text>
              </View>
            </View>

            {/* Response Time Trend (Simplified) */}
            <View style={styles.trendContainer}>
              <View style={styles.trendChart}>
                {[40, 35, 42, 30, 28, 32, 25].map((height, i) => (
                  <View
                    key={i}
                    style={[
                      styles.trendBar,
                      { height: height, backgroundColor: '#1890ff' + (i === 6 ? '' : '80') },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.trendLabels}>
                <Text style={styles.trendLabel}>12:00</Text>
                <Text style={styles.trendLabel}>13:00</Text>
                <Text style={styles.trendLabel}>14:00</Text>
                <Text style={styles.trendLabel}>15:00</Text>
                <Text style={styles.trendLabel}>Now</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Database Performance */}
        <Text style={styles.sectionTitle}>Database Performance</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.noPadding}>
            {databaseStatus.map((db, index) => (
              <React.Fragment key={index}>
                <View style={styles.dbItem}>
                  <View style={styles.dbLeft}>
                    <View style={[styles.dbIcon, { backgroundColor: db.color }]}>
                      <Text style={styles.dbIconText}>{db.icon}</Text>
                    </View>
                    <View>
                      <Text style={styles.dbName}>{db.name}</Text>
                      <Text style={[styles.dbStatus, { color: '#52c41a' }]}>{db.status}</Text>
                    </View>
                  </View>
                  <View style={styles.dbRight}>
                    <Text style={styles.dbMetric}>{db.metric}</Text>
                    <Text style={styles.dbMetricLabel}>{db.metricLabel}</Text>
                  </View>
                </View>
                {index < databaseStatus.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>

        {/* JVM Performance */}
        <Text style={styles.sectionTitle}>JVM Performance</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content>
            {/* Heap Memory */}
            <View style={styles.jvmItem}>
              <View style={styles.jvmHeader}>
                <Text style={styles.jvmLabel}>Heap Memory</Text>
                <Text style={styles.jvmValue}>{jvmStats.heapUsed} / {jvmStats.heapMax}</Text>
              </View>
              <ProgressBar
                progress={jvmStats.heapPercent / 100}
                color="#1890ff"
                style={styles.jvmProgress}
              />
            </View>

            {/* Non-Heap Memory */}
            <View style={styles.jvmItem}>
              <View style={styles.jvmHeader}>
                <Text style={styles.jvmLabel}>Non-Heap Memory</Text>
                <Text style={styles.jvmValue}>{jvmStats.nonHeapUsed} / {jvmStats.nonHeapMax}</Text>
              </View>
              <ProgressBar
                progress={jvmStats.nonHeapPercent / 100}
                color="#52c41a"
                style={styles.jvmProgress}
              />
            </View>

            {/* GC Stats */}
            <View style={styles.gcStatsRow}>
              <View style={styles.gcStatItem}>
                <Text style={styles.gcStatValue}>{jvmStats.youngGc}</Text>
                <Text style={styles.gcStatLabel}>Young GC</Text>
              </View>
              <View style={styles.gcStatItem}>
                <Text style={styles.gcStatValue}>{jvmStats.fullGc}</Text>
                <Text style={styles.gcStatLabel}>Full GC</Text>
              </View>
              <View style={styles.gcStatItem}>
                <Text style={styles.gcStatValue}>{jvmStats.threads}</Text>
                <Text style={styles.gcStatLabel}>Threads</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingBottom: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  statusCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  statusValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  statusIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(82,196,26,0.2)',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 4,
  },
  statusTagText: {
    fontSize: 12,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    width: (width - 44) / 2,
    backgroundColor: '#fff',
  },
  metricCardContent: {
    padding: 12,
  },
  metricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  metricLabel: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  metricStatus: {
    fontSize: 11,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 8,
  },
  progressContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  apiStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  apiStatItem: {
    alignItems: 'center',
  },
  apiStatValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  apiStatLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  trendContainer: {
    marginTop: 8,
  },
  trendChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 60,
    marginBottom: 8,
  },
  trendBar: {
    width: (width - 80) / 7,
    borderRadius: 2,
  },
  trendLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendLabel: {
    fontSize: 10,
    color: '#8c8c8c',
  },
  noPadding: {
    paddingHorizontal: 0,
  },
  dbItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  dbLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dbIcon: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dbIconText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  dbName: {
    fontSize: 14,
    color: '#262626',
  },
  dbStatus: {
    fontSize: 11,
  },
  dbRight: {
    alignItems: 'flex-end',
  },
  dbMetric: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  dbMetricLabel: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  jvmItem: {
    marginBottom: 16,
  },
  jvmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  jvmLabel: {
    fontSize: 14,
    color: '#262626',
  },
  jvmValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  jvmProgress: {
    height: 8,
    borderRadius: 4,
  },
  gcStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  gcStatItem: {
    flex: 1,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    alignItems: 'center',
  },
  gcStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  gcStatLabel: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  bottomPadding: {
    height: 20,
  },
});
