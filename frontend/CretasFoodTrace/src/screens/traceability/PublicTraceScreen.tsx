import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
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
import { useRoute } from '@react-navigation/native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { traceabilityApiClient, PublicTraceResponse } from '../../services/api/traceabilityApiClient';

/**
 * 公开溯源屏幕
 * 消费者扫码查询，无需登录
 */
const PublicTraceScreen: React.FC = () => {
  const theme = useTheme();
  const route = useRoute<any>();
  const { batchNumber: initialBatchNumber, traceCode: initialTraceCode } = route.params || {};

  const [batchNumber, setBatchNumber] = useState(initialBatchNumber || '');
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState<PublicTraceResponse | null>(null);

  // 如果有初始参数，自动查询
  useEffect(() => {
    if (initialBatchNumber) {
      handleSearch(initialBatchNumber);
    } else if (initialTraceCode) {
      handleSearchByCode(initialTraceCode);
    }
  }, [initialBatchNumber, initialTraceCode]);

  const handleSearch = useCallback(async (searchBatch?: string) => {
    const searchValue = searchBatch || batchNumber.trim();
    if (!searchValue) {
      Alert.alert('提示', '请输入批次号');
      return;
    }

    setLoading(true);
    try {
      const result = await traceabilityApiClient.getPublicTrace(searchValue);
      setTraceData(result);
    } catch (err: any) {
      console.error('公开溯源查询失败:', err);
      setTraceData({
        productName: '',
        batchNumber: searchValue,
        factoryName: '',
        qualityStatus: '',
        materials: [],
        traceCode: '',
        queryTime: new Date().toISOString(),
        isValid: false,
        message: '查询失败，请稍后重试'
      });
    } finally {
      setLoading(false);
    }
  }, [batchNumber]);

  const handleSearchByCode = useCallback(async (code: string) => {
    setLoading(true);
    try {
      const result = await traceabilityApiClient.getTraceByCode(code);
      setTraceData(result);
      if (result.batchNumber) {
        setBatchNumber(result.batchNumber);
      }
    } catch (err: any) {
      console.error('溯源码查询失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const getQualityStatusInfo = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PASSED':
        return { text: '质检合格', color: '#4CAF50', icon: 'check-circle' };
      case 'FAILED':
        return { text: '质检不合格', color: '#f44336', icon: 'close-circle' };
      case 'PENDING':
      case 'PENDING_INSPECTION':
        return { text: '待检验', color: '#FF9800', icon: 'clock-outline' };
      case 'INSPECTING':
        return { text: '检验中', color: '#2196F3', icon: 'progress-check' };
      default:
        return { text: status || '未知', color: '#9e9e9e', icon: 'help-circle-outline' };
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* 搜索区域 */}
        <Surface style={styles.searchCard} elevation={2}>
          <View style={styles.headerRow}>
            <MaterialCommunityIcons name="qrcode-scan" size={28} color={theme.colors.primary} />
            <Text variant="titleLarge" style={styles.headerTitle}>产品溯源查询</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            输入产品批次号，查询完整生产信息
          </Text>
          <TextInput
            mode="outlined"
            label="产品批次号"
            placeholder="请输入批次号"
            value={batchNumber}
            onChangeText={setBatchNumber}
            style={styles.input}
            left={<TextInput.Icon icon="barcode" />}
            onSubmitEditing={() => handleSearch()}
          />
          <Button
            mode="contained"
            onPress={() => handleSearch()}
            loading={loading}
            disabled={loading || !batchNumber.trim()}
            style={styles.searchButton}
            icon="magnify"
          >
            查询
          </Button>
        </Surface>

        {/* 加载中 */}
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>正在查询溯源信息...</Text>
          </View>
        )}

        {/* 查询结果 */}
        {traceData && !loading && (
          <>
            {traceData.isValid ? (
              <>
                {/* 验证成功 */}
                <Card style={[styles.card, styles.successCard]}>
                  <Card.Content>
                    <View style={styles.verifyHeader}>
                      <MaterialCommunityIcons
                        name="shield-check"
                        size={48}
                        color="#4CAF50"
                      />
                      <View style={styles.verifyInfo}>
                        <Text variant="titleMedium" style={styles.verifyTitle}>
                          产品验证通过
                        </Text>
                        <Text style={styles.verifySubtitle}>
                          该产品信息已在系统中登记
                        </Text>
                      </View>
                    </View>
                  </Card.Content>
                </Card>

                {/* 产品信息 */}
                <Card style={styles.card}>
                  <Card.Content>
                    <View style={styles.sectionHeader}>
                      <MaterialCommunityIcons name="food-apple" size={24} color={theme.colors.primary} />
                      <Text variant="titleMedium" style={styles.sectionTitle}>产品信息</Text>
                    </View>
                    <Divider style={styles.divider} />

                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{traceData.productName || '产品'}</Text>
                      <Text style={styles.batchNumber}>批次号: {traceData.batchNumber}</Text>
                    </View>

                    <View style={styles.infoGrid}>
                      <View style={styles.infoRow}>
                        <Text style={styles.label}>生产工厂</Text>
                        <Text style={styles.value}>{traceData.factoryName}</Text>
                      </View>
                      {traceData.productionDate && (
                        <View style={styles.infoRow}>
                          <Text style={styles.label}>生产日期</Text>
                          <Text style={styles.value}>{traceData.productionDate}</Text>
                        </View>
                      )}
                      {traceData.certificationInfo && (
                        <View style={styles.infoRow}>
                          <Text style={styles.label}>认证信息</Text>
                          <Text style={styles.value}>{traceData.certificationInfo}</Text>
                        </View>
                      )}
                    </View>
                  </Card.Content>
                </Card>

                {/* 质量状态 */}
                {traceData.qualityStatus && (
                  <Card style={styles.card}>
                    <Card.Content>
                      <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="clipboard-check" size={24} color={theme.colors.primary} />
                        <Text variant="titleMedium" style={styles.sectionTitle}>质量检验</Text>
                      </View>
                      <Divider style={styles.divider} />

                      <View style={styles.qualityContainer}>
                        <View style={[
                          styles.qualityBadge,
                          { backgroundColor: getQualityStatusInfo(traceData.qualityStatus).color + '15' }
                        ]}>
                          <MaterialCommunityIcons
                            name={getQualityStatusInfo(traceData.qualityStatus).icon as any}
                            size={40}
                            color={getQualityStatusInfo(traceData.qualityStatus).color}
                          />
                          <Text style={[
                            styles.qualityText,
                            { color: getQualityStatusInfo(traceData.qualityStatus).color }
                          ]}>
                            {getQualityStatusInfo(traceData.qualityStatus).text}
                          </Text>
                        </View>

                        {traceData.qualityInspection && (
                          <View style={styles.qualityDetails}>
                            <Text style={styles.qualityDetail}>
                              检验日期: {traceData.qualityInspection.inspectionDate?.split('T')[0]}
                            </Text>
                            {traceData.qualityInspection.passRate !== undefined && (
                              <Text style={styles.qualityDetail}>
                                合格率: {traceData.qualityInspection.passRate}%
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </Card.Content>
                  </Card>
                )}

                {/* 原材料来源 */}
                {traceData.materials && traceData.materials.length > 0 && (
                  <Card style={styles.card}>
                    <Card.Content>
                      <View style={styles.sectionHeader}>
                        <MaterialCommunityIcons name="leaf" size={24} color={theme.colors.primary} />
                        <Text variant="titleMedium" style={styles.sectionTitle}>原材料来源</Text>
                      </View>
                      <Divider style={styles.divider} />

                      {traceData.materials.map((material, index) => (
                        <View key={index} style={[
                          styles.materialItem,
                          index < traceData.materials.length - 1 && styles.materialItemBorder
                        ]}>
                          <MaterialCommunityIcons name="package-variant" size={20} color="#666" />
                          <View style={styles.materialInfo}>
                            <Text style={styles.materialType}>{material.materialType}</Text>
                            <Text style={styles.materialDetail}>产地: {material.origin}</Text>
                            <Text style={styles.materialDetail}>入库: {material.receiptDate}</Text>
                          </View>
                        </View>
                      ))}
                    </Card.Content>
                  </Card>
                )}

                {/* 溯源码 */}
                <Surface style={styles.traceCodeCard} elevation={1}>
                  <MaterialCommunityIcons name="qrcode" size={20} color="#666" />
                  <Text style={styles.traceCodeLabel}>溯源码:</Text>
                  <Text style={styles.traceCode}>{traceData.traceCode}</Text>
                </Surface>
              </>
            ) : (
              /* 验证失败 */
              <Card style={[styles.card, styles.errorCard]}>
                <Card.Content>
                  <View style={styles.errorContainer}>
                    <MaterialCommunityIcons
                      name="alert-circle-outline"
                      size={64}
                      color={theme.colors.error}
                    />
                    <Text variant="titleMedium" style={styles.errorTitle}>
                      未找到溯源信息
                    </Text>
                    <Text style={styles.errorMessage}>
                      {traceData.message || '该批次号未在系统中登记'}
                    </Text>
                    <Text style={styles.errorHint}>
                      请检查批次号是否正确，或联系生产厂家
                    </Text>
                  </View>
                </Card.Content>
              </Card>
            )}

            {/* 查询时间 */}
            <Text style={styles.queryTime}>
              查询时间: {traceData.queryTime ? new Date(traceData.queryTime).toLocaleString() : '-'}
            </Text>
          </>
        )}

        {/* 空状态 */}
        {!traceData && !loading && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="food-fork-drink"
              size={80}
              color={theme.colors.outlineVariant}
            />
            <Text style={styles.emptyText}>食品安全，从溯源开始</Text>
            <Text style={styles.emptySubtext}>
              扫描产品二维码或输入批次号{'\n'}查询产品的完整生产信息
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
    paddingBottom: 32,
  },
  searchCard: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  headerTitle: {
    marginLeft: 12,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#666',
    marginBottom: 16,
  },
  input: {
    marginBottom: 12,
  },
  searchButton: {
    marginTop: 4,
    borderRadius: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  card: {
    marginBottom: 16,
    borderRadius: 12,
  },
  successCard: {
    backgroundColor: '#E8F5E9',
  },
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyInfo: {
    marginLeft: 16,
    flex: 1,
  },
  verifyTitle: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  verifySubtitle: {
    color: '#4CAF50',
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    marginLeft: 8,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 12,
  },
  productInfo: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  productName: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  batchNumber: {
    fontSize: 14,
    color: '#666',
  },
  infoGrid: {
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    color: '#666',
  },
  value: {
    fontWeight: '500',
  },
  qualityContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  qualityBadge: {
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    width: '100%',
  },
  qualityText: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  qualityDetails: {
    marginTop: 16,
    width: '100%',
  },
  qualityDetail: {
    textAlign: 'center',
    color: '#666',
    marginTop: 4,
  },
  materialItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  materialItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  materialInfo: {
    marginLeft: 12,
    flex: 1,
  },
  materialType: {
    fontSize: 15,
    fontWeight: '500',
  },
  materialDetail: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  traceCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  traceCodeLabel: {
    marginLeft: 8,
    color: '#666',
  },
  traceCode: {
    flex: 1,
    textAlign: 'right',
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#333',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorTitle: {
    marginTop: 12,
    color: '#C62828',
  },
  errorMessage: {
    marginTop: 8,
    color: '#666',
    textAlign: 'center',
  },
  errorHint: {
    marginTop: 12,
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
  },
  queryTime: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default PublicTraceScreen;
