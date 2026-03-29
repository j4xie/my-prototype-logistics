/**
 * useStatCards - Computes stat card data from dashboard results
 */
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { FAHomeStackParamList } from '../../../../types/navigation';
import { useFactoryFeatureStore } from '../../../../store/factoryFeatureStore';
import type { DashboardOverviewData, AlertsDashboardData, RestaurantDashboardSummary } from '../../../../services/api/dashboardApiClient';
import type { WorkReportSummary } from './useDashboardData';
import type { StatCardData } from '../types';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'FAHome'>;

function calculateTrendPercent(today: number | undefined, yesterday: number | undefined): string | undefined {
  if (today === undefined || yesterday === undefined || yesterday === 0) return undefined;
  const change = ((today - yesterday) / yesterday) * 100;
  if (change > 0) return `+${change.toFixed(0)}%`;
  if (change < 0) return `${change.toFixed(0)}%`;
  return undefined;
}

function calculateTrendDiff(today: number | undefined, yesterday: number | undefined): string | undefined {
  if (today === undefined || yesterday === undefined) return undefined;
  const diff = today - yesterday;
  if (diff > 0) return `+${diff}`;
  if (diff < 0) return `${diff}`;
  return undefined;
}

interface UseStatCardsParams {
  isRestaurantMode: boolean;
  overviewData: DashboardOverviewData | null;
  alertsData: AlertsDashboardData | null;
  restaurantSummary: RestaurantDashboardSummary | null;
  workReportSummary: WorkReportSummary;
}

export function useStatCards({
  isRestaurantMode,
  overviewData,
  alertsData,
  restaurantSummary,
  workReportSummary,
}: UseStatCardsParams) {
  const navigation = useNavigation<NavigationProp>();
  const { t } = useTranslation('home');
  const { isScreenEnabled, isProcessMode } = useFactoryFeatureStore();

  const getStatCards = useCallback((): StatCardData[] => {
    const todayStats = overviewData?.todayStats;
    const yesterdayStats = overviewData?.yesterdayStats;
    const alertsSummary = alertsData?.summary;

    const outputTrend = calculateTrendPercent(todayStats?.todayOutputKg, yesterdayStats?.outputKg);
    const batchTrend = calculateTrendDiff(todayStats?.totalBatches, yesterdayStats?.totalBatches);

    const statCardScreenGuard: Record<string, string> = {
      todayAlerts: 'AIAlerts',
    };

    if (isRestaurantMode) {
      return [
        {
          id: 'todaySales',
          value: restaurantSummary?.todayRequisitionCount ?? '--',
          label: t('stats.todayOrders', 'Today orders'),
          icon: 'receipt',
          color: '#667eea',
          onPress: () => navigation.navigate('TodayProduction'),
        },
        {
          id: 'pendingApproval',
          value: restaurantSummary?.pendingApprovalCount ?? '--',
          label: t('stats.pendingApproval', 'Pending'),
          icon: 'clipboard-check',
          color: (restaurantSummary?.pendingApprovalCount ?? 0) > 0 ? '#ff7043' : '#a0aec0',
          onPress: () => {
            const parent = navigation.getParent();
            if (parent) {
              parent.navigate('FAManagementTab', { screen: 'WorkReportApproval' });
            }
          },
        },
        {
          id: 'todayAlerts',
          value: alertsSummary?.activeAlerts ?? 0,
          label: t('stats.todayAlerts'),
          icon: 'alert-circle',
          color:
            alertsSummary?.criticalAlerts && alertsSummary.criticalAlerts > 0 ? '#e53e3e' : '#a0aec0',
          onPress: () => navigation.navigate('AIAlerts'),
        },
      ].filter(card => {
        const screenName = statCardScreenGuard[card.id];
        return !screenName || isScreenEnabled(screenName);
      });
    }

    return [
      {
        id: 'todayProduction',
        value:
          todayStats?.todayOutputKg != null ? Number(todayStats.todayOutputKg).toFixed(0) : '--',
        label: t('stats.todayOutput'),
        icon: 'scale',
        color: '#667eea',
        trend: outputTrend,
        onPress: () => navigation.navigate('TodayProduction'),
      },
      {
        id: 'todayBatches',
        value: todayStats?.totalBatches ?? overviewData?.summary?.totalBatches ?? '--',
        label: t('stats.todayBatches'),
        icon: 'package-variant',
        color: '#48bb78',
        trend: batchTrend,
        onPress: () => navigation.navigate('TodayBatches'),
      },
      {
        id: 'materialBatches',
        value: todayStats?.totalMaterialBatches ?? todayStats?.materialReceived ?? '--',
        label: t('stats.materialBatches'),
        icon: 'truck-delivery',
        color: '#ed8936',
        onPress: () => navigation.navigate('MaterialBatch'),
      },
      {
        id: 'todayAlerts',
        value: alertsSummary?.activeAlerts ?? overviewData?.summary?.activeAlerts ?? '--',
        label: t('stats.todayAlerts'),
        icon: 'alert-circle',
        color:
          alertsSummary?.criticalAlerts && alertsSummary.criticalAlerts > 0 ? '#e53e3e' : '#a0aec0',
        onPress: () => navigation.navigate('AIAlerts'),
      },
      {
        id: 'pendingApproval',
        value: workReportSummary.pendingApprovalCount ?? 0,
        label: t('stats.pendingWorkReport', 'Pending reports'),
        icon: 'clipboard-check',
        color: (workReportSummary.pendingApprovalCount ?? 0) > 0 ? '#ff7043' : '#a0aec0',
        onPress: () => {
          const parent = navigation.getParent();
          if (parent) {
            parent.navigate('FAManagementTab', { screen: 'WorkReportApproval' });
          }
        },
      },
      ...(isProcessMode()
        ? [
            {
              id: 'processTasks',
              value: 0,
              label: 'Process tasks',
              icon: 'format-list-checks',
              color: '#0891B2',
              onPress: () => {
                const parent = navigation.getParent();
                if (parent) {
                  parent.navigate('FAManagementTab', { screen: 'ProcessTaskList' });
                }
              },
            },
          ]
        : []),
    ].filter(card => {
      const screenName = statCardScreenGuard[card.id];
      return !screenName || isScreenEnabled(screenName);
    });
  }, [
    isRestaurantMode,
    overviewData,
    alertsData,
    restaurantSummary,
    workReportSummary,
    navigation,
    t,
    isScreenEnabled,
    isProcessMode,
  ]);

  return { getStatCards };
}
