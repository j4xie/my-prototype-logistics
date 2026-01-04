import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  ActivityIndicator,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

type Props = NativeStackScreenProps<PlatformStackParamList, 'SystemHealth'>;

interface ServiceStatus {
  name: string;
  serviceName: string;
  status: 'running' | 'warning' | 'error' | 'maintenance';
  statusLabel: string;
}

interface InfrastructureStatus {
  name: string;
  address: string;
  status: 'normal' | 'warning' | 'error' | 'maintenance';
  statusLabel: string;
}

interface HealthCheck {
  name: string;
  time: string;
  result: 'passed' | 'warning' | 'failed';
  description: string;
}

export default function SystemHealthScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Health score
  const [healthScore, setHealthScore] = useState(98);

  // Health statistics
  const [healthStats, setHealthStats] = useState({
    normal: 8,
    warning: 1,
    error: 0,
    maintenance: 1,
  });

  // Core services
  const [coreServices, setCoreServices] = useState<ServiceStatus[]>([
    { name: 'API Gateway', serviceName: 'gateway-service', status: 'running', statusLabel: 'Running' },
    { name: 'User Service', serviceName: 'user-service', status: 'running', statusLabel: 'Running' },
    { name: 'Production Service', serviceName: 'production-service', status: 'running', statusLabel: 'Running' },
    { name: 'AI Service', serviceName: 'ai-service', status: 'warning', statusLabel: 'Warning' },
    { name: 'Rule Engine', serviceName: 'drools-service', status: 'running', statusLabel: 'Running' },
  ]);

  // Infrastructure
  const [infrastructure, setInfrastructure] = useState<InfrastructureStatus[]>([
    { name: 'MySQL Master', address: '139.196.165.140:3306', status: 'normal', statusLabel: 'Normal' },
    { name: 'Redis Cache', address: '139.196.165.140:6379', status: 'normal', statusLabel: 'Normal' },
    { name: 'File Storage', address: 'OSS Service', status: 'normal', statusLabel: 'Normal' },
    { name: 'Message Queue', address: 'Scheduled Maintenance', status: 'maintenance', statusLabel: 'Maintenance' },
  ]);

  // Recent health checks
  const [recentChecks, setRecentChecks] = useState<HealthCheck[]>([
    { name: 'Auto Health Check', time: '2 min ago', result: 'passed', description: 'All services responding normally' },
    { name: 'Database Connection Check', time: '5 min ago', result: 'passed', description: 'Connection pool status normal' },
    { name: 'AI Service Response Check', time: '10 min ago', result: 'warning', description: 'Response time exceeds threshold (>2s)' },
    { name: 'Disk Space Check', time: '15 min ago', result: 'passed', description: 'Sufficient space remaining (55%)' },
  ]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setLoading(false);
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'running':
      case 'normal':
      case 'passed':
        return '#52c41a';
      case 'warning':
        return '#faad14';
      case 'error':
      case 'failed':
        return '#f5222d';
      case 'maintenance':
        return '#8c8c8c';
      default:
        return '#8c8c8c';
    }
  };

  const getHealthGradient = (): [string, string] => {
    if (healthScore >= 90) return ['#52c41a', '#389e0d'];
    if (healthScore >= 70) return ['#faad14', '#d48806'];
    return ['#f5222d', '#cf1322'];
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
          <View style={styles.headerContent}>
            <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>Health Status</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading health status...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Health Status</Text>
          <IconButton icon="refresh" iconColor="#fff" onPress={handleRefresh} />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Health Score */}
        <LinearGradient colors={getHealthGradient()} style={styles.healthCard}>
          <View style={styles.healthCardContent}>
            <View>
              <Text style={styles.healthLabel}>System Health</Text>
              <Text style={styles.healthScore}>{healthScore}%</Text>
              <Text style={styles.healthDescription}>All core services running normally</Text>
            </View>
            <View style={styles.healthIcon}>
              <IconButton icon="heart-pulse" iconColor="#fff" size={40} />
            </View>
          </View>
        </LinearGradient>

        {/* Health Statistics */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#52c41a' }]}>{healthStats.normal}</Text>
            <Text style={styles.statLabel}>Normal</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#faad14' }]}>{healthStats.warning}</Text>
            <Text style={styles.statLabel}>Warning</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#f5222d' }]}>{healthStats.error}</Text>
            <Text style={styles.statLabel}>Error</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: '#8c8c8c' }]}>{healthStats.maintenance}</Text>
            <Text style={styles.statLabel}>Maintenance</Text>
          </View>
        </View>

        {/* Core Services */}
        <Text style={styles.sectionTitle}>Core Services</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.noPadding}>
            {coreServices.map((service, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity style={styles.serviceItem}>
                  <View style={styles.serviceLeft}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(service.status) }]} />
                    <View>
                      <Text style={styles.serviceName}>{service.name}</Text>
                      <Text style={[
                        styles.serviceDetail,
                        service.status === 'warning' && { color: '#faad14' }
                      ]}>
                        {service.status === 'warning' ? 'Slow Response' : service.serviceName}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.serviceRight}>
                    <Text style={[styles.serviceStatus, { color: getStatusColor(service.status) }]}>
                      {service.statusLabel}
                    </Text>
                    <IconButton icon="chevron-right" iconColor="#8c8c8c" size={16} style={styles.chevron} />
                  </View>
                </TouchableOpacity>
                {index < coreServices.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>

        {/* Infrastructure */}
        <Text style={styles.sectionTitle}>Infrastructure</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.noPadding}>
            {infrastructure.map((infra, index) => (
              <React.Fragment key={index}>
                <TouchableOpacity style={styles.serviceItem}>
                  <View style={styles.serviceLeft}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(infra.status) }]} />
                    <View>
                      <Text style={styles.serviceName}>{infra.name}</Text>
                      <Text style={styles.serviceDetail}>{infra.address}</Text>
                    </View>
                  </View>
                  <View style={styles.serviceRight}>
                    <Text style={[styles.serviceStatus, { color: getStatusColor(infra.status) }]}>
                      {infra.statusLabel}
                    </Text>
                    <IconButton icon="chevron-right" iconColor="#8c8c8c" size={16} style={styles.chevron} />
                  </View>
                </TouchableOpacity>
                {index < infrastructure.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>

        {/* Recent Checks */}
        <Text style={styles.sectionTitle}>Recent Checks</Text>
        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.noPadding}>
            {recentChecks.map((check, index) => (
              <React.Fragment key={index}>
                <View style={styles.checkItem}>
                  <View style={styles.checkHeader}>
                    <Text style={styles.checkName}>{check.name}</Text>
                    <Text style={[styles.checkResult, { color: getStatusColor(check.result) }]}>
                      {check.result === 'passed' ? 'Passed' : check.result === 'warning' ? 'Warning' : 'Failed'}
                    </Text>
                  </View>
                  <Text style={styles.checkDescription}>{check.time} - {check.description}</Text>
                </View>
                {index < recentChecks.length - 1 && <Divider />}
              </React.Fragment>
            ))}
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
  healthCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  healthCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  healthScore: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  healthDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  healthIcon: {
    width: 80,
    height: 80,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 12,
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  noPadding: {
    paddingHorizontal: 0,
  },
  serviceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  serviceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  serviceName: {
    fontSize: 14,
    color: '#262626',
  },
  serviceDetail: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  serviceRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  serviceStatus: {
    fontSize: 12,
  },
  chevron: {
    margin: 0,
    marginLeft: 4,
  },
  checkItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  checkHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  checkName: {
    fontSize: 14,
    color: '#262626',
  },
  checkResult: {
    fontSize: 12,
  },
  checkDescription: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  bottomPadding: {
    height: 20,
  },
});
