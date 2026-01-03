import React from 'react';
import { View } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { BatchCostAnalysis } from '../../../../types/processing';
import { styles } from '../styles';

interface EquipmentStatsCardProps {
  equipmentStats: BatchCostAnalysis['equipmentStats'];
}

/**
 * 设备详情卡片组件
 * 显示设备使用统计和明细
 */
export const EquipmentStatsCard = React.memo<EquipmentStatsCardProps>(({ equipmentStats }) => {
  const { t } = useTranslation('processing');

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title
        title={t('costAnalysisDashboard.equipmentStats.title')}
        subtitle={t('costAnalysisDashboard.equipmentStats.subtitle', {
          usages: equipmentStats.totalUsages,
          hours: Math.floor(equipmentStats.totalDuration / 60)
        })}
      />
      <Card.Content>
        <View style={styles.detailRow}>
          <Text variant="bodyMedium">{t('costAnalysisDashboard.equipmentStats.usageCount')}</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {t('costAnalysisDashboard.equipmentStats.usageUnit', { count: equipmentStats.totalUsages })}
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">{t('costAnalysisDashboard.equipmentStats.runTime')}</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {t('costAnalysisDashboard.equipmentStats.hoursMinutes', {
              hours: Math.floor(equipmentStats.totalDuration / 60),
              minutes: equipmentStats.totalDuration % 60
            })}
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">{t('costAnalysisDashboard.equipmentStats.equipmentCost')}</Text>
          <Text variant="titleMedium" style={[styles.detailValue, { color: '#7B1FA2' }]}>
            ¥{equipmentStats.totalEquipmentCost.toFixed(2)}
          </Text>
        </View>

        {equipmentStats.equipmentDetails && equipmentStats.equipmentDetails.length > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <Text variant="bodySmall" style={{ color: '#757575', marginBottom: 8 }}>
              {t('costAnalysisDashboard.equipmentStats.equipmentDetails')}
            </Text>
            {equipmentStats.equipmentDetails.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                <Text variant="bodySmall">{detail.equipmentName}</Text>
                <Text variant="bodySmall" style={styles.detailValue}>
                  {detail.usageDuration ? `${Math.floor(detail.usageDuration / 60)}h` : '-'} • ¥{detail.equipmentCost?.toFixed(2) || '0.00'}
                </Text>
              </View>
            ))}
          </>
        )}
      </Card.Content>
    </Card>
  );
});

EquipmentStatsCard.displayName = 'EquipmentStatsCard';
