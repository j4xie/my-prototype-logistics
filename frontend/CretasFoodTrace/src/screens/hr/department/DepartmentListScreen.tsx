/**
 * 部门列表
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert,
} from 'react-native';
import { Text, Card, Searchbar, Chip, FAB, ActivityIndicator, IconButton } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { departmentApiClient } from '../../../services/api/departmentApiClient';
import { HR_THEME, type Department } from '../../../types/hrNavigation';

export default function DepartmentListScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('hr');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [departments, setDepartments] = useState<Department[]>([]);

  const loadData = useCallback(async () => {
    try {
      const res = await departmentApiClient.getDepartments();
      // Handle both direct array and paged response formats
      const data = Array.isArray(res) ? res : (res as any)?.content ?? [];
      setDepartments(data.map((d: any) => ({
        id: String(d.id),
        name: d.name,
        code: d.code,
        memberCount: d.memberCount ?? d.employeeCount ?? 0,
        managerName: d.managerName,
        isActive: d.isActive ?? d.status === 'active',
        description: d.description,
      })));
    } catch (error) {
      console.error('加载部门列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [loadData]);

  const handleDelete = (item: Department) => {
    Alert.alert(t('department.list.deleteConfirm'), t('department.list.deleteMessage', { name: item.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        try {
          // item.id can be string or number, convert to number for API
          const numericId = typeof item.id === 'string' ? parseInt(item.id, 10) : item.id;
          await departmentApiClient.deleteDepartment(numericId);
          loadData();
        } catch (e) { Alert.alert(t('messages.error'), t('department.list.deleteFailed')); }
      }},
    ]);
  };

  const filteredData = useMemo(() => departments.filter(item =>
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.managerName?.toLowerCase().includes(searchQuery.toLowerCase())
  ), [departments, searchQuery]);

  const renderItem = useCallback(({ item }: { item: Department }) => (
    <TouchableOpacity onPress={() => navigation.navigate('DepartmentDetail' as any, { departmentId: item.id })}>
      <Card style={styles.card}>
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="office-building" size={28} color={HR_THEME.primary} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="account" size={14} color={HR_THEME.textSecondary} />
                <Text style={styles.metaText}>{item.managerName || t('department.list.noManager')}</Text>
              </View>
              <View style={styles.metaItem}>
                <MaterialCommunityIcons name="account-group" size={14} color={HR_THEME.textSecondary} />
                <Text style={styles.metaText}>{t('department.list.memberCount', { count: item.memberCount ?? 0 })}</Text>
              </View>
            </View>
          </View>
          <View style={styles.actions}>
            <Chip
              mode="flat"
              textStyle={{ fontSize: 10, color: item.isActive ? HR_THEME.success : HR_THEME.textMuted }}
              style={[styles.chip, { backgroundColor: item.isActive ? '#f6ffed' : '#f5f5f5' }]}
            >
              {item.isActive ? t('department.list.status.active') : t('department.list.status.disabled')}
            </Chip>
            <IconButton
              icon="delete"
              size={18}
              iconColor={HR_THEME.danger}
              onPress={() => handleDelete(item)}
            />
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  ), [navigation, t, handleDelete]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('department.list.title')}</Text>
      </View>

      <View style={styles.search}>
        <Searchbar
          placeholder={t('department.list.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
        />
      </View>

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t('department.list.totalPrefix')} <Text style={styles.summaryCount}>{filteredData.length}</Text> {t('department.list.totalSuffix')}
        </Text>
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={item => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="office-building-outline" size={64} color={HR_THEME.textMuted} />
            <Text style={styles.emptyText}>{t('department.list.empty')}</Text>
          </View>
        }
      />

      <FAB
        icon="plus"
        style={styles.fab}
        onPress={() => navigation.navigate('DepartmentAdd' as any)}
        color="#fff"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HR_THEME.background },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: HR_THEME.background },
  header: { padding: 16, backgroundColor: HR_THEME.primary },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
  search: { padding: 16, backgroundColor: HR_THEME.cardBackground, borderBottomWidth: 1, borderBottomColor: HR_THEME.border },
  searchbar: { backgroundColor: HR_THEME.background, elevation: 0 },
  summary: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: HR_THEME.cardBackground },
  summaryText: { fontSize: 14, color: HR_THEME.textSecondary },
  summaryCount: { fontWeight: 'bold', color: HR_THEME.primary },
  list: { padding: 16 },
  card: { borderRadius: 12, marginBottom: 12, backgroundColor: HR_THEME.cardBackground },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  iconContainer: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: HR_THEME.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: '500', color: HR_THEME.textPrimary },
  metaRow: { flexDirection: 'row', marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', marginRight: 16 },
  metaText: { fontSize: 12, color: HR_THEME.textSecondary, marginLeft: 4 },
  actions: { alignItems: 'flex-end' },
  chip: { height: 22, marginBottom: 4 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, fontSize: 14, color: HR_THEME.textMuted },
  fab: { position: 'absolute', right: 16, bottom: 24, backgroundColor: HR_THEME.primary },
});
