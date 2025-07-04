import React from 'react';
import { View, StyleSheet, ViewStyle, TouchableOpacity } from 'react-native';
import { Text, Chip, Divider } from 'react-native-paper';
import { Card } from '../base/Card';
import { Badge } from '../base/Badge';

export interface TraceData {
  id: string;
  batchNumber: string;
  productName: string;
  status: 'active' | 'processing' | 'completed' | 'shipped';
  createdAt: string;
  location: string;
  category: string;
  quality?: 'pass' | 'fail' | 'warning';
  progress?: number;
}

export interface TraceCardProps {
  data: TraceData;
  onPress?: (data: TraceData) => void;
  showProgress?: boolean;
  compact?: boolean;
  style?: ViewStyle;
}

export const TraceCard: React.FC<TraceCardProps> = ({
  data,
  onPress,
  showProgress = false,
  compact = false,
  style,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#2196F3';
      case 'processing': return '#ff9800';
      case 'completed': return '#4caf50';
      case 'shipped': return '#9c27b0';
      default: return '#757575';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return '进行中';
      case 'processing': return '加工中';
      case 'completed': return '已完成';
      case 'shipped': return '已发货';
      default: return '未知';
    }
  };

  const getQualityVariant = (quality?: string) => {
    switch (quality) {
      case 'pass': return 'success';
      case 'fail': return 'danger';
      case 'warning': return 'warning';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const CardComponent = onPress ? TouchableOpacity : View;

  return (
    <CardComponent
      onPress={onPress ? () => onPress(data) : undefined}
      style={style}
      activeOpacity={0.7}
    >
      <Card variant="elevated" padding={compact ? 'small' : 'medium'}>
        {/* 头部信息 */}
        <View style={styles.header}>
          <View style={styles.titleSection}>
            <Text variant="titleMedium" style={styles.productName}>
              {data.productName}
            </Text>
            <Text variant="bodySmall" style={styles.batchNumber}>
              批次号: {data.batchNumber}
            </Text>
          </View>
          
          <View style={styles.statusSection}>
            <Chip
              style={[
                styles.statusChip,
                { backgroundColor: getStatusColor(data.status) + '20' }
              ]}
              textStyle={{ color: getStatusColor(data.status) }}
              compact
            >
              {getStatusText(data.status)}
            </Chip>
          </View>
        </View>

        {!compact && <Divider style={styles.divider} />}

        {/* 详细信息 */}
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.label}>
              分类:
            </Text>
            <Text variant="bodySmall" style={styles.value}>
              {data.category}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.label}>
              位置:
            </Text>
            <Text variant="bodySmall" style={styles.value}>
              {data.location}
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <Text variant="bodySmall" style={styles.label}>
              创建:
            </Text>
            <Text variant="bodySmall" style={styles.value}>
              {formatDate(data.createdAt)}
            </Text>
          </View>
        </View>

        {/* 质量和进度信息 */}
        {(data.quality || showProgress) && (
          <>
            {!compact && <Divider style={styles.divider} />}
            <View style={styles.footer}>
              {data.quality && (
                <Badge variant={getQualityVariant(data.quality)} size="small">
                  {data.quality === 'pass' ? '合格' : 
                   data.quality === 'fail' ? '不合格' : '警告'}
                </Badge>
              )}
              
              {showProgress && data.progress !== undefined && (
                <View style={styles.progressSection}>
                  <Text variant="bodySmall" style={styles.progressText}>
                    进度: {data.progress}%
                  </Text>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill,
                        { 
                          width: `${data.progress}%`,
                          backgroundColor: getStatusColor(data.status)
                        }
                      ]} 
                    />
                  </View>
                </View>
              )}
            </View>
          </>
        )}
      </Card>
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  } as ViewStyle,
  
  titleSection: {
    flex: 1,
    marginRight: 12,
  } as ViewStyle,
  
  productName: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  
  batchNumber: {
    opacity: 0.7,
  },
  
  statusSection: {
    alignItems: 'flex-end',
  } as ViewStyle,
  
  statusChip: {
    marginBottom: 4,
  } as ViewStyle,
  
  divider: {
    marginVertical: 12,
  } as ViewStyle,
  
  details: {
    gap: 6,
  } as ViewStyle,
  
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  } as ViewStyle,
  
  label: {
    opacity: 0.7,
    fontWeight: '500',
  },
  
  value: {
    flex: 1,
    textAlign: 'right',
  },
  
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  } as ViewStyle,
  
  progressSection: {
    flex: 1,
    marginLeft: 12,
  } as ViewStyle,
  
  progressText: {
    textAlign: 'right',
    marginBottom: 4,
    opacity: 0.7,
  },
  
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    overflow: 'hidden',
  } as ViewStyle,
  
  progressFill: {
    height: '100%',
    borderRadius: 2,
  } as ViewStyle,
});