/**
 * 批次分配
 *
 * 功能:
 * - 显示生产批次列表
 * - 批次人员分配情况
 * - 调整分配人员
 *
 * 对应原型: /docs/prd/prototype/hr-admin/batch-assignment.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { Text, Card, Chip, Avatar, ActivityIndicator, Searchbar } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { HR_THEME, type BatchAssignmentItem } from '../../../types/hrNavigation';

const getStatusConfig = (t: any) => ({
  in_progress: { label: t('production.batchAssignment.status.inProgress'), color: HR_THEME.info, bgColor: '#e6f7ff' },
  pending: { label: t('production.batchAssignment.status.pending'), color: HR_THEME.warning, bgColor: '#fff7e6' },
  completed: { label: t('production.batchAssignment.status.completed'), color: HR_THEME.success, bgColor: '#f6ffed' },
});

export default function BatchAssignmentScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [batches, setBatches] = useState<BatchAssignmentItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      // getBatchAssignments returns { content: [...], totalElements, totalPages } directly
      const res = await schedulingApiClient.getBatchAssignments();
      if (res?.content) {
        // Map API response to add missing assignedEmployees field
        const mappedBatches: BatchAssignmentItem[] = res.content.map((b: any) => ({
          batchId: b.batchId,
          batchNumber: b.batchNumber,
          productName: b.productName,
          productSpec: b.productSpec,
          status: b.status,
          assignedCount: b.assignedCount ?? 0,
          requiredCount: b.requiredCount ?? 0,
          totalWorkHours: b.totalWorkHours ?? 0,
          laborCost: b.laborCost ?? 0,
          assignedEmployees: b.assignedEmployees ?? [], // Default to empty array if not provided
        }));
        setBatches(mappedBatches);
      }
    } catch (error) {
      console.error('加载批次分配数据失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const filteredData = batches.filter(
    (item) =>
      item.batchNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.productName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemPress = (item: BatchAssignmentItem) => {
    navigation.navigate('BatchWorkers' as any, {
      batchId: item.batchId,
      batchName: `${item.batchNumber} - ${item.productName}`,
    });
  };

  const renderItem = ({ item }: { item: BatchAssignmentItem }) => {
    const STATUS_CONFIG = getStatusConfig(t);
    const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;

    return (
      <TouchableOpacity onPress={() => handleItemPress(item)}>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.cardHeader}>
              <View style={styles.batchInfo}>
                <Text style={styles.batchNumber}>{item.batchNumber}</Text>
                <Text style={styles.productName}>{item.productName}</Text>
              </View>
              <Chip
                mode="flat"
                textStyle={{ fontSize: 11, color: statusConfig.color }}
                style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
              >
                {statusConfig.label}
              </Chip>
            </View>

            <View style={styles.assignmentRow}>
              <View style={styles.assignmentInfo}>
                <MaterialCommunityIcons
                  name="account-group"
                  size={18}
                  color={HR_THEME.textSecondary}
                />
                <Text style={styles.assignmentText}>
                  {t('production.batchAssignment.assigned')} {item.assignedCount}/{item.requiredCount} {t('production.batchAssignment.required')}
                </Text>
              </View>
              <View style={styles.avatarGroup}>
                {item.assignedEmployees?.slice(0, 4).map((emp, index) => (
                  <View
                    key={emp.id}
                    style={[
                      styles.avatarWrapper,
                      { marginLeft: index > 0 ? -8 : 0 },
                    ]}
                  >
                    <Avatar.Text
                      size={28}
                      label={emp.name?.substring(0, 1) || 'U'}
                      style={{ backgroundColor: HR_THEME.primary }}
                    />
                  </View>
                ))}
                {(item.assignedEmployees?.length || 0) > 4 && (
                  <View style={[styles.avatarWrapper, { marginLeft: -8 }]}>
                    <View style={styles.moreAvatar}>
                      <Text style={styles.moreText}>
                        +{(item.assignedEmployees?.length || 0) - 4}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={16}
                  color={HR_THEME.info}
                />
                <Text style={styles.statText}>
                  {item.totalWorkHours?.toFixed(1) || 0}h {t('production.batchAssignment.workHours')}
                </Text>
              </View>
              <View style={styles.statItem}>
                <MaterialCommunityIcons
                  name="currency-cny"
                  size={16}
                  color={HR_THEME.success}
                />
                <Text style={styles.statText}>
                  ¥{item.laborCost?.toLocaleString() || 0}
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={HR_THEME.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('production.batchAssignment.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={t('production.batchAssignment.search')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => item.batchId}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="clipboard-list-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>{t('production.batchAssignment.empty')}</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HR_THEME.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: HR_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  placeholder: {
    width: 32,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  searchbar: {
    backgroundColor: HR_THEME.background,
    elevation: 0,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  batchInfo: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
  },
  productName: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    height: 24,
  },
  assignmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assignmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  assignmentText: {
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginLeft: 6,
  },
  avatarGroup: {
    flexDirection: 'row',
  },
  avatarWrapper: {
    zIndex: 1,
  },
  moreAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: HR_THEME.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HR_THEME.border,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  statText: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginLeft: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 14,
    color: HR_THEME.textMuted,
  },
});
