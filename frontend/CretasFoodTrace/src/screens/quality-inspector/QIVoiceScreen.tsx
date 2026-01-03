/**
 * 语音质检页面
 * Quality Inspector - Voice Inspection Screen
 * 集成讯飞语音识别 (通过后端代理)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QI_COLORS, QualityInspectorStackParamList } from '../../types/qualityInspector';
import { speechRecognitionService } from '../../services/voice/SpeechRecognitionService';
import { SpeechRecognitionStatus } from '../../services/voice/types';
import { useTranslation } from 'react-i18next';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;
type RouteProps = RouteProp<QualityInspectorStackParamList, 'QIVoice'>;

interface VoiceCommand {
  time: string;
  text: string;
  type: 'user' | 'system';
}

export default function QIVoiceScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation('quality');
  const { batchId, batchNumber } = route.params;

  const VOICE_HINTS = [
    t('voice.hints.appearance'),
    t('voice.hints.smell'),
    t('voice.hints.specification'),
    t('voice.hints.packaging'),
    t('voice.hints.failed'),
  ];

  const [status, setStatus] = useState<SpeechRecognitionStatus>('idle');
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [currentText, setCurrentText] = useState('');
  const [isListening, setIsListening] = useState(false);

  // 动画
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim1 = useRef(new Animated.Value(0)).current;
  const waveAnim2 = useRef(new Animated.Value(0)).current;
  const waveAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 设置语音识别回调
    const unsubResult = speechRecognitionService.addResultListener((result) => {
      if (result.text) {
        setCurrentText(result.text);
        if (result.isFinal) {
          addCommand(result.text, 'user');
          processVoiceCommand(result.text);
          setCurrentText('');
        }
      }
    });

    const unsubStatus = speechRecognitionService.addStatusListener((newStatus) => {
      setStatus(newStatus);
      setIsListening(newStatus === 'listening');
    });

    const unsubError = speechRecognitionService.addErrorListener((error) => {
      Alert.alert(t('voice.voiceRecognitionError'), error.message);
      setIsListening(false);
    });

    // 添加欢迎消息
    addCommand(t('voice.aiGreeting'), 'system');

    return () => {
      unsubResult();
      unsubStatus();
      unsubError();
      speechRecognitionService.cancel();
    };
  }, []);

  // 脉冲动画
  useEffect(() => {
    if (isListening) {
      startPulseAnimation();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening]);

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const addCommand = (text: string, type: 'user' | 'system') => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setCommands(prev => [...prev, { time, text, type }]);
  };

  const processVoiceCommand = (text: string) => {
    // 解析语音命令
    const lowerText = text.toLowerCase();

    // 检查是否包含评分关键词
    let response = '';

    if (lowerText.includes('外观')) {
      const score = extractScore(text);
      response = t('voice.recordedAppearance', { score });
    } else if (lowerText.includes('气味')) {
      const score = extractScore(text);
      response = t('voice.recordedSmell', { score });
    } else if (lowerText.includes('规格')) {
      const score = extractScore(text);
      response = t('voice.recordedSpecification', { score });
    } else if (lowerText.includes('重量')) {
      const score = extractScore(text);
      response = t('voice.recordedWeight', { score });
    } else if (lowerText.includes('包装')) {
      const score = extractScore(text);
      response = t('voice.recordedPackaging', { score });
    } else if (lowerText.includes('完成') || lowerText.includes('提交')) {
      response = t('voice.submittingResult');
      setTimeout(() => {
        navigation.goBack();
      }, 1500);
    } else {
      response = t('voice.pleaseSpecifyItem');
    }

    // 延迟添加系统回复
    setTimeout(() => {
      addCommand(response, 'system');
    }, 500);
  };

  const extractScore = (text: string): number => {
    // 提取数字分数
    const match = text.match(/(\d+)\s*(分|点)?/);
    if (match && match[1]) {
      const score = parseInt(match[1], 10);
      return Math.min(20, Math.max(0, score));
    }

    // 关键词匹配
    if (text.includes('满分') || text.includes('完美')) {
      return 20;
    }
    if (text.includes('优秀') || text.includes('很好')) {
      return 18;
    }
    if (text.includes('良好') || text.includes('不错')) {
      return 16;
    }
    if (text.includes('合格') || text.includes('一般')) {
      return 14;
    }
    if (text.includes('不合格') || text.includes('差')) {
      return 10;
    }

    return 15; // 默认分数
  };

  const handleMicPress = async () => {
    if (isListening) {
      try {
        await speechRecognitionService.stopListening();
      } catch (error) {
        console.error('停止录音失败:', error);
      }
    } else {
      try {
        await speechRecognitionService.startListening();
      } catch (error) {
        console.error('开始录音失败:', error);
        Alert.alert(t('voice.recordingFailed'), t('voice.cannotStartRecording'));
      }
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* 批次信息 */}
      <View style={styles.batchHeader}>
        <Text style={styles.batchNumber}>{batchNumber || t('voice.selectBatch')}</Text>
        {batchId && <Text style={styles.batchId}>{t('voice.batchId')}: {batchId}</Text>}
      </View>

      {/* 对话区域 */}
      <ScrollView
        style={styles.chatArea}
        contentContainerStyle={[styles.chatContent, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {commands.map((cmd, index) => (
          <View
            key={index}
            style={[
              styles.messageRow,
              cmd.type === 'user' ? styles.messageRowUser : styles.messageRowSystem,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                cmd.type === 'user' ? styles.bubbleUser : styles.bubbleSystem,
              ]}
            >
              {cmd.type === 'system' && (
                <Ionicons name="sparkles" size={16} color={QI_COLORS.primary} style={styles.aiIcon} />
              )}
              <Text style={[styles.messageText, cmd.type === 'user' && styles.messageTextUser]}>
                {cmd.text}
              </Text>
            </View>
            <Text style={styles.messageTime}>{cmd.time}</Text>
          </View>
        ))}

        {/* 当前识别文本 */}
        {currentText && (
          <View style={[styles.messageRow, styles.messageRowUser]}>
            <View style={[styles.messageBubble, styles.bubbleUser, styles.bubbleTyping]}>
              <Text style={[styles.messageText, styles.messageTextUser]}>{currentText}...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* 提示语 */}
      <View style={styles.hintsSection}>
        <Text style={styles.hintsTitle}>{t('voice.trySaying')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {VOICE_HINTS.map((hint, index) => (
            <TouchableOpacity
              key={index}
              style={styles.hintChip}
              onPress={() => addCommand(hint, 'user')}
            >
              <Text style={styles.hintText}>{hint}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 麦克风按钮 */}
      <View style={[styles.micSection, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.micButton}
          onPress={handleMicPress}
          activeOpacity={0.8}
        >
          <Animated.View
            style={[
              styles.micInner,
              isListening && styles.micInnerActive,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            {status === 'processing' ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={36}
                color="#fff"
              />
            )}
          </Animated.View>
        </TouchableOpacity>
        <Text style={styles.micHint}>
          {isListening ? t('voice.listening') : status === 'processing' ? t('voice.processing') : t('voice.clickToStart')}
        </Text>
      </View>

      {/* 底部操作 */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={20} color={QI_COLORS.text} />
          <Text style={styles.actionBtnText}>{t('voice.returnToForm')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn}>
          <Ionicons name="settings-outline" size={20} color={QI_COLORS.text} />
          <Text style={styles.actionBtnText}>{t('voice.voiceSettings')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },

  // 批次信息
  batchHeader: {
    backgroundColor: QI_COLORS.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  batchNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  batchId: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginTop: 4,
  },

  // 对话区域
  chatArea: {
    flex: 1,
  },
  chatContent: {
    padding: 16,
  },
  messageRow: {
    marginBottom: 12,
  },
  messageRowUser: {
    alignItems: 'flex-end',
  },
  messageRowSystem: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bubbleUser: {
    backgroundColor: QI_COLORS.primary,
    borderBottomRightRadius: 4,
  },
  bubbleSystem: {
    backgroundColor: QI_COLORS.card,
    borderBottomLeftRadius: 4,
  },
  bubbleTyping: {
    opacity: 0.8,
  },
  aiIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    fontSize: 15,
    color: QI_COLORS.text,
    lineHeight: 22,
    flex: 1,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTime: {
    fontSize: 11,
    color: QI_COLORS.disabled,
    marginTop: 4,
  },

  // 提示
  hintsSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: QI_COLORS.card,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
  },
  hintsTitle: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginBottom: 8,
  },
  hintChip: {
    backgroundColor: QI_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  hintText: {
    fontSize: 13,
    color: QI_COLORS.text,
  },

  // 麦克风
  micSection: {
    alignItems: 'center',
    paddingTop: 20,
    backgroundColor: QI_COLORS.card,
  },
  micButton: {
    marginBottom: 12,
  },
  micInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: QI_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: QI_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  micInnerActive: {
    backgroundColor: QI_COLORS.danger,
  },
  micHint: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },

  // 底部操作
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: QI_COLORS.card,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  actionBtnText: {
    fontSize: 14,
    color: QI_COLORS.text,
  },
});
