/**
 * VoiceMicButton — 可复用语音麦克风按钮
 *
 * 按下开始录音，再次按下（或调用 stopRecording）停止并通过后端代理进行语音识别。
 * 录音中显示脉冲动画；识别结果通过 onTranscript 回调返回。
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  TouchableOpacity,
  Animated,
  StyleSheet,
  Alert,
  View,
  ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { speechRecognitionService } from '../../services/voice/SpeechRecognitionService';

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  size?: number;
  color?: string;
  activeColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
}

export function VoiceMicButton({
  onTranscript,
  size = 36,
  color = '#6B7280',
  activeColor = '#EF4444',
  disabled = false,
  style,
}: VoiceMicButtonProps) {
  const { t } = useTranslation('voice');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnimationRef = useRef<Animated.CompositeAnimation | null>(null);

  // 启动脉冲动画
  useEffect(() => {
    if (isRecording) {
      pulseAnimationRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
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
      pulseAnimationRef.current.start();
    } else {
      pulseAnimationRef.current?.stop();
      pulseAnimationRef.current = null;
      pulseAnim.setValue(1);
    }

    return () => {
      pulseAnimationRef.current?.stop();
    };
  }, [isRecording, pulseAnim]);

  // 组件卸载时清理录音资源
  useEffect(() => {
    return () => {
      if (isRecording) {
        speechRecognitionService.stopListening().catch(() => {});
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = useCallback(async () => {
    if (disabled || isProcessing) return;

    if (isRecording) {
      // 停止录音并识别
      try {
        setIsRecording(false);
        setIsProcessing(true);
        const result = await speechRecognitionService.stopListening();
        if (result.text?.trim()) {
          onTranscript(result.text.trim());
        } else {
          Alert.alert(t('tip', { ns: 'common', defaultValue: '提示' }), t('error.no_speech_detected'));
        }
      } catch (err) {
        console.error('[VoiceMicButton] 停止录音失败:', err);
        Alert.alert(t('error.recognition_failed', { defaultValue: '语音识别失败' }), t('error.recognition_failed'));
      } finally {
        setIsProcessing(false);
      }
    } else {
      // 请求权限并开始录音
      try {
        const { status } = await Audio.requestPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(t('tip', { ns: 'common', defaultValue: '提示' }), t('error.permission_required'));
          return;
        }
        setIsRecording(true);
        await speechRecognitionService.startListening();
      } catch (err) {
        console.error('[VoiceMicButton] 开始录音失败:', err);
        setIsRecording(false);
        Alert.alert(t('error.service_connecting'), t('error.recognition_failed'));
      }
    }
  }, [disabled, isProcessing, isRecording, onTranscript]);

  const currentColor = isRecording ? activeColor : color;
  const iconName = isProcessing ? 'loading' : isRecording ? 'microphone-off' : 'microphone';

  return (
    <View style={[styles.wrapper, style]}>
      {/* 录音中的背景脉冲圆 */}
      {isRecording && (
        <Animated.View
          style={[
            styles.pulse,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: activeColor,
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />
      )}
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || isProcessing}
        activeOpacity={0.7}
        style={[
          styles.button,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isRecording ? activeColor + '20' : 'transparent',
          },
        ]}
      >
        <MaterialCommunityIcons
          name={iconName}
          size={size * 0.6}
          color={currentColor}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    opacity: 0.25,
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceMicButton;
