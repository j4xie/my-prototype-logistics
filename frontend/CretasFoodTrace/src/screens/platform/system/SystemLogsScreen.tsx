import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  TextInput,
  Chip,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

type Props = NativeStackScreenProps<PlatformStackParamList, 'SystemLogs'>;

interface LogEntry {
  id: string;
  type: 'login' | 'config' | 'error' | 'data' | 'system';
  title: string;
  time: string;
  operator: string;
  detail: string;
  description: string;
}

const LOG_TYPE_CONFIG = {
  login: { label: 'Login', color: '#1890ff', bgColor: '#e6f7ff' },
  config: { label: 'Config', color: '#52c41a', bgColor: '#f6ffed' },
  error: { label: 'Error', color: '#f5222d', bgColor: '#fff1f0' },
  data: { label: 'Data', color: '#722ed1', bgColor: '#f9f0ff' },
  system: { label: 'System', color: '#fa8c16', bgColor: '#fff7e6' },
};

const FILTER_OPTIONS = ['All', 'Login', 'Config', 'Data', 'Error'];

export default function SystemLogsScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Log statistics
  const [logStats, setLogStats] = useState({
    total: 2456,
    admin: 186,
    business: 2156,
    system: 114,
  });

  // Log entries
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      type: 'login',
      title: 'User Login Success',
      time: '14:32',
      operator: 'Admin Zhang',
      detail: 'IP: 192.168.1.100',
      description: 'Platform admin logged in via mobile app',
    },
    {
      id: '2',
      type: 'config',
      title: 'Modified Factory Quota',
      time: '14:25',
      operator: 'Admin Zhang',
      detail: 'Factory: Seafood Processing #1',
      description: 'AI quota adjusted from 50,000 to 80,000 calls/month',
    },
    {
      id: '3',
      type: 'error',
      title: 'Login Failed',
      time: '14:18',
      operator: 'Unknown',
      detail: 'IP: 203.45.67.89',
      description: 'Wrong password, 3 consecutive failures, account locked for 15 minutes',
    },
    {
      id: '4',
      type: 'data',
      title: 'Created Production Batch',
      time: '14:10',
      operator: 'Workshop Director Wang',
      detail: 'Factory: Frozen Food Factory',
      description: 'Batch: PB-20241201-001, Planned: 5000kg',
    },
    {
      id: '5',
      type: 'system',
      title: 'Rule Updated',
      time: '13:45',
      operator: 'System Auto',
      detail: 'Rule: QUOTA-WARN-001',
      description: 'Quota warning rule triggered, notified 3 admins',
    },
    {
      id: '6',
      type: 'config',
      title: 'Published Blueprint Version',
      time: '13:30',
      operator: 'Admin Zhang',
      detail: 'Blueprint: Seafood Processing Standard',
      description: 'Released v2.1.0, pushed to 3 bound factories',
    },
    {
      id: '7',
      type: 'login',
      title: 'User Logout',
      time: '13:15',
      operator: 'QC Inspector Li',
      detail: 'IP: 192.168.1.56',
      description: 'Manual logout, session duration: 2h 15min',
    },
    {
      id: '8',
      type: 'data',
      title: 'QC Record Submitted',
      time: '13:00',
      operator: 'QC Inspector Li',
      detail: 'Factory: Seafood Processing #1',
      description: 'Batch MB-F001-056 passed QC, status updated',
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

  const filteredLogs = logs.filter(log => {
    const matchesFilter = activeFilter === 'All' ||
      LOG_TYPE_CONFIG[log.type].label.toLowerCase() === activeFilter.toLowerCase();
    const matchesSearch = searchQuery === '' ||
      log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.operator.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleLogPress = (log: LogEntry) => {
    setSelectedLog(log);
    setDetailModalVisible(true);
  };

  const handleExport = () => {
    // Simulate export
    console.log('Exporting logs...');
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => {
    const config = LOG_TYPE_CONFIG[item.type];
    return (
      <TouchableOpacity
        style={styles.logItem}
        onPress={() => handleLogPress(item)}
      >
        <View style={styles.logHeader}>
          <View style={styles.logHeaderLeft}>
            <View style={[styles.logTypeTag, { backgroundColor: config.bgColor }]}>
              <Text style={[styles.logTypeText, { color: config.color }]}>{config.label}</Text>
            </View>
            <Text style={styles.logTitle}>{item.title}</Text>
          </View>
          <Text style={styles.logTime}>{item.time}</Text>
        </View>
        <Text style={styles.logDetail}>
          Operator: {item.operator} | {item.detail}
        </Text>
        <Text style={styles.logDescription}>{item.description}</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
          <View style={styles.headerContent}>
            <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>System Logs</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>System Logs</Text>
          <IconButton icon="magnify" iconColor="#fff" onPress={() => {}} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Log Statistics */}
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.statsCard}>
          <Text style={styles.statsLabel}>Today's Operation Logs</Text>
          <Text style={styles.statsValue}>
            {logStats.total.toLocaleString()} <Text style={styles.statsUnit}>entries</Text>
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{logStats.admin}</Text>
              <Text style={styles.statLabel}>Admin Ops</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{logStats.business.toLocaleString()}</Text>
              <Text style={styles.statLabel}>Business Ops</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{logStats.system}</Text>
              <Text style={styles.statLabel}>System Ops</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTER_OPTIONS.map((filter) => (
            <Chip
              key={filter}
              mode={activeFilter === filter ? 'flat' : 'outlined'}
              selected={activeFilter === filter}
              onPress={() => setActiveFilter(filter)}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive
              ]}
              textStyle={[
                styles.filterChipText,
                activeFilter === filter && styles.filterChipTextActive
              ]}
            >
              {filter}
            </Chip>
          ))}
        </ScrollView>

        {/* Log List Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Today's Logs</Text>
          <TouchableOpacity onPress={handleExport}>
            <Text style={styles.exportButton}>Export</Text>
          </TouchableOpacity>
        </View>

        {/* Log List */}
        <Card style={styles.logCard} mode="elevated">
          <FlatList
            data={filteredLogs}
            renderItem={renderLogItem}
            keyExtractor={(item) => item.id}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            contentContainerStyle={styles.logList}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No matching logs</Text>
              </View>
            }
            ListFooterComponent={
              <TouchableOpacity style={styles.loadMore}>
                <Text style={styles.loadMoreText}>Load more logs</Text>
              </TouchableOpacity>
            }
          />
        </Card>
      </View>

      {/* Log Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContainer}
        >
          {selectedLog && (
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Log Details</Text>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Type:</Text>
                <View style={[
                  styles.logTypeTag,
                  { backgroundColor: LOG_TYPE_CONFIG[selectedLog.type].bgColor }
                ]}>
                  <Text style={[
                    styles.logTypeText,
                    { color: LOG_TYPE_CONFIG[selectedLog.type].color }
                  ]}>
                    {LOG_TYPE_CONFIG[selectedLog.type].label}
                  </Text>
                </View>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Title:</Text>
                <Text style={styles.modalValue}>{selectedLog.title}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Time:</Text>
                <Text style={styles.modalValue}>{selectedLog.time}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Operator:</Text>
                <Text style={styles.modalValue}>{selectedLog.operator}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Details:</Text>
                <Text style={styles.modalValue}>{selectedLog.detail}</Text>
              </View>
              <View style={styles.modalRow}>
                <Text style={styles.modalLabel}>Description:</Text>
                <Text style={styles.modalValue}>{selectedLog.description}</Text>
              </View>
              <Button
                mode="contained"
                onPress={() => setDetailModalVisible(false)}
                style={styles.modalButton}
              >
                Close
              </Button>
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
    padding: 16,
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  statsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 4,
  },
  statsValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  statsUnit: {
    fontSize: 14,
    fontWeight: '400',
    opacity: 0.8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    marginRight: 8,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 16,
  },
  filterChip: {
    backgroundColor: '#f0f0f0',
    borderColor: 'transparent',
  },
  filterChipActive: {
    backgroundColor: '#1a1a2e',
  },
  filterChipText: {
    color: '#595959',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  exportButton: {
    fontSize: 13,
    color: '#1890ff',
  },
  logCard: {
    flex: 1,
    backgroundColor: '#fff',
  },
  logList: {
    paddingVertical: 8,
  },
  logItem: {
    padding: 14,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  logTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logTypeText: {
    fontSize: 11,
  },
  logTitle: {
    fontSize: 14,
    color: '#262626',
    flex: 1,
  },
  logTime: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  logDetail: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 4,
  },
  logDescription: {
    fontSize: 12,
    color: '#595959',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#8c8c8c',
  },
  loadMore: {
    padding: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    fontSize: 14,
    color: '#1890ff',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    padding: 20,
  },
  modalContent: {
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 8,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalLabel: {
    fontSize: 14,
    color: '#8c8c8c',
    width: 80,
  },
  modalValue: {
    fontSize: 14,
    color: '#262626',
    flex: 1,
  },
  modalButton: {
    marginTop: 8,
    backgroundColor: '#667eea',
  },
});
