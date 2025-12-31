import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, RefreshControl } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  Portal,
  Modal,
  Button,
  ActivityIndicator,
  List,
  Searchbar,
  SegmentedButtons,
  Divider,
  DataTable,
  Switch,
  TextInput,
  ProgressBar,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import {
  supplierAdmissionApiClient,
  AdmissionEvaluationResult,
  AcceptanceStrategy,
  SupplierRuleConfig,
  SupplierReport,
  getGradeColor,
  getGradeLabel,
  getInspectionLevelColor,
  getInspectionLevelLabel,
  InspectionLevel,
} from '../../services/api/supplierAdmissionApiClient';
import { supplierApiClient, Supplier } from '../../services/api/supplierApiClient';
import { useAuthStore } from '../../store/authStore';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';

const admissionLogger = logger.createContextLogger('SupplierAdmission');

// Tab 类型
type TabValue = 'evaluate' | 'rules' | 'acceptance';

/**
 * 供应商准入管理页面
 * 功能：
 * 1. 评估供应商准入资格
 * 2. 查看/配置准入规则
 * 3. 生成验收策略
 */
export default function SupplierAdmissionScreen() {
  const navigation = useNavigation();
  const user = useAuthStore((state) => state.user);
  const factoryId = getFactoryId(user);

  // 状态
  const [activeTab, setActiveTab] = useState<TabValue>('evaluate');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 评估结果状态
  const [evaluationResults, setEvaluationResults] = useState<
    Record<string, AdmissionEvaluationResult>
  >({});
  const [evaluatingId, setEvaluatingId] = useState<string | null>(null);

  // 详情 Modal
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierReport, setSupplierReport] = useState<SupplierReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);

  // 验收策略 Modal
  const [acceptanceModalVisible, setAcceptanceModalVisible] = useState(false);
  const [acceptanceStrategy, setAcceptanceStrategy] = useState<AcceptanceStrategy | null>(null);
  const [generatingStrategy, setGeneratingStrategy] = useState(false);
  const [strategyForm, setStrategyForm] = useState({
    supplierId: '',
    materialTypeId: '',
    quantity: '',
  });

  // 规则配置状态
  const [ruleConfig, setRuleConfig] = useState<SupplierRuleConfig | null>(null);
  const [loadingRules, setLoadingRules] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const [editedRules, setEditedRules] = useState<Partial<SupplierRuleConfig>>({});

  // 加载供应商列表
  const loadSuppliers = useCallback(async () => {
    if (!factoryId) return;

    try {
      setLoading(true);
      const response = await supplierApiClient.getSuppliers({
        factoryId,
        page: 1,
        size: 100,
      });

      if (response?.data && Array.isArray(response.data)) {
        setSuppliers(response.data);
        admissionLogger.info('供应商列表加载成功', { count: response.data.length });
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      admissionLogger.error('加载供应商列表失败', error as Error);
      Alert.alert('错误', '加载供应商列表失败');
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, [factoryId]);

  // 加载规则配置
  const loadRuleConfig = useCallback(async () => {
    if (!factoryId) return;

    try {
      setLoadingRules(true);
      const config = await supplierAdmissionApiClient.getRuleConfiguration(factoryId);
      setRuleConfig(config);
      setEditedRules(config);
      admissionLogger.info('规则配置加载成功', { version: config.version });
    } catch (error) {
      admissionLogger.error('加载规则配置失败', error as Error);
      // 使用默认配置
      setRuleConfig(null);
    } finally {
      setLoadingRules(false);
    }
  }, [factoryId]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  useEffect(() => {
    if (activeTab === 'rules') {
      loadRuleConfig();
    }
  }, [activeTab, loadRuleConfig]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSuppliers();
    setRefreshing(false);
  };

  // 评估单个供应商
  const handleEvaluate = async (supplierId: string) => {
    if (!factoryId) return;

    try {
      setEvaluatingId(supplierId);
      const result = await supplierAdmissionApiClient.evaluateAdmission(supplierId, factoryId);
      setEvaluationResults((prev) => ({
        ...prev,
        [supplierId]: result,
      }));
      admissionLogger.info('供应商评估完成', {
        supplierId,
        admitted: result.admitted,
        grade: result.grade,
        score: result.score,
      });
    } catch (error) {
      admissionLogger.error('评估失败', error as Error, { supplierId });
      Alert.alert('错误', '评估失败，请稍后重试');
    } finally {
      setEvaluatingId(null);
    }
  };

  // 批量评估
  const handleBatchEvaluate = async () => {
    if (!factoryId || suppliers.length === 0) return;

    const supplierIds = suppliers.slice(0, 10).map((s) => s.id);

    try {
      setLoading(true);
      const results = await supplierAdmissionApiClient.batchEvaluate(supplierIds, factoryId);
      setEvaluationResults((prev) => ({
        ...prev,
        ...results,
      }));
      admissionLogger.info('批量评估完成', { count: Object.keys(results).length });
      Alert.alert('成功', `已评估 ${Object.keys(results).length} 个供应商`);
    } catch (error) {
      admissionLogger.error('批量评估失败', error as Error);
      Alert.alert('错误', '批量评估失败');
    } finally {
      setLoading(false);
    }
  };

  // 查看供应商详情报告
  const handleViewReport = async (supplier: Supplier) => {
    if (!factoryId) return;

    setSelectedSupplier(supplier);
    setDetailModalVisible(true);
    setLoadingReport(true);

    try {
      const report = await supplierAdmissionApiClient.getSupplierReport(supplier.id, factoryId);
      setSupplierReport(report);
      admissionLogger.info('供应商报告加载成功', { supplierId: supplier.id });
    } catch (error) {
      admissionLogger.error('加载供应商报告失败', error as Error);
      setSupplierReport(null);
    } finally {
      setLoadingReport(false);
    }
  };

  // 生成验收策略
  const handleGenerateStrategy = async () => {
    if (!factoryId || !strategyForm.supplierId || !strategyForm.materialTypeId) {
      Alert.alert('提示', '请填写供应商和材料类型');
      return;
    }

    try {
      setGeneratingStrategy(true);
      const strategy = await supplierAdmissionApiClient.generateAcceptanceStrategy(
        {
          supplierId: strategyForm.supplierId,
          materialTypeId: strategyForm.materialTypeId,
          quantity: parseInt(strategyForm.quantity) || 100,
        },
        factoryId
      );
      setAcceptanceStrategy(strategy);
      admissionLogger.info('验收策略生成成功', {
        supplierId: strategyForm.supplierId,
        level: strategy.inspectionLevel,
      });
    } catch (error) {
      admissionLogger.error('生成验收策略失败', error as Error);
      Alert.alert('错误', '生成验收策略失败');
    } finally {
      setGeneratingStrategy(false);
    }
  };

  // 保存规则配置
  const handleSaveRules = async () => {
    if (!factoryId) return;

    try {
      setSavingRules(true);
      const updated = await supplierAdmissionApiClient.updateRuleConfiguration(
        editedRules,
        factoryId
      );
      setRuleConfig(updated);
      admissionLogger.info('规则配置保存成功', { version: updated.version });
      Alert.alert('成功', '规则配置已保存');
    } catch (error) {
      admissionLogger.error('保存规则配置失败', error as Error);
      Alert.alert('错误', '保存失败');
    } finally {
      setSavingRules(false);
    }
  };

  // 筛选供应商
  const filteredSuppliers = suppliers.filter((s) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.supplierCode.toLowerCase().includes(query) ||
      (s.contactPerson && s.contactPerson.toLowerCase().includes(query))
    );
  });

  // 渲染评估结果 Chip
  const renderGradeChip = (result: AdmissionEvaluationResult | undefined) => {
    if (!result) return null;

    return (
      <Chip
        mode="flat"
        compact
        style={[styles.gradeChip, { backgroundColor: getGradeColor(result.grade) + '20' }]}
        textStyle={{ color: getGradeColor(result.grade), fontWeight: 'bold' }}
      >
        {result.grade} ({result.score}分)
      </Chip>
    );
  };

  // 渲染评估 Tab
  const renderEvaluateTab = () => (
    <ScrollView
      style={styles.tabContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 搜索和批量操作 */}
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="搜索供应商"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchbar}
        />
        <Button
          mode="contained"
          onPress={handleBatchEvaluate}
          style={styles.batchButton}
          disabled={loading || suppliers.length === 0}
          compact
        >
          批量评估
        </Button>
      </View>

      {/* 统计卡片 */}
      <Card style={styles.statsCard}>
        <Card.Content>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{suppliers.length}</Text>
              <Text style={styles.statLabel}>供应商总数</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                {Object.values(evaluationResults).filter((r) => r.admitted).length}
              </Text>
              <Text style={styles.statLabel}>已准入</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF9800' }]}>
                {Object.values(evaluationResults).filter((r) => !r.admitted).length}
              </Text>
              <Text style={styles.statLabel}>未准入</Text>
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* 供应商列表 */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      ) : filteredSuppliers.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Content style={styles.emptyContent}>
            <List.Icon icon="account-search" color="#999" />
            <Text style={styles.emptyText}>暂无供应商</Text>
          </Card.Content>
        </Card>
      ) : (
        filteredSuppliers.map((supplier) => {
          const result = evaluationResults[supplier.id];
          const isEvaluating = evaluatingId === supplier.id;

          return (
            <Card key={supplier.id} style={styles.supplierCard}>
              <Card.Content>
                <View style={styles.supplierHeader}>
                  <View>
                    <Text style={styles.supplierName}>{supplier.name}</Text>
                    <Text style={styles.supplierCode}>{supplier.supplierCode}</Text>
                  </View>
                  <View style={styles.gradeArea}>
                    {isEvaluating ? (
                      <ActivityIndicator size="small" />
                    ) : result ? (
                      renderGradeChip(result)
                    ) : (
                      <Chip mode="outlined" compact>
                        未评估
                      </Chip>
                    )}
                  </View>
                </View>

                {/* 评估结果详情 */}
                {result && (
                  <View style={styles.resultDetails}>
                    <View style={styles.resultRow}>
                      <Chip
                        icon={result.admitted ? 'check-circle' : 'close-circle'}
                        mode="flat"
                        compact
                        style={{
                          backgroundColor: result.admitted ? '#E8F5E9' : '#FFEBEE',
                        }}
                        textStyle={{
                          color: result.admitted ? '#2E7D32' : '#C62828',
                        }}
                      >
                        {result.admitted ? '已准入' : '未准入'}
                      </Chip>
                      <Text style={styles.gradeLabel}>{getGradeLabel(result.grade)}</Text>
                    </View>

                    {/* 拒绝原因 */}
                    {!result.admitted && result.rejectionReasons.length > 0 && (
                      <View style={styles.rejectionBox}>
                        <Text style={styles.rejectionTitle}>拒绝原因:</Text>
                        {result.rejectionReasons.slice(0, 2).map((reason, idx) => (
                          <Text key={idx} style={styles.rejectionItem}>
                            • {reason.description}
                          </Text>
                        ))}
                      </View>
                    )}

                    {/* 改进建议 */}
                    {result.improvements.length > 0 && (
                      <View style={styles.improvementBox}>
                        <Text style={styles.improvementTitle}>改进建议:</Text>
                        {result.improvements.slice(0, 2).map((item, idx) => (
                          <Text key={idx} style={styles.improvementItem}>
                            • {item}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* 操作按钮 */}
                <View style={styles.actionRow}>
                  <Button
                    mode="outlined"
                    onPress={() => handleEvaluate(supplier.id)}
                    disabled={isEvaluating}
                    compact
                    icon="clipboard-check"
                  >
                    {result ? '重新评估' : '评估'}
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => handleViewReport(supplier)}
                    compact
                    icon="file-document"
                  >
                    详细报告
                  </Button>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setStrategyForm({
                        supplierId: supplier.id,
                        materialTypeId: '',
                        quantity: '100',
                      });
                      setAcceptanceStrategy(null);
                      setAcceptanceModalVisible(true);
                    }}
                    compact
                    icon="clipboard-list"
                  >
                    验收策略
                  </Button>
                </View>
              </Card.Content>
            </Card>
          );
        })
      )}

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  // 渲染规则配置 Tab
  const renderRulesTab = () => (
    <ScrollView style={styles.tabContent}>
      {loadingRules ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>加载规则配置...</Text>
        </View>
      ) : (
        <>
          {/* 准入规则 */}
          <Card style={styles.ruleCard}>
            <Card.Title title="准入规则" titleStyle={styles.cardTitle} />
            <Card.Content>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>要求营业执照</Text>
                <Switch
                  value={editedRules.admissionRules?.requireBusinessLicense ?? true}
                  onValueChange={(value) =>
                    setEditedRules({
                      ...editedRules,
                      admissionRules: {
                        ...editedRules.admissionRules!,
                        requireBusinessLicense: value,
                      },
                    })
                  }
                />
              </View>
              <Divider style={styles.ruleDivider} />

              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>要求质量认证</Text>
                <Switch
                  value={editedRules.admissionRules?.requireQualityCertificates ?? true}
                  onValueChange={(value) =>
                    setEditedRules({
                      ...editedRules,
                      admissionRules: {
                        ...editedRules.admissionRules!,
                        requireQualityCertificates: value,
                      },
                    })
                  }
                />
              </View>
              <Divider style={styles.ruleDivider} />

              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>最低评级</Text>
                <TextInput
                  value={String(editedRules.admissionRules?.minRating ?? 60)}
                  onChangeText={(text) =>
                    setEditedRules({
                      ...editedRules,
                      admissionRules: {
                        ...editedRules.admissionRules!,
                        minRating: parseInt(text) || 0,
                      },
                    })
                  }
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.ruleInput}
                  dense
                />
              </View>
              <Divider style={styles.ruleDivider} />

              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>最低历史合格率 (%)</Text>
                <TextInput
                  value={String((editedRules.admissionRules?.minHistoricalPassRate ?? 0.8) * 100)}
                  onChangeText={(text) =>
                    setEditedRules({
                      ...editedRules,
                      admissionRules: {
                        ...editedRules.admissionRules!,
                        minHistoricalPassRate: (parseInt(text) || 0) / 100,
                      },
                    })
                  }
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.ruleInput}
                  dense
                />
              </View>
            </Card.Content>
          </Card>

          {/* 验收规则 */}
          <Card style={styles.ruleCard}>
            <Card.Title title="验收规则" titleStyle={styles.cardTitle} />
            <Card.Content>
              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>新供应商检验级别</Text>
                <SegmentedButtons
                  value={editedRules.acceptanceRules?.newSupplierLevel || 'NORMAL'}
                  onValueChange={(value) =>
                    setEditedRules({
                      ...editedRules,
                      acceptanceRules: {
                        ...editedRules.acceptanceRules!,
                        newSupplierLevel: value as InspectionLevel,
                      },
                    })
                  }
                  buttons={[
                    { value: 'RELAXED', label: '宽松' },
                    { value: 'NORMAL', label: '正常' },
                    { value: 'STRICT', label: '加严' },
                  ]}
                  style={styles.segmentedButtons}
                />
              </View>
              <Divider style={styles.ruleDivider} />

              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>默认抽样比例 (%)</Text>
                <TextInput
                  value={String((editedRules.acceptanceRules?.defaultSamplePercentage ?? 0.1) * 100)}
                  onChangeText={(text) =>
                    setEditedRules({
                      ...editedRules,
                      acceptanceRules: {
                        ...editedRules.acceptanceRules!,
                        defaultSamplePercentage: (parseInt(text) || 0) / 100,
                      },
                    })
                  }
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.ruleInput}
                  dense
                />
              </View>
              <Divider style={styles.ruleDivider} />

              <View style={styles.ruleRow}>
                <Text style={styles.ruleLabel}>高风险抽样比例 (%)</Text>
                <TextInput
                  value={String((editedRules.acceptanceRules?.highRiskSamplePercentage ?? 0.3) * 100)}
                  onChangeText={(text) =>
                    setEditedRules({
                      ...editedRules,
                      acceptanceRules: {
                        ...editedRules.acceptanceRules!,
                        highRiskSamplePercentage: (parseInt(text) || 0) / 100,
                      },
                    })
                  }
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.ruleInput}
                  dense
                />
              </View>
            </Card.Content>
          </Card>

          {/* 保存按钮 */}
          <Button
            mode="contained"
            onPress={handleSaveRules}
            loading={savingRules}
            disabled={savingRules}
            style={styles.saveButton}
          >
            保存规则配置
          </Button>

          {ruleConfig && (
            <Text style={styles.versionText}>当前版本: v{ruleConfig.version}</Text>
          )}

          <View style={styles.bottomPadding} />
        </>
      )}
    </ScrollView>
  );

  // 渲染验收策略 Tab
  const renderAcceptanceTab = () => (
    <ScrollView style={styles.tabContent}>
      <Card style={styles.infoCard}>
        <Card.Title title="验收策略生成" titleStyle={styles.cardTitle} />
        <Card.Content>
          <Text style={styles.infoText}>
            根据供应商的历史表现和规则配置，自动生成个性化的验收策略，包括检验级别、抽样方案和检验项目。
          </Text>

          <Button
            mode="contained"
            onPress={() => {
              setStrategyForm({ supplierId: '', materialTypeId: '', quantity: '100' });
              setAcceptanceStrategy(null);
              setAcceptanceModalVisible(true);
            }}
            icon="clipboard-plus"
            style={styles.generateButton}
          >
            生成验收策略
          </Button>
        </Card.Content>
      </Card>

      {/* 检验级别说明 */}
      <Card style={styles.levelCard}>
        <Card.Title title="检验级别说明" titleStyle={styles.cardTitle} />
        <Card.Content>
          <View style={styles.levelRow}>
            <Chip
              mode="flat"
              style={[styles.levelChip, { backgroundColor: getInspectionLevelColor('RELAXED') + '20' }]}
              textStyle={{ color: getInspectionLevelColor('RELAXED') }}
            >
              宽松检验
            </Chip>
            <Text style={styles.levelDesc}>历史表现优秀的供应商，减少抽样比例</Text>
          </View>
          <Divider style={styles.levelDivider} />
          <View style={styles.levelRow}>
            <Chip
              mode="flat"
              style={[styles.levelChip, { backgroundColor: getInspectionLevelColor('NORMAL') + '20' }]}
              textStyle={{ color: getInspectionLevelColor('NORMAL') }}
            >
              正常检验
            </Chip>
            <Text style={styles.levelDesc}>标准检验流程，按配置的抽样比例执行</Text>
          </View>
          <Divider style={styles.levelDivider} />
          <View style={styles.levelRow}>
            <Chip
              mode="flat"
              style={[styles.levelChip, { backgroundColor: getInspectionLevelColor('STRICT') + '20' }]}
              textStyle={{ color: getInspectionLevelColor('STRICT') }}
            >
              加严检验
            </Chip>
            <Text style={styles.levelDesc}>新供应商或历史问题供应商，增加抽样比例</Text>
          </View>
        </Card.Content>
      </Card>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="供应商准入管理" />
        <Appbar.Action icon="refresh" onPress={loadSuppliers} />
      </Appbar.Header>

      {/* Tab 切换 */}
      <SegmentedButtons
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        buttons={[
          { value: 'evaluate', label: '准入评估', icon: 'clipboard-check' },
          { value: 'rules', label: '规则配置', icon: 'cog' },
          { value: 'acceptance', label: '验收策略', icon: 'clipboard-list' },
        ]}
        style={styles.tabs}
      />

      {/* Tab 内容 */}
      {activeTab === 'evaluate' && renderEvaluateTab()}
      {activeTab === 'rules' && renderRulesTab()}
      {activeTab === 'acceptance' && renderAcceptanceTab()}

      {/* 详情报告 Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>
            供应商报告: {selectedSupplier?.name}
          </Text>

          {loadingReport ? (
            <View style={styles.modalLoading}>
              <ActivityIndicator size="large" />
              <Text>加载报告中...</Text>
            </View>
          ) : supplierReport ? (
            <ScrollView style={styles.modalScrollView}>
              {/* 准入状态 */}
              <Card style={styles.reportCard}>
                <Card.Title title="准入评估" />
                <Card.Content>
                  <View style={styles.reportRow}>
                    <Text>评估结果:</Text>
                    {renderGradeChip(supplierReport.admissionEvaluation)}
                  </View>
                  <View style={styles.reportRow}>
                    <Text>状态:</Text>
                    <Chip
                      mode="flat"
                      compact
                      style={{
                        backgroundColor: supplierReport.admissionEvaluation.admitted
                          ? '#E8F5E9'
                          : '#FFEBEE',
                      }}
                    >
                      {supplierReport.admissionEvaluation.admitted ? '已准入' : '未准入'}
                    </Chip>
                  </View>
                </Card.Content>
              </Card>

              {/* 历史数据 */}
              <Card style={styles.reportCard}>
                <Card.Title title="历史数据" />
                <Card.Content>
                  <DataTable>
                    <DataTable.Row>
                      <DataTable.Cell>总供货次数</DataTable.Cell>
                      <DataTable.Cell numeric>
                        {supplierReport.historicalData.totalSupplyCount}
                      </DataTable.Cell>
                    </DataTable.Row>
                    <DataTable.Row>
                      <DataTable.Cell>平均合格率</DataTable.Cell>
                      <DataTable.Cell numeric>
                        {(supplierReport.historicalData.averagePassRate * 100).toFixed(1)}%
                      </DataTable.Cell>
                    </DataTable.Row>
                    <DataTable.Row>
                      <DataTable.Cell>总供货量</DataTable.Cell>
                      <DataTable.Cell numeric>
                        {supplierReport.historicalData.totalQuantitySupplied} kg
                      </DataTable.Cell>
                    </DataTable.Row>
                  </DataTable>
                </Card.Content>
              </Card>

              {/* 建议 */}
              {supplierReport.recommendations.length > 0 && (
                <Card style={styles.reportCard}>
                  <Card.Title title="改进建议" />
                  <Card.Content>
                    {supplierReport.recommendations.map((rec, idx) => (
                      <Text key={idx} style={styles.recommendationItem}>
                        {idx + 1}. {rec}
                      </Text>
                    ))}
                  </Card.Content>
                </Card>
              )}
            </ScrollView>
          ) : (
            <Text style={styles.noDataText}>无法加载报告</Text>
          )}

          <Button mode="contained" onPress={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        </Modal>
      </Portal>

      {/* 验收策略 Modal */}
      <Portal>
        <Modal
          visible={acceptanceModalVisible}
          onDismiss={() => setAcceptanceModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>生成验收策略</Text>

          <ScrollView style={styles.modalScrollView}>
            {!acceptanceStrategy ? (
              <>
                <TextInput
                  label="供应商ID"
                  value={strategyForm.supplierId}
                  onChangeText={(text) => setStrategyForm({ ...strategyForm, supplierId: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="材料类型ID"
                  value={strategyForm.materialTypeId}
                  onChangeText={(text) => setStrategyForm({ ...strategyForm, materialTypeId: text })}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="数量 (kg)"
                  value={strategyForm.quantity}
                  onChangeText={(text) => setStrategyForm({ ...strategyForm, quantity: text })}
                  mode="outlined"
                  keyboardType="number-pad"
                  style={styles.input}
                />
              </>
            ) : (
              <>
                {/* 策略结果 */}
                <Card style={styles.strategyCard}>
                  <Card.Title title="检验级别" />
                  <Card.Content>
                    <Chip
                      mode="flat"
                      style={[
                        styles.levelChip,
                        {
                          backgroundColor:
                            getInspectionLevelColor(acceptanceStrategy.inspectionLevel) + '20',
                        },
                      ]}
                      textStyle={{
                        color: getInspectionLevelColor(acceptanceStrategy.inspectionLevel),
                      }}
                    >
                      {getInspectionLevelLabel(acceptanceStrategy.inspectionLevel)}
                    </Chip>
                    <Text style={styles.rationaleText}>{acceptanceStrategy.rationale}</Text>
                  </Card.Content>
                </Card>

                <Card style={styles.strategyCard}>
                  <Card.Title title="抽样方案" />
                  <Card.Content>
                    <DataTable>
                      <DataTable.Row>
                        <DataTable.Cell>抽样比例</DataTable.Cell>
                        <DataTable.Cell numeric>
                          {(acceptanceStrategy.samplingPlan.samplePercentage * 100).toFixed(1)}%
                        </DataTable.Cell>
                      </DataTable.Row>
                      <DataTable.Row>
                        <DataTable.Cell>计算抽样量</DataTable.Cell>
                        <DataTable.Cell numeric>
                          {acceptanceStrategy.samplingPlan.calculatedSampleSize} 件
                        </DataTable.Cell>
                      </DataTable.Row>
                      <DataTable.Row>
                        <DataTable.Cell>接受数</DataTable.Cell>
                        <DataTable.Cell numeric>
                          ≤ {acceptanceStrategy.samplingPlan.acceptanceNumber}
                        </DataTable.Cell>
                      </DataTable.Row>
                      <DataTable.Row>
                        <DataTable.Cell>拒收数</DataTable.Cell>
                        <DataTable.Cell numeric>
                          ≥ {acceptanceStrategy.samplingPlan.rejectionNumber}
                        </DataTable.Cell>
                      </DataTable.Row>
                    </DataTable>
                  </Card.Content>
                </Card>

                {acceptanceStrategy.inspectionItems.length > 0 && (
                  <Card style={styles.strategyCard}>
                    <Card.Title title="检验项目" />
                    <Card.Content>
                      {acceptanceStrategy.inspectionItems.map((item, idx) => (
                        <View key={idx} style={styles.inspectionItem}>
                          <Text style={styles.inspectionName}>
                            {item.mandatory ? '★ ' : ''}
                            {item.name}
                          </Text>
                          <Text style={styles.inspectionDetail}>
                            方法: {item.method} | 标准: {item.standardValue}
                          </Text>
                        </View>
                      ))}
                    </Card.Content>
                  </Card>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.modalActions}>
            <Button mode="outlined" onPress={() => setAcceptanceModalVisible(false)}>
              {acceptanceStrategy ? '关闭' : '取消'}
            </Button>
            {!acceptanceStrategy && (
              <Button
                mode="contained"
                onPress={handleGenerateStrategy}
                loading={generatingStrategy}
                disabled={generatingStrategy}
              >
                生成策略
              </Button>
            )}
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  tabs: {
    margin: 16,
    marginBottom: 8,
  },
  tabContent: {
    flex: 1,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchbar: {
    flex: 1,
  },
  batchButton: {
    height: 48,
    justifyContent: 'center',
  },
  statsCard: {
    margin: 16,
    marginBottom: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  emptyCard: {
    margin: 16,
  },
  emptyContent: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
  },
  supplierCard: {
    margin: 16,
    marginBottom: 8,
  },
  supplierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  supplierName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  supplierCode: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  gradeArea: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  gradeChip: {
    height: 32,
  },
  gradeLabel: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  resultDetails: {
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  rejectionBox: {
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  rejectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#C62828',
    marginBottom: 4,
  },
  rejectionItem: {
    fontSize: 12,
    color: '#C62828',
    marginLeft: 8,
  },
  improvementBox: {
    backgroundColor: '#FFF3E0',
    padding: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  improvementTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 4,
  },
  improvementItem: {
    fontSize: 12,
    color: '#E65100',
    marginLeft: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  // 规则配置样式
  ruleCard: {
    margin: 16,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  ruleLabel: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  ruleInput: {
    width: 80,
    height: 40,
  },
  ruleDivider: {
    marginVertical: 4,
  },
  segmentedButtons: {
    marginLeft: 8,
  },
  saveButton: {
    margin: 16,
  },
  versionText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
  },
  // 验收策略样式
  infoCard: {
    margin: 16,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  generateButton: {
    marginTop: 8,
  },
  levelCard: {
    margin: 16,
    marginBottom: 8,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  levelChip: {
    marginRight: 12,
  },
  levelDesc: {
    flex: 1,
    fontSize: 13,
    color: '#666',
  },
  levelDivider: {
    marginVertical: 4,
  },
  // Modal 样式
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalLoading: {
    padding: 40,
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  input: {
    marginBottom: 12,
  },
  noDataText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  // 报告样式
  reportCard: {
    marginBottom: 12,
  },
  reportRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  // 策略样式
  strategyCard: {
    marginBottom: 12,
  },
  rationaleText: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  inspectionItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  inspectionName: {
    fontSize: 14,
    fontWeight: '500',
  },
  inspectionDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  bottomPadding: {
    height: 80,
  },
});
