import React, { useState, useEffect, useRef, useMemo, memo } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { formatDuration, formatCurrency, calculateWorkMinutes } from '../../types/costAccounting';

interface TimerDisplayProps {
  startTime: string;
  ccrRate: number;  // CCR成本率(元/分钟)
  isActive?: boolean;
  variant?: 'normal' | 'warning' | 'danger';
}

/**
 * 计时器显示组件 - 实时显示工作时长和成本
 * - 超大字体显示时长
 * - 实时更新预估成本
 * - 颜色渐变提示(绿→黄→红)
 * - React.memo优化，减少不必要的重渲染
 */
export const TimerDisplay: React.FC<TimerDisplayProps> = memo(({
  startTime,
  ccrRate,
  isActive = true,
  variant = 'normal',
}) => {
  const [currentMinutes, setCurrentMinutes] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 每秒更新时长和成本（优化：使用ref避免闭包问题）
  useEffect(() => {
    if (!isActive) {
      // 清理定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // 立即更新一次
    const minutes = calculateWorkMinutes(startTime);
    setCurrentMinutes(minutes);
    setEstimatedCost(ccrRate * minutes);

    // 设置定时器
    intervalRef.current = setInterval(() => {
      const newMinutes = calculateWorkMinutes(startTime);
      setCurrentMinutes(newMinutes);
      setEstimatedCost(ccrRate * newMinutes);
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTime, ccrRate, isActive]);

  // 脉冲动画
  useEffect(() => {
    if (!isActive) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();

    return () => pulse.stop();
  }, [isActive]);

  // 根据时长获取颜色（使用useMemo优化）
  const [bgColor, textColor] = useMemo((): [string, string] => {
    if (variant === 'danger' || currentMinutes > 480) {
      // 超过8小时 - 红色
      return ['#FEE2E2', '#EF4444'];
    } else if (variant === 'warning' || currentMinutes > 360) {
      // 超过6小时 - 黄色
      return ['#FEF3C7', '#F59E0B'];
    } else {
      // 正常 - 绿色
      return ['#D1FAE5', '#10B981'];
    }
  }, [variant, currentMinutes]);

  // 格式化时间显示 (HH:MM:SS) - 使用useMemo优化
  const formattedTime = useMemo(() => {
    const hours = Math.floor(currentMinutes / 60);
    const mins = Math.floor(currentMinutes % 60);
    const secs = Math.floor(((currentMinutes % 1) * 60));

    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }, [currentMinutes]);

  // 格式化成本显示 - 使用useMemo优化
  const formattedCost = useMemo(() => formatCurrency(estimatedCost), [estimatedCost]);
  const formattedDuration = useMemo(() => formatDuration(currentMinutes), [currentMinutes]);
  const formattedCCR = useMemo(() => formatCurrency(ccrRate), [ccrRate]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[bgColor, '#FFFFFF']}
        style={styles.gradient}
      >
        {/* 标签 */}
        <Text style={styles.label}>
          {isActive ? '已工作时长' : '工作时长'}
        </Text>

        {/* 时间显示 */}
        <Animated.View style={{ transform: [{ scale: isActive ? pulseAnim : 1 }] }}>
          <Text style={[styles.time, { color: textColor }]}>
            {formattedTime}
          </Text>
        </Animated.View>

        {/* 时长文字 */}
        <Text style={styles.duration}>
          {formattedDuration}
        </Text>

        {/* 分隔线 */}
        <View style={styles.divider} />

        {/* 成本显示 */}
        <View style={styles.costContainer}>
          <Text style={styles.costLabel}>预估人工成本</Text>
          <Text style={[styles.costValue, { color: textColor }]}>
            {formattedCost}
          </Text>
        </View>

        {/* CCR率说明 */}
        <Text style={styles.ccrInfo}>
          成本率: {formattedCCR}/分钟
        </Text>
      </LinearGradient>
    </View>
  );
});

// 设置displayName以便调试
TimerDisplay.displayName = 'TimerDisplay';

const styles = StyleSheet.create({
  container: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  gradient: {
    padding: 32,
    alignItems: 'center',
  },
  label: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  time: {
    fontSize: 72,
    fontWeight: 'bold',
    fontFamily: 'monospace',
    letterSpacing: -2,
  },
  duration: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 8,
    marginBottom: 24,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  costContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  costLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 8,
  },
  costValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  ccrInfo: {
    fontSize: 14,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
