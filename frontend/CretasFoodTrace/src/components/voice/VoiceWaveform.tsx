/**
 * 语音波形动画组件
 * Voice Waveform Animation Component
 */

import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, ViewStyle } from 'react-native';

interface VoiceWaveformProps {
  isActive: boolean;
  barCount?: number;
  color?: string;
  style?: ViewStyle;
  height?: number;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  isActive,
  barCount = 5,
  color = '#2563EB',
  style,
  height = 40,
}) => {
  // 为每个柱子创建动画值
  const animatedValues = useRef<Animated.Value[]>(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isActive) {
      // 为每个柱子创建随机高度动画
      const animations = animatedValues.map((animValue, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: Math.random() * 0.7 + 0.3, // 0.3 - 1.0
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: Math.random() * 0.4 + 0.2, // 0.2 - 0.6
              duration: 200 + Math.random() * 300,
              useNativeDriver: true,
            }),
          ])
        );
      });

      // 错开启动时间
      animations.forEach((anim, index) => {
        setTimeout(() => anim.start(), index * 100);
      });

      return () => {
        animations.forEach((anim) => anim.stop());
      };
    } else {
      // 重置为静止状态
      animatedValues.forEach((animValue) => {
        Animated.timing(animValue, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        }).start();
      });
      return undefined;
    }
  }, [isActive, animatedValues]);

  return (
    <View style={[styles.container, { height }, style]}>
      {animatedValues.map((animValue, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: height,
              transform: [{ scaleY: animValue }],
            },
          ]}
        />
      ))}
    </View>
  );
};

/**
 * 圆形波形动画（用于麦克风按钮周围）
 */
interface CircularWaveformProps {
  isActive: boolean;
  size?: number;
  color?: string;
  rings?: number;
}

export const CircularWaveform: React.FC<CircularWaveformProps> = ({
  isActive,
  size = 120,
  color = '#2563EB',
  rings = 3,
}) => {
  const animatedValues = useRef<Animated.Value[]>(
    Array.from({ length: rings }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    if (isActive) {
      const animations = animatedValues.map((animValue, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(animValue, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
          ])
        );
      });

      // 错开启动
      animations.forEach((anim, index) => {
        setTimeout(() => anim.start(), index * 500);
      });

      return () => {
        animations.forEach((anim) => anim.stop());
      };
    } else {
      animatedValues.forEach((animValue) => {
        animValue.setValue(0);
      });
      return undefined;
    }
  }, [isActive, animatedValues]);

  return (
    <View style={[styles.circularContainer, { width: size, height: size }]}>
      {animatedValues.map((animValue, index) => (
        <Animated.View
          key={index}
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: color,
              opacity: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 0],
              }),
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1.5],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
};

/**
 * 简单的音量指示器
 */
interface VolumeIndicatorProps {
  level: number; // 0-1
  color?: string;
  width?: number;
  height?: number;
}

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({
  level,
  color = '#2563EB',
  width = 200,
  height = 8,
}) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: level,
      duration: 100,
      useNativeDriver: false, // 需要使用 false 来动画 width
    }).start();
  }, [level, animatedWidth]);

  return (
    <View style={[styles.volumeContainer, { width, height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          styles.volumeFill,
          {
            backgroundColor: color,
            height,
            borderRadius: height / 2,
            width: animatedWidth.interpolate({
              inputRange: [0, 1],
              outputRange: [0, width],
            }),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  circularContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
  },
  volumeContainer: {
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  volumeFill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});

export default VoiceWaveform;
