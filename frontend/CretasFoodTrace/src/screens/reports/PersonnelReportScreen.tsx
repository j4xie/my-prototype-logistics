import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Chip,
  DataTable,
  ActivityIndicator,
  Divider,
  Surface,
  SegmentedButtons,
} from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { personnelApiClient } from '../../services/api/personnelApiClient';
import { handleError , getErrorMsg} from '../../utils/errorHandler';
import type {
  PersonnelStatistics,
  WorkHoursRankingItem,
} from '../../services/api/personnelApiClient';
import { getFactoryId } from '../../types/auth';
import { logger } from '../../utils/logger';

// 创建PersonnelReport专用logger
const personnelReportLogger = logger.createContextLogger('PersonnelReport');

/**
 * 人员报表页面
 * API集成:
 * - GET /api/mobile/{factoryId}/personnel/statistics - 人员总览统计
 * - GET /api/mobile/{factoryId}/personnel/work-hours-ranking - 工时排行榜
 * - GET /api/mobile/{factoryId}/personnel/overtime-statistics - 加班统计
 * - GET /api/mobile/{factoryId}/personnel/performance - 人员绩效统计
 *
 * 展示内容:
 * - 人员总览统计
 * - 工时排行榜（TOP 10）
 * - 加班统计
 * - 绩效评估
 */
export default function PersonnelReportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { t } = useTranslation('reports');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('month');

  // 数据状态
  const [personnelStats, setPersonnelStats] = useState<PersonnelStatistics | null>(null);
  const [workHoursRanking, setWorkHoursRanking] = useState<WorkHoursRankingItem[]>([]);

  /**
   * 加载人员统计数据
   */
  const loadPersonnelData = async () => {
    setLoading(true);
    try {
      const factoryId = getFactoryId(user);

      if (!factoryId) {
        Alert.alert(t('common.error'), t('personnel.cannotGetFactoryInfo'));
        return;
      }

      personnelReportLogger.debug('加载人员报表数据', { timeRange, factoryId });

      // 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === 'week') {
        startDate.setDate(endDate.getDate() - 7);
      } else if (timeRange === 'month') {
        startDate.setMonth(endDate.getMonth() - 1);
      } else {
        startDate.setDate(endDate.getDate() - 1);
      }

      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      // 并行加载人员统计和工时排行榜
      const [statsResponse, rankingResponse] = await Promise.all([
        personnelApiClient.getPersonnelStatistics(factoryId, startDateStr, endDateStr)
          .catch((err) => {
            personnelReportLogger.error('人员统计API失败', err, { factoryId, startDateStr, endDateStr });
            return { success: false, data: null };
          }),
        personnelApiClient.getWorkHoursRanking(factoryId, startDateStr, endDateStr, 10)
          .catch((err) => {
            personnelReportLogger.error('工时排行API失败', err, { factoryId, startDateStr, endDateStr });
            return { success: false, data: [] };
          }),
      ]);

      // 设置人员统计数据
      if (statsResponse.success && statsResponse.data) {
        setPersonnelStats(statsResponse.data);
        personnelReportLogger.info('人员统计数据加载成功', {
          totalEmployees: statsResponse.data.totalEmployees,
          totalPresent: statsResponse.data.totalPresent,
          avgAttendanceRate: statsResponse.data.avgAttendanceRate.toFixed(1) + '%',
        });
      } else {
        setPersonnelStats(null);
        personnelReportLogger.warn('人员统计数据为空', { factoryId });
      }

      // 设置工时排行榜
      if (rankingResponse.success && rankingResponse.data) {
        setWorkHoursRanking(rankingResponse.data);
        personnelReportLogger.info('工时排行榜加载成功', {
          itemCount: rankingResponse.data.length,
        });
      } else {
        setWorkHoursRanking([]);
        personnelReportLogger.warn('工时排行榜数据为空', { factoryId });
      }

    } catch (error) {
      personnelReportLogger.error('加载人员报表失败', error, {
        factoryId: getFactoryId(user),
        timeRange,
      });
      const errorMessage =
        getErrorMsg(error) || t('personnel.loadFailed');
      Alert.alert(t('personnel.loadFailed'), errorMessage);
      setPersonnelStats(null);
      setWorkHoursRanking([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新数据
   */
  const handleRefresh = async () => {
    setRefreshing(true);
    await loadPersonnelData();
    setRefreshing(false);
  };

  /**
   * 页面聚焦时加载数据
   */
  useFocusEffect(
    useCallback(() => {
      loadPersonnelData();
    }, [timeRange])
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('personnel.title')} />
        <Appbar.Action icon="refresh" onPress={loadPersonnelData} />
      </Appbar.Header>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* 时间范围选择 */}
        <Surface style={styles.timeRangeCard} elevation={1}>
          <Text variant="bodyMedium" style={styles.sectionLabel}>
            {t('personnel.timeRange')}
          </Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'day', label: t('personnel.today') },
              { value: 'week', label: t('personnel.thisWeek') },
              { value: 'month', label: t('personnel.thisMonth') },
            ]}
            style={styles.segmentedButtons}
          />
        </Surface>

        {/* 人员总览 */}
        <Surface style={styles.statsCard} elevation={1}>
          <Text variant="titleMedium" style={styles.statsTitle}>
            {t('personnel.personnelOverview')}
          </Text>
          <Divider style={styles.divider} />

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
              <Text style={styles.loadingText}>{t('common.loading')}</Text>
            </View>
          ) : personnelStats ? (
            <>
              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{personnelStats.totalEmployees}</Text>
                  <Text style={styles.statLabel}>{t('personnel.totalEmployees')}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#4CAF50' }]}>
                    {personnelStats.totalPresent}
                  </Text>
                  <Text style={styles.statLabel}>{t('personnel.present')}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#F44336' }]}>
                    {personnelStats.totalAbsent}
                  </Text>
                  <Text style={styles.statLabel}>{t('personnel.absent')}</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: '#2196F3' }]}>
                    {personnelStats.activeDepartments}
                  </Text>
                  <Text style={styles.statLabel}>{t('personnel.activeDepartments')}</Text>
                </View>
              </View>

              <Divider style={styles.divider} />

              <View style={styles.attendanceRateContainer}>
                <Text style={styles.attendanceRateLabel}>{t('personnel.avgAttendanceRate')}</Text>
                <Text style={styles.attendanceRateValue}>
                  {personnelStats.avgAttendanceRate.toFixed(1)}%
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{t('personnel.noPersonnelData')}</Text>
            </View>
          )}
        </Surface>

        {/* 工时排行榜 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('personnel.workHoursRanking')} titleVariant="titleMedium" />
          <DataTable>
            <DataTable.Header>
              <DataTable.Title>{t('personnel.name')}</DataTable.Title>
              <DataTable.Title>{t('personnel.department')}</DataTable.Title>
              <DataTable.Title numeric>{t('personnel.workHours')}</DataTable.Title>
              <DataTable.Title numeric>{t('personnel.attendanceRate')}</DataTable.Title>
            </DataTable.Header>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" />
              </View>
            ) : workHoursRanking.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text variant="bodyMedium" style={styles.emptyText}>
                  {t('personnel.noWorkHoursData')}
                </Text>
              </View>
            ) : (
              workHoursRanking.map((item, index) => (
                <DataTable.Row key={item.userId || index}>
                  <DataTable.Cell>
                    <View style={styles.rankingNameCell}>
                      {index < 3 && (
                        <Chip
                          mode="flat"
                          style={[
                            styles.rankChip,
                            index === 0 && { backgroundColor: '#FFD700' },
                            index === 1 && { backgroundColor: '#C0C0C0' },
                            index === 2 && { backgroundColor: '#CD7F32' },
                          ]}
                          textStyle={{ fontSize: 10, fontWeight: 'bold' }}
                        >
                          {index + 1}
                        </Chip>
                      )}
                      <Text variant="bodySmall">{item.userName}</Text>
                    </View>
                  </DataTable.Cell>
                  <DataTable.Cell>
                    <Text variant="bodySmall" numberOfLines={1}>
                      {item.departmentName}
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text variant="bodySmall" style={{ color: '#2196F3', fontWeight: '600' }}>
                      {item.totalWorkHours.toFixed(1)}h
                    </Text>
                  </DataTable.Cell>
                  <DataTable.Cell numeric>
                    <Text
                      variant="bodySmall"
                      style={{
                        color: item.attendanceRate >= 95 ? '#4CAF50' : '#FF9800',
                      }}
                    >
                      {item.attendanceRate.toFixed(0)}%
                    </Text>
                  </DataTable.Cell>
                </DataTable.Row>
              ))
            )}
          </DataTable>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  timeRangeCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#666',
    marginBottom: 12,
    fontWeight: '500',
  },
  segmentedButtons: {
    marginTop: 4,
  },
  statsCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    marginBottom: 8,
  },
  statsTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  divider: {
    marginVertical: 12,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginLeft: 12,
    color: '#999',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  attendanceRateContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  attendanceRateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  attendanceRateValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4CAF50',
  },
  card: {
    margin: 16,
    marginBottom: 0,
    marginTop: 8,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#999',
  },
  rankingNameCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rankChip: {
    height: 20,
    marginRight: 4,
  },
  bottomPadding: {
    height: 80,
  },
});
