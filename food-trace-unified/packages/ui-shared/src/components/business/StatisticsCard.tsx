import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { Card } from '../base/Card';

export interface StatData {
  value: string | number;
  label: string;
  change?: {
    value: number;
    type: 'increase' | 'decrease' | 'neutral';
  };
  icon?: string;
  color?: string;
}

export interface StatisticsCardProps {
  data: StatData;
  variant?: 'default' | 'compact' | 'detailed';
  onPress?: () => void;
  style?: ViewStyle;
}

export const StatisticsCard: React.FC<StatisticsCardProps> = ({
  data,
  variant = 'default',
  onPress,
  style,
}) => {
  const getChangeColor = (type: string) => {
    switch (type) {
      case 'increase': return '#4caf50';
      case 'decrease': return '#f44336';
      case 'neutral': return '#757575';
      default: return '#757575';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'increase': return 'trending-up';
      case 'decrease': return 'trending-down';
      case 'neutral': return 'trending-neutral';
      default: return 'minus';
    }
  };

  const formatValue = (value: string | number) => {
    if (typeof value === 'number') {
      if (value >= 1000000) {
        return `${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}K`;
      }
      return value.toString();
    }
    return value;
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  return (
    <Card
      variant="elevated"
      padding={variant === 'compact' ? 'small' : 'medium'}
      style={[styles.container, style]}
    >
      <View style={styles.content}>
        {/* 图标区域 */}
        {data.icon && (
          <View style={styles.iconSection}>
            <IconButton
              icon={data.icon}
              size={variant === 'compact' ? 20 : 24}
              iconColor={data.color || '#2196F3'}
              style={[
                styles.iconButton,
                { backgroundColor: (data.color || '#2196F3') + '20' }
              ]}
            />
          </View>
        )}

        {/* 数据区域 */}
        <View style={styles.dataSection}>
          <Text
            variant={variant === 'compact' ? 'headlineSmall' : 'headlineMedium'}
            style={[
              styles.value,
              { color: data.color || '#2196F3' }
            ]}
          >
            {formatValue(data.value)}
          </Text>
          
          <Text
            variant={variant === 'compact' ? 'bodySmall' : 'bodyMedium'}
            style={styles.label}
          >
            {data.label}
          </Text>

          {/* 变化指标 */}
          {data.change && variant !== 'compact' && (
            <View style={styles.changeSection}>
              <IconButton
                icon={getChangeIcon(data.change.type)}
                size={16}
                iconColor={getChangeColor(data.change.type)}
                style={styles.changeIcon}
              />
              <Text
                variant="bodySmall"
                style={[
                  styles.changeText,
                  { color: getChangeColor(data.change.type) }
                ]}
              >
                {formatChange(data.change.value)}
              </Text>
            </View>
          )}
        </View>

        {/* 操作区域 */}
        {onPress && variant === 'detailed' && (
          <View style={styles.actionSection}>
            <IconButton
              icon="chevron-right"
              size={20}
              onPress={onPress}
              style={styles.actionButton}
            />
          </View>
        )}
      </View>
    </Card>
  );
};

// 统计卡片网格组件
export interface StatisticsGridProps {
  stats: StatData[];
  columns?: 2 | 3 | 4;
  variant?: 'default' | 'compact' | 'detailed';
  onStatPress?: (stat: StatData, index: number) => void;
  style?: ViewStyle;
}

export const StatisticsGrid: React.FC<StatisticsGridProps> = ({
  stats,
  columns = 2,
  variant = 'compact',
  onStatPress,
  style,
}) => {
  const getItemWidth = () => {
    switch (columns) {
      case 2: return '48%';
      case 3: return '31%';
      case 4: return '23%';
      default: return '48%';
    }
  };

  return (
    <View style={[styles.grid, style]}>
      {stats.map((stat, index) => (
        <View
          key={index}
          style={[
            styles.gridItem,
            { width: getItemWidth() }
          ]}
        >
          <StatisticsCard
            data={stat}
            variant={variant}
            onPress={onStatPress ? () => onStatPress(stat, index) : undefined}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 80,
  } as ViewStyle,
  
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  
  iconSection: {
    marginRight: 12,
  } as ViewStyle,
  
  iconButton: {
    margin: 0,
  } as ViewStyle,
  
  dataSection: {
    flex: 1,
  } as ViewStyle,
  
  value: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  label: {
    opacity: 0.7,
    marginBottom: 8,
  },
  
  changeSection: {
    flexDirection: 'row',
    alignItems: 'center',
  } as ViewStyle,
  
  changeIcon: {
    margin: 0,
    marginRight: 4,
  } as ViewStyle,
  
  changeText: {
    fontWeight: '500',
    fontSize: 12,
  },
  
  actionSection: {
    marginLeft: 8,
  } as ViewStyle,
  
  actionButton: {
    margin: 0,
  } as ViewStyle,
  
  // 网格样式
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  } as ViewStyle,
  
  gridItem: {
    marginBottom: 8,
  } as ViewStyle,
});