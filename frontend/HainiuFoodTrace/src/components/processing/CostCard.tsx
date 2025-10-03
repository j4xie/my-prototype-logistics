import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCurrency } from '../../types/costAccounting';

interface CostCardProps {
  title: string;
  amount: number;
  percentage?: string;  // 如 "45.23"
  icon?: keyof typeof Ionicons.glyphMap;
  color?: string;
  trend?: 'up' | 'down' | 'stable';
  subtitle?: string;
}

/**
 * 成本卡片组件 - 显示成本项目
 * - 图标+标题+金额
 * - 显示占比百分比
 * - 趋势箭头指示
 */
export const CostCard: React.FC<CostCardProps> = ({
  title,
  amount,
  percentage,
  icon = 'cash-outline',
  color = '#3B82F6',
  trend,
  subtitle,
}) => {
  const getTrendIcon = (): keyof typeof Ionicons.glyphMap | null => {
    if (trend === 'up') return 'trending-up';
    if (trend === 'down') return 'trending-down';
    return null;
  };

  const getTrendColor = (): string => {
    if (trend === 'up') return '#EF4444';  // 上升 - 红色(成本增加)
    if (trend === 'down') return '#10B981'; // 下降 - 绿色(成本减少)
    return '#6B7280';
  };

  const trendIcon = getTrendIcon();
  const trendColor = getTrendColor();

  return (
    <View style={styles.card}>
      {/* 图标区域 */}
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={32} color={color} />
      </View>

      {/* 内容区域 */}
      <View style={styles.content}>
        {/* 标题行 */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>{title}</Text>
          {trendIcon && (
            <Ionicons name={trendIcon} size={20} color={trendColor} />
          )}
        </View>

        {/* 副标题 */}
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {/* 金额和百分比 */}
        <View style={styles.amountRow}>
          <Text style={[styles.amount, { color }]}>
            {formatCurrency(amount)}
          </Text>
          {percentage && (
            <View style={[styles.percentageBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.percentage, { color }]}>
                {percentage}%
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  subtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  percentageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
  },
});
