import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Searchbar,
  IconButton,
  ActivityIndicator,
  FAB,
  Portal,
  Modal,
  Button,
  TextInput,
  Menu,
  Divider,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { isAxiosError } from 'axios';
import {
  supplierApiClient,
  Supplier,
} from '../../../services/api/supplierApiClient';
import {
  supplierAdmissionApiClient,
  AdmissionEvaluationResult,
  getGradeColor,
  getGradeLabel,
} from '../../../services/api/supplierAdmissionApiClient';

// Types
type AdmissionStatus = 'pending' | 'approved' | 'rejected' | 'supplement';
type SupplierType = 'all' | 'material' | 'equipment' | 'service';

interface SupplierAdmissionItem extends Supplier {
  admissionStatus: AdmissionStatus;
  evaluationResult?: AdmissionEvaluationResult;
  submittedAt?: string;
  reviewedAt?: string;
  reviewedBy?: string;
}

// Status configuration
const STATUS_CONFIG: Record<AdmissionStatus, { label: string; color: string; bgColor: string }> = {
  pending: { label: '待审核', color: '#faad14', bgColor: '#fffbe6' },
  approved: { label: '已通过', color: '#52c41a', bgColor: '#f6ffed' },
  rejected: { label: '已拒绝', color: '#ff4d4f', bgColor: '#fff2f0' },
  supplement: { label: '补充材料', color: '#1890ff', bgColor: '#e6f7ff' },
};

const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'material', label: '原料供应商' },
  { key: 'equipment', label: '设备供应商' },
  { key: 'service', label: '服务供应商' },
];

const STATUS_FILTERS: { key: AdmissionStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部状态' },
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已拒绝' },
  { key: 'supplement', label: '补充材料' },
];

export default function SupplierAdmissionScreen() {
  const navigation = useNavigation();

  // State
  const [suppliers, setSuppliers] = useState<SupplierAdmissionItem[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<SupplierAdmissionItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AdmissionStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<SupplierType>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [evaluating, setEvaluating] = useState<string | null>(null);

  // Modal state
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [supplementModalVisible, setSupplementModalVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierAdmissionItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [supplementNote, setSupplementNote] = useState('');
  const [statusMenuVisible, setStatusMenuVisible] = useState(false);

  // Stats
  const pendingCount = suppliers.filter(s => s.admissionStatus === 'pending').length;
  const approvedCount = suppliers.filter(s => s.admissionStatus === 'approved').length;
  const rejectedCount = suppliers.filter(s => s.admissionStatus === 'rejected').length;

  // Fetch suppliers
  const fetchSuppliers = useCallback(async () => {
    try {
      const response = await supplierApiClient.getSuppliers({});

      // Transform to admission items with mock status
      const admissionItems: SupplierAdmissionItem[] = response.data.map((supplier) => ({
        ...supplier,
        admissionStatus: supplier.isActive ? 'approved' : 'pending',
        submittedAt: supplier.createdAt,
      }));

      setSuppliers(admissionItems);
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '无法加载供应商列表');
      } else if (error instanceof Error) {
        Alert.alert('加载失败', error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  // Filter suppliers
  useEffect(() => {
    let result = [...suppliers];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(query) ||
          s.supplierCode.toLowerCase().includes(query) ||
          (s.contactPerson?.toLowerCase() || '').includes(query)
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(s => s.admissionStatus === statusFilter);
    }

    // Type filter (using businessType field)
    if (typeFilter !== 'all') {
      result = result.filter(s => s.businessType === typeFilter);
    }

    setFilteredSuppliers(result);
  }, [suppliers, searchQuery, statusFilter, typeFilter]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchSuppliers();
  }, [fetchSuppliers]);

  // Evaluate admission
  const handleEvaluate = async (supplier: SupplierAdmissionItem) => {
    setEvaluating(supplier.id);
    try {
      const result = await supplierAdmissionApiClient.evaluateAdmission(supplier.id);

      // Update supplier with evaluation result
      setSuppliers(prev => prev.map(s =>
        s.id === supplier.id
          ? { ...s, evaluationResult: result }
          : s
      ));

      // Show result
      Alert.alert(
        '评估完成',
        `供应商 ${supplier.name}\n评分: ${result.score}\n评级: ${getGradeLabel(result.grade)}\n${result.admitted ? '准入资格通过' : '准入资格不通过'}`,
        [{ text: '确定' }]
      );
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('评估失败', error.message);
      }
    } finally {
      setEvaluating(null);
    }
  };

  // Approve supplier
  const handleApprove = async (supplier: SupplierAdmissionItem) => {
    Alert.alert(
      '确认通过',
      `确定通过供应商 "${supplier.name}" 的准入申请吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              await supplierApiClient.toggleSupplierStatus(supplier.id, true);
              setSuppliers(prev => prev.map(s =>
                s.id === supplier.id
                  ? { ...s, admissionStatus: 'approved', isActive: true, reviewedAt: new Date().toISOString() }
                  : s
              ));
              Alert.alert('成功', '供应商准入已通过');
            } catch (error) {
              if (error instanceof Error) {
                Alert.alert('操作失败', error.message);
              }
            }
          },
        },
      ]
    );
  };

  // Reject supplier
  const handleReject = async () => {
    if (!selectedSupplier || !rejectReason.trim()) {
      Alert.alert('提示', '请填写拒绝原因');
      return;
    }

    try {
      await supplierApiClient.toggleSupplierStatus(selectedSupplier.id, false);
      setSuppliers(prev => prev.map(s =>
        s.id === selectedSupplier.id
          ? { ...s, admissionStatus: 'rejected', isActive: false, reviewedAt: new Date().toISOString() }
          : s
      ));
      setRejectModalVisible(false);
      setRejectReason('');
      setSelectedSupplier(null);
      Alert.alert('成功', '供应商准入已拒绝');
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('操作失败', error.message);
      }
    }
  };

  // Request supplement materials
  const handleRequestSupplement = async () => {
    if (!selectedSupplier || !supplementNote.trim()) {
      Alert.alert('提示', '请填写需要补充的材料说明');
      return;
    }

    // Update local state (in real implementation, this would call an API)
    setSuppliers(prev => prev.map(s =>
      s.id === selectedSupplier.id
        ? { ...s, admissionStatus: 'supplement' }
        : s
    ));
    setSupplementModalVisible(false);
    setSupplementNote('');
    setSelectedSupplier(null);
    Alert.alert('成功', '已通知供应商补充材料');
  };

  // View detail
  const handleViewDetail = (supplier: SupplierAdmissionItem) => {
    setSelectedSupplier(supplier);
    setDetailModalVisible(true);
  };

  // Render supplier card
  const renderSupplierCard = (supplier: SupplierAdmissionItem) => {
    const statusConfig = STATUS_CONFIG[supplier.admissionStatus];
    const isEvaluating = evaluating === supplier.id;

    return (
      <Card key={supplier.id} style={styles.supplierCard} mode="elevated">
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => handleViewDetail(supplier)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.supplierInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.supplierName}>{supplier.name}</Text>
                <Chip
                  mode="flat"
                  style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
                  textStyle={{ color: statusConfig.color, fontSize: 11 }}
                >
                  {statusConfig.label}
                </Chip>
              </View>
              <Text style={styles.supplierCode}>
                {supplier.supplierCode} | {supplier.contactPerson || '未设置联系人'}
              </Text>
              <Text style={styles.supplierMeta}>
                {supplier.phone || supplier.email || '暂无联系方式'}
              </Text>
            </View>
          </View>

          {/* Evaluation Result */}
          {supplier.evaluationResult && (
            <View style={styles.evaluationSection}>
              <View style={styles.evaluationRow}>
                <Text style={styles.evaluationLabel}>评估评分:</Text>
                <Text style={[styles.evaluationValue, { color: getGradeColor(supplier.evaluationResult.grade) }]}>
                  {supplier.evaluationResult.score}分 ({supplier.evaluationResult.grade}级)
                </Text>
              </View>
              {supplier.evaluationResult.rejectionReasons.length > 0 && (
                <View style={styles.reasonsContainer}>
                  <Text style={styles.reasonsTitle}>未通过项:</Text>
                  {supplier.evaluationResult.rejectionReasons.slice(0, 2).map((reason, index) => (
                    <Text key={index} style={styles.reasonItem}>
                      - {reason.description}
                    </Text>
                  ))}
                  {supplier.evaluationResult.rejectionReasons.length > 2 && (
                    <Text style={styles.moreReasons}>
                      ...还有 {supplier.evaluationResult.rejectionReasons.length - 2} 项
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Qualification Documents */}
          <View style={styles.qualificationSection}>
            <Text style={styles.qualificationTitle}>资质文件</Text>
            <View style={styles.qualificationRow}>
              <Chip
                mode="flat"
                icon={supplier.businessType ? 'check-circle' : 'close-circle'}
                style={[
                  styles.qualificationChip,
                  { backgroundColor: supplier.businessType ? '#f6ffed' : '#fff2f0' },
                ]}
                textStyle={{ fontSize: 11, color: supplier.businessType ? '#52c41a' : '#ff4d4f' }}
              >
                营业执照
              </Chip>
              <Chip
                mode="flat"
                icon={supplier.creditLevel ? 'check-circle' : 'close-circle'}
                style={[
                  styles.qualificationChip,
                  { backgroundColor: supplier.creditLevel ? '#f6ffed' : '#fff2f0' },
                ]}
                textStyle={{ fontSize: 11, color: supplier.creditLevel ? '#52c41a' : '#ff4d4f' }}
              >
                信用评级
              </Chip>
              <Chip
                mode="flat"
                icon={supplier.rating && supplier.rating >= 3 ? 'check-circle' : 'close-circle'}
                style={[
                  styles.qualificationChip,
                  { backgroundColor: supplier.rating && supplier.rating >= 3 ? '#f6ffed' : '#fff2f0' },
                ]}
                textStyle={{
                  fontSize: 11,
                  color: supplier.rating && supplier.rating >= 3 ? '#52c41a' : '#ff4d4f'
                }}
              >
                质量认证
              </Chip>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Actions */}
          <View style={styles.actionRow}>
            <Button
              mode="text"
              compact
              onPress={() => handleEvaluate(supplier)}
              loading={isEvaluating}
              disabled={isEvaluating}
              icon="clipboard-check-outline"
            >
              评估
            </Button>
            {supplier.admissionStatus === 'pending' && (
              <>
                <Button
                  mode="text"
                  compact
                  textColor="#52c41a"
                  onPress={() => handleApprove(supplier)}
                  icon="check"
                >
                  通过
                </Button>
                <Button
                  mode="text"
                  compact
                  textColor="#ff4d4f"
                  onPress={() => {
                    setSelectedSupplier(supplier);
                    setRejectModalVisible(true);
                  }}
                  icon="close"
                >
                  拒绝
                </Button>
                <Button
                  mode="text"
                  compact
                  textColor="#1890ff"
                  onPress={() => {
                    setSelectedSupplier(supplier);
                    setSupplementModalVisible(true);
                  }}
                  icon="file-document-edit-outline"
                >
                  补充
                </Button>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            size={24}
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.headerTitle}>供应商准入审核</Text>
          <IconButton
            icon="refresh"
            iconColor="#fff"
            size={24}
            onPress={handleRefresh}
          />
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Search Bar */}
        <Searchbar
          placeholder="搜索供应商名称、代码、联系人"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statsCard, statusFilter === 'pending' && styles.statsCardActive]}
            onPress={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
          >
            <Text style={[styles.statsValue, { color: '#faad14' }]}>{pendingCount}</Text>
            <Text style={styles.statsLabel}>待审核</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statsCard, statusFilter === 'approved' && styles.statsCardActive]}
            onPress={() => setStatusFilter(statusFilter === 'approved' ? 'all' : 'approved')}
          >
            <Text style={[styles.statsValue, { color: '#52c41a' }]}>{approvedCount}</Text>
            <Text style={styles.statsLabel}>已通过</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statsCard, statusFilter === 'rejected' && styles.statsCardActive]}
            onPress={() => setStatusFilter(statusFilter === 'rejected' ? 'all' : 'rejected')}
          >
            <Text style={[styles.statsValue, { color: '#ff4d4f' }]}>{rejectedCount}</Text>
            <Text style={styles.statsLabel}>已拒绝</Text>
          </TouchableOpacity>
        </View>

        {/* Type Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          {TYPE_FILTERS.map(filter => (
            <TouchableOpacity
              key={filter.key}
              onPress={() => setTypeFilter(filter.key as SupplierType)}
            >
              <Chip
                mode="flat"
                selected={typeFilter === filter.key}
                style={[
                  styles.filterChip,
                  typeFilter === filter.key && styles.filterChipSelected,
                ]}
                textStyle={[
                  styles.filterChipText,
                  typeFilter === filter.key && styles.filterChipTextSelected,
                ]}
              >
                {filter.label}
              </Chip>
            </TouchableOpacity>
          ))}

          {/* Status Menu */}
          <Menu
            visible={statusMenuVisible}
            onDismiss={() => setStatusMenuVisible(false)}
            anchor={
              <TouchableOpacity onPress={() => setStatusMenuVisible(true)}>
                <Chip
                  mode="flat"
                  icon="filter-variant"
                  style={styles.filterChip}
                  textStyle={styles.filterChipText}
                >
                  {STATUS_FILTERS.find(f => f.key === statusFilter)?.label || '状态筛选'}
                </Chip>
              </TouchableOpacity>
            }
          >
            {STATUS_FILTERS.map(filter => (
              <Menu.Item
                key={filter.key}
                onPress={() => {
                  setStatusFilter(filter.key);
                  setStatusMenuVisible(false);
                }}
                title={filter.label}
                leadingIcon={statusFilter === filter.key ? 'check' : undefined}
              />
            ))}
          </Menu>
        </ScrollView>

        {/* Supplier List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredSuppliers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>暂无匹配的供应商</Text>
            <Text style={styles.emptySubtext}>请尝试调整筛选条件</Text>
          </View>
        ) : (
          filteredSuppliers.map(renderSupplierCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => setDetailModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          {selectedSupplier && (
            <ScrollView>
              <Text style={styles.modalTitle}>供应商详情</Text>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>供应商名称</Text>
                <Text style={styles.detailValue}>{selectedSupplier.name}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>供应商代码</Text>
                <Text style={styles.detailValue}>{selectedSupplier.supplierCode}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>联系人</Text>
                <Text style={styles.detailValue}>{selectedSupplier.contactPerson || '未设置'}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>联系电话</Text>
                <Text style={styles.detailValue}>{selectedSupplier.phone || '未设置'}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>地址</Text>
                <Text style={styles.detailValue}>{selectedSupplier.address || '未设置'}</Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>信用额度</Text>
                <Text style={styles.detailValue}>
                  {selectedSupplier.creditLimit ? `${selectedSupplier.creditLimit.toLocaleString()} 元` : '未设置'}
                </Text>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.detailLabel}>评级</Text>
                <Text style={styles.detailValue}>
                  {selectedSupplier.rating ? `${selectedSupplier.rating} 星` : '未评级'}
                </Text>
              </View>

              {selectedSupplier.evaluationResult && (
                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>准入评估</Text>
                  <View style={styles.evaluationDetail}>
                    <Text style={styles.detailValue}>
                      评分: {selectedSupplier.evaluationResult.score}
                    </Text>
                    <Text style={styles.detailValue}>
                      评级: {getGradeLabel(selectedSupplier.evaluationResult.grade)}
                    </Text>
                    <Text style={styles.detailValue}>
                      {selectedSupplier.evaluationResult.admitted ? '准入通过' : '准入不通过'}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setDetailModalVisible(false)}
                >
                  关闭
                </Button>
                {selectedSupplier.admissionStatus === 'pending' && (
                  <Button
                    mode="contained"
                    onPress={() => {
                      setDetailModalVisible(false);
                      handleApprove(selectedSupplier);
                    }}
                  >
                    通过准入
                  </Button>
                )}
              </View>
            </ScrollView>
          )}
        </Modal>
      </Portal>

      {/* Reject Modal */}
      <Portal>
        <Modal
          visible={rejectModalVisible}
          onDismiss={() => {
            setRejectModalVisible(false);
            setRejectReason('');
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>拒绝准入</Text>
          <Text style={styles.modalSubtitle}>
            供应商: {selectedSupplier?.name}
          </Text>
          <TextInput
            label="拒绝原因"
            mode="outlined"
            multiline
            numberOfLines={4}
            value={rejectReason}
            onChangeText={setRejectReason}
            style={styles.modalInput}
            placeholder="请填写拒绝原因..."
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setRejectModalVisible(false);
                setRejectReason('');
              }}
            >
              取消
            </Button>
            <Button
              mode="contained"
              buttonColor="#ff4d4f"
              onPress={handleReject}
            >
              确认拒绝
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Supplement Modal */}
      <Portal>
        <Modal
          visible={supplementModalVisible}
          onDismiss={() => {
            setSupplementModalVisible(false);
            setSupplementNote('');
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>要求补充材料</Text>
          <Text style={styles.modalSubtitle}>
            供应商: {selectedSupplier?.name}
          </Text>
          <TextInput
            label="需要补充的材料"
            mode="outlined"
            multiline
            numberOfLines={4}
            value={supplementNote}
            onChangeText={setSupplementNote}
            style={styles.modalInput}
            placeholder="请说明需要补充的材料内容..."
          />
          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setSupplementModalVisible(false);
                setSupplementNote('');
              }}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleRequestSupplement}
            >
              发送通知
            </Button>
          </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statsCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  statsCardActive: {
    borderColor: '#1a1a2e',
    borderWidth: 2,
  },
  statsValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statsLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  filterScroll: {
    marginBottom: 16,
  },
  filterContainer: {
    gap: 8,
    alignItems: 'center',
  },
  filterChip: {
    backgroundColor: '#fff',
  },
  filterChipSelected: {
    backgroundColor: '#1a1a2e',
  },
  filterChipText: {
    color: '#595959',
    fontSize: 13,
  },
  filterChipTextSelected: {
    color: '#fff',
  },
  supplierCard: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  cardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  supplierInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  supplierName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  statusChip: {
    height: 24,
  },
  supplierCode: {
    fontSize: 13,
    color: '#595959',
    marginBottom: 2,
  },
  supplierMeta: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  evaluationSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fafafa',
    borderRadius: 8,
  },
  evaluationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  evaluationLabel: {
    fontSize: 13,
    color: '#595959',
  },
  evaluationValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  reasonsContainer: {
    marginTop: 8,
  },
  reasonsTitle: {
    fontSize: 12,
    color: '#ff4d4f',
    fontWeight: '500',
    marginBottom: 4,
  },
  reasonItem: {
    fontSize: 12,
    color: '#8c8c8c',
    marginLeft: 8,
  },
  moreReasons: {
    fontSize: 11,
    color: '#1890ff',
    marginLeft: 8,
    marginTop: 4,
  },
  qualificationSection: {
    marginTop: 12,
  },
  qualificationTitle: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 8,
  },
  qualificationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  qualificationChip: {
    height: 28,
  },
  divider: {
    marginVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 4,
  },
  loadingContainer: {
    padding: 48,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#8c8c8c',
  },
  emptyContainer: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#595959',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  bottomPadding: {
    height: 80,
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#595959',
    marginBottom: 16,
  },
  modalInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 8,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    color: '#262626',
  },
  evaluationDetail: {
    marginTop: 4,
  },
});
