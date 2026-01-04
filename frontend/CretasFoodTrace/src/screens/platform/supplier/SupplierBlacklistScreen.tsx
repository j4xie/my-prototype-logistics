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

// Types
interface BlacklistedSupplier extends Supplier {
  blacklistReason: string;
  blacklistedAt: string;
  blacklistedBy: string;
  expiresAt?: string;
}

interface SupplierForBlacklist extends Supplier {
  // Candidate for blacklisting
}

export default function SupplierBlacklistScreen() {
  const navigation = useNavigation();

  // State
  const [blacklistedSuppliers, setBlacklistedSuppliers] = useState<BlacklistedSupplier[]>([]);
  const [activeSuppliers, setActiveSuppliers] = useState<SupplierForBlacklist[]>([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState<BlacklistedSupplier[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal state
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<BlacklistedSupplier | null>(null);
  const [selectedForBlacklist, setSelectedForBlacklist] = useState<SupplierForBlacklist | null>(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');

  // Mock blacklist reasons
  const BLACKLIST_REASONS = [
    '质量问题频发',
    '交货延迟严重',
    '违反合同条款',
    '资质过期未续',
    '财务问题',
    '其他原因',
  ];

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const response = await supplierApiClient.getSuppliers({});

      // Separate active and inactive (blacklisted) suppliers
      const active: SupplierForBlacklist[] = [];
      const blacklisted: BlacklistedSupplier[] = [];

      response.data.forEach((supplier) => {
        if (supplier.isActive) {
          active.push(supplier);
        } else {
          // Mock blacklist data for inactive suppliers
          blacklisted.push({
            ...supplier,
            blacklistReason: '资质不符合要求',
            blacklistedAt: supplier.updatedAt || supplier.createdAt,
            blacklistedBy: '系统管理员',
          });
        }
      });

      setActiveSuppliers(active);
      setBlacklistedSuppliers(blacklisted);
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
    fetchData();
  }, [fetchData]);

  // Filter blacklisted suppliers
  useEffect(() => {
    let result = [...blacklistedSuppliers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        s =>
          s.name.toLowerCase().includes(query) ||
          s.supplierCode.toLowerCase().includes(query) ||
          s.blacklistReason.toLowerCase().includes(query)
      );
    }

    setFilteredSuppliers(result);
  }, [blacklistedSuppliers, searchQuery]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
  }, [fetchData]);

  // Add to blacklist
  const handleAddToBlacklist = async () => {
    if (!selectedForBlacklist || !blacklistReason.trim()) {
      Alert.alert('提示', '请选择供应商并填写拉黑原因');
      return;
    }

    try {
      await supplierApiClient.toggleSupplierStatus(selectedForBlacklist.id, false);

      const newBlacklistedSupplier: BlacklistedSupplier = {
        ...selectedForBlacklist,
        isActive: false,
        blacklistReason,
        blacklistedAt: new Date().toISOString(),
        blacklistedBy: '当前用户',
      };

      setBlacklistedSuppliers(prev => [newBlacklistedSupplier, ...prev]);
      setActiveSuppliers(prev => prev.filter(s => s.id !== selectedForBlacklist.id));

      setAddModalVisible(false);
      setSelectedForBlacklist(null);
      setBlacklistReason('');
      setSupplierSearchQuery('');

      Alert.alert('成功', `供应商 "${selectedForBlacklist.name}" 已加入黑名单`);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('操作失败', error.message);
      }
    }
  };

  // Remove from blacklist
  const handleRemoveFromBlacklist = async () => {
    if (!selectedSupplier) return;

    try {
      await supplierApiClient.toggleSupplierStatus(selectedSupplier.id, true);

      const restoredSupplier: SupplierForBlacklist = {
        ...selectedSupplier,
        isActive: true,
      };

      setActiveSuppliers(prev => [restoredSupplier, ...prev]);
      setBlacklistedSuppliers(prev => prev.filter(s => s.id !== selectedSupplier.id));

      setRemoveModalVisible(false);
      setSelectedSupplier(null);

      Alert.alert('成功', `供应商 "${selectedSupplier.name}" 已移出黑名单`);
    } catch (error) {
      if (error instanceof Error) {
        Alert.alert('操作失败', error.message);
      }
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Filter active suppliers for selection
  const filteredActiveSuppliers = activeSuppliers.filter(s => {
    if (!supplierSearchQuery.trim()) return true;
    const query = supplierSearchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(query) ||
      s.supplierCode.toLowerCase().includes(query)
    );
  });

  // Render blacklisted supplier card
  const renderBlacklistCard = (supplier: BlacklistedSupplier) => {
    return (
      <Card key={supplier.id} style={styles.supplierCard} mode="elevated">
        <TouchableOpacity
          style={styles.cardContent}
          onPress={() => {
            setSelectedSupplier(supplier);
            setDetailModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={styles.supplierInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.supplierName}>{supplier.name}</Text>
                <Chip
                  mode="flat"
                  style={styles.blacklistChip}
                  textStyle={styles.blacklistChipText}
                  icon="cancel"
                >
                  黑名单
                </Chip>
              </View>
              <Text style={styles.supplierCode}>{supplier.supplierCode}</Text>
            </View>
          </View>

          <View style={styles.reasonSection}>
            <View style={styles.reasonRow}>
              <IconButton
                icon="alert-circle"
                size={18}
                iconColor="#ff4d4f"
                style={styles.reasonIcon}
              />
              <View style={styles.reasonContent}>
                <Text style={styles.reasonLabel}>拉黑原因</Text>
                <Text style={styles.reasonText}>{supplier.blacklistReason}</Text>
              </View>
            </View>
          </View>

          <View style={styles.metaSection}>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>拉黑时间</Text>
              <Text style={styles.metaValue}>{formatDate(supplier.blacklistedAt)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaLabel}>操作人</Text>
              <Text style={styles.metaValue}>{supplier.blacklistedBy}</Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.actionRow}>
            <Button
              mode="text"
              compact
              icon="eye"
              onPress={() => {
                setSelectedSupplier(supplier);
                setDetailModalVisible(true);
              }}
            >
              查看详情
            </Button>
            <Button
              mode="text"
              compact
              textColor="#52c41a"
              icon="restore"
              onPress={() => {
                setSelectedSupplier(supplier);
                setRemoveModalVisible(true);
              }}
            >
              移出黑名单
            </Button>
          </View>
        </TouchableOpacity>
      </Card>
    );
  };

  // Render supplier selection item
  const renderSupplierSelectionItem = (supplier: SupplierForBlacklist) => {
    const isSelected = selectedForBlacklist?.id === supplier.id;

    return (
      <TouchableOpacity
        key={supplier.id}
        style={[styles.selectionItem, isSelected && styles.selectionItemSelected]}
        onPress={() => setSelectedForBlacklist(supplier)}
      >
        <View style={styles.selectionContent}>
          <Text style={styles.selectionName}>{supplier.name}</Text>
          <Text style={styles.selectionCode}>{supplier.supplierCode}</Text>
        </View>
        {isSelected && (
          <IconButton icon="check-circle" iconColor="#52c41a" size={20} />
        )}
      </TouchableOpacity>
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
          <Text style={styles.headerTitle}>供应商黑名单</Text>
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
        {/* Stats Card */}
        <Card style={styles.statsCard} mode="elevated">
          <View style={styles.statsContent}>
            <View style={styles.statsItem}>
              <Text style={styles.statsValue}>{blacklistedSuppliers.length}</Text>
              <Text style={styles.statsLabel}>黑名单供应商</Text>
            </View>
            <View style={styles.statsDivider} />
            <View style={styles.statsItem}>
              <Text style={[styles.statsValue, { color: '#52c41a' }]}>{activeSuppliers.length}</Text>
              <Text style={styles.statsLabel}>正常供应商</Text>
            </View>
          </View>
        </Card>

        {/* Search Bar */}
        <Searchbar
          placeholder="搜索供应商名称、代码、拉黑原因"
          onChangeText={setSearchQuery}
          value={searchQuery}
          style={styles.searchBar}
          inputStyle={styles.searchInput}
        />

        {/* Blacklist */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredSuppliers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>暂无黑名单供应商</Text>
            <Text style={styles.emptySubtext}>点击右下角按钮添加</Text>
          </View>
        ) : (
          filteredSuppliers.map(renderBlacklistCard)
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* FAB - Add to Blacklist */}
      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => setAddModalVisible(true)}
        label="添加黑名单"
      />

      {/* Add to Blacklist Modal */}
      <Portal>
        <Modal
          visible={addModalVisible}
          onDismiss={() => {
            setAddModalVisible(false);
            setSelectedForBlacklist(null);
            setBlacklistReason('');
            setSupplierSearchQuery('');
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>添加到黑名单</Text>

          {/* Supplier Search */}
          <Searchbar
            placeholder="搜索供应商"
            onChangeText={setSupplierSearchQuery}
            value={supplierSearchQuery}
            style={styles.modalSearchBar}
            inputStyle={styles.searchInput}
          />

          {/* Supplier List */}
          <ScrollView style={styles.supplierList}>
            {filteredActiveSuppliers.length === 0 ? (
              <Text style={styles.noSupplierText}>没有可选供应商</Text>
            ) : (
              filteredActiveSuppliers.slice(0, 10).map(renderSupplierSelectionItem)
            )}
            {filteredActiveSuppliers.length > 10 && (
              <Text style={styles.moreText}>
                还有 {filteredActiveSuppliers.length - 10} 个供应商...
              </Text>
            )}
          </ScrollView>

          {/* Selected Supplier Info */}
          {selectedForBlacklist && (
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedLabel}>已选择:</Text>
              <Chip mode="flat" style={styles.selectedChip}>
                {selectedForBlacklist.name}
              </Chip>
            </View>
          )}

          {/* Reason Selection */}
          <Text style={styles.reasonSectionTitle}>拉黑原因</Text>
          <View style={styles.reasonOptions}>
            {BLACKLIST_REASONS.map(reason => (
              <TouchableOpacity
                key={reason}
                onPress={() => setBlacklistReason(reason)}
              >
                <Chip
                  mode="flat"
                  selected={blacklistReason === reason}
                  style={[
                    styles.reasonOption,
                    blacklistReason === reason && styles.reasonOptionSelected,
                  ]}
                  textStyle={[
                    styles.reasonOptionText,
                    blacklistReason === reason && styles.reasonOptionTextSelected,
                  ]}
                >
                  {reason}
                </Chip>
              </TouchableOpacity>
            ))}
          </View>

          {/* Custom Reason Input */}
          <TextInput
            label="详细原因说明（可选）"
            mode="outlined"
            multiline
            numberOfLines={2}
            value={blacklistReason}
            onChangeText={setBlacklistReason}
            style={styles.modalInput}
            placeholder="请填写详细的拉黑原因..."
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setAddModalVisible(false);
                setSelectedForBlacklist(null);
                setBlacklistReason('');
                setSupplierSearchQuery('');
              }}
            >
              取消
            </Button>
            <Button
              mode="contained"
              buttonColor="#ff4d4f"
              onPress={handleAddToBlacklist}
              disabled={!selectedForBlacklist || !blacklistReason.trim()}
            >
              确认拉黑
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Remove from Blacklist Modal */}
      <Portal>
        <Modal
          visible={removeModalVisible}
          onDismiss={() => {
            setRemoveModalVisible(false);
            setSelectedSupplier(null);
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>移出黑名单</Text>

          {selectedSupplier && (
            <>
              <View style={styles.confirmSection}>
                <Text style={styles.confirmText}>
                  确定要将供应商 "{selectedSupplier.name}" 移出黑名单吗？
                </Text>
                <View style={styles.confirmInfo}>
                  <Text style={styles.confirmLabel}>原拉黑原因:</Text>
                  <Text style={styles.confirmValue}>{selectedSupplier.blacklistReason}</Text>
                </View>
                <View style={styles.confirmInfo}>
                  <Text style={styles.confirmLabel}>拉黑时间:</Text>
                  <Text style={styles.confirmValue}>{formatDate(selectedSupplier.blacklistedAt)}</Text>
                </View>
              </View>

              <Text style={styles.warningText}>
                移出黑名单后，该供应商将恢复正常状态，可以继续供货。
              </Text>
            </>
          )}

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => {
                setRemoveModalVisible(false);
                setSelectedSupplier(null);
              }}
            >
              取消
            </Button>
            <Button
              mode="contained"
              buttonColor="#52c41a"
              onPress={handleRemoveFromBlacklist}
            >
              确认移出
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* Detail Modal */}
      <Portal>
        <Modal
          visible={detailModalVisible}
          onDismiss={() => {
            setDetailModalVisible(false);
            setSelectedSupplier(null);
          }}
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

              <Divider style={styles.detailDivider} />

              <View style={styles.blacklistDetailSection}>
                <Text style={styles.blacklistDetailTitle}>黑名单信息</Text>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>拉黑原因</Text>
                  <Text style={[styles.detailValue, { color: '#ff4d4f' }]}>
                    {selectedSupplier.blacklistReason}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>拉黑时间</Text>
                  <Text style={styles.detailValue}>{formatDate(selectedSupplier.blacklistedAt)}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailLabel}>操作人</Text>
                  <Text style={styles.detailValue}>{selectedSupplier.blacklistedBy}</Text>
                </View>
              </View>

              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => {
                    setDetailModalVisible(false);
                    setSelectedSupplier(null);
                  }}
                >
                  关闭
                </Button>
                <Button
                  mode="contained"
                  buttonColor="#52c41a"
                  onPress={() => {
                    setDetailModalVisible(false);
                    setRemoveModalVisible(true);
                  }}
                >
                  移出黑名单
                </Button>
              </View>
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
  content: {
    flex: 1,
    padding: 16,
  },
  statsCard: {
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
  },
  statsContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  statsItem: {
    flex: 1,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#ff4d4f',
  },
  statsLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#f0f0f0',
  },
  searchBar: {
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  searchInput: {
    fontSize: 14,
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
  blacklistChip: {
    backgroundColor: '#fff2f0',
    height: 24,
  },
  blacklistChipText: {
    color: '#ff4d4f',
    fontSize: 11,
  },
  supplierCode: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  reasonSection: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff7f7',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#ff4d4f',
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  reasonIcon: {
    margin: 0,
    marginRight: 4,
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginBottom: 2,
  },
  reasonText: {
    fontSize: 14,
    color: '#ff4d4f',
    fontWeight: '500',
  },
  metaSection: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 24,
  },
  metaItem: {
    flex: 1,
  },
  metaLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 13,
    color: '#595959',
  },
  divider: {
    marginVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
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
    height: 100,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: '#ff4d4f',
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalSearchBar: {
    marginBottom: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  supplierList: {
    maxHeight: 200,
    marginBottom: 12,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fafafa',
    marginBottom: 8,
  },
  selectionItemSelected: {
    backgroundColor: '#f6ffed',
    borderWidth: 1,
    borderColor: '#52c41a',
  },
  selectionContent: {
    flex: 1,
  },
  selectionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  selectionCode: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  noSupplierText: {
    textAlign: 'center',
    color: '#8c8c8c',
    padding: 16,
  },
  moreText: {
    textAlign: 'center',
    color: '#1890ff',
    fontSize: 12,
    marginTop: 8,
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    padding: 8,
    backgroundColor: '#f6ffed',
    borderRadius: 8,
  },
  selectedLabel: {
    fontSize: 13,
    color: '#595959',
  },
  selectedChip: {
    backgroundColor: '#fff',
  },
  reasonSectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
  },
  reasonOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  reasonOption: {
    backgroundColor: '#f5f5f5',
  },
  reasonOptionSelected: {
    backgroundColor: '#1a1a2e',
  },
  reasonOptionText: {
    fontSize: 12,
    color: '#595959',
  },
  reasonOptionTextSelected: {
    color: '#fff',
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
  confirmSection: {
    marginBottom: 16,
  },
  confirmText: {
    fontSize: 15,
    color: '#262626',
    marginBottom: 12,
  },
  confirmInfo: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  confirmLabel: {
    fontSize: 13,
    color: '#8c8c8c',
    width: 80,
  },
  confirmValue: {
    fontSize: 13,
    color: '#262626',
    flex: 1,
  },
  warningText: {
    fontSize: 12,
    color: '#faad14',
    backgroundColor: '#fffbe6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  detailSection: {
    marginBottom: 12,
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
  detailDivider: {
    marginVertical: 16,
  },
  blacklistDetailSection: {
    backgroundColor: '#fff7f7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  blacklistDetailTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ff4d4f',
    marginBottom: 12,
  },
});
