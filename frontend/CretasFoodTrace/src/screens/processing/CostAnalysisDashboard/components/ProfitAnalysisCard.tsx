import React from 'react';
import { View } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
import { BatchCostAnalysis } from '../../../../types/processing';
import { styles } from '../styles';

interface ProfitAnalysisCardProps {
  profitAnalysis: BatchCostAnalysis['profitAnalysis'];
}

/**
 * 利润分析卡片组件
 * 显示利润率、保本价等财务指标
 */
export const ProfitAnalysisCard = React.memo<ProfitAnalysisCardProps>(({ profitAnalysis }) => {
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title title="📊 利润分析" />
      <Card.Content>
        <View style={styles.detailRow}>
          <Text variant="bodyMedium">预期收入</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            ¥{profitAnalysis.expectedRevenue?.toFixed(2) || '0.00'}
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">总成本</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            ¥{profitAnalysis.totalCost.toFixed(2)}
          </Text>
        </View>
        <Divider />

        {profitAnalysis.profitMargin !== undefined && (
          <>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">利润</Text>
              <Text
                variant="titleMedium"
                style={[
                  styles.detailValue,
                  { color: profitAnalysis.profitMargin >= 0 ? '#388E3C' : '#D32F2F' },
                ]}
              >
                ¥{profitAnalysis.profitMargin.toFixed(2)}
              </Text>
            </View>
            <Divider />
          </>
        )}

        {profitAnalysis.profitRate !== undefined && (
          <>
            <View style={styles.detailRow}>
              <Text variant="bodyMedium">利润率</Text>
              <Text
                variant="titleMedium"
                style={[
                  styles.detailValue,
                  { color: profitAnalysis.profitRate >= 0 ? '#388E3C' : '#D32F2F' },
                ]}
              >
                {profitAnalysis.profitRate.toFixed(2)}%
              </Text>
            </View>
            <Divider />
          </>
        )}

        {profitAnalysis.breakEvenPrice && (
          <View style={styles.detailRow}>
            <Text variant="bodyMedium">保本价</Text>
            <Text variant="bodyMedium" style={styles.detailValue}>
              {profitAnalysis.breakEvenPrice}
            </Text>
          </View>
        )}
      </Card.Content>
    </Card>
  );
});

ProfitAnalysisCard.displayName = 'ProfitAnalysisCard';
