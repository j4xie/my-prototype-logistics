/**
 * AI 表单助手悬浮按钮组件
 *
 * 提供三种 AI 辅助输入方式:
 * 1. 文本输入 - 弹出对话框，输入自然语言
 * 2. 语音输入 - 使用讯飞语音识别
 * 3. OCR 扫描 - 拍照识别单据
 *
 * @example
 * ```tsx
 * const formRef = useRef<DynamicFormRef>(null);
 *
 * <AIAssistantButton
 *   formRef={formRef}
 *   entityType={EntityType.MATERIAL_BATCH}
 *   schema={materialBatchSchema}
 * />
 * ```
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-12-28
 */

import React, { useState, useCallback, useRef, RefObject } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Keyboard,
  Platform,
} from 'react-native';
import {
  FAB,
  Portal,
  Modal,
  TextInput,
  Button,
  Text,
  IconButton,
  Surface,
  ActivityIndicator,
  Snackbar,
  Chip,
} from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import { useFormAIAssistant } from '../hooks/useFormAIAssistant';
import { EntityType } from '../../services/api/formTemplateApiClient';
import { speechRecognitionService } from '../../services/voice/SpeechRecognitionService';
import type { DynamicFormRef, FormSchema } from '../core/DynamicForm';

// ========== 类型定义 ==========

export interface AIAssistantButtonProps {
  /** 表单引用 */
  formRef: RefObject<DynamicFormRef | null>;
  /** 实体类型 */
  entityType: EntityType;
  /** 表单 Schema */
  schema?: FormSchema;
  /** 上下文信息 */
  context?: Record<string, unknown>;
  /** 按钮位置 */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** 是否显示 */
  visible?: boolean;
  /** AI 填充成功回调 */
  onAIFillSuccess?: (fieldValues: Record<string, unknown>, confidence: number) => void;
  /** AI 填充失败回调 */
  onAIFillError?: (error: string) => void;
}

// ========== 组件实现 ==========

export const AIAssistantButton: React.FC<AIAssistantButtonProps> = ({
  formRef,
  entityType,
  schema,
  context,
  position = 'bottom-right',
  visible = true,
  onAIFillSuccess,
  onAIFillError,
}) => {
  // 状态
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isTextModalVisible, setIsTextModalVisible] = useState(false);
  const [isVoiceModalVisible, setIsVoiceModalVisible] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');

  // 动画
  const fabAnimation = useRef(new Animated.Value(0)).current;

  // AI 助手 Hook
  const {
    parseWithAI,
    parseWithOCR,
    isProcessing,
    aiFilledFields,
    lastResult,
    error,
  } = useFormAIAssistant({
    formRef,
    entityType,
    schema,
    context,
    onAIFill: (fieldValues, confidence) => {
      showSnackbar(`AI 已填充 ${Object.keys(fieldValues).length} 个字段 (置信度: ${Math.round(confidence * 100)}%)`, 'success');
      onAIFillSuccess?.(fieldValues, confidence);
    },
    onError: (err) => {
      showSnackbar(err, 'error');
      onAIFillError?.(err);
    },
  });

  // 显示提示
  const showSnackbar = useCallback((message: string, type: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setSnackbarVisible(true);
  }, []);

  // 切换菜单
  const toggleMenu = useCallback(() => {
    const toValue = isMenuOpen ? 0 : 1;
    Animated.spring(fabAnimation, {
      toValue,
      useNativeDriver: true,
      friction: 5,
    }).start();
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen, fabAnimation]);

  // 打开文本输入模态框
  const openTextModal = useCallback(() => {
    setIsMenuOpen(false);
    setTextInput('');
    setIsTextModalVisible(true);
  }, []);

  // 处理文本输入
  const handleTextSubmit = useCallback(async () => {
    if (!textInput.trim()) return;

    Keyboard.dismiss();
    setIsTextModalVisible(false);

    await parseWithAI(textInput);
    setTextInput('');
  }, [textInput, parseWithAI]);

  // 打开语音输入模态框
  const openVoiceModal = useCallback(async () => {
    setIsMenuOpen(false);
    setVoiceText('');
    setIsVoiceModalVisible(true);

    // 检查权限
    const hasPermission = await speechRecognitionService.requestPermissions();
    if (!hasPermission) {
      showSnackbar('未获得录音权限', 'error');
      setIsVoiceModalVisible(false);
    }
  }, [showSnackbar]);

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      setVoiceText('正在录音...');
      await speechRecognitionService.startListening();
    } catch (err) {
      setIsRecording(false);
      showSnackbar(err instanceof Error ? err.message : '录音启动失败', 'error');
    }
  }, [showSnackbar]);

  // 停止录音并识别
  const stopRecording = useCallback(async () => {
    try {
      setVoiceText('正在识别...');
      const result = await speechRecognitionService.stopListening();
      setIsRecording(false);

      if (result.text && result.text !== '[语音识别需要配置讯飞密钥]') {
        setVoiceText(result.text);
      } else {
        setVoiceText('');
        showSnackbar('语音识别失败，请重试', 'error');
      }
    } catch (err) {
      setIsRecording(false);
      setVoiceText('');
      showSnackbar(err instanceof Error ? err.message : '识别失败', 'error');
    }
  }, [showSnackbar]);

  // 确认语音输入
  const confirmVoiceInput = useCallback(async () => {
    if (!voiceText.trim() || voiceText === '正在录音...' || voiceText === '正在识别...') {
      return;
    }

    setIsVoiceModalVisible(false);
    await parseWithAI(voiceText);
    setVoiceText('');
  }, [voiceText, parseWithAI]);

  // 打开相机进行 OCR
  const openCamera = useCallback(async () => {
    setIsMenuOpen(false);

    // 请求相机权限
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showSnackbar('未获得相机权限', 'error');
      return;
    }

    // 拍照
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await parseWithOCR(result.assets[0].base64);
    }
  }, [parseWithOCR, showSnackbar]);

  // 从相册选择图片进行 OCR
  const pickImage = useCallback(async () => {
    setIsMenuOpen(false);

    // 请求相册权限
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showSnackbar('未获得相册权限', 'error');
      return;
    }

    // 选择图片
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
      base64: true,
      allowsEditing: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      await parseWithOCR(result.assets[0].base64);
    }
  }, [parseWithOCR, showSnackbar]);

  // 计算位置样式
  const positionStyle = {
    'bottom-right': { bottom: 16, right: 16 },
    'bottom-left': { bottom: 16, left: 16 },
    'top-right': { top: 16, right: 16 },
    'top-left': { top: 16, left: 16 },
  }[position];

  if (!visible) return null;

  // 菜单项动画
  const menuStyle1 = {
    opacity: fabAnimation,
    transform: [
      {
        translateY: fabAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -70],
        }),
      },
    ],
  };

  const menuStyle2 = {
    opacity: fabAnimation,
    transform: [
      {
        translateY: fabAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -130],
        }),
      },
    ],
  };

  const menuStyle3 = {
    opacity: fabAnimation,
    transform: [
      {
        translateY: fabAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -190],
        }),
      },
    ],
  };

  return (
    <>
      {/* 悬浮按钮组 */}
      <View style={[styles.fabContainer, positionStyle]} pointerEvents="box-none">
        {/* 菜单项: OCR 相册 */}
        <Animated.View style={[styles.menuItem, menuStyle3]}>
          <FAB
            icon="image"
            size="small"
            onPress={pickImage}
            disabled={isProcessing}
            style={styles.menuFab}
          />
          <Text style={styles.menuLabel}>相册</Text>
        </Animated.View>

        {/* 菜单项: OCR 拍照 */}
        <Animated.View style={[styles.menuItem, menuStyle2]}>
          <FAB
            icon="camera"
            size="small"
            onPress={openCamera}
            disabled={isProcessing}
            style={styles.menuFab}
          />
          <Text style={styles.menuLabel}>拍照</Text>
        </Animated.View>

        {/* 菜单项: 语音 */}
        <Animated.View style={[styles.menuItem, menuStyle1]}>
          <FAB
            icon="microphone"
            size="small"
            onPress={openVoiceModal}
            disabled={isProcessing}
            style={styles.menuFab}
          />
          <Text style={styles.menuLabel}>语音</Text>
        </Animated.View>

        {/* 主按钮 */}
        <FAB
          icon={isMenuOpen ? 'close' : 'robot'}
          onPress={isProcessing ? undefined : toggleMenu}
          loading={isProcessing}
          style={styles.mainFab}
          color="#fff"
        />
      </View>

      {/* 文本输入模态框 */}
      <Portal>
        <Modal
          visible={isTextModalVisible}
          onDismiss={() => setIsTextModalVisible(false)}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>AI 智能填表</Text>
          <Text style={styles.modalSubtitle}>
            用自然语言描述，AI 将自动填充表单
          </Text>

          <TextInput
            mode="outlined"
            label="描述您要填写的内容"
            placeholder="例如：帮我填一个带鱼批次，500公斤，温度-20度"
            value={textInput}
            onChangeText={setTextInput}
            multiline
            numberOfLines={4}
            style={styles.textInput}
          />

          <View style={styles.modalActions}>
            <Button
              mode="outlined"
              onPress={() => setIsTextModalVisible(false)}
              style={styles.actionButton}
            >
              取消
            </Button>
            <Button
              mode="contained"
              onPress={handleTextSubmit}
              disabled={!textInput.trim() || isProcessing}
              loading={isProcessing}
              style={styles.actionButton}
            >
              开始解析
            </Button>
          </View>
        </Modal>
      </Portal>

      {/* 语音输入模态框 */}
      <Portal>
        <Modal
          visible={isVoiceModalVisible}
          onDismiss={() => {
            if (isRecording) {
              speechRecognitionService.cancel();
            }
            setIsVoiceModalVisible(false);
          }}
          contentContainerStyle={styles.modalContent}
        >
          <Text style={styles.modalTitle}>语音输入</Text>
          <Text style={styles.modalSubtitle}>
            按住按钮说话，松开后自动识别
          </Text>

          <Surface style={styles.voiceBox}>
            {isRecording ? (
              <View style={styles.recordingIndicator}>
                <ActivityIndicator size="large" color="#FF5722" />
                <Text style={styles.recordingText}>正在录音...</Text>
              </View>
            ) : voiceText ? (
              <Text style={styles.voiceResultText}>{voiceText}</Text>
            ) : (
              <Text style={styles.voicePlaceholder}>点击下方按钮开始录音</Text>
            )}
          </Surface>

          <View style={styles.voiceControls}>
            <IconButton
              icon={isRecording ? 'stop' : 'microphone'}
              iconColor={isRecording ? '#FF5722' : '#2196F3'}
              size={48}
              mode="contained"
              onPress={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              style={styles.voiceButton}
            />
          </View>

          {voiceText && voiceText !== '正在录音...' && voiceText !== '正在识别...' && (
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setVoiceText('')}
                style={styles.actionButton}
              >
                重新录音
              </Button>
              <Button
                mode="contained"
                onPress={confirmVoiceInput}
                disabled={isProcessing}
                loading={isProcessing}
                style={styles.actionButton}
              >
                确认解析
              </Button>
            </View>
          )}
        </Modal>
      </Portal>

      {/* 处理中遮罩 */}
      <Portal>
        <Modal
          visible={isProcessing}
          dismissable={false}
          contentContainerStyle={styles.loadingModal}
        >
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>AI 正在分析...</Text>
        </Modal>
      </Portal>

      {/* 提示条 */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        style={snackbarType === 'error' ? styles.errorSnackbar : styles.successSnackbar}
        action={{
          label: '关闭',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </>
  );
};

// ========== 样式 ==========

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 1000,
  },
  mainFab: {
    backgroundColor: '#2196F3',
  },
  menuItem: {
    position: 'absolute',
    alignItems: 'center',
  },
  menuFab: {
    backgroundColor: '#fff',
  },
  menuLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalContent: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  textInput: {
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  actionButton: {
    minWidth: 100,
  },
  voiceBox: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    borderRadius: 8,
    elevation: 1,
  },
  recordingIndicator: {
    alignItems: 'center',
  },
  recordingText: {
    marginTop: 12,
    color: '#FF5722',
    fontSize: 16,
  },
  voiceResultText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  voicePlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  voiceControls: {
    alignItems: 'center',
    marginBottom: 16,
  },
  voiceButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  loadingModal: {
    backgroundColor: '#fff',
    margin: 60,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
  },
  successSnackbar: {
    backgroundColor: '#4CAF50',
  },
  errorSnackbar: {
    backgroundColor: '#F44336',
  },
});

export default AIAssistantButton;
