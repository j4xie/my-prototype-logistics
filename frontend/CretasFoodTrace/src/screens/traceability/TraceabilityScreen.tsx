import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  TextInput,
  Button,
  Surface,
  Divider,
  Chip,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { traceabilityApiClient, BatchTraceResponse } from '../../services/api/traceabilityApiClient';

/**
 * 溯源查询屏幕
 * 用于工厂内部查询批次溯源信息
 */
const TraceabilityScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const [batchNumber, setBatchNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [traceData, setTraceData] = useState<BatchTraceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!batchNumber.trim()) {
      Alert.alert('提示', '请输入批次号');
      return;
    }

    setLoading(true);
    setError(null);
    setTraceData(null);

    try {
      const result = await traceabilityApiClient.getBatchTrace(batchNumber.trim());
      if (result) {
        setTraceData(result);
      } else {
        setError('未找到该批次的溯源信息');
      }
    } catch (err: any) {
      console.error('溯源查询失败:', err);
      setError(err.message || '查询失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [batchNumber]);

  const handleViewFullTrace = useCallback(() => {
    if (traceData) {
      navigation.navigate('TraceabilityDetail', {
        batchNumber: traceData.production.batchNumber,
      });
    }
  }, [traceData, navigation]);

  const onRefresh = useCallback(async () => {
    if (!batchNumber.trim()) return;
    setRefreshing(true);
    await handleSearch();
    setRefreshing(false);
  }, [batchNumber, handleSearch]);

  const getQualityStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PASSED':
        return theme.colors.primary;
      case 'FAILED':
        return theme.colors.error;
      case 'PENDING':
      case 'PENDING_INSPECTION':
        return theme.colors.secondary;
      default:
        return theme.colors.outline;
    }
  };

  const getQualityStatusText = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PASSED':
        return '已通过';
      case 'FAILED':
        return '未通过';
      case 'PENDING':
      case 'PENDING_INSPECTION':
        return '待检验';
      case 'INSPECTING':
        return '检验中';
      default:
        return status || '未知';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* 搜索区域 */}
        <Surface style={styles.searchCard} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            <MaterialCommunityIcons name="shield-check" size={20} color="#1976D2" /> 保罗溯源查询
          </Text>
          <TextInput
            mode="outlined"
            label="批次号"
            placeholder="输入生产批次号"
            value={batchNumber}
            onChangeText={setBatchNumber}
            style={styles.input}
            left={<TextInput.Icon icon="barcode-scan" />}
            onSubmitEditing={handleSearch}
          />
          <Button
            mode="contained"
            onPress={handleSearch}
            loading={loading}
            disabled={loading || !batchNumber.trim()}
            style={styles.searchButton}
            icon="magnify"
          >
            查询
          </Button>
        </Surface>

        {/* 错误提示 */}
        {error && (
          <Card style={[styles.card, styles.errorCard]}>
            <Card.Content>
              <View style={styles.errorContent}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={24}
                  color={theme.colors.error}
                />
                <Text style={[styles.errorText, { color: theme.colors.error }]}>
                  {error}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 加载中 */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>正在查询...</Text>
          </View>
        )}

        {/* 溯源结果 */}
        {traceData && !loading && (
          <>
            {/* 生产信息卡片 */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons
                    name="factory"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    生产信息
                  </Text>
                  <Chip
                    mode="flat"
                    style={[
                      styles.statusChip,
                      { backgroundColor: getQualityStatusColor(traceData.qualityStatus) + '20' },
                    ]}
                    textStyle={{ color: getQualityStatusColor(traceData.qualityStatus) }}
                  >
                    {getQualityStatusText(traceData.qualityStatus)}
                  </Chip>
                </View>
                <Divider style={styles.divider} />

                <View style={styles.infoRow}>
                  <Text style={styles.label}>批次号:</Text>
                  <Text style={styles.value}>{traceData.production.batchNumber}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>产品名称:</Text>
                  <Text style={styles.value}>{traceData.production.productName || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>生产工厂:</Text>
                  <Text style={styles.value}>{traceData.production.factoryName}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>生产日期:</Text>
                  <Text style={styles.value}>{traceData.production.productionDate || '-'}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>负责人:</Text>
                  <Text style={styles.value}>{traceData.production.supervisorName || '-'}</Text>
                </View>
                {traceData.production.quantity && (
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>产量:</Text>
                    <Text style={styles.value}>
                      {traceData.production.quantity} {traceData.production.unit}
                    </Text>
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* 统计信息 */}
            <Card style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <MaterialCommunityIcons
                    name="chart-bar"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <Text variant="titleMedium" style={styles.cardTitle}>
                    关联数据
                  </Text>
                </View>
                <Divider style={styles.divider} />

                <View style={styles.statsContainer}>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={28}
                      color={theme.colors.tertiary}
                    />
                    <Text style={styles.statNumber}>{traceData.materialCount}</Text>
                    <Text style={styles.statLabel}>原材料批次</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="clipboard-check-outline"
                      size={28}
                      color={theme.colors.secondary}
                    />
                    <Text style={styles.statNumber}>{traceData.inspectionCount}</Text>
                    <Text style={styles.statLabel}>质检记录</Text>
                  </View>
                  <View style={styles.statItem}>
                    <MaterialCommunityIcons
                      name="truck-delivery"
                      size={28}
                      color={theme.colors.primary}
                    />
                    <Text style={styles.statNumber}>{traceData.shipmentCount}</Text>
                    <Text style={styles.statLabel}>出货记录</Text>
                  </View>
                </View>
              </Card.Content>
            </Card>

            {/* 查看完整链路按钮 */}
            <Button
              mode="contained"
              onPress={handleViewFullTrace}
              style={styles.fullTraceButton}
              icon="link-variant"
            >
              查看完整溯源链路
            </Button>

            {/* 最后更新时间 */}
            <Text style={styles.updateTime}>
              最后更新: {traceData.lastUpdateTime ? new Date(traceData.lastUpdateTime).toLocaleString() : '-'}
            </Text>
          </>
        )}

        {/* 空状态 */}
        {!traceData && !loading && !error && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="qrcode-scan"
              size={80}
              color={theme.colors.outlineVariant}
            />
            <Text style={styles.emptyText}>
              输入批次号查询溯源信息
            </Text>
            <Text style={styles.emptySubtext}>
              支持查询生产批次的完整追溯链路
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  searchCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    marginBottom: 12,
    fontWeight: '600',
  },
  input: {
    marginBottom: 12,
  },
  searchButton: {
    marginTop: 4,
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  errorCard: {
    backgroundColor: '#ffebee',
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorText: {
    marginLeft: 8,
    flex: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    marginLeft: 8,
    flex: 1,
    fontWeight: '600',
  },
  statusChip: {
    height: 28,
  },
  divider: {
    marginVertical: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    width: 80,
    color: '#666',
    fontSize: 14,
  },
  value: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  fullTraceButton: {
    marginBottom: 16,
    borderRadius: 8,
  },
  updateTime: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginBottom: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
  },
});

export default TraceabilityScreen;
