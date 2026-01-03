/**
 * 考勤异常
 *
 * 功能:
 * - 异常记录列表
 * - 异常处理
 * - 分类筛选
 *
 * 对应原型: /docs/prd/prototype/hr-admin/attendance-anomaly.html
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
  Alert,
} from 'react-native';
import { Text, Card, Chip, Avatar, ActivityIndicator, Menu, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { hrApiClient } from '../../../services/api/hrApiClient';
import {
  HR_THEME,
  ANOMALY_TYPE_CONFIG,
  type AttendanceAnomaly,
  type AttendanceAnomalyType,
} from '../../../types/hrNavigation';

type FilterType = AttendanceAnomalyType | 'all';

export default function AttendanceAnomalyScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  const [anomalies, setAnomalies] = useState<AttendanceAnomaly[]>([]);

  const loadData = useCallback(async () => {
    try {
      // getAttendanceAnomalies 返回 AttendanceAnomaly[] 直接数组
      const anomalyList = await hrApiClient.getAttendanceAnomalies({
        // 根据 anomalyType 筛选
      });
      // 客户端筛选
      const filtered = filterType === 'all'
        ? anomalyList
        : anomalyList.filter(a => a.anomalyType === filterType);
      // Map API response (id: number) to UI type (id: string)
      const mappedAnomalies: AttendanceAnomaly[] = filtered.map(a => ({
        ...a,
        id: String(a.id),
        // Ensure resolvedBy is number if present
        resolvedBy: a.resolvedBy != null ? Number(a.resolvedBy) : undefined,
      }));
      setAnomalies(mappedAnomalies);
    } catch (error) {
      console.error(t('common.loading'), error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterType]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleResolve = async (anomaly: AttendanceAnomaly) => {
    Alert.alert(
      t('attendance.anomaly.resolve'),
      `确定要将 ${anomaly.userName} 的${ANOMALY_TYPE_CONFIG[anomaly.anomalyType].label}记录标记为已处理吗？`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          onPress: async () => {
            try {
              await hrApiClient.resolveAnomaly(anomaly.id, { action: 'resolved', notes: '手动处理' });
              loadData();
            } catch (error) {
              Alert.alert(t('messages.error'), '处理失败，请重试');
            }
          },
        },
      ]
    );
  };

  const filterOptions: { value: FilterType; label: string }[] = [
    { value: 'all', label: t('staff.filter.all') },
    { value: 'LATE', label: t('anomalyTypes.late') },
    { value: 'ABSENT', label: t('anomalyTypes.absent') },
    { value: 'EARLY_LEAVE', label: t('anomalyTypes.earlyLeave') },
    { value: 'NO_CLOCK_IN', label: t('anomalyTypes.missingCheckIn') },
    { value: 'NO_CLOCK_OUT', label: t('anomalyTypes.missingCheckOut') },
  ];

  const renderItem = ({ item }: { item: AttendanceAnomaly }) => {
    const config = ANOMALY_TYPE_CONFIG[item.anomalyType];

    return (
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <View style={styles.userInfo}>
              <Avatar.Text
                size={40}
                label={item.userName?.substring(0, 1) || 'U'}
                style={{ backgroundColor: HR_THEME.primary }}
              />
              <View style={styles.userMeta}>
                <Text style={styles.userName}>{item.userName}</Text>
                <Text style={styles.department}>{item.department || t('staff.card.noDepartment')}</Text>
              </View>
            </View>
            <Chip
              mode="flat"
              icon={() => (
                <MaterialCommunityIcons name={config.icon as any} size={14} color={config.color} />
              )}
              textStyle={{ fontSize: 11, color: config.color }}
              style={[styles.typeChip, { backgroundColor: config.color + '20' }]}
            >
              {config.label}
            </Chip>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <MaterialCommunityIcons name="clock" size={16} color={HR_THEME.textSecondary} />
              <Text style={styles.detailText}>
                {item.anomalyTime?.split(' ')[1] || item.anomalyTime}
              </Text>
            </View>
            {item.duration && (
              <View style={styles.detailItem}>
                <MaterialCommunityIcons name="timer" size={16} color={HR_THEME.textSecondary} />
                <Text style={styles.detailText}>{item.duration}分钟</Text>
              </View>
            )}
          </View>

          {item.notes && (
            <Text style={styles.notes} numberOfLines={2}>{item.notes}</Text>
          )}

          <View style={styles.cardFooter}>
            {item.isResolved ? (
              <View style={styles.resolvedBadge}>
                <MaterialCommunityIcons name="check-circle" size={16} color={HR_THEME.success} />
                <Text style={styles.resolvedText}>{t('attendance.anomaly.resolve')}</Text>
              </View>
            ) : (
              <Button
                mode="outlined"
                compact
                onPress={() => handleResolve(item)}
                style={styles.resolveButton}
                textColor={HR_THEME.primary}
              >
                {t('attendance.anomaly.resolve')}
              </Button>
            )}
          </View>
        </Card.Content>
      </Card>
    );
  };

  if (loading && anomalies.length === 0) {
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
        <Text style={styles.headerTitle}>{t('attendance.anomaly.title')}</Text>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.filterBtn}
              onPress={() => setMenuVisible(true)}
            >
              <MaterialCommunityIcons name="filter" size={24} color={HR_THEME.primary} />
            </TouchableOpacity>
          }
        >
          {filterOptions.map((option) => (
            <Menu.Item
              key={option.value}
              onPress={() => {
                setFilterType(option.value);
                setMenuVisible(false);
              }}
              title={option.label}
              leadingIcon={filterType === option.value ? 'check' : undefined}
            />
          ))}
        </Menu>
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          共 <Text style={styles.summaryCount}>{anomalies.length}</Text> 条异常记录
          {filterType !== 'all' && (
            <Text> (筛选: {filterOptions.find(o => o.value === filterType)?.label})</Text>
          )}
        </Text>
      </View>

      <FlatList
        data={anomalies}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={64}
              color={HR_THEME.success}
            />
            <Text style={styles.emptyText}>{t('attendance.anomaly.empty')}</Text>
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
  filterBtn: {
    padding: 4,
  },
  summary: {
    padding: 16,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  summaryText: {
    fontSize: 14,
    color: HR_THEME.textSecondary,
  },
  summaryCount: {
    fontWeight: 'bold',
    color: HR_THEME.primary,
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
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userMeta: {
    marginLeft: 12,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  department: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  typeChip: {
    height: 26,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  detailText: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginLeft: 6,
  },
  notes: {
    fontSize: 13,
    color: HR_THEME.textMuted,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: HR_THEME.border,
  },
  resolvedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resolvedText: {
    fontSize: 13,
    color: HR_THEME.success,
    marginLeft: 4,
  },
  resolveButton: {
    borderColor: HR_THEME.primary,
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
