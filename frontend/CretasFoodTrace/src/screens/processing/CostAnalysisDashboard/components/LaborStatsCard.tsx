import React from 'react';
import { View } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { BatchCostAnalysis } from '../../../../types/processing';
import { styles } from '../styles';

interface LaborStatsCardProps {
  laborStats: BatchCostAnalysis['laborStats'];
}

/**
 * 人工详情卡片组件
 * 显示人工统计数据和明细
 */
export const LaborStatsCard = React.memo<LaborStatsCardProps>(({ laborStats }) => {
  const { t } = useTranslation('processing');

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title
        title={t('costAnalysisDashboard.laborStats.title')}
        subtitle={t('costAnalysisDashboard.laborStats.subtitle', {
          personnel: laborStats.totalSessions,
          hours: Math.floor(laborStats.totalMinutes / 60)
        })}
      />
      <Card.Content>
        <View style={styles.detailRow}>
          <Text variant="bodyMedium">{t('costAnalysisDashboard.laborStats.totalPersonnel')}</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {t('costAnalysisDashboard.laborStats.personnelUnit', { count: laborStats.totalSessions })}
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">{t('costAnalysisDashboard.laborStats.totalHours')}</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {t('costAnalysisDashboard.laborStats.hoursMinutes', {
              hours: Math.floor(laborStats.totalMinutes / 60),
              minutes: laborStats.totalMinutes % 60
            })}
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">{t('costAnalysisDashboard.laborStats.laborCost')}</Text>
          <Text variant="titleMedium" style={[styles.detailValue, { color: '#1976D2' }]}>
            ¥{laborStats.totalLaborCost.toFixed(2)}
          </Text>
        </View>

        {laborStats.workerDetails && laborStats.workerDetails.length > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <Text variant="bodySmall" style={{ color: '#757575', marginBottom: 8 }}>
              {t('costAnalysisDashboard.laborStats.workerDetails')}
            </Text>
            {laborStats.workerDetails.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                <Text variant="bodySmall">{detail.workerName}{detail.workType ? ` (${detail.workType})` : ''}</Text>
                <Text variant="bodySmall" style={styles.detailValue}>
                  {detail.totalMinutes ? `${Math.floor(detail.totalMinutes / 60)}h` : '-'} • ¥{detail.laborCost?.toFixed(2) || '0.00'}
                </Text>
              </View>
            ))}
          </>
        )}
      </Card.Content>
    </Card>
  );
});

LaborStatsCard.displayName = 'LaborStatsCard';
