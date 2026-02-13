/**
 * KPICardMobile Component
 *
 * A gradient-styled KPI card for mobile SmartBI dashboards.
 * Features:
 * - Gradient background (purple/pink/blue/green)
 * - Large value display
 * - Trend indicator with arrow and percentage
 * - Optional sparkline trend visualization
 *
 * @version 1.0.0
 * @since 2026-02-12
 */

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export type TrendType = 'up' | 'down' | 'flat';

export interface KPICardMobileProps {
  /** Card title */
  title: string;
  /** Main display value (formatted string) */
  value: string;
  /** Trend percentage change (e.g., 5.2 for +5.2%) */
  change?: number;
  /** Trend direction */
  trend?: TrendType;
  /** Gradient color preset */
  colorPreset?: 'purple' | 'pink' | 'blue' | 'green' | 'orange';
  /** Press handler */
  onPress?: () => void;
  /** Optional subtitle */
  subtitle?: string;
}

// Gradient color presets (matching web KPICard.vue)
const GRADIENT_PRESETS = {
  purple: ['#667eea', '#764ba2'],
  pink: ['#f093fb', '#f5576c'],
  blue: ['#4facfe', '#00f2fe'],
  green: ['#43e97b', '#38f9d7'],
  orange: ['#fa709a', '#fee140'],
};

// Trend icons
const TREND_ICONS = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'trending-neutral',
} as const;

/**
 * KPICardMobile Component
 *
 * @example
 * ```tsx
 * <KPICardMobile
 *   title="总收入"
 *   value="¥125.2万"
 *   change={8.5}
 *   trend="up"
 *   colorPreset="purple"
 * />
 * ```
 */
export default function KPICardMobile({
  title,
  value,
  change,
  trend = 'flat',
  colorPreset = 'purple',
  onPress,
  subtitle,
}: KPICardMobileProps): React.ReactElement {
  const gradientColors = GRADIENT_PRESETS[colorPreset];
  const trendIcon = TREND_ICONS[trend];
  const trendColor = trend === 'up' ? '#4ade80' : trend === 'down' ? '#f87171' : '#9ca3af';

  const CardContent = (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {/* Value */}
        <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>

        {/* Subtitle (optional) */}
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {/* Trend indicator */}
        {change !== undefined && (
          <View style={styles.trendContainer}>
            <MaterialCommunityIcons
              name={trendIcon}
              size={16}
              color={trendColor}
            />
            <Text style={[styles.trendText, { color: trendColor }]}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        style={styles.container}
        onPress={onPress}
        activeOpacity={0.8}
      >
        {CardContent}
      </TouchableOpacity>
    );
  }

  return <View style={styles.container}>{CardContent}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  gradient: {
    padding: 16,
    minHeight: 120,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 8,
    fontWeight: '500',
  },
  value: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
