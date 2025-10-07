import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Card, Text, ProgressBar, Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { ModuleConfig } from '../../../types/navigation';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2列布局,考虑16px padding

interface ModuleCardProps {
  module: ModuleConfig;
  onPress: () => void;
  disabled?: boolean;
}

/**
 * 模块卡片组件
 * 用于主页显示各业务模块入口
 */
export const ModuleCard: React.FC<ModuleCardProps> = ({
  module,
  onPress,
  disabled = false
}) => {
  // 根据模块状态决定卡片样式
  const isAvailable = module.status === 'available';
  const isComingSoon = module.status === 'coming_soon';
  const isLocked = module.status === 'locked';

  // 渐变色配置
  const gradientColors = isAvailable
    ? [module.color, `${module.color}CC`] // 可用:原色渐变
    : ['#E0E0E0', '#BDBDBD']; // 不可用:灰色渐变

  // 状态标识
  const statusBadge = () => {
    if (isComingSoon) {
      return (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>即将上线</Text>
        </View>
      );
    }
    if (isLocked) {
      return (
        <View style={[styles.badge, styles.lockedBadge]}>
          <Icon source="lock" size={12} color="#FFF" />
          <Text style={styles.badgeText}>已锁定</Text>
        </View>
      );
    }
    if (module.progress !== undefined && module.progress < 100) {
      return (
        <View style={[styles.badge, styles.progressBadge]}>
          <Text style={styles.badgeText}>{module.progress}%</Text>
        </View>
      );
    }
    return null;
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || !isAvailable}
      style={styles.container}
      activeOpacity={0.7}
    >
      <Card style={[styles.card, !isAvailable && styles.disabledCard]} mode="elevated">
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* 状态标识 */}
          {statusBadge()}

          {/* 图标 */}
          <View style={styles.iconContainer}>
            <Icon source={module.icon} size={40} color="#FFF" />
          </View>

          {/* 模块名称 */}
          <Text variant="titleMedium" style={styles.title}>
            {module.name}
          </Text>

          {/* 描述 */}
          <Text variant="bodySmall" style={styles.description} numberOfLines={2}>
            {module.description}
          </Text>

          {/* 进度条 (仅开发中模块显示) */}
          {module.progress !== undefined && module.progress < 100 && (
            <ProgressBar
              progress={module.progress / 100}
              color="#FFF"
              style={styles.progressBar}
            />
          )}
        </LinearGradient>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    marginBottom: 16,
  },
  card: {
    overflow: 'hidden',
    elevation: 4,
  },
  disabledCard: {
    opacity: 0.6,
  },
  gradient: {
    padding: 16,
    height: 160,
    justifyContent: 'space-between',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  progressBadge: {
    backgroundColor: 'rgba(255, 152, 0, 0.9)',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#FFF',
    fontWeight: '600',
    marginTop: 8,
  },
  description: {
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
});
