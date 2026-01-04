/**
 * 混批排产屏幕
 *
 * 功能：
 * - 智能检测可合并的订单
 * - 按同原料/同工艺分组
 * - 显示合并节省时间
 * - 确认或拒绝混批建议
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { MixedBatchGroup, MixedBatchOrder, MixedBatchType } from '../../../types/dispatcher';
import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { isAxiosError } from 'axios';

// 主题色
const DISPATCHER_THEME = {
  primary: '#722ed1',
  secondary: '#a18cd1',
  accent: '#fbc2eb',
  gradientStart: '#722ed1',
  gradientEnd: '#a18cd1',
};

// Mock数据已移除，改为从API获取

export default function MixedBatchScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [groups, setGroups] = useState<MixedBatchGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<MixedBatchGroup | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detectLoading, setDetectLoading] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'same_material' | 'same_process'>('all');

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true);
      const response = await schedulingApiClient.getMixedBatchGroups();
      if (response.success && response.data) {
        setGroups(response.data);
      } else {
        console.error('API error:', response.message);
        Alert.alert('加载失败', response.message || '无法获取混批数据');
      }
    } catch (error) {
      console.error('加载混批数据失败:', error);
      if (isAxiosError(error)) {
        if (error.response?.status === 401) {
          Alert.alert('登录已过期', '请重新登录');
        } else {
          Alert.alert('请求失败', error.response?.data?.message || '网络错误，请检查连接');
        }
      } else if (error instanceof Error) {
        Alert.alert('错误', error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 下拉刷新
  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // 检测混批机会
  const detectMixedBatch = async () => {
    try {
      setDetectLoading(true);
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const response = await schedulingApiClient.detectMixedBatch({
        startDate,
        endDate,
      });
      if (response.success && response.data) {
        setGroups(response.data);
        const pendingCount = response.data.filter(g => g.status === 'pending').length;
        Alert.alert('检测完成', `发现 ${pendingCount} 个可优化的混批机会`);
      } else {
        console.error('API error:', response.message);
        Alert.alert('检测失败', response.message || '无法检测混批机会');
      }
    } catch (error) {
      console.error('检测混批失败:', error);
      if (isAxiosError(error)) {
        Alert.alert('请求失败', error.response?.data?.message || '网络错误');
      } else if (error instanceof Error) {
        Alert.alert('错误', error.message);
      }
    } finally {
      setDetectLoading(false);
    }
  };

  // 确认混批
  const confirmGroup = async (group: MixedBatchGroup) => {
    Alert.alert(
      '确认混批',
      `确认将 ${group.orders.length} 个订单合并排产？\n预计节省换产时间: ${group.estimatedSwitchSaving} 分钟`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确认',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await schedulingApiClient.confirmMixedBatch(group.id);
              if (response.success && response.data) {
                // 使用API返回的数据更新本地状态
                setGroups(prev => prev.map(g =>
                  g.id === group.id ? response.data : g
                ));
                setDetailModalVisible(false);
                Alert.alert('成功', '混批确认成功，已生成生产计划');
              } else {
                Alert.alert('确认失败', response.message || '无法确认混批');
              }
            } catch (error) {
              console.error('确认混批失败:', error);
              if (isAxiosError(error)) {
                Alert.alert('请求失败', error.response?.data?.message || '网络错误');
              } else if (error instanceof Error) {
                Alert.alert('错误', error.message);
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // 拒绝混批
  const rejectGroup = async (group: MixedBatchGroup) => {
    Alert.alert(
      '拒绝混批',
      '确定拒绝此混批建议？拒绝后订单将单独排产。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定拒绝',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await schedulingApiClient.rejectMixedBatch(group.id, '用户手动拒绝');
              if (response.success && response.data) {
                // 使用API返回的数据更新本地状态
                setGroups(prev => prev.map(g =>
                  g.id === group.id ? response.data : g
                ));
                setDetailModalVisible(false);
                Alert.alert('已拒绝', '混批建议已拒绝');
              } else {
                Alert.alert('拒绝失败', response.message || '无法拒绝混批');
              }
            } catch (error) {
              console.error('拒绝混批失败:', error);
              if (isAxiosError(error)) {
                Alert.alert('请求失败', error.response?.data?.message || '网络错误');
              } else if (error instanceof Error) {
                Alert.alert('错误', error.message);
              }
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // 获取分组类型信息
  const getGroupTypeInfo = (type: MixedBatchType) => {
    switch (type) {
      case 'same_material':
        return {
          label: '同原料',
          icon: 'cube-outline' as const,
          color: '#1890ff',
          bgColor: '#e6f7ff',
        };
      case 'same_process':
        return {
          label: '同工艺',
          icon: 'cog-outline' as const,
          color: '#722ed1',
          bgColor: '#f9f0ff',
        };
      default:
        return {
          label: '混合',
          icon: 'apps' as const,
          color: '#666',
          bgColor: '#f5f5f5',
        };
    }
  };

  // 获取状态信息
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: '待确认', color: '#fa8c16', bgColor: '#fff7e6' };
      case 'confirmed':
        return { label: '已确认', color: '#52c41a', bgColor: '#f6ffed' };
      case 'rejected':
        return { label: '已拒绝', color: '#ff4d4f', bgColor: '#fff1f0' };
      default:
        return { label: '未知', color: '#666', bgColor: '#f5f5f5' };
    }
  };

  // 获取优先级信息
  const getPriorityInfo = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return { label: '紧急', color: '#ff4d4f' };
      case 'high':
        return { label: '高', color: '#fa8c16' };
      case 'normal':
        return { label: '普通', color: '#1890ff' };
      case 'low':
        return { label: '低', color: '#8c8c8c' };
      default:
        return { label: '普通', color: '#1890ff' };
    }
  };

  // 筛选分组
  const filteredGroups = groups.filter(g => {
    if (filterType === 'all') return true;
    return g.groupType === filterType;
  });

  // 统计信息
  const stats = {
    total: groups.length,
    pending: groups.filter(g => g.status === 'pending').length,
    confirmed: groups.filter(g => g.status === 'confirmed').length,
    totalSaving: groups.filter(g => g.status !== 'rejected').reduce((sum, g) => sum + g.estimatedSwitchSaving, 0),
  };

  useEffect(() => {
    loadData();
  }, []);

  // 渲染分组卡片
  const renderGroupCard = (group: MixedBatchGroup) => {
    const typeInfo = getGroupTypeInfo(group.groupType);
    const statusInfo = getStatusInfo(group.status);

    return (
      <TouchableOpacity
        key={group.id}
        style={styles.groupCard}
        onPress={() => {
          setSelectedGroup(group);
          setDetailModalVisible(true);
        }}
      >
        {/* 头部 */}
        <View style={styles.groupHeader}>
          <View style={styles.groupTypeContainer}>
            <View style={[styles.typeBadge, { backgroundColor: typeInfo.bgColor }]}>
              <MaterialCommunityIcons name={typeInfo.icon} size={16} color={typeInfo.color} />
              <Text style={[styles.typeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
            </View>
            {group.groupType === 'same_material' && group.materialBatchNumber && (
              <Text style={styles.materialBatchText}>原料批次: {group.materialBatchNumber}</Text>
            )}
            {group.groupType === 'same_process' && group.processType && (
              <Text style={styles.processText}>工艺: {group.processType}</Text>
            )}
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
            <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
          </View>
        </View>

        {/* 订单列表预览 */}
        <View style={styles.ordersPreview}>
          <Text style={styles.ordersTitle}>
            包含 {group.orders.length} 个订单 · 总量 {group.totalQuantity} kg
          </Text>
          <View style={styles.ordersList}>
            {group.orders.slice(0, 3).map((order, index) => (
              <View key={order.orderId} style={styles.orderItem}>
                <Text style={styles.orderNumber}>{order.orderId}</Text>
                <Text style={styles.orderProduct}>{order.productName}</Text>
                <Text style={styles.orderQuantity}>{order.quantity}{order.unit}</Text>
              </View>
            ))}
            {group.orders.length > 3 && (
              <Text style={styles.moreOrders}>+{group.orders.length - 3} 更多订单</Text>
            )}
          </View>
        </View>

        {/* 节省信息 */}
        <View style={styles.savingContainer}>
          <MaterialCommunityIcons name="clock-fast" size={20} color="#52c41a" />
          <Text style={styles.savingText}>
            预计节省换产时间: <Text style={styles.savingValue}>{group.estimatedSwitchSaving} 分钟</Text>
          </Text>
        </View>

        {/* 底部操作 */}
        {group.status === 'pending' && (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.cardButton, styles.rejectButton]}
              onPress={(e) => {
                e.stopPropagation();
                rejectGroup(group);
              }}
            >
              <Text style={styles.rejectButtonText}>拒绝</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cardButton, styles.confirmButton]}
              onPress={(e) => {
                e.stopPropagation();
                confirmGroup(group);
              }}
            >
              <Text style={styles.confirmButtonText}>确认混批</Text>
            </TouchableOpacity>
          </View>
        )}

        {group.status === 'confirmed' && group.productionPlanId && (
          <View style={styles.confirmedInfo}>
            <MaterialCommunityIcons name="check-circle" size={16} color="#52c41a" />
            <Text style={styles.confirmedText}>已生成计划: {group.productionPlanId}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // 渲染详情模态框
  const renderDetailModal = () => {
    if (!selectedGroup) return null;
    const typeInfo = getGroupTypeInfo(selectedGroup.groupType);
    const statusInfo = getStatusInfo(selectedGroup.status);

    return (
      <Modal
        visible={detailModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* 模态框头部 */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleContainer}>
                <View style={[styles.typeBadge, { backgroundColor: typeInfo.bgColor }]}>
                  <MaterialCommunityIcons name={typeInfo.icon} size={18} color={typeInfo.color} />
                  <Text style={[styles.typeText, { color: typeInfo.color }]}>{typeInfo.label}混批</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor, marginLeft: 8 }]}>
                  <Text style={[styles.statusText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setDetailModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {/* 基本信息 */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>基本信息</Text>
              {selectedGroup.groupType === 'same_material' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>原料批次:</Text>
                  <Text style={styles.infoValue}>{selectedGroup.materialBatchNumber}</Text>
                </View>
              )}
              {selectedGroup.groupType === 'same_process' && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>工艺类型:</Text>
                  <Text style={styles.infoValue}>{selectedGroup.processType}</Text>
                </View>
              )}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>订单数量:</Text>
                <Text style={styles.infoValue}>{selectedGroup.orders.length} 个</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>总产量:</Text>
                <Text style={styles.infoValue}>{selectedGroup.totalQuantity} kg</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>节省时间:</Text>
                <Text style={[styles.infoValue, { color: '#52c41a', fontWeight: 'bold' }]}>
                  {selectedGroup.estimatedSwitchSaving} 分钟
                </Text>
              </View>
            </View>

            {/* 订单详情 */}
            <View style={styles.detailSection}>
              <Text style={styles.sectionTitle}>包含订单</Text>
              <ScrollView style={styles.orderDetailList}>
                {selectedGroup.orders.map((order, index) => {
                  return (
                    <View key={order.orderId} style={styles.orderDetailItem}>
                      <View style={styles.orderDetailHeader}>
                        <Text style={styles.orderDetailNumber}>{order.orderId}</Text>
                        <Text style={styles.orderCustomer}>{order.customerName}</Text>
                      </View>
                      <View style={styles.orderDetailBody}>
                        <View style={styles.orderDetailRow}>
                          <Text style={styles.orderDetailLabel}>产品:</Text>
                          <Text style={styles.orderDetailValue}>{order.productName}</Text>
                        </View>
                        <View style={styles.orderDetailRow}>
                          <Text style={styles.orderDetailLabel}>数量:</Text>
                          <Text style={styles.orderDetailValue}>{order.quantity} kg</Text>
                        </View>
                        <View style={styles.orderDetailRow}>
                          <Text style={styles.orderDetailLabel}>交期:</Text>
                          <Text style={styles.orderDetailValue}>{order.deadline}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>

            {/* 操作按钮 */}
            {selectedGroup.status === 'pending' && (
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalRejectButton]}
                  onPress={() => rejectGroup(selectedGroup)}
                >
                  <MaterialCommunityIcons name="close-circle-outline" size={20} color="#ff4d4f" />
                  <Text style={styles.modalRejectText}>拒绝建议</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalConfirmButton]}
                  onPress={() => confirmGroup(selectedGroup)}
                >
                  <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                  <Text style={styles.modalConfirmText}>确认混批</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedGroup.status === 'confirmed' && (
              <View style={styles.confirmedSection}>
                <MaterialCommunityIcons name="check-decagram" size={48} color="#52c41a" />
                <Text style={styles.confirmedTitle}>已确认混批</Text>
                <Text style={styles.confirmedSubtitle}>
                  生产计划: {selectedGroup.productionPlanId}
                </Text>
                <Text style={styles.confirmedTime}>
                  确认时间: {selectedGroup.confirmedAt}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <LinearGradient
        colors={[DISPATCHER_THEME.gradientStart, DISPATCHER_THEME.gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>混批排产</Text>
            <Text style={styles.headerSubtitle}>智能合并订单，优化生产效率</Text>
          </View>
          <TouchableOpacity
            style={styles.detectButton}
            onPress={detectMixedBatch}
            disabled={detectLoading}
          >
            {detectLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="radar" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 统计卡片 */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>混批组</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#fa8c16' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>待确认</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#52c41a' }]}>{stats.confirmed}</Text>
          <Text style={styles.statLabel}>已确认</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#1890ff' }]}>{stats.totalSaving}</Text>
          <Text style={styles.statLabel}>节省(分)</Text>
        </View>
      </View>

      {/* 筛选器 */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'all' && styles.filterChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.filterText, filterType === 'all' && styles.filterTextActive]}>
            全部
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'same_material' && styles.filterChipActive]}
          onPress={() => setFilterType('same_material')}
        >
          <MaterialCommunityIcons
            name="cube-outline"
            size={16}
            color={filterType === 'same_material' ? '#fff' : '#666'}
          />
          <Text style={[styles.filterText, filterType === 'same_material' && styles.filterTextActive]}>
            同原料
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filterType === 'same_process' && styles.filterChipActive]}
          onPress={() => setFilterType('same_process')}
        >
          <MaterialCommunityIcons
            name="cog-outline"
            size={16}
            color={filterType === 'same_process' ? '#fff' : '#666'}
          />
          <Text style={[styles.filterText, filterType === 'same_process' && styles.filterTextActive]}>
            同工艺
          </Text>
        </TouchableOpacity>
      </View>

      {/* 分组列表 */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={DISPATCHER_THEME.primary} />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant" size={64} color="#ccc" />
            <Text style={styles.emptyText}>暂无混批建议</Text>
            <Text style={styles.emptySubtext}>点击右上角按钮检测混批机会</Text>
          </View>
        ) : (
          filteredGroups.map(group => renderGroupCard(group))
        )}
      </ScrollView>

      {/* AI 算法标识 */}
      <View style={styles.aiBadge}>
        <MaterialCommunityIcons name="robot" size={16} color={DISPATCHER_THEME.primary} />
        <Text style={styles.aiBadgeText}>基于订单相似度聚类算法</Text>
      </View>

      {/* 详情模态框 */}
      {renderDetailModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  detectButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -10,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  filterText: {
    fontSize: 14,
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    color: '#ccc',
  },
  groupCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  groupTypeContainer: {
    flex: 1,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  materialBatchText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  processText: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  ordersPreview: {
    marginBottom: 12,
  },
  ordersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  ordersList: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 10,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  orderNumber: {
    fontSize: 12,
    color: '#666',
    width: 100,
  },
  orderProduct: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  orderQuantity: {
    fontSize: 12,
    color: '#999',
    width: 50,
    textAlign: 'right',
  },
  moreOrders: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
    marginTop: 6,
    textAlign: 'center',
  },
  savingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6ffed',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  savingText: {
    fontSize: 13,
    color: '#333',
  },
  savingValue: {
    fontWeight: 'bold',
    color: '#52c41a',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cardButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  rejectButton: {
    backgroundColor: '#fff1f0',
  },
  rejectButtonText: {
    color: '#ff4d4f',
    fontWeight: '500',
  },
  confirmButton: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  confirmedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  confirmedText: {
    fontSize: 13,
    color: '#52c41a',
  },
  aiBadge: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: 6,
  },
  aiBadgeText: {
    fontSize: 12,
    color: DISPATCHER_THEME.primary,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  modalTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailSection: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#999',
    width: 80,
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  orderDetailList: {
    maxHeight: 250,
  },
  orderDetailItem: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  orderDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  orderDetailNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  orderCustomer: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  orderDetailBody: {
    gap: 4,
  },
  orderDetailRow: {
    flexDirection: 'row',
  },
  orderDetailLabel: {
    fontSize: 13,
    color: '#999',
    width: 50,
  },
  orderDetailValue: {
    fontSize: 13,
    color: '#333',
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  modalRejectButton: {
    backgroundColor: '#fff1f0',
  },
  modalRejectText: {
    color: '#ff4d4f',
    fontWeight: '600',
  },
  modalConfirmButton: {
    backgroundColor: DISPATCHER_THEME.primary,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '600',
  },
  confirmedSection: {
    alignItems: 'center',
    padding: 24,
  },
  confirmedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#52c41a',
    marginTop: 12,
  },
  confirmedSubtitle: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
  },
  confirmedTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
});
