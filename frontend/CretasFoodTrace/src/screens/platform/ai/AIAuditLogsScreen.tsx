import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  IconButton,
  Chip,
  ActivityIndicator,
  Portal,
  Modal,
  Button,
  Menu,
  Divider,
  Searchbar,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { PlatformStackParamList } from '../../../navigation/PlatformStackNavigator';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<PlatformStackParamList, 'AIAuditLogs'>;

interface AuditLogEntry {
  id: string;
  timestamp: string;
  factoryId: string;
  factoryName: string;
  userId: number;
  username: string;
  inputText: string;
  recognizedIntent: string;
  confidence: number;
  executionResult: 'success' | 'failed' | 'fallback';
  responseTime: number;
  llmFallback: boolean;
  parameters?: Record<string, unknown>;
  errorMessage?: string;
}

const TIME_RANGE_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const INTENT_TYPES = [
  { key: 'all', label: 'All Intents' },
  { key: 'material_query', label: 'Material Query' },
  { key: 'batch_create', label: 'Batch Create' },
  { key: 'quality_check', label: 'Quality Check' },
  { key: 'production_status', label: 'Production Status' },
  { key: 'inventory_query', label: 'Inventory Query' },
  { key: 'report_generate', label: 'Report Generate' },
];

const RESULT_CONFIG = {
  success: { label: 'Success', color: '#52c41a', bgColor: '#f6ffed' },
  failed: { label: 'Failed', color: '#f5222d', bgColor: '#fff1f0' },
  fallback: { label: 'Fallback', color: '#fa8c16', bgColor: '#fff7e6' },
};

/**
 * AIAuditLogsScreen - AI Decision Audit Logs Page
 * Displays AI decision audit logs with filtering and detail view
 */
export default function AIAuditLogsScreen() {
  const { t } = useTranslation('platform');
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState('today');
  const [selectedFactory, setSelectedFactory] = useState('all');
  const [selectedIntent, setSelectedIntent] = useState('all');
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [timeRangeMenuVisible, setTimeRangeMenuVisible] = useState(false);
  const [intentMenuVisible, setIntentMenuVisible] = useState(false);

  // Audit log statistics
  const [stats, setStats] = useState({
    totalRequests: 1856,
    successRate: 94.2,
    avgResponseTime: 1.2,
    fallbackRate: 8.5,
  });

  // Mock factories for filter
  const [factories] = useState([
    { id: 'all', name: 'All Factories' },
    { id: 'F001', name: 'Seafood Processing #1' },
    { id: 'F002', name: 'Frozen Food Factory' },
    { id: 'F003', name: 'Meat Processing Center' },
  ]);

  // Mock audit log data
  const [logs, setLogs] = useState<AuditLogEntry[]>([
    {
      id: '1',
      timestamp: '2024-12-15 14:32:45',
      factoryId: 'F001',
      factoryName: 'Seafood Processing #1',
      userId: 101,
      username: 'Worker Zhang',
      inputText: 'Check today incoming material batches',
      recognizedIntent: 'material_query',
      confidence: 0.95,
      executionResult: 'success',
      responseTime: 0.8,
      llmFallback: false,
      parameters: { date: 'today', type: 'incoming' },
    },
    {
      id: '2',
      timestamp: '2024-12-15 14:28:12',
      factoryId: 'F002',
      factoryName: 'Frozen Food Factory',
      userId: 203,
      username: 'Manager Li',
      inputText: 'Create new production batch for frozen dumplings',
      recognizedIntent: 'batch_create',
      confidence: 0.88,
      executionResult: 'success',
      responseTime: 1.2,
      llmFallback: false,
      parameters: { productType: 'frozen_dumplings' },
    },
    {
      id: '3',
      timestamp: '2024-12-15 14:15:33',
      factoryId: 'F001',
      factoryName: 'Seafood Processing #1',
      userId: 102,
      username: 'QC Inspector Wang',
      inputText: 'What is the weather today',
      recognizedIntent: 'unknown',
      confidence: 0.35,
      executionResult: 'fallback',
      responseTime: 2.5,
      llmFallback: true,
      errorMessage: 'Intent not recognized, fallback to LLM',
    },
    {
      id: '4',
      timestamp: '2024-12-15 14:08:21',
      factoryId: 'F003',
      factoryName: 'Meat Processing Center',
      userId: 301,
      username: 'Worker Liu',
      inputText: 'Record quality inspection result for batch MB-001',
      recognizedIntent: 'quality_check',
      confidence: 0.92,
      executionResult: 'success',
      responseTime: 0.9,
      llmFallback: false,
      parameters: { batchId: 'MB-001', action: 'record' },
    },
    {
      id: '5',
      timestamp: '2024-12-15 13:55:18',
      factoryId: 'F002',
      factoryName: 'Frozen Food Factory',
      userId: 204,
      username: 'Admin Chen',
      inputText: 'Generate weekly production report',
      recognizedIntent: 'report_generate',
      confidence: 0.78,
      executionResult: 'failed',
      responseTime: 3.2,
      llmFallback: false,
      errorMessage: 'Insufficient data for report generation',
    },
    {
      id: '6',
      timestamp: '2024-12-15 13:42:09',
      factoryId: 'F001',
      factoryName: 'Seafood Processing #1',
      userId: 103,
      username: 'Supervisor Zhao',
      inputText: 'Query current production line status',
      recognizedIntent: 'production_status',
      confidence: 0.91,
      executionResult: 'success',
      responseTime: 1.1,
      llmFallback: false,
      parameters: { target: 'current_line' },
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
    const matchesFactory = selectedFactory === 'all' || log.factoryId === selectedFactory;
    const matchesIntent = selectedIntent === 'all' || log.recognizedIntent === selectedIntent;
    const matchesSearch = searchQuery === '' ||
      log.inputText.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.recognizedIntent.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFactory && matchesIntent && matchesSearch;
  });

  const handleLogPress = (log: AuditLogEntry) => {
    setSelectedLog(log);
    setDetailModalVisible(true);
  };

  const handleExport = () => {
    console.log('Exporting audit logs...');
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return '#52c41a';
    if (confidence >= 0.7) return '#1890ff';
    if (confidence >= 0.5) return '#fa8c16';
    return '#f5222d';
  };

  const renderLogItem = ({ item }: { item: AuditLogEntry }) => {
    const resultConfig = RESULT_CONFIG[item.executionResult];
    return (
      <TouchableOpacity
        style={styles.logItem}
        onPress={() => handleLogPress(item)}
      >
        <View style={styles.logHeader}>
          <View style={styles.logHeaderLeft}>
            <Text style={styles.logTime}>{item.timestamp}</Text>
            <View style={[styles.resultTag, { backgroundColor: resultConfig.bgColor }]}>
              <Text style={[styles.resultTagText, { color: resultConfig.color }]}>
                {resultConfig.label}
              </Text>
            </View>
          </View>
          <Text style={styles.logFactory}>{item.factoryName}</Text>
        </View>

        <View style={styles.logContent}>
          <Text style={styles.logInput} numberOfLines={2}>
            {item.inputText}
          </Text>
        </View>

        <View style={styles.logMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>User:</Text>
            <Text style={styles.metaValue}>{item.username}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Intent:</Text>
            <Chip
              mode="flat"
              compact
              style={styles.intentChip}
              textStyle={styles.intentChipText}
            >
              {item.recognizedIntent}
            </Chip>
          </View>
        </View>

        <View style={styles.logFooter}>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Confidence:</Text>
            <Text style={[styles.footerValue, { color: getConfidenceColor(item.confidence) }]}>
              {(item.confidence * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Text style={styles.footerLabel}>Response:</Text>
            <Text style={styles.footerValue}>{item.responseTime}s</Text>
          </View>
          {item.llmFallback && (
            <Chip
              mode="flat"
              compact
              icon="robot"
              style={styles.llmChip}
              textStyle={styles.llmChipText}
            >
              LLM
            </Chip>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
          <View style={styles.headerContent}>
            <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>AI Audit Logs</Text>
            <View style={{ width: 48 }} />
          </View>
        </LinearGradient>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading audit logs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <IconButton icon="arrow-left" iconColor="#fff" onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>AI Audit Logs</Text>
          <IconButton icon="download" iconColor="#fff" onPress={handleExport} />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {/* Statistics Cards */}
        <LinearGradient colors={['#1a1a2e', '#16213e']} style={styles.statsCard}>
          <Text style={styles.statsLabel}>Today's AI Requests</Text>
          <Text style={styles.statsValue}>
            {stats.totalRequests.toLocaleString()} <Text style={styles.statsUnit}>requests</Text>
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.successRate}%</Text>
              <Text style={styles.statLabel}>Success Rate</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.avgResponseTime}s</Text>
              <Text style={styles.statLabel}>Avg Response</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.fallbackRate}%</Text>
              <Text style={styles.statLabel}>Fallback Rate</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Search Bar */}
        <Searchbar
          placeholder="Search logs..."
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Filter Row */}
        <View style={styles.filterRow}>
          <Menu
            visible={timeRangeMenuVisible}
            onDismiss={() => setTimeRangeMenuVisible(false)}
            anchor={
              <Chip
                mode="outlined"
                icon="calendar"
                onPress={() => setTimeRangeMenuVisible(true)}
                style={styles.filterChip}
              >
                {TIME_RANGE_OPTIONS.find(o => o.key === selectedTimeRange)?.label || 'Today'}
              </Chip>
            }
          >
            {TIME_RANGE_OPTIONS.map((option) => (
              <Menu.Item
                key={option.key}
                onPress={() => {
                  setSelectedTimeRange(option.key);
                  setTimeRangeMenuVisible(false);
                }}
                title={option.label}
              />
            ))}
          </Menu>

          <Menu
            visible={intentMenuVisible}
            onDismiss={() => setIntentMenuVisible(false)}
            anchor={
              <Chip
                mode="outlined"
                icon="robot"
                onPress={() => setIntentMenuVisible(true)}
                style={styles.filterChip}
              >
                {INTENT_TYPES.find(o => o.key === selectedIntent)?.label || 'All Intents'}
              </Chip>
            }
          >
            {INTENT_TYPES.map((option) => (
              <Menu.Item
                key={option.key}
                onPress={() => {
                  setSelectedIntent(option.key);
                  setIntentMenuVisible(false);
                }}
                title={option.label}
              />
            ))}
          </Menu>
        </View>

        {/* Factory Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.factoryFilterRow}
        >
          {factories.map((factory) => (
            <Chip
              key={factory.id}
              mode={selectedFactory === factory.id ? 'flat' : 'outlined'}
              selected={selectedFactory === factory.id}
              onPress={() => setSelectedFactory(factory.id)}
              style={[
                styles.factoryChip,
                selectedFactory === factory.id && styles.factoryChipActive
              ]}
              textStyle={[
                styles.factoryChipText,
                selectedFactory === factory.id && styles.factoryChipTextActive
              ]}
            >
              {factory.name}
            </Chip>
          ))}
        </ScrollView>

        {/* Log List Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Audit Log List</Text>
          <Text style={styles.listCount}>{filteredLogs.length} records</Text>
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
                <Text style={styles.emptyText}>No matching audit logs</Text>
              </View>
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
            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalTitle}>Audit Log Details</Text>

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Basic Information</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Time:</Text>
                  <Text style={styles.modalValue}>{selectedLog.timestamp}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Factory:</Text>
                  <Text style={styles.modalValue}>{selectedLog.factoryName}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>User:</Text>
                  <Text style={styles.modalValue}>{selectedLog.username} (ID: {selectedLog.userId})</Text>
                </View>
              </View>

              <Divider style={styles.modalDivider} />

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>AI Processing</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Input:</Text>
                  <Text style={styles.modalValue}>{selectedLog.inputText}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Intent:</Text>
                  <Chip mode="flat" compact style={styles.modalIntentChip}>
                    {selectedLog.recognizedIntent}
                  </Chip>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Confidence:</Text>
                  <Text style={[styles.modalValue, { color: getConfidenceColor(selectedLog.confidence) }]}>
                    {(selectedLog.confidence * 100).toFixed(1)}%
                  </Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>LLM Fallback:</Text>
                  <Text style={styles.modalValue}>{selectedLog.llmFallback ? 'Yes' : 'No'}</Text>
                </View>
              </View>

              <Divider style={styles.modalDivider} />

              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Execution Result</Text>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Result:</Text>
                  <View style={[styles.resultTag, { backgroundColor: RESULT_CONFIG[selectedLog.executionResult].bgColor }]}>
                    <Text style={[styles.resultTagText, { color: RESULT_CONFIG[selectedLog.executionResult].color }]}>
                      {RESULT_CONFIG[selectedLog.executionResult].label}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Response Time:</Text>
                  <Text style={styles.modalValue}>{selectedLog.responseTime}s</Text>
                </View>
                {selectedLog.errorMessage && (
                  <View style={styles.modalRow}>
                    <Text style={styles.modalLabel}>Error:</Text>
                    <Text style={[styles.modalValue, { color: '#f5222d' }]}>{selectedLog.errorMessage}</Text>
                  </View>
                )}
              </View>

              {selectedLog.parameters && Object.keys(selectedLog.parameters).length > 0 && (
                <>
                  <Divider style={styles.modalDivider} />
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>Extracted Parameters</Text>
                    {Object.entries(selectedLog.parameters).map(([key, value]) => (
                      <View key={key} style={styles.modalRow}>
                        <Text style={styles.modalLabel}>{key}:</Text>
                        <Text style={styles.modalValue}>{String(value)}</Text>
                      </View>
                    ))}
                  </View>
                </>
              )}

              <Button
                mode="contained"
                onPress={() => setDetailModalVisible(false)}
                style={styles.modalButton}
              >
                Close
              </Button>
            </ScrollView>
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
    gap: 24,
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
  searchBar: {
    marginBottom: 12,
    borderRadius: 12,
    elevation: 0,
    backgroundColor: '#fff',
  },
  searchInput: {
    fontSize: 14,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#fff',
  },
  factoryFilterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 12,
  },
  factoryChip: {
    backgroundColor: '#f0f0f0',
    borderColor: 'transparent',
  },
  factoryChipActive: {
    backgroundColor: '#667eea',
  },
  factoryChipText: {
    color: '#595959',
    fontSize: 12,
  },
  factoryChipTextActive: {
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
  listCount: {
    fontSize: 13,
    color: '#8c8c8c',
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
    alignItems: 'center',
    marginBottom: 8,
  },
  logHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logTime: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  logFactory: {
    fontSize: 12,
    color: '#667eea',
  },
  resultTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  resultTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  logContent: {
    marginBottom: 8,
  },
  logInput: {
    fontSize: 14,
    color: '#262626',
    lineHeight: 20,
  },
  logMeta: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  metaValue: {
    fontSize: 12,
    color: '#262626',
  },
  intentChip: {
    backgroundColor: '#e6f7ff',
    height: 24,
  },
  intentChipText: {
    fontSize: 11,
    color: '#1890ff',
  },
  logFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerLabel: {
    fontSize: 11,
    color: '#8c8c8c',
  },
  footerValue: {
    fontSize: 11,
    fontWeight: '500',
    color: '#262626',
  },
  llmChip: {
    backgroundColor: '#f9f0ff',
    height: 22,
  },
  llmChipText: {
    fontSize: 10,
    color: '#722ed1',
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
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalContent: {
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 16,
  },
  modalSection: {
    marginBottom: 8,
  },
  modalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 8,
  },
  modalDivider: {
    marginVertical: 12,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    width: 100,
  },
  modalValue: {
    fontSize: 13,
    color: '#262626',
    flex: 1,
  },
  modalIntentChip: {
    backgroundColor: '#e6f7ff',
    height: 24,
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: '#667eea',
  },
});
