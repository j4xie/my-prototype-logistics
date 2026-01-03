import React from 'react';
import { View } from 'react-native';
import { Text, Card } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { BatchCostAnalysis } from '../../../../types/processing';
import { styles, colors } from '../styles';

interface CostOverviewCardProps {
  costBreakdown: BatchCostAnalysis['costBreakdown'];
}

/**
 * 成本概览卡片组件
 * 显示四个成本类别的网格视图
 *
 * 使用React.memo优化：只有costBreakdown变化时才重新渲染
 */
export const CostOverviewCard = React.memo<CostOverviewCardProps>(({ costBreakdown }) => {
  const { t } = useTranslation('processing');

  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title title={t('costAnalysisDashboard.costOverview.title')} />
      <Card.Content>
        <View style={styles.costGrid}>
          {/* 原材料成本 */}
          <View style={[styles.costItem, { backgroundColor: colors.rawMaterial.bg }]}>
            <Text variant="bodySmall" style={styles.costLabel}>
              {t('costAnalysisDashboard.costOverview.rawMaterialCost')}
            </Text>
            <Text variant="titleMedium" style={[styles.costValue, { color: colors.rawMaterial.text }]}>
              ¥{costBreakdown.rawMaterialCost.toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.costPercentage}>
              {costBreakdown.rawMaterialPercentage}
            </Text>
          </View>

          {/* 人工成本 */}
          <View style={[styles.costItem, { backgroundColor: colors.labor.bg }]}>
            <Text variant="bodySmall" style={styles.costLabel}>
              {t('costAnalysisDashboard.costOverview.laborCost')}
            </Text>
            <Text variant="titleMedium" style={[styles.costValue, { color: colors.labor.text }]}>
              ¥{costBreakdown.laborCost.toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.costPercentage}>
              {costBreakdown.laborPercentage}
            </Text>
          </View>

          {/* 设备成本 */}
          <View style={[styles.costItem, { backgroundColor: colors.equipment.bg }]}>
            <Text variant="bodySmall" style={styles.costLabel}>
              {t('costAnalysisDashboard.costOverview.equipmentCost')}
            </Text>
            <Text variant="titleMedium" style={[styles.costValue, { color: colors.equipment.text }]}>
              ¥{costBreakdown.equipmentCost.toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.costPercentage}>
              {costBreakdown.equipmentPercentage}
            </Text>
          </View>

          {/* 总成本 */}
          <View style={[styles.costItem, { backgroundColor: colors.total.bg }]}>
            <Text variant="bodySmall" style={styles.costLabel}>
              {t('costAnalysisDashboard.costOverview.totalCost')}
            </Text>
            <Text variant="titleLarge" style={[styles.costValue, { color: colors.total.text }]}>
              ¥{costBreakdown.totalCost.toFixed(2)}
            </Text>
            <Text variant="bodySmall" style={styles.costPercentage}>
              100%
            </Text>
          </View>
        </View>
      </Card.Content>
    </Card>
  );
});

CostOverviewCard.displayName = 'CostOverviewCard';
