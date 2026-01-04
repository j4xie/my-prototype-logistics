import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  Button,
  ActivityIndicator,
  Divider,
  Portal,
  Modal,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

type Props = NativeStackScreenProps<PlatformStackParamList, 'SystemAlerts'>;

interface SystemAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  time: string;
  description: string;
  status: 'pending' | 'resolved';
  actions?: { label: string; color: string }[];
  resolvedInfo?: {
    method: string;
    handler: string;
  };
}

const SEVERITY_CONFIG = {
  critical: { label: 'Critical', color: '#f5222d', bgColor: '#fff1f0', borderColor: '#f5222d' },
  warning: { label: 'Warning', color: '#d48806', bgColor: '#fffbe6', borderColor: '#faad14' },
  info: { label: 'Info', color: '#096dd9', bgColor: '#e6f7ff', borderColor: '#1890ff' },
};

export default function SystemAlertsScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<SystemAlert | null>(null);
  const [actionModalVisible, setActionModalVisible] = useState(false);

  // Alert statistics
  const [alertStats, setAlertStats] = useState({
    critical: 2,
    warning: 5,
    info: 12,
  });

  // Pending alerts
  const [pendingAlerts, setPendingAlerts] = useState<SystemAlert[]>([
    {
      id: '1',
      severity: 'critical',
      title: 'Database Connection Error',
      time: '5 min ago',
      description: 'MySQL slave connection timeout, sync delay exceeds 10 seconds',
      status: 'pending',
      actions: [
        { label: 'Handle Now', color: '#f5222d' },
        { label: 'Ignore', color: '#8c8c8c' },
      ],
    },
    {
      id: '2',
      severity: 'critical',
      title: 'AI Quota Near Depletion',
      time: '15 min ago',
      description: 'Frozen Food Factory AI quota usage at 95%, expected to exhaust today',
      status: 'pending',
      actions: [
        { label: 'Expand Quota', color: '#f5222d' },
        { label: 'Ignore', color: '#8c8c8c' },
      ],
    },
    {
      id: '3',
      severity: 'warning',
      title: 'AI Service Slow Response',
      time: '30 min ago',
      description: 'AI service avg response time exceeds 2s threshold, current: 2.8s',
      status: 'pending',
      actions: [
        { label: 'View Details', color: '#faad14' },
        { label: 'Ignore', color: '#8c8c8c' },
      ],
    },
    {
      id: '4',
      severity: 'warning',
      title: 'High Memory Usage',
      time: '1 hour ago',
      description: 'JVM heap memory usage at 75%, recommend checking for memory leaks',
      status: 'pending',
      actions: [
        { label: 'View Monitor', color: '#faad14' },
        { label: 'Ignore', color: '#8c8c8c' },
      ],
    },
    {
      id: '5',
      severity: 'warning',
      title: 'Login Anomaly Detected',
      time: '2 hours ago',
      description: 'Multiple failed login attempts detected from IP 203.45.67.89',
      status: 'pending',
      actions: [
        { label: 'Block IP', color: '#faad14' },
        { label: 'Ignore', color: '#8c8c8c' },
      ],
    },
  ]);

  // Resolved alerts
  const [resolvedAlerts, setResolvedAlerts] = useState<SystemAlert[]>([
    {
      id: '6',
      severity: 'warning',
      title: 'API Request Timeout',
      time: '3 hours ago',
      description: 'API request timeout error',
      status: 'resolved',
      resolvedInfo: { method: 'Auto Recovery', handler: 'System' },
    },
    {
      id: '7',
      severity: 'warning',
      title: 'Disk Space Alert',
      time: '5 hours ago',
      description: 'Disk space running low',
      status: 'resolved',
      resolvedInfo: { method: 'Log Cleanup', handler: 'Admin Zhang' },
    },
    {
      id: '8',
      severity: 'info',
      title: 'Certificate Expiring Soon',
      time: 'Yesterday',
      description: 'SSL certificate expiring',
      status: 'resolved',
      resolvedInfo: { method: 'Renewed SSL', handler: 'Admin Zhang' },
    },
    {
      id: '9',
      severity: 'info',
      title: 'Quota Usage Alert',
      time: 'Yesterday',
      description: 'AI quota usage warning',
      status: 'resolved',
      resolvedInfo: { method: 'Temporary Expansion', handler: 'Admin Zhang' },
    },
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

  const handleMarkAllRead = () => {
    Alert.alert(
      'Confirm',
      'Mark all alerts as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: () => console.log('Marked all as read') },
      ]
    );
  };

  const handleAlertAction = (alert: SystemAlert, actionIndex: number) => {
    if (!alert.actions) return;
    const action = alert.actions[actionIndex];
    if (!action) return;

    if (action.label === 'Ignore') {
      // Move to resolved
      setPendingAlerts(prev => prev.filter(a => a.id !== alert.id));
      setResolvedAlerts(prev => [
        {
          ...alert,
          status: 'resolved',
          resolvedInfo: { method: 'Ignored', handler: 'Admin' },
        },
        ...prev,
      ]);
      setAlertStats(prev => ({
        ...prev,
        [alert.severity]: prev[alert.severity] - 1,
      }));
    } else {
      // Show action modal
      setSelectedAlert(alert);
      setActionModalVisible(true);
    }
  };

  const handleActionConfirm = () => {
    if (!selectedAlert) return;

    setPendingAlerts(prev => prev.filter(a => a.id !== selectedAlert.id));
    setResolvedAlerts(prev => [
      {
        ...selectedAlert,
        status: 'resolved',
        resolvedInfo: { method: 'Manual Action', handler: 'Admin' },
      },
      ...prev,
    ]);
    setAlertStats(prev => ({
      ...prev,
      [selectedAlert.severity]: prev[selectedAlert.severity] - 1,
    }));
    setActionModalVisible(false);
    setSelectedAlert(null);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
          <View style={styles.headerContent}>
            <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>System Alerts</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading alerts...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>System Alerts</Text>
          <TouchableOpacity onPress={handleMarkAllRead}>
            <Text style={styles.markAllRead}>Mark All Read</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Alert Statistics */}
        <View style={styles.statsGrid}>
          <LinearGradient
            colors={['#f5222d', '#cf1322']}
            style={styles.statCard}
          >
            <Text style={styles.statValue}>{alertStats.critical}</Text>
            <Text style={styles.statLabel}>Critical</Text>
          </LinearGradient>
          <LinearGradient
            colors={['#faad14', '#d48806']}
            style={styles.statCard}
          >
            <Text style={styles.statValue}>{alertStats.warning}</Text>
            <Text style={styles.statLabel}>Warning</Text>
          </LinearGradient>
          <LinearGradient
            colors={['#1890ff', '#096dd9']}
            style={styles.statCard}
          >
            <Text style={styles.statValue}>{alertStats.info}</Text>
            <Text style={styles.statLabel}>Info</Text>
          </LinearGradient>
        </View>

        {/* Pending Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Pending Alerts</Text>
          <Text style={styles.sectionCount}>{pendingAlerts.length} items</Text>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.noPadding}>
            {pendingAlerts.map((alert, index) => {
              const config = SEVERITY_CONFIG[alert.severity];
              return (
                <React.Fragment key={alert.id}>
                  <View style={[styles.alertItem, { borderLeftColor: config.borderColor }]}>
                    <View style={styles.alertHeader}>
                      <View style={styles.alertHeaderLeft}>
                        <View style={[styles.severityTag, { backgroundColor: config.bgColor }]}>
                          <Text style={[styles.severityText, { color: config.color }]}>
                            {config.label}
                          </Text>
                        </View>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                      </View>
                      <Text style={styles.alertTime}>{alert.time}</Text>
                    </View>
                    <Text style={styles.alertDescription}>{alert.description}</Text>
                    {alert.actions && (
                      <View style={styles.alertActions}>
                        {alert.actions.map((action, actionIndex) => (
                          <TouchableOpacity
                            key={actionIndex}
                            style={[
                              styles.actionButton,
                              { backgroundColor: actionIndex === 0 ? action.color : '#f0f0f0' }
                            ]}
                            onPress={() => handleAlertAction(alert, actionIndex)}
                          >
                            <Text style={[
                              styles.actionButtonText,
                              { color: actionIndex === 0 ? '#fff' : '#595959' }
                            ]}>
                              {action.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                  {index < pendingAlerts.length - 1 && <Divider />}
                </React.Fragment>
              );
            })}
            {pendingAlerts.length === 0 && (
              <View style={styles.emptyContainer}>
                <IconButton icon="check-circle" iconColor="#52c41a" size={48} />
                <Text style={styles.emptyText}>No pending alerts</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        {/* Resolved Alerts */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Resolved Alerts</Text>
          <Text style={styles.sectionCount}>Today {resolvedAlerts.length} items</Text>
        </View>

        <Card style={styles.card} mode="elevated">
          <Card.Content style={styles.noPadding}>
            {resolvedAlerts.map((alert, index) => (
              <React.Fragment key={alert.id}>
                <View style={styles.resolvedItem}>
                  <View style={styles.alertHeader}>
                    <View style={styles.alertHeaderLeft}>
                      <View style={styles.resolvedTag}>
                        <Text style={styles.resolvedTagText}>Resolved</Text>
                      </View>
                      <Text style={styles.resolvedTitle}>{alert.title}</Text>
                    </View>
                    <Text style={styles.alertTime}>{alert.time}</Text>
                  </View>
                  {alert.resolvedInfo && (
                    <Text style={styles.resolvedInfo}>
                      Method: {alert.resolvedInfo.method} | Handler: {alert.resolvedInfo.handler}
                    </Text>
                  )}
                </View>
                {index < resolvedAlerts.length - 1 && <Divider />}
              </React.Fragment>
            ))}
          </Card.Content>
        </Card>

        {/* View History */}
        <TouchableOpacity style={styles.viewHistory}>
          <Text style={styles.viewHistoryText}>View Alert History</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Action Modal */}
      <Portal>
        <Modal
          visible={actionModalVisible}
          onDismiss={() => setActionModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedAlert && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Handle Alert</Text>
              <View style={[
                styles.modalAlertPreview,
                { borderLeftColor: SEVERITY_CONFIG[selectedAlert.severity].borderColor }
              ]}>
                <View style={[
                  styles.severityTag,
                  { backgroundColor: SEVERITY_CONFIG[selectedAlert.severity].bgColor }
                ]}>
                  <Text style={[
                    styles.severityText,
                    { color: SEVERITY_CONFIG[selectedAlert.severity].color }
                  ]}>
                    {SEVERITY_CONFIG[selectedAlert.severity].label}
                  </Text>
                </View>
                <Text style={styles.modalAlertTitle}>{selectedAlert.title}</Text>
                <Text style={styles.modalAlertDescription}>{selectedAlert.description}</Text>
              </View>
              <Text style={styles.modalHint}>
                This action will mark the alert as resolved. Please ensure the issue has been addressed.
              </Text>
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setActionModalVisible(false)}
                  style={styles.modalCancelButton}
                >
                  Cancel
                </Button>
                <Button
                  mode="contained"
                  onPress={handleActionConfirm}
                  style={[
                    styles.modalConfirmButton,
                    { backgroundColor: SEVERITY_CONFIG[selectedAlert.severity].color }
                  ]}
                >
                  Confirm Resolved
                </Button>
              </View>
            </View>
          )}
        </Modal>
      </Portal>
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
    paddingRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  markAllRead: {
    fontSize: 14,
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
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionCount: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  noPadding: {
    paddingHorizontal: 0,
  },
  alertItem: {
    padding: 16,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  alertHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  severityTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    flex: 1,
  },
  alertTime: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  alertDescription: {
    fontSize: 13,
    color: '#595959',
    marginBottom: 10,
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  actionButtonText: {
    fontSize: 12,
  },
  resolvedItem: {
    padding: 14,
    opacity: 0.7,
  },
  resolvedTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
  },
  resolvedTagText: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  resolvedTitle: {
    fontSize: 14,
    color: '#595959',
    flex: 1,
  },
  resolvedInfo: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 6,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#52c41a',
    marginTop: 8,
  },
  viewHistory: {
    alignItems: 'center',
    padding: 16,
  },
  viewHistoryText: {
    fontSize: 14,
    color: '#1890ff',
  },
  bottomPadding: {
    height: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalContent: {
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
  },
  modalAlertPreview: {
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderLeftWidth: 4,
    gap: 8,
  },
  modalAlertTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  modalAlertDescription: {
    fontSize: 13,
    color: '#595959',
  },
  modalHint: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderColor: '#d9d9d9',
  },
  modalConfirmButton: {
    flex: 1,
  },
});
