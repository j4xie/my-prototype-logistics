/**
 * 语音助手浮层界面
 * Voice Assistant Overlay UI
 */

import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  SafeAreaView,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useVoiceAssistantStore,
  useInspectionProgress,
  useTotalScore,
} from '../../store/voiceAssistantStore';
import { VoiceChatBubble, TypingBubble, SystemMessage } from './VoiceChatBubble';
import { VoiceWaveform, CircularWaveform } from './VoiceWaveform';
import { INSPECTION_ITEMS, calculateGrade } from '../../services/voice/config';

interface VoiceAssistantOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (data: any) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const VoiceAssistantOverlay: React.FC<VoiceAssistantOverlayProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const {
    status,
    currentBatch,
    chatHistory,
    inspectionData,
    error,
    startListening,
    stopListening,
    confirmSubmit,
    resetSession,
    endSession,
    clearError,
  } = useVoiceAssistantStore();

  const progress = useInspectionProgress();
  const totalScore = useTotalScore();
  const scrollViewRef = useRef<ScrollView>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // 滑入动画
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // 自动滚动到底部
  useEffect(() => {
    if (chatHistory.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [chatHistory.length]);

  // P0 Fix: Wrap handlers with useCallback to prevent re-renders
  const handleMicPress = useCallback(async () => {
    try {
      if (status === 'listening') {
        await stopListening();
      } else if (status === 'idle') {
        await startListening();
      }
    } catch (err) {
      Alert.alert('错误', err instanceof Error ? err.message : '操作失败');
    }
  }, [status, stopListening, startListening]);

  const handleSubmit = useCallback(async () => {
    try {
      const result = await confirmSubmit();
      onSubmit?.(result);
      onClose();
    } catch (err) {
      Alert.alert('提交失败', err instanceof Error ? err.message : '请重试');
    }
  }, [confirmSubmit, onSubmit, onClose]);

  const handleReset = useCallback(() => {
    Alert.alert('确认重置', '将清除当前所有检验数据，是否继续？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确认重置',
        style: 'destructive',
        onPress: () => resetSession(),
      },
    ]);
  }, [resetSession]);

  const handleClose = useCallback(() => {
    if (chatHistory.length > 0 && progress.percentage < 100) {
      Alert.alert('确认退出', '检验尚未完成，退出将丢失当前进度', [
        { text: '继续检验', style: 'cancel' },
        {
          text: '确认退出',
          style: 'destructive',
          onPress: () => {
            endSession();
            onClose();
          },
        },
      ]);
    } else {
      endSession();
      onClose();
    }
  }, [chatHistory.length, progress.percentage, endSession, onClose]);

  // P0 Fix: Use useMemo for computed values
  const statusText = useMemo(() => {
    switch (status) {
      case 'listening':
        return '正在聆听...';
      case 'processing':
        return '正在处理...';
      case 'speaking':
        return '正在播报...';
      case 'waiting_confirm':
        return '等待确认提交';
      case 'error':
        return '发生错误';
      default:
        return '点击麦克风开始说话';
    }
  }, [status]);

  const micButtonColor = useMemo(() => {
    switch (status) {
      case 'listening':
        return '#EF4444';
      case 'processing':
        return '#F59E0B';
      case 'speaking':
        return '#3B82F6';
      default:
        return '#2563EB';
    }
  }, [status]);

  if (!currentBatch) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackground}>
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <SafeAreaView style={styles.safeArea}>
            {/* 头部 */}
            <View style={styles.header}>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>AI 语音质检</Text>
              <TouchableOpacity onPress={handleReset} style={styles.resetButton}>
                <MaterialCommunityIcons name="refresh" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* 批次信息卡片 */}
            <View style={styles.batchCard}>
              <View style={styles.batchInfo}>
                <Text style={styles.batchNumber}>{currentBatch.batchNumber}</Text>
                <Text style={styles.batchProduct}>
                  {currentBatch.productName} | {currentBatch.quantity}
                  {currentBatch.unit}
                </Text>
                {currentBatch.source && (
                  <Text style={styles.batchSource}>
                    来源: {currentBatch.source}
                  </Text>
                )}
              </View>
              {/* 总分显示 */}
              {progress.completed > 0 && (
                <View style={styles.scoreContainer}>
                  <Text style={styles.scoreValue}>{totalScore}</Text>
                  <Text style={styles.scoreLabel}>
                    分 / {calculateGrade(totalScore)}级
                  </Text>
                </View>
              )}
            </View>

            {/* 进度条 */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${progress.percentage}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {progress.completed}/{progress.total} 项完成
              </Text>
            </View>

            {/* 检验项目指示器 */}
            <View style={styles.itemIndicators}>
              {INSPECTION_ITEMS.map((item) => {
                const itemData = inspectionData[item.key as 'appearance' | 'smell' | 'specification' | 'weight' | 'packaging'];
                const isCompleted = itemData?.score !== undefined;
                return (
                  <View
                    key={item.key}
                    style={[
                      styles.itemIndicator,
                      isCompleted && styles.itemIndicatorCompleted,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={isCompleted ? 'check' : 'circle-outline'}
                      size={12}
                      color={isCompleted ? '#FFFFFF' : '#9CA3AF'}
                    />
                    <Text
                      style={[
                        styles.itemIndicatorText,
                        isCompleted && styles.itemIndicatorTextCompleted,
                      ]}
                    >
                      {item.name}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* 对话区域 */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.chatContainer}
              contentContainerStyle={styles.chatContent}
              showsVerticalScrollIndicator={false}
            >
              {/* 错误提示 */}
              {error && (
                <SystemMessage
                  text={error.message}
                  type="error"
                  style={{ marginBottom: 8 }}
                />
              )}

              {/* 对话气泡 */}
              {chatHistory.map((message) => (
                <VoiceChatBubble key={message.id} message={message} />
              ))}

              {/* 处理中指示 */}
              {status === 'processing' && <TypingBubble />}
            </ScrollView>

            {/* 底部控制区 */}
            <View style={styles.bottomControls}>
              {/* 波形动画 */}
              <View style={styles.waveformContainer}>
                {status === 'listening' ? (
                  <VoiceWaveform
                    isActive={true}
                    barCount={7}
                    color="#2563EB"
                    height={30}
                  />
                ) : (
                  <Text style={styles.statusText}>{statusText}</Text>
                )}
              </View>

              {/* 麦克风按钮 */}
              <View style={styles.micContainer}>
                {status === 'listening' && (
                  <CircularWaveform
                    isActive={true}
                    size={100}
                    color={micButtonColor}
                  />
                )}
                <TouchableOpacity
                  onPress={handleMicPress}
                  disabled={status === 'processing' || status === 'speaking'}
                  style={[
                    styles.micButton,
                    { backgroundColor: micButtonColor },
                    (status === 'processing' || status === 'speaking') &&
                      styles.micButtonDisabled,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={
                      status === 'listening'
                        ? 'stop'
                        : status === 'processing'
                        ? 'loading'
                        : 'microphone'
                    }
                    size={32}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              </View>

              {/* 提交按钮 */}
              {progress.percentage === 100 && (
                <TouchableOpacity
                  onPress={handleSubmit}
                  style={styles.submitButton}
                >
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.submitButtonText}>确认提交</Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    height: SCREEN_HEIGHT * 0.9,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  safeArea: {
    flex: 1,
  },
  // 头部
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  resetButton: {
    padding: 4,
  },
  // 批次卡片
  batchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
  },
  batchInfo: {
    flex: 1,
  },
  batchNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  batchProduct: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  batchSource: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2563EB',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  // 进度条
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 8,
    minWidth: 60,
  },
  // 检验项目指示器
  itemIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginTop: 8,
    paddingHorizontal: 16,
    gap: 6,
  },
  itemIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  itemIndicatorCompleted: {
    backgroundColor: '#10B981',
  },
  itemIndicatorText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  itemIndicatorTextCompleted: {
    color: '#FFFFFF',
  },
  // 对话区域
  chatContainer: {
    flex: 1,
    marginTop: 12,
  },
  chatContent: {
    paddingVertical: 8,
  },
  // 底部控制
  bottomControls: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  waveformContainer: {
    height: 30,
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: '#6B7280',
  },
  micContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 100,
    height: 100,
  },
  micButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  micButtonDisabled: {
    opacity: 0.6,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 12,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default VoiceAssistantOverlay;
