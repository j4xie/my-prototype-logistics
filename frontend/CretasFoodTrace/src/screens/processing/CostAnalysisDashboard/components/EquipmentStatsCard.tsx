import React from 'react';
import { View } from 'react-native';
import { Text, Card, Divider } from 'react-native-paper';
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
  return (
    <Card style={styles.card} mode="elevated">
      <Card.Title
        title="⚙️ 设备详情"
        subtitle={`${equipmentStats.totalEquipment}台设备 • 运行${Math.floor(equipmentStats.totalRuntime / 60)}h`}
      />
      <Card.Content>
        <View style={styles.detailRow}>
          <Text variant="bodyMedium">设备数量</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {equipmentStats.totalEquipment}台
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">运行时长</Text>
          <Text variant="bodyMedium" style={styles.detailValue}>
            {Math.floor(equipmentStats.totalRuntime / 60)}小时 {equipmentStats.totalRuntime % 60}分钟
          </Text>
        </View>
        <Divider />

        <View style={styles.detailRow}>
          <Text variant="bodyMedium">设备成本</Text>
          <Text variant="titleMedium" style={[styles.detailValue, { color: '#7B1FA2' }]}>
            ¥{equipmentStats.totalCost.toFixed(2)}
          </Text>
        </View>

        {equipmentStats.equipmentDetails && equipmentStats.equipmentDetails.length > 0 && (
          <>
            <Divider style={{ marginVertical: 8 }} />
            <Text variant="bodySmall" style={{ color: '#757575', marginBottom: 8 }}>
              设备明细
            </Text>
            {equipmentStats.equipmentDetails.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                <Text variant="bodySmall">{detail.equipmentName}</Text>
                <Text variant="bodySmall" style={styles.detailValue}>
                  {Math.floor(detail.runtime / 60)}h • ¥{detail.cost.toFixed(2)}
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
