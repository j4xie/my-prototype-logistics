/**
 * TutorialOverlay - 全屏卡片式教程引导
 *
 * 功能:
 * - 全屏半透明遮罩，阻止其他点击
 * - 居中卡片：图标 + 标题 + 说明文字
 * - 步骤指示器 (圆点) + 下一步/跳过
 * - 支持多个教程，每个教程多步
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Dimensions, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TutorialStep } from '../../store/tutorialStore';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  visible: boolean;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({ visible, steps, currentStep, onNext, onSkip }: Props) {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(30));

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(30);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, currentStep]);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: (step.iconBg || '#EEF2FF') }]}>
            <MaterialCommunityIcons
              name={(step.icon || 'information') as any}
              size={36}
              color={step.iconColor || '#4F46E5'}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>{step.title || ''}</Text>

          {/* Description */}
          <Text style={styles.description}>{step.text}</Text>

          {/* Step dots */}
          <View style={styles.dots}>
            {steps.map((_, i) => (
              <View key={i} style={[styles.dot, i === currentStep && styles.dotActive]} />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.buttons}>
            <TouchableOpacity onPress={onSkip} style={styles.skipBtn}>
              <Text style={styles.skipText}>跳过教程</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onNext} style={styles.nextBtn}>
              <Text style={styles.nextText}>{isLast ? '开始使用' : '下一步'}</Text>
              {!isLast && <MaterialCommunityIcons name="chevron-right" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>

          {/* Step counter */}
          <Text style={styles.counter}>{currentStep + 1} / {steps.length}</Text>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: SCREEN_W - 48,
    maxWidth: 380,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 15,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e0e0e0',
  },
  dotActive: {
    backgroundColor: '#4F46E5',
    width: 20,
  },
  buttons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    width: '100%',
  },
  skipBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipText: {
    fontSize: 15,
    color: '#999',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 22,
    gap: 4,
  },
  nextText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  counter: {
    fontSize: 12,
    color: '#ccc',
    marginTop: 12,
  },
});
