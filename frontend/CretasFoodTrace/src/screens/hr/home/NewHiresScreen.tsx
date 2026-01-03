/**
 * 本月入职员工列表
 *
 * 功能:
 * - 显示本月入职员工列表
 * - 支持按部门筛选
 * - 支持搜索
 *
 * 对应原型: /docs/prd/prototype/hr-admin/new-hires.html
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
import { Text, Card, Searchbar, Chip, Avatar, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { userApiClient } from '../../../services/api/userApiClient';
import { HR_THEME, STAFF_STATUS_CONFIG, type StaffListItem } from '../../../types/hrNavigation';

export default function NewHiresScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newHires, setNewHires] = useState<StaffListItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      // 获取本月入职员工
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const res = await userApiClient.getUsers({
        page: 0,
        size: 100,
      });

      // API 直接返回 PageResponse，不需要 .success 和 .data 包装
      // 过滤本月入职的员工
      if (res?.content) {
        const startDateStr = startOfMonth.toISOString().split('T')[0] ?? '';
        const filtered = res.content.filter((u) => {
          const hireDate = (u as unknown as { hireDate?: string }).hireDate;
          return hireDate && hireDate >= startDateStr;
        });
        // Map UserDTO to StaffListItem, add status field
        const mappedHires: StaffListItem[] = filtered.map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName || u.realName || u.username,
          department: u.departmentDisplayName ?? u.department ?? '',
          position: u.position || '',
          phone: u.phone || '',
          avatarUrl: undefined, // UserDTO doesn't have avatar
          status: 'active' as const, // Default to active for new hires
          hireDate: (u as any).hireDate,
          roleCode: u.roleCode,
          roleName: u.roleDisplayName,
        }));
        setNewHires(mappedHires);
      }
    } catch (error) {
      console.error(t('common.loading'), error);
    } finally{
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

  const filteredData = newHires.filter(
    (item) =>
      item.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.department?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleItemPress = (item: StaffListItem) => {
    navigation.navigate('StaffDetail' as any, { staffId: item.id });
  };

  const renderItem = ({ item }: { item: StaffListItem }) => {
    const statusConfig = STAFF_STATUS_CONFIG[item.status] || STAFF_STATUS_CONFIG.active;

    return (
      <TouchableOpacity onPress={() => handleItemPress(item)}>
        <Card style={styles.card}>
          <Card.Content style={styles.cardContent}>
            <Avatar.Text
              size={48}
              label={item.fullName?.substring(0, 1) || 'U'}
              style={{ backgroundColor: HR_THEME.primary }}
            />
            <View style={styles.info}>
              <Text style={styles.name}>{item.fullName || item.username}</Text>
              <Text style={styles.department}>{item.department || t('staff.card.noDepartment')}</Text>
              <View style={styles.metaRow}>
                <Chip
                  mode="flat"
                  textStyle={{ fontSize: 10, color: statusConfig.color }}
                  style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
                >
                  {statusConfig.label}
                </Chip>
                {item.hireDate && (
                  <Text style={styles.hireDate}>
                    {t('staff.form.hireDate')}: {item.hireDate.split('T')[0]}
                  </Text>
                )}
              </View>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={HR_THEME.textMuted}
            />
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
        <Text style={styles.headerTitle}>{t('home.newHires.title')}</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Searchbar
          placeholder={t('staff.search.placeholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t('home.newHires.title')} <Text style={styles.summaryCount}>{newHires.length}</Text> 人
        </Text>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="account-group-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>{t('home.newHires.empty')}</Text>
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
  summary: {
    padding: 16,
    paddingTop: 0,
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
    paddingTop: 0,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: HR_THEME.cardBackground,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  department: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  statusChip: {
    height: 22,
    marginRight: 8,
  },
  hireDate: {
    fontSize: 12,
    color: HR_THEME.textMuted,
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
