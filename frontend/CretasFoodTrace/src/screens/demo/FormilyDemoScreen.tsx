/**
 * FormilyDemoScreen - AI 动态表单演示页面 (Premium Version v4)
 *
 * 改进:
 * 1. 点击自动演示进入全屏轮播模式
 * 2. 每个步骤内容限制在屏幕内，无需滚动
 * 3. 流畅的步骤切换动画
 * 4. 8步详细流程展示
 * 5. 真实表单类型展示
 * 6. 流式文字打字效果
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
  StatusBar,
  Easing,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {
  Text,
  Surface,
  useTheme,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// ============ 类型定义 ============
interface DemoStep {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  color: string;
  duration: number;
}

// ============ 演示数据 ============
const DEMO_STEPS: DemoStep[] = [
  {
    id: 1,
    title: '进入配置',
    subtitle: 'Enter Config',
    description: '进入表单模板管理页面',
    icon: 'cog-outline',
    color: '#667eea',
    duration: 3500,
  },
  {
    id: 2,
    title: '选择表单',
    subtitle: 'Select Form',
    description: '选择要配置的表单类型',
    icon: 'form-select',
    color: '#764ba2',
    duration: 3500,
  },
  {
    id: 3,
    title: '唤起 AI',
    subtitle: 'Activate AI',
    description: '点击 AI 助手开始对话',
    icon: 'robot',
    color: '#f093fb',
    duration: 3000,
  },
  {
    id: 4,
    title: '描述需求',
    subtitle: 'Describe Need',
    description: '用自然语言描述字段需求',
    icon: 'chat-processing',
    color: '#4facfe',
    duration: 4000,
  },
  {
    id: 5,
    title: 'AI 理解',
    subtitle: 'AI Parse',
    description: 'AI 分析并理解您的需求',
    icon: 'brain',
    color: '#43e97b',
    duration: 4500,
  },
  {
    id: 6,
    title: '生成字段',
    subtitle: 'Generate Fields',
    description: 'AI 自动生成表单字段',
    icon: 'auto-fix',
    color: '#fa709a',
    duration: 3500,
  },
  {
    id: 7,
    title: '预览确认',
    subtitle: 'Preview',
    description: '预览生成的字段，可调整',
    icon: 'eye-check',
    color: '#00c6fb',
    duration: 3000,
  },
  {
    id: 8,
    title: '保存版本',
    subtitle: 'Save Version',
    description: '保存为新版本，支持回滚',
    icon: 'content-save-check',
    color: '#38ef7d',
    duration: 3000,
  },
];

// 真实表单类型（与系统一致）
const FORM_TYPES = [
  { id: 'quality', name: '质检表单', icon: 'clipboard-check', color: '#1890ff', status: '使用默认配置' },
  { id: 'material', name: '原料批次', icon: 'package-variant', color: '#52c41a', status: '版本', hasConfig: true },
  { id: 'production', name: '生产批次', icon: 'cog', color: '#fa8c16', status: '使用默认配置' },
  { id: 'shipment', name: '出货单', icon: 'truck-delivery', color: '#eb2f96', status: '使用默认配置' },
  { id: 'equipment', name: '设备信息', icon: 'wrench', color: '#722ed1', status: '使用默认配置' },
];

// 生成的字段
const GENERATED_FIELDS = [
  { name: '运输温度', type: 'number', component: '滑块', icon: 'thermometer' },
  { name: '供应商评级', type: 'rating', component: '星级', icon: 'star' },
  { name: '冷链证明', type: 'file', component: '上传', icon: 'file-image' },
];

// AI 回复内容（用于流式输出）
const AI_RESPONSE_TEXT = `好的，我理解了您的需求：

1. 运输温度 - 数值型滑块
2. 供应商评级 - 星级评分
3. 冷链证明 - 文件上传

正在为您生成表单字段...`;

// ============ 流式文字 Hook ============
function useTypewriter(text: string, speed: number = 30, start: boolean = false) {
  const [displayText, setDisplayText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!start) {
      setDisplayText('');
      setIsComplete(false);
      return;
    }

    let index = 0;
    setDisplayText('');
    setIsComplete(false);

    const timer = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(timer);
        setIsComplete(true);
      }
    }, speed);

    return () => clearInterval(timer);
  }, [text, speed, start]);

  return { displayText, isComplete };
}

// ============ 动画 Hooks ============
function useStepTransition() {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  const animateOut = useCallback(() => {
    return new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -30,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
  }, [fadeAnim, scaleAnim, slideAnim]);

  const animateIn = useCallback(() => {
    slideAnim.setValue(30);
    return new Promise<void>((resolve) => {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => resolve());
    });
  }, [fadeAnim, scaleAnim, slideAnim]);

  return { fadeAnim, scaleAnim, slideAnim, animateOut, animateIn };
}

// ============ 全屏演示组件 ============
interface FullScreenDemoProps {
  visible: boolean;
  onClose: () => void;
}

const FullScreenDemo: React.FC<FullScreenDemoProps> = ({ visible, onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [startTypewriter, setStartTypewriter] = useState(false);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const { fadeAnim, scaleAnim, slideAnim, animateOut, animateIn } = useStepTransition();

  // currentStep 始终在 0 到 DEMO_STEPS.length-1 范围内，step 不会为 undefined
  const step = DEMO_STEPS[currentStep]!;

  // 流式文字效果
  const { displayText: aiText, isComplete: aiTextComplete } = useTypewriter(
    AI_RESPONSE_TEXT,
    25,
    startTypewriter && currentStep === 4
  );

  // 重置状态
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      progressAnim.setValue(0);
      setStartTypewriter(false);
    }
  }, [visible]);

  // 每个步骤开始时触发流式文字
  useEffect(() => {
    if (visible && currentStep === 4) {
      // AI 理解步骤，延迟启动打字效果
      const timer = setTimeout(() => setStartTypewriter(true), 500);
      return () => clearTimeout(timer);
    }
    setStartTypewriter(false);
    return undefined;
  }, [visible, currentStep]);

  // 进度动画
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / DEMO_STEPS.length,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  // 切换步骤
  const goToStep = useCallback(async (newStep: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    await animateOut();
    setCurrentStep(newStep);
    await animateIn();
    setIsTransitioning(false);
  }, [isTransitioning, animateOut, animateIn]);

  // 自动播放
  useEffect(() => {
    if (visible) {
      autoPlayTimerRef.current = setTimeout(() => {
        const nextStep = currentStep < DEMO_STEPS.length - 1 ? currentStep + 1 : 0;
        goToStep(nextStep);
      }, step.duration);
    }
    return () => {
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }
    };
  }, [visible, currentStep, step.duration, goToStep]);

  // 渲染步骤内容 - 精简版，确保不超出屏幕
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // 进入配置
        return (
          <View style={fsStyles.stepContentBox}>
            <View style={fsStyles.mockNav}>
              <Text style={fsStyles.mockNavText}>管理 › 系统配置 ›</Text>
              <Text style={fsStyles.mockNavHighlight}> 表单配置</Text>
            </View>
            <View style={fsStyles.entryCard}>
              <LinearGradient colors={[step.color, '#764ba2']} style={fsStyles.entryGradient}>
                <Icon source="form-select" size={40} color="#fff" />
                <Text style={fsStyles.entryTitle}>表单模板配置</Text>
                <Text style={fsStyles.entryDesc}>管理表单字段结构</Text>
              </LinearGradient>
            </View>
          </View>
        );

      case 1: // 选择表单 - 展示所有5种表单类型
        return (
          <View style={fsStyles.stepContentBox}>
            <Text style={fsStyles.contentLabel}>表单类型</Text>
            <View style={fsStyles.formList}>
              {FORM_TYPES.slice(0, 4).map((form, idx) => (
                <View key={form.id} style={[fsStyles.formListItem, idx === 1 && fsStyles.formListItemSelected]}>
                  <View style={[fsStyles.formListIcon, { backgroundColor: form.color + '15' }]}>
                    <Icon source={form.icon} size={22} color={form.color} />
                  </View>
                  <View style={fsStyles.formListInfo}>
                    <Text style={fsStyles.formListName}>{form.name}</Text>
                    <Text style={fsStyles.formListStatus}>{form.status}</Text>
                  </View>
                  {idx === 1 && <Icon source="check-circle" size={20} color="#52c41a" />}
                  {form.hasConfig && (
                    <View style={fsStyles.aiTag}>
                      <Icon source="robot" size={12} color="#667eea" />
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        );

      case 2: // 唤起 AI
        return (
          <View style={fsStyles.stepContentBox}>
            <View style={fsStyles.aiHeader}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={fsStyles.aiAvatar}>
                <Icon source="robot" size={28} color="#fff" />
              </LinearGradient>
              <View style={fsStyles.aiInfo}>
                <Text style={fsStyles.aiTitle}>AI 表单助手</Text>
                <Text style={fsStyles.aiDesc}>用自然语言描述您的需求</Text>
              </View>
            </View>
            <LinearGradient colors={['#667eea', '#764ba2']} style={fsStyles.aiButton}>
              <Icon source="chat-processing" size={18} color="#fff" />
              <Text style={fsStyles.aiButtonText}>开始对话</Text>
            </LinearGradient>
          </View>
        );

      case 3: // 描述需求
        return (
          <View style={fsStyles.stepContentBox}>
            <View style={fsStyles.chatBubbleRight}>
              <Text style={fsStyles.chatTextWhite}>
                我需要添加运输温度、供应商评级和冷链证明三个字段
              </Text>
            </View>
            <View style={fsStyles.typingRow}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={fsStyles.aiAvatarSmall}>
                <Icon source="robot" size={14} color="#fff" />
              </LinearGradient>
              <View style={fsStyles.typingIndicator}>
                <View style={fsStyles.typingDot} />
                <View style={[fsStyles.typingDot, { opacity: 0.6 }]} />
                <View style={[fsStyles.typingDot, { opacity: 0.3 }]} />
              </View>
            </View>
          </View>
        );

      case 4: // AI 理解 - 流式输出
        return (
          <View style={fsStyles.stepContentBox}>
            <View style={fsStyles.aiResponseRow}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={fsStyles.aiAvatarSmall}>
                <Icon source="robot" size={14} color="#fff" />
              </LinearGradient>
              <View style={fsStyles.chatBubbleLeft}>
                <Text style={fsStyles.chatTextDark}>
                  {aiText}
                  {!aiTextComplete && <Text style={fsStyles.cursor}>|</Text>}
                </Text>
              </View>
            </View>
          </View>
        );

      case 5: // 生成字段
        return (
          <View style={fsStyles.stepContentBox}>
            <Text style={fsStyles.contentLabel}>AI 生成的字段</Text>
            <View style={fsStyles.fieldsList}>
              {GENERATED_FIELDS.map((field, idx) => (
                <View key={field.name} style={fsStyles.fieldItem}>
                  <View style={[fsStyles.fieldIcon, { backgroundColor: step.color + '15' }]}>
                    <Icon source={field.icon} size={18} color={step.color} />
                  </View>
                  <View style={fsStyles.fieldInfo}>
                    <Text style={fsStyles.fieldName}>{field.name}</Text>
                    <View style={fsStyles.fieldTags}>
                      <View style={[fsStyles.tag, { backgroundColor: '#667eea15' }]}>
                        <Text style={[fsStyles.tagText, { color: '#667eea' }]}>{field.type}</Text>
                      </View>
                      <View style={[fsStyles.tag, { backgroundColor: '#52c41a15' }]}>
                        <Text style={[fsStyles.tagText, { color: '#52c41a' }]}>{field.component}</Text>
                      </View>
                    </View>
                  </View>
                  <Icon source="check-circle" size={18} color="#52c41a" />
                </View>
              ))}
            </View>
          </View>
        );

      case 6: // 预览确认
        return (
          <View style={fsStyles.stepContentBox}>
            <View style={fsStyles.previewHeader}>
              <Icon source="eye-check" size={20} color={step.color} />
              <Text style={fsStyles.previewTitle}>字段预览</Text>
              <View style={fsStyles.previewBadge}>
                <Text style={fsStyles.previewBadgeText}>3 个新字段</Text>
              </View>
            </View>
            <View style={fsStyles.previewList}>
              {GENERATED_FIELDS.map((field) => (
                <View key={field.name} style={fsStyles.previewItem}>
                  <Icon source={field.icon} size={16} color="#666" />
                  <Text style={fsStyles.previewItemName}>{field.name}</Text>
                  <Text style={fsStyles.previewItemType}>{field.component}</Text>
                </View>
              ))}
            </View>
            <View style={fsStyles.previewActions}>
              <View style={fsStyles.editBtn}>
                <Text style={fsStyles.editBtnText}>调整</Text>
              </View>
              <View style={fsStyles.confirmBtn}>
                <Icon source="check" size={14} color="#fff" />
                <Text style={fsStyles.confirmBtnText}>确认</Text>
              </View>
            </View>
          </View>
        );

      case 7: // 保存版本
        return (
          <View style={fsStyles.stepContentBox}>
            <View style={fsStyles.successIcon}>
              <LinearGradient colors={['#38ef7d', '#11998e']} style={fsStyles.successGradient}>
                <Icon source="check" size={40} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={fsStyles.successTitle}>保存成功!</Text>
            <Text style={fsStyles.successDesc}>已创建新版本 v1.2</Text>
            <View style={fsStyles.versionInfo}>
              <View style={fsStyles.versionItem}>
                <Text style={fsStyles.versionLabel}>版本号</Text>
                <Text style={fsStyles.versionValue}>v1.2</Text>
              </View>
              <View style={fsStyles.versionDivider} />
              <View style={fsStyles.versionItem}>
                <Text style={fsStyles.versionLabel}>新增字段</Text>
                <Text style={fsStyles.versionValue}>3 个</Text>
              </View>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={fsStyles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {/* 渐变背景 */}
        <LinearGradient
          colors={[step.color, '#1a1a2e']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* 关闭按钮 */}
        <TouchableOpacity style={fsStyles.closeBtn} onPress={onClose}>
          <Icon source="close" size={24} color="#fff" />
        </TouchableOpacity>

        {/* 顶部进度 */}
        <View style={fsStyles.progressSection}>
          <View style={fsStyles.progressDots}>
            {DEMO_STEPS.map((s, idx) => (
              <View
                key={s.id}
                style={[
                  fsStyles.progressDot,
                  idx === currentStep && fsStyles.progressDotActive,
                  idx < currentStep && fsStyles.progressDotCompleted,
                ]}
              />
            ))}
          </View>
          <Text style={fsStyles.progressText}>
            {currentStep + 1} / {DEMO_STEPS.length}
          </Text>
        </View>

        {/* 步骤标题 */}
        <View style={fsStyles.stepHeader}>
          <Animated.View
            style={[
              fsStyles.stepIconContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <LinearGradient colors={['#ffffff30', '#ffffff10']} style={fsStyles.stepIconBg}>
              <Icon source={step.icon} size={36} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Animated.Text
            style={[
              fsStyles.stepTitle,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {step.title}
          </Animated.Text>
          <Animated.Text
            style={[
              fsStyles.stepSubtitle,
              { opacity: fadeAnim },
            ]}
          >
            {step.description}
          </Animated.Text>
        </View>

        {/* 步骤内容 */}
        <Animated.View
          style={[
            fsStyles.contentArea,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
            },
          ]}
        >
          {renderStepContent()}
        </Animated.View>

        {/* 底部步骤指示器 */}
        <View style={fsStyles.bottomIndicator}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={fsStyles.stepsScroll}
          >
            {DEMO_STEPS.map((s, idx) => (
              <TouchableOpacity
                key={s.id}
                style={[
                  fsStyles.stepDot,
                  idx === currentStep && { backgroundColor: s.color },
                ]}
                onPress={() => goToStep(idx)}
              >
                <Icon
                  source={s.icon}
                  size={14}
                  color={idx === currentStep ? '#fff' : '#ffffff60'}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

// ============ 普通浏览模式 - 步骤内容渲染 ============
const renderNormalStepContent = (currentStep: number, step: DemoStep) => {
  switch (currentStep) {
    case 0: // 进入配置
      return (
        <View style={normalStyles.contentBox}>
          <View style={normalStyles.mockNav}>
            <Text style={normalStyles.mockNavText}>管理 › 系统配置 ›</Text>
            <Text style={normalStyles.mockNavHighlight}> 表单配置</Text>
          </View>
          <View style={normalStyles.entryCard}>
            <LinearGradient colors={[step.color, '#764ba2']} style={normalStyles.entryGradient}>
              <Icon source="form-select" size={48} color="#fff" />
              <Text style={normalStyles.entryTitle}>表单模板配置</Text>
              <Text style={normalStyles.entryDesc}>管理 5 种表单字段结构</Text>
            </LinearGradient>
          </View>
        </View>
      );

    case 1: // 选择表单 - 展示所有5种表单类型
      return (
        <View style={normalStyles.contentBox}>
          <Text style={normalStyles.contentLabel}>选择要配置的表单</Text>
          {FORM_TYPES.map((form, idx) => (
            <View key={form.id} style={[normalStyles.formItem, idx === 1 && normalStyles.formItemSelected]}>
              <View style={[normalStyles.formItemIcon, { backgroundColor: form.color + '15' }]}>
                <Icon source={form.icon} size={24} color={form.color} />
              </View>
              <View style={normalStyles.formItemInfo}>
                <Text style={normalStyles.formItemName}>{form.name}</Text>
                <Text style={normalStyles.formItemStatus}>{form.status}</Text>
              </View>
              {idx === 1 && <Icon source="check-circle" size={20} color="#52c41a" />}
              {form.hasConfig && (
                <View style={normalStyles.aiConfigBadge}>
                  <Icon source="robot" size={12} color="#667eea" />
                  <Text style={normalStyles.aiBadgeText}>AI</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      );

    case 2: // 唤起 AI
      return (
        <View style={normalStyles.contentBox}>
          <View style={normalStyles.aiSection}>
            <LinearGradient colors={['#667eea', '#764ba2']} style={normalStyles.aiAvatarLarge}>
              <Icon source="robot" size={40} color="#fff" />
            </LinearGradient>
            <Text style={normalStyles.aiSectionTitle}>AI 表单助手</Text>
            <Text style={normalStyles.aiSectionDesc}>用自然语言描述您想添加的字段</Text>
            <LinearGradient colors={['#667eea', '#764ba2']} style={normalStyles.aiStartBtn}>
              <Icon source="chat-processing" size={20} color="#fff" />
              <Text style={normalStyles.aiStartBtnText}>开始对话</Text>
            </LinearGradient>
          </View>
        </View>
      );

    case 3: // 描述需求
      return (
        <View style={normalStyles.contentBox}>
          <Text style={normalStyles.contentLabel}>对话示例</Text>
          <View style={normalStyles.chatArea}>
            <View style={normalStyles.chatBubbleRight}>
              <Text style={normalStyles.chatTextWhite}>
                我需要添加运输温度、供应商评级和冷链证明三个字段
              </Text>
            </View>
            <View style={normalStyles.typingRow}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={normalStyles.aiAvatarSmall}>
                <Icon source="robot" size={14} color="#fff" />
              </LinearGradient>
              <View style={normalStyles.typingBubble}>
                <View style={normalStyles.typingDots}>
                  <View style={normalStyles.typingDot} />
                  <View style={[normalStyles.typingDot, { opacity: 0.6 }]} />
                  <View style={[normalStyles.typingDot, { opacity: 0.3 }]} />
                </View>
                <Text style={normalStyles.typingText}>AI 正在分析...</Text>
              </View>
            </View>
          </View>
        </View>
      );

    case 4: // AI 理解
      return (
        <View style={normalStyles.contentBox}>
          <Text style={normalStyles.contentLabel}>AI 理解结果</Text>
          <View style={normalStyles.aiResponseBox}>
            <View style={normalStyles.aiResponseHeader}>
              <LinearGradient colors={['#667eea', '#764ba2']} style={normalStyles.aiAvatarSmall}>
                <Icon source="robot" size={14} color="#fff" />
              </LinearGradient>
              <Text style={normalStyles.aiResponseTitle}>AI 回复</Text>
            </View>
            <View style={normalStyles.aiResponseContent}>
              <Text style={normalStyles.aiResponseText}>好的，我理解了您的需求：</Text>
              <View style={normalStyles.aiResponseItem}>
                <Icon source="numeric-1-circle" size={18} color="#667eea" />
                <Text style={normalStyles.aiResponseItemText}>运输温度 - 数值型滑块</Text>
              </View>
              <View style={normalStyles.aiResponseItem}>
                <Icon source="numeric-2-circle" size={18} color="#667eea" />
                <Text style={normalStyles.aiResponseItemText}>供应商评级 - 星级评分</Text>
              </View>
              <View style={normalStyles.aiResponseItem}>
                <Icon source="numeric-3-circle" size={18} color="#667eea" />
                <Text style={normalStyles.aiResponseItemText}>冷链证明 - 文件上传</Text>
              </View>
            </View>
          </View>
        </View>
      );

    case 5: // 生成字段
      return (
        <View style={normalStyles.contentBox}>
          <Text style={normalStyles.contentLabel}>AI 生成的字段</Text>
          {GENERATED_FIELDS.map((field) => (
            <View key={field.name} style={normalStyles.generatedField}>
              <View style={[normalStyles.fieldIconBox, { backgroundColor: step.color + '15' }]}>
                <Icon source={field.icon} size={22} color={step.color} />
              </View>
              <View style={normalStyles.fieldContent}>
                <Text style={normalStyles.fieldNameText}>{field.name}</Text>
                <View style={normalStyles.fieldTagsRow}>
                  <View style={[normalStyles.fieldTag, { backgroundColor: '#667eea15' }]}>
                    <Text style={[normalStyles.fieldTagText, { color: '#667eea' }]}>{field.type}</Text>
                  </View>
                  <View style={[normalStyles.fieldTag, { backgroundColor: '#52c41a15' }]}>
                    <Text style={[normalStyles.fieldTagText, { color: '#52c41a' }]}>{field.component}</Text>
                  </View>
                </View>
              </View>
              <Icon source="check-circle" size={22} color="#52c41a" />
            </View>
          ))}
        </View>
      );

    case 6: // 预览确认
      return (
        <View style={normalStyles.contentBox}>
          <View style={normalStyles.previewHeader}>
            <Icon source="eye-check" size={24} color={step.color} />
            <Text style={normalStyles.previewTitle}>预览确认</Text>
            <View style={normalStyles.previewBadge}>
              <Text style={normalStyles.previewBadgeText}>3 个新字段</Text>
            </View>
          </View>
          <View style={normalStyles.previewCard}>
            {GENERATED_FIELDS.map((field) => (
              <View key={field.name} style={normalStyles.previewFieldItem}>
                <Icon source={field.icon} size={18} color="#666" />
                <Text style={normalStyles.previewFieldName}>{field.name}</Text>
                <Text style={normalStyles.previewFieldType}>{field.component}</Text>
              </View>
            ))}
          </View>
          <View style={normalStyles.previewActions}>
            <TouchableOpacity style={normalStyles.editBtn}>
              <Icon source="pencil" size={16} color="#667eea" />
              <Text style={normalStyles.editBtnText}>调整字段</Text>
            </TouchableOpacity>
            <TouchableOpacity activeOpacity={0.8}>
              <LinearGradient colors={['#52c41a', '#38ef7d']} style={normalStyles.confirmBtn}>
                <Icon source="check" size={16} color="#fff" />
                <Text style={normalStyles.confirmBtnText}>确认添加</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      );

    case 7: // 保存版本
      return (
        <View style={normalStyles.contentBox}>
          <View style={normalStyles.successSection}>
            <LinearGradient colors={['#38ef7d', '#11998e']} style={normalStyles.successIconBox}>
              <Icon source="check" size={48} color="#fff" />
            </LinearGradient>
            <Text style={normalStyles.successTitle}>保存成功!</Text>
            <Text style={normalStyles.successDesc}>表单配置已创建新版本</Text>
          </View>
          <View style={normalStyles.versionCard}>
            <View style={normalStyles.versionRow}>
              <Text style={normalStyles.versionLabel}>版本号</Text>
              <Text style={normalStyles.versionValue}>v1.2</Text>
            </View>
            <View style={normalStyles.versionDivider} />
            <View style={normalStyles.versionRow}>
              <Text style={normalStyles.versionLabel}>新增字段</Text>
              <Text style={normalStyles.versionValue}>3 个</Text>
            </View>
            <View style={normalStyles.versionDivider} />
            <View style={normalStyles.versionRow}>
              <Text style={normalStyles.versionLabel}>可回滚</Text>
              <Icon source="check-circle" size={18} color="#52c41a" />
            </View>
          </View>
        </View>
      );

    default:
      return null;
  }
};

// ============ 主组件 ============
export const FormilyDemoScreen: React.FC = () => {
  const theme = useTheme();
  const [showFullScreen, setShowFullScreen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // currentStep 始终在有效范围内
  const step = DEMO_STEPS[currentStep]!;

  // 进度条动画
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / DEMO_STEPS.length,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [currentStep, progressAnim]);

  const handlePrevStep = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  const handleNextStep = () => {
    if (currentStep < DEMO_STEPS.length - 1) setCurrentStep(currentStep + 1);
  };

  const handleStartDemo = () => {
    setShowFullScreen(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>AI 动态表单</Text>
          <Text style={styles.headerSubtitle}>自然语言驱动的表单配置体验</Text>

          {/* 进度条 */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {currentStep + 1}/{DEMO_STEPS.length}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* 步骤指示器 */}
      <View style={styles.stepIndicatorContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepIndicatorScroll}
        >
          {DEMO_STEPS.map((s, idx) => (
            <TouchableOpacity
              key={s.id}
              style={styles.stepIndicatorItem}
              onPress={() => setCurrentStep(idx)}
            >
              <View
                style={[
                  styles.stepDot,
                  idx < currentStep && styles.stepDotCompleted,
                  idx === currentStep && [styles.stepDotCurrent, { borderColor: s.color }],
                ]}
              >
                {idx < currentStep ? (
                  <Icon source="check" size={14} color="#fff" />
                ) : (
                  <Icon source={s.icon} size={14} color={idx === currentStep ? s.color : '#999'} />
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  idx === currentStep && { color: s.color, fontWeight: '600' },
                ]}
                numberOfLines={1}
              >
                {s.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 当前步骤卡片 */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <Surface style={styles.stepCard} elevation={2}>
          {/* 步骤标题 */}
          <View style={styles.stepCardHeader}>
            <View style={[styles.stepCardIcon, { backgroundColor: step.color + '15' }]}>
              <Icon source={step.icon} size={28} color={step.color} />
            </View>
            <View style={styles.stepCardInfo}>
              <Text style={styles.stepCardTitle}>{step.title}</Text>
              <Text style={styles.stepCardSubtitle}>{step.subtitle}</Text>
            </View>
          </View>

          <View style={styles.stepCardDivider} />

          {/* 步骤描述 */}
          <Text style={styles.stepDescription}>{step.description}</Text>

          {/* 详细步骤内容 */}
          {renderNormalStepContent(currentStep, step)}
        </Surface>
      </ScrollView>

      {/* 底部控制区 */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, currentStep === 0 && styles.controlBtnDisabled]}
          onPress={handlePrevStep}
          disabled={currentStep === 0}
        >
          <Icon source="chevron-left" size={20} color={currentStep === 0 ? '#ccc' : '#667eea'} />
          <Text style={[styles.controlBtnText, currentStep === 0 && styles.controlBtnTextDisabled]}>
            上一步
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleStartDemo} activeOpacity={0.8}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.autoPlayBtn}
          >
            <Icon source="play" size={18} color="#fff" />
            <Text style={styles.autoPlayBtnText}>自动演示</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.controlBtn,
            currentStep === DEMO_STEPS.length - 1 && styles.controlBtnDisabled,
          ]}
          onPress={handleNextStep}
          disabled={currentStep === DEMO_STEPS.length - 1}
        >
          <Text
            style={[
              styles.controlBtnText,
              currentStep === DEMO_STEPS.length - 1 && styles.controlBtnTextDisabled,
            ]}
          >
            下一步
          </Text>
          <Icon
            source="chevron-right"
            size={20}
            color={currentStep === DEMO_STEPS.length - 1 ? '#ccc' : '#667eea'}
          />
        </TouchableOpacity>
      </View>

      {/* 底部提示 */}
      <TouchableOpacity style={styles.tryHint} activeOpacity={0.8}>
        <LinearGradient
          colors={['#667eea15', '#764ba215']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.tryHintGradient}
        >
          <Icon source="rocket-launch" size={20} color="#667eea" />
          <View style={styles.tryHintContent}>
            <Text style={styles.tryHintTitle}>想亲自体验？</Text>
            <Text style={styles.tryHintDesc}>管理 → 系统配置 → 表单配置</Text>
          </View>
          <Icon source="chevron-right" size={20} color="#667eea" />
        </LinearGradient>
      </TouchableOpacity>

      {/* 全屏演示模态框 */}
      <FullScreenDemo visible={showFullScreen} onClose={() => setShowFullScreen(false)} />
    </SafeAreaView>
  );
};

// ============ 全屏演示样式 ============
const fsStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: StatusBar.currentHeight || 44,
  },
  closeBtn: {
    position: 'absolute',
    top: (StatusBar.currentHeight || 44) + 10,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 16,
    gap: 12,
  },
  progressDots: {
    flexDirection: 'row',
    gap: 5,
  },
  progressDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressDotActive: {
    backgroundColor: '#fff',
    width: 18,
  },
  progressDotCompleted: {
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  stepHeader: {
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  stepIconContainer: {
    marginBottom: 12,
  },
  stepIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 6,
  },
  contentArea: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: height * 0.42,
  },
  stepContentBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    maxHeight: '100%',
  },
  mockNav: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  mockNavText: {
    fontSize: 12,
    color: '#999',
  },
  mockNavHighlight: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  entryCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  entryGradient: {
    padding: 20,
    alignItems: 'center',
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
  },
  entryDesc: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  contentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  formList: {
    gap: 8,
  },
  formListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8f9fa',
  },
  formListItemSelected: {
    backgroundColor: '#667eea08',
    borderWidth: 1.5,
    borderColor: '#667eea',
  },
  formListIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formListInfo: {
    flex: 1,
    marginLeft: 10,
  },
  formListName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  formListStatus: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  aiTag: {
    marginLeft: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#667eea15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  aiAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiInfo: {
    marginLeft: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  aiDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  aiButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  chatBubbleRight: {
    backgroundColor: '#667eea',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    padding: 12,
    maxWidth: '85%',
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  chatTextWhite: {
    fontSize: 13,
    color: '#fff',
    lineHeight: 20,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 4,
    marginLeft: 10,
    padding: 10,
    backgroundColor: '#f0f2f5',
    borderRadius: 12,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  aiResponseRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  aiAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBubbleLeft: {
    flex: 1,
    backgroundColor: '#f0f2f5',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    padding: 12,
    marginLeft: 8,
  },
  chatTextDark: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
  },
  cursor: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  fieldsList: {
    gap: 8,
  },
  fieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 10,
    borderRadius: 10,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInfo: {
    flex: 1,
    marginLeft: 10,
  },
  fieldName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  fieldTags: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  previewTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  previewBadge: {
    backgroundColor: '#52c41a15',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  previewBadgeText: {
    fontSize: 11,
    color: '#52c41a',
    fontWeight: '600',
  },
  previewList: {
    gap: 6,
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  previewItemName: {
    flex: 1,
    fontSize: 13,
    color: '#333',
  },
  previewItemType: {
    fontSize: 11,
    color: '#999',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 10,
  },
  editBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#667eea',
    alignItems: 'center',
  },
  editBtnText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#52c41a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  confirmBtnText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  successIcon: {
    alignSelf: 'center',
    marginBottom: 12,
  },
  successGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
  },
  successDesc: {
    fontSize: 13,
    color: '#999',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  versionInfo: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    padding: 12,
  },
  versionItem: {
    flex: 1,
    alignItems: 'center',
  },
  versionLabel: {
    fontSize: 11,
    color: '#999',
  },
  versionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#38ef7d',
    marginTop: 2,
  },
  versionDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
  },
  bottomIndicator: {
    paddingVertical: 16,
  },
  stepsScroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ============ 普通浏览模式样式 ============
const normalStyles = StyleSheet.create({
  contentBox: {
    marginTop: 8,
  },
  mockNav: {
    flexDirection: 'row',
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  mockNavText: {
    fontSize: 13,
    color: '#999',
  },
  mockNavHighlight: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '600',
  },
  entryCard: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  entryGradient: {
    padding: 24,
    alignItems: 'center',
  },
  entryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  entryDesc: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  contentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  formItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
  },
  formItemSelected: {
    backgroundColor: '#667eea08',
    borderWidth: 2,
    borderColor: '#667eea',
  },
  formItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  formItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  formItemStatus: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  aiConfigBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#667eea15',
    borderRadius: 12,
    gap: 4,
  },
  aiBadgeText: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '600',
  },
  aiSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  aiAvatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aiSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  aiSectionDesc: {
    fontSize: 13,
    color: '#999',
    marginTop: 4,
    marginBottom: 20,
  },
  aiStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 8,
  },
  aiStartBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  chatArea: {
    gap: 12,
  },
  chatBubbleRight: {
    backgroundColor: '#667eea',
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 14,
    maxWidth: '85%',
    alignSelf: 'flex-end',
  },
  chatTextWhite: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiAvatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
    padding: 12,
    backgroundColor: '#f0f2f5',
    borderRadius: 16,
    borderTopLeftRadius: 4,
    gap: 10,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#667eea',
  },
  typingText: {
    fontSize: 13,
    color: '#999',
  },
  aiResponseBox: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    overflow: 'hidden',
  },
  aiResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 10,
  },
  aiResponseTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  aiResponseContent: {
    padding: 12,
    gap: 10,
  },
  aiResponseText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 22,
    marginBottom: 4,
  },
  aiResponseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aiResponseItemText: {
    fontSize: 14,
    color: '#333',
  },
  generatedField: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f8f9fa',
    marginBottom: 10,
  },
  fieldIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldContent: {
    flex: 1,
    marginLeft: 12,
  },
  fieldNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  fieldTagsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  fieldTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  fieldTagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  previewTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  previewBadge: {
    backgroundColor: '#52c41a15',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  previewBadgeText: {
    fontSize: 12,
    color: '#52c41a',
    fontWeight: '600',
  },
  previewCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  previewFieldItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  previewFieldName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  previewFieldType: {
    fontSize: 12,
    color: '#999',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#667eea',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  editBtnText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '600',
  },
  confirmBtn: {
    flex: 1.5,
    flexDirection: 'row',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  successIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  successDesc: {
    fontSize: 14,
    color: '#999',
    marginTop: 6,
  },
  versionCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  versionLabel: {
    fontSize: 14,
    color: '#666',
  },
  versionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#38ef7d',
  },
  versionDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
  },
});

// ============ 主页面样式 ============
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 20,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 6,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    width: '100%',
    gap: 12,
  },
  progressBackground: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  stepIndicatorContainer: {
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  stepIndicatorScroll: {
    paddingHorizontal: 16,
  },
  stepIndicatorItem: {
    alignItems: 'center',
    width: 65,
    marginRight: 8,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepDotCompleted: {
    backgroundColor: '#52c41a',
  },
  stepDotCurrent: {
    backgroundColor: '#fff',
    borderWidth: 2,
  },
  stepLabel: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  stepCard: {
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#fff',
  },
  stepCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCardInfo: {
    marginLeft: 14,
  },
  stepCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  stepCardSubtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  stepCardDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  stepDescription: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  controlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  controlBtnDisabled: {
    opacity: 0.5,
  },
  controlBtnText: {
    fontSize: 14,
    color: '#667eea',
    fontWeight: '500',
  },
  controlBtnTextDisabled: {
    color: '#ccc',
  },
  autoPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
    gap: 8,
  },
  autoPlayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  tryHint: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tryHintGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  tryHintContent: {
    flex: 1,
  },
  tryHintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  tryHintDesc: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
});

export default FormilyDemoScreen;
