/**
 * 语音助手悬浮按钮
 * Voice Assistant FAB Button
 */

import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Animated,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVoiceAssistantStore } from '../../store/voiceAssistantStore';

interface VoiceAssistantButtonProps {
  onPress: () => void;
  style?: ViewStyle;
  size?: 'small' | 'medium' | 'large';
  showPulse?: boolean;
}

const SIZE_MAP = {
  small: 48,
  medium: 56,
  large: 64,
};

const ICON_SIZE_MAP = {
  small: 24,
  medium: 28,
  large: 32,
};

export const VoiceAssistantButton: React.FC<VoiceAssistantButtonProps> = ({
  onPress,
  style,
  size = 'medium',
  showPulse = true,
}) => {
  const { config, status, isSessionActive } = useVoiceAssistantStore();
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  // 脉冲动画
  React.useEffect(() => {
    if (showPulse && status === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
      return undefined;
    }
  }, [status, showPulse, pulseAnim]);

  if (!config.enabled) {
    return null;
  }

  const buttonSize = SIZE_MAP[size];
  const iconSize = ICON_SIZE_MAP[size];

  // 根据状态确定颜色和图标
  const getStatusConfig = () => {
    switch (status) {
      case 'listening':
        return {
          backgroundColor: '#EF4444',
          icon: 'microphone' as const,
          iconColor: '#FFFFFF',
        };
      case 'processing':
        return {
          backgroundColor: '#F59E0B',
          icon: 'loading' as const,
          iconColor: '#FFFFFF',
        };
      case 'speaking':
        return {
          backgroundColor: '#3B82F6',
          icon: 'volume-high' as const,
          iconColor: '#FFFFFF',
        };
      case 'waiting_confirm':
        return {
          backgroundColor: '#10B981',
          icon: 'check-circle' as const,
          iconColor: '#FFFFFF',
        };
      case 'error':
        return {
          backgroundColor: '#6B7280',
          icon: 'alert-circle' as const,
          iconColor: '#FFFFFF',
        };
      default:
        return {
          backgroundColor: '#2563EB',
          icon: 'microphone' as const,
          iconColor: '#FFFFFF',
        };
    }
  };

  const statusConfig = getStatusConfig();

  return (
    <View style={[styles.container, style]}>
      {/* 脉冲效果 */}
      {showPulse && status === 'listening' && (
        <Animated.View
          style={[
            styles.pulse,
            {
              width: buttonSize,
              height: buttonSize,
              borderRadius: buttonSize / 2,
              backgroundColor: statusConfig.backgroundColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}

      {/* 主按钮 */}
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          styles.button,
          {
            width: buttonSize,
            height: buttonSize,
            borderRadius: buttonSize / 2,
            backgroundColor: statusConfig.backgroundColor,
          },
        ]}
      >
        {status === 'processing' ? (
          <Animated.View
            style={{
              transform: [
                {
                  rotate: pulseAnim.interpolate({
                    inputRange: [1, 1.3],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            }}
          >
            <MaterialCommunityIcons
              name="loading"
              size={iconSize}
              color={statusConfig.iconColor}
            />
          </Animated.View>
        ) : (
          <MaterialCommunityIcons
            name={statusConfig.icon}
            size={iconSize}
            color={statusConfig.iconColor}
          />
        )}
      </TouchableOpacity>

      {/* 会话激活指示器 */}
      {isSessionActive && (
        <View style={styles.activeIndicator} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    opacity: 0.3,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  activeIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
});

export default VoiceAssistantButton;
