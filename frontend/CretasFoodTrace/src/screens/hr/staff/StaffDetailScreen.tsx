/**
 * 员工详情
 *
 * 功能:
 * - 员工基本信息
 * - 考勤统计
 * - 参与批次记录
 * - AI分析入口
 *
 * 对应原型: /docs/prd/prototype/hr-admin/staff-detail.html
 *
 * @version 1.0.0
 * @since 2025-12-29
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Avatar, Button, ActivityIndicator, Chip, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { userApiClient } from '../../../services/api/userApiClient';
import {
  HR_THEME,
  STAFF_STATUS_CONFIG,
  type StaffDetail,
  type HRStackParamList,
} from '../../../types/hrNavigation';

type RouteParams = RouteProp<HRStackParamList, 'StaffDetail'>;

export default function StaffDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteParams>();
  const { staffId } = route.params;
  const { t } = useTranslation('hr');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [staff, setStaff] = useState<StaffDetail | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await userApiClient.getUserById(staffId);
      // API 直接返回 UserDTO，不需要 .success 和 .data 包装
      if (res) {
        setStaff(res as unknown as StaffDetail);
      }
    } catch (error) {
      console.error('加载员工详情失败:', error);
      Alert.alert(t('messages.error'), t('staff.detail.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [staffId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatMinutes = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    return `${hours}h`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={HR_THEME.primary} />
      </View>
    );
  }

  if (!staff) {
    return (
      <View style={styles.errorContainer}>
        <Text>{t('staff.detail.notFound')}</Text>
      </View>
    );
  }

  const statusConfig = STAFF_STATUS_CONFIG[staff.status] || STAFF_STATUS_CONFIG.active;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('staff.detail.title')}</Text>
        <TouchableOpacity
          onPress={() => navigation.navigate('StaffAIAnalysis' as any, { staffId })}
          style={styles.aiBtn}
        >
          <MaterialCommunityIcons name="robot" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 头像卡片 */}
        <Card style={styles.profileCard}>
          <Card.Content style={styles.profileContent}>
            <Avatar.Text
              size={80}
              label={staff.fullName?.substring(0, 1) || 'U'}
              style={{ backgroundColor: HR_THEME.primary }}
            />
            <Text style={styles.staffName}>{staff.fullName || staff.username}</Text>
            <Text style={styles.staffMeta}>
              {staff.department || t('staff.detail.noDepartment')} · {staff.position || staff.roleName || t('staff.detail.employee')}
            </Text>
            <Chip
              mode="flat"
              textStyle={{ color: statusConfig.color }}
              style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
            >
              {statusConfig.label}
            </Chip>
          </Card.Content>
        </Card>

        {/* 基本信息 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>{t('staff.detail.sections.basicInfo')}</Text>
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="phone" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>{t('staff.detail.fields.phone')}</Text>
              <Text style={styles.infoValue}>{staff.phone || '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="email" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>{t('staff.detail.fields.email')}</Text>
              <Text style={styles.infoValue}>{staff.email || '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="calendar" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>{t('staff.detail.fields.hireDate')}</Text>
              <Text style={styles.infoValue}>{staff.hireDate?.split('T')[0] || '-'}</Text>
            </View>
            <Divider style={styles.divider} />
            <View style={styles.infoRow}>
              <MaterialCommunityIcons name="badge-account" size={18} color={HR_THEME.textSecondary} />
              <Text style={styles.infoLabel}>{t('staff.detail.fields.employeeCode')}</Text>
              <Text style={styles.infoValue}>{staff.employeeCode || '-'}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* 考勤统计 */}
        <Card style={styles.sectionCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>{t('staff.detail.sections.monthlyAttendance')}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: HR_THEME.success }]}>
                  {staff.attendanceStats?.workDays ?? 0}
                </Text>
                <Text style={styles.statLabel}>{t('staff.detail.attendance.workDays')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: HR_THEME.warning }]}>
                  {staff.attendanceStats?.lateDays ?? 0}
                </Text>
                <Text style={styles.statLabel}>{t('staff.detail.attendance.late')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: HR_THEME.info }]}>
                  {staff.attendanceStats?.earlyLeaveDays ?? 0}
                </Text>
                <Text style={styles.statLabel}>{t('staff.detail.attendance.earlyLeave')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: HR_THEME.danger }]}>
                  {staff.attendanceStats?.absentDays ?? 0}
                </Text>
                <Text style={styles.statLabel}>{t('staff.detail.attendance.absent')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 工时汇总 */}
        {staff.workTimeSummary && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('staff.detail.sections.workSummary')}</Text>
              <View style={styles.workSummary}>
                <View style={styles.workItem}>
                  <Text style={styles.workValue}>{staff.workTimeSummary.totalBatches}</Text>
                  <Text style={styles.workLabel}>{t('staff.detail.work.batches')}</Text>
                </View>
                <View style={styles.workDivider} />
                <View style={styles.workItem}>
                  <Text style={styles.workValue}>{staff.workTimeSummary.totalHours.toFixed(1)}h</Text>
                  <Text style={styles.workLabel}>{t('staff.detail.work.totalHours')}</Text>
                </View>
                <View style={styles.workDivider} />
                <View style={styles.workItem}>
                  <Text style={styles.workValue}>¥{staff.workTimeSummary.totalEarnings.toFixed(0)}</Text>
                  <Text style={styles.workLabel}>{t('staff.detail.work.earnings')}</Text>
                </View>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* 最近批次 */}
        {staff.recentBatches && staff.recentBatches.length > 0 && (
          <Card style={styles.sectionCard}>
            <Card.Content>
              <Text style={styles.sectionTitle}>{t('staff.detail.sections.recentBatches')}</Text>
              {staff.recentBatches.slice(0, 5).map((batch, index) => (
                <View key={index} style={styles.batchRow}>
                  <View style={styles.batchInfo}>
                    <Text style={styles.batchNumber}>{batch.batchNumber}</Text>
                    <Text style={styles.batchProduct}>
                      {batch.productName} · {batch.processType}
                    </Text>
                  </View>
                  <View style={styles.batchStats}>
                    <Text style={styles.batchHours}>{batch.workHours.toFixed(1)}h</Text>
                    <Text style={styles.batchDate}>{batch.workDate}</Text>
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          <Button
            mode="contained"
            icon="robot"
            onPress={() => navigation.navigate('StaffAIAnalysis' as any, { staffId })}
            style={styles.aiButton}
            buttonColor={HR_THEME.primary}
          >
            {t('staff.detail.aiAnalysis')}
          </Button>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  errorContainer: {
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
    backgroundColor: HR_THEME.primary,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  aiBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  profileContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  staffName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: HR_THEME.textPrimary,
    marginTop: 12,
  },
  staffMeta: {
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  statusChip: {
    marginTop: 12,
  },
  sectionCard: {
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: HR_THEME.cardBackground,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: HR_THEME.textPrimary,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    flex: 1,
    fontSize: 14,
    color: HR_THEME.textSecondary,
    marginLeft: 12,
  },
  infoValue: {
    fontSize: 14,
    color: HR_THEME.textPrimary,
  },
  divider: {
    marginVertical: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  workSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workItem: {
    flex: 1,
    alignItems: 'center',
  },
  workDivider: {
    width: 1,
    height: 40,
    backgroundColor: HR_THEME.border,
  },
  workValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: HR_THEME.primary,
  },
  workLabel: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 4,
  },
  batchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: HR_THEME.border,
  },
  batchInfo: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: HR_THEME.textPrimary,
  },
  batchProduct: {
    fontSize: 12,
    color: HR_THEME.textSecondary,
    marginTop: 2,
  },
  batchStats: {
    alignItems: 'flex-end',
  },
  batchHours: {
    fontSize: 14,
    fontWeight: '600',
    color: HR_THEME.primary,
  },
  batchDate: {
    fontSize: 11,
    color: HR_THEME.textMuted,
    marginTop: 2,
  },
  actionButtons: {
    marginTop: 8,
  },
  aiButton: {
    borderRadius: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
