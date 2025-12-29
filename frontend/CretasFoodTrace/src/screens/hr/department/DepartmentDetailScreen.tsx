/**
 * 部门详情
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, RefreshControl, TouchableOpacity, Alert, FlatList,
} from 'react-native';
import { Text, Card, Avatar, Button, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { departmentApiClient } from '../../../services/api/departmentApiClient';
import { HR_THEME, type HRStackParamList, type Department } from '../../../types/hrNavigation';

type RouteParams = RouteProp<HRStackParamList, 'DepartmentDetail'>;

interface DepartmentMember {
  id: number;
  fullName: string;
  username: string;
  position?: string;
  phone?: string;
}

interface DepartmentDetail extends Department {
  members?: DepartmentMember[];
  createdAt?: string;
  updatedAt?: string;
}

export default function DepartmentDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { departmentId } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [department, setDepartment] = useState<DepartmentDetail | null>(null);

  const loadData = useCallback(async () => {
    try {
      // departmentId is string from route params, convert to number for API
      const numericId = typeof departmentId === 'string' ? parseInt(departmentId, 10) : departmentId;
      const res = await departmentApiClient.getDepartmentById(numericId);
      if (res.success && res.data) {
        setDepartment(res.data as DepartmentDetail);
      }
    } catch (error) {
      console.error('加载部门详情失败:', error);
      Alert.alert('错误', '加载部门信息失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [departmentId]);

  useFocusEffect(
    useCallback(() => { loadData(); }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleStatus = async () => {
    if (!department) return;

    const action = department.isActive ? '停用' : '启用';
    Alert.alert(`确认${action}`, `确定要${action}该部门吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: async () => {
        try {
          const numericId = typeof departmentId === 'string' ? parseInt(departmentId, 10) : departmentId;
          await departmentApiClient.updateDepartment(numericId, {
            name: department.name, // required field
            isActive: !department.isActive,
          });
          loadData();
        } catch (error) {
          Alert.alert('错误', `${action}失败`);
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  if (!department) {
    return (
      <View style={styles.errorContainer}>
        <Text>部门信息不存在</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>部门详情</Text>
        <TouchableOpacity onPress={handleToggleStatus} style={styles.statusBtn}>
          <MaterialCommunityIcons
            name={department.isActive ? 'pause-circle' : 'play-circle'}
            size={24}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* 部门信息卡片 */}
        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            <View style={styles.iconLarge}>
              <MaterialCommunityIcons name="office-building" size={40} color={HR_THEME.primary} />
            </View>
            <Text style={styles.deptName}>{department.name}</Text>
            <Chip
              mode="flat"
              textStyle={{ color: department.isActive ? HR_THEME.success : HR_THEME.textMuted }}
              style={[styles.statusChip, {
                backgroundColor: department.isActive ? '#f6ffed' : '#f5f5f5'
              }]}
            >
              {department.isActive ? '正常运行' : '已停用'}
            </Chip>
            {department.description && (
              <Text style={styles.description}>{department.description}</Text>
            )}
          </Card.Content>
        </Card>

        {/* 基本信息 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>基本信息</Text>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-tie" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>负责人</Text>
              <Text style={styles.infoValue}>{department.managerName || '未指定'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="account-group" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>成员数量</Text>
              <Text style={styles.infoValue}>{department.memberCount ?? 0} 人</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>创建时间</Text>
              <Text style={styles.infoValue}>{department.createdAt?.split('T')[0] || '-'}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* 成员列表 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>部门成员</Text>
              <Text style={styles.memberCount}>{department.members?.length ?? 0} 人</Text>
            </View>

            {department.members && department.members.length > 0 ? (
              department.members.slice(0, 10).map((member, index) => (
                <View key={member.id}>
                  <View style={styles.memberRow}>
                    <Avatar.Text
                      size={36}
                      label={member.fullName?.substring(0, 1) || 'U'}
                      style={{ backgroundColor: HR_THEME.primary }}
                    />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.fullName || member.username}</Text>
                      <Text style={styles.memberPosition}>{member.position || '员工'}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('StaffDetail' as any, { staffId: member.id })}
                    >
                      <MaterialCommunityIcons name="chevron-right" size={24} color={HR_THEME.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {index < (department.members?.length ?? 0) - 1 && <Divider style={styles.divider} />}
                </View>
              ))
            ) : (
              <View style={styles.emptyMembers}>
                <MaterialCommunityIcons name="account-off-outline" size={48} color={HR_THEME.textMuted} />
                <Text style={styles.emptyText}>暂无成员</Text>
              </View>
            )}
          </Card.Content>
        </Card>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: HR_THEME.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: HR_THEME.background },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: HR_THEME.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: HR_THEME.primary,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#fff' },
  statusBtn: { padding: 4 },
  content: { flex: 1, padding: 16 },
  profileCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  profileContent: { alignItems: 'center', paddingVertical: 24 },
  iconLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: HR_THEME.primary + '15', justifyContent: 'center', alignItems: 'center',
  },
  deptName: { fontSize: 22, fontWeight: 'bold', color: HR_THEME.textPrimary, marginTop: 12 },
  statusChip: { marginTop: 12 },
  description: { fontSize: 14, color: HR_THEME.textSecondary, marginTop: 12, textAlign: 'center', paddingHorizontal: 16 },
  sectionCard: { borderRadius: 12, marginBottom: 16, backgroundColor: HR_THEME.cardBackground },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: HR_THEME.textPrimary },
  memberCount: { fontSize: 14, color: HR_THEME.textSecondary },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  infoLabel: { flex: 1, fontSize: 14, color: HR_THEME.textSecondary, marginLeft: 12 },
  infoValue: { fontSize: 14, color: HR_THEME.textPrimary },
  divider: { marginVertical: 4 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  memberInfo: { flex: 1, marginLeft: 12 },
  memberName: { fontSize: 14, fontWeight: '500', color: HR_THEME.textPrimary },
  memberPosition: { fontSize: 12, color: HR_THEME.textSecondary, marginTop: 2 },
  emptyMembers: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { marginTop: 8, fontSize: 14, color: HR_THEME.textMuted },
  bottomSpacer: { height: 40 },
});
