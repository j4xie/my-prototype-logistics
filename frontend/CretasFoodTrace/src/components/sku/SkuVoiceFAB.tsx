/**
 * SKU 语音配置 FAB 按钮
 *
 * 浮动操作按钮，用于触发语音配置功能
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
} from 'react-native';
import { FAB, Portal, Text, useTheme } from 'react-native-paper';
import { useSkuConfigVoiceStore } from '../../store/skuConfigVoiceStore';

// ==================== 类型定义 ====================

interface SkuVoiceFABProps {
  /** 是否显示 */
  visible?: boolean;
  /** 是否为编辑模式 */
  isEditMode?: boolean;
  /** 点击回调 */
  onPress?: () => void;
  /** 自定义样式 */
  style?: object;
  /** FAB 位置 */
  position?: 'left' | 'right';
}

// ==================== 主组件 ====================

export function SkuVoiceFAB({
  visible = true,
  isEditMode = false,
  onPress,
  style,
  position = 'right',
}: SkuVoiceFABProps) {
  const theme = useTheme();
  const { openDialog, status, dialogVisible } = useSkuConfigVoiceStore();

  // 脉冲动画
  const [pulseAnim] = useState(new Animated.Value(1));

  // 状态提示文字
  const getStatusHint = () => {
    switch (status) {
      case 'listening':
        return '正在录音...';
      case 'processing':
        return 'AI 分析中...';
      case 'speaking':
        return '播报中...';
      case 'confirming':
        return '请确认配置';
      case 'error':
        return '出现错误';
      default:
        return isEditMode ? '语音修改' : '语音配置';
    }
  };

  // 图标
  const getIcon = () => {
    switch (status) {
      case 'listening':
        return 'microphone';
      case 'processing':
        return 'robot';
      case 'speaking':
        return 'volume-high';
      case 'confirming':
        return 'check-circle';
      case 'error':
        return 'alert-circle';
      default:
        return 'microphone';
    }
  };

  // 背景色
  const getBackgroundColor = () => {
    switch (status) {
      case 'listening':
        return '#f5222d'; // 红色 - 录音中
      case 'processing':
        return '#faad14'; // 黄色 - 处理中
      case 'speaking':
        return '#1890ff'; // 蓝色 - 播报中
      case 'confirming':
        return '#52c41a'; // 绿色 - 确认中
      case 'error':
        return '#ff4d4f'; // 红色 - 错误
      default:
        return '#1890ff'; // 蓝色 - 默认
    }
  };

  // 点击处理
  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      openDialog(isEditMode);
    }
  }, [onPress, openDialog, isEditMode]);

  // 脉冲动画 (录音状态)
  useEffect(() => {
    if (status === 'listening') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
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
  }, [status, pulseAnim]);

  // 不显示则返回 null
  if (!visible || dialogVisible) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        position === 'left' ? styles.positionLeft : styles.positionRight,
        style,
      ]}
    >
      {/* 状态提示气泡 */}
      {status !== 'idle' && (
        <View
          style={[
            styles.statusBubble,
            position === 'left' ? styles.bubbleRight : styles.bubbleLeft,
          ]}
        >
          <Text style={styles.statusText}>{getStatusHint()}</Text>
        </View>
      )}

      {/* FAB 按钮 */}
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <FAB
          icon={getIcon()}
          onPress={handlePress}
          style={[
            styles.fab,
            { backgroundColor: getBackgroundColor() },
          ]}
          color="#fff"
          size="medium"
          disabled={status === 'processing' || status === 'speaking'}
        />
      </Animated.View>

      {/* 底部提示文字 */}
      {status === 'idle' && (
        <Text style={styles.hintText}>{getStatusHint()}</Text>
      )}
    </View>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    alignItems: 'center',
  },
  positionRight: {
    right: 24,
  },
  positionLeft: {
    left: 24,
  },
  fab: {
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
  },
  statusBubble: {
    position: 'absolute',
    top: -8,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  bubbleLeft: {
    right: 70,
  },
  bubbleRight: {
    left: 70,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  hintText: {
    marginTop: 6,
    fontSize: 11,
    color: '#666',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});

export default SkuVoiceFAB;
