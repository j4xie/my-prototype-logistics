/**
 * 员工列表
 *
 * 功能:
 * - 员工列表展示
 * - 搜索和筛选
 * - 状态标签显示
 *
 * 对应原型: /docs/prd/prototype/hr-admin/staff.html
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
import { Text, Card, Searchbar, Chip, Avatar, FAB, ActivityIndicator, Menu } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { userApiClient } from '../../../services/api/userApiClient';
import { HR_THEME, STAFF_STATUS_CONFIG, type StaffListItem, type StaffStatus } from '../../../types/hrNavigation';

export default function StaffListScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'all'>('all');
  const [menuVisible, setMenuVisible] = useState(false);
  const [staffList, setStaffList] = useState<StaffListItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const loadData = useCallback(async (pageNum = 0, append = false) => {
    try {
      const res = await userApiClient.getUsers({
        page: pageNum,
        size: 20,
        keyword: searchQuery || undefined,
      });

      // API 直接返回 PageResponse，不需要 .success 和 .data 包装
      if (res?.content) {
        // Map UserDTO to StaffListItem with status field
        const mappedContent: StaffListItem[] = res.content.map((u) => ({
          id: u.id,
          username: u.username,
          fullName: u.fullName || u.realName || u.username,
          department: u.departmentDisplayName ?? u.department ?? '',
          position: u.position || '',
          phone: u.phone || '',
          avatarUrl: undefined, // UserDTO doesn't have avatar
          status: (u.isActive ? 'active' : 'resigned') as StaffStatus,
          roleCode: u.roleCode,
          roleName: u.roleDisplayName,
        }));

        const filteredContent = statusFilter === 'all'
          ? mappedContent
          : mappedContent.filter((u) => u.status === statusFilter);

        if (append) {
          setStaffList((prev) => [...prev, ...filteredContent]);
        } else {
          setStaffList(filteredContent);
        }
        setHasMore(res.content.length === 20);
      }
    } catch (error) {
      console.error('加载员工列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      setPage(0);
      loadData(0);
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setPage(0);
    loadData(0);
  }, [loadData]);

  const onEndReached = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadData(nextPage, true);
    }
  };

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
              label={item.fullName?.substring(0, 1) || item.username?.substring(0, 1) || 'U'}
              style={{ backgroundColor: HR_THEME.primary }}
            />
            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{item.fullName || item.username}</Text>
                <Chip
                  mode="flat"
                  textStyle={{ fontSize: 10, color: statusConfig.color }}
                  style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
                >
                  {statusConfig.label}
                </Chip>
              </View>
              <Text style={styles.meta}>
                {item.department || '未分配部门'} · {item.position || item.roleName || '员工'}
              </Text>
              {item.phone && (
                <Text style={styles.phone}>{item.phone}</Text>
              )}
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

  const statusOptions: { value: StaffStatus | 'all'; label: string }[] = [
    { value: 'all', label: '全部' },
    { value: 'active', label: '在岗' },
    { value: 'on_leave', label: '休假' },
    { value: 'resigned', label: '离职' },
    { value: 'suspended', label: '停职' },
  ];

  if (loading && staffList.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>员工管理</Text>
      </View>

      <View style={styles.filterContainer}>
        <Searchbar
          placeholder="搜索员工..."
          value={searchQuery}
          onChangeText={(text) => {
            setSearchQuery(text);
            setPage(0);
          }}
          onSubmitEditing={() => loadData(0)}
          style={styles.searchbar}
        />
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setMenuVisible(true)}
            >
              <MaterialCommunityIcons name="filter" size={20} color={HR_THEME.primary} />
              <Text style={styles.filterText}>
                {statusOptions.find((o) => o.value === statusFilter)?.label || '筛选'}
              </Text>
            </TouchableOpacity>
          }
        >
          {statusOptions.map((option) => (
            <Menu.Item
              key={option.value}
              onPress={() => {
                setStatusFilter(option.value);
                setMenuVisible(false);
                setPage(0);
                loadData(0);
              }}
              title={option.label}
            />
          ))}
        </Menu>
      </View>

      <FlatList
        data={staffList}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="account-search-outline"
              size={64}
              color={HR_THEME.textMuted}
            />
            <Text style={styles.emptyText}>暂无员工数据</Text>
          </View>
        }
        ListFooterComponent={
          loading && staffList.length > 0 ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator size="small" color={HR_THEME.primary} />
            </View>
          ) : null
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('StaffAdd' as any)}
        color="#fff"
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
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: HR_THEME.primary,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: HR_THEME.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  searchbar: {
    flex: 1,
    backgroundColor: HR_THEME.background,
    elevation: 0,
    marginRight: 12,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: HR_THEME.primary + '10',
  },
  filterText: {
    fontSize: 14,
    color: HR_THEME.primary,
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
  },
  card: {
    borderRadius: 12,
    marginBottom: 12,
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
    marginRight: 8,
  },
  statusChip: {
    height: 22,
  },
  meta: {
    fontSize: 13,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  phone: {
    fontSize: 12,
    color: HR_THEME.textMuted,
    marginTop: 2,
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
  footerLoading: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: HR_THEME.primary,
  },
});
