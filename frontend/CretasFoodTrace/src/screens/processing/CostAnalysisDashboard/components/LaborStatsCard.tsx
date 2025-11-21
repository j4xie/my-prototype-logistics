import React from 'react';
import { View } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
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
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title
        title="👥 人工详情"
        subtitle={`${laborStats.totalSessions}人 • 总工时${Math.floor(laborStats.totalMinutes / 60)}h`}
      />
      <Card.Content>
        <View style={styles.detailRow}>
          <Text variant="bodyMedium">总人数</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {laborStats.totalSessions}人
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">总工时</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {Math.floor(laborStats.totalMinutes / 60)}小时 {laborStats.totalMinutes % 60}分钟
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">人工成本</Text>
          <Text variant="titleMedium" style={[styles.detailValue, { color: '#1976D2' }]}>
            ¥{laborStats.totalLaborCost.toFixed(2)}
          </Text>
        </View>

        {laborStats.workerDetails && laborStats.workerDetails.length > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <Text variant="bodySmall" style={{ color: '#757575', marginBottom: 8 }}>
              工人明细
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
