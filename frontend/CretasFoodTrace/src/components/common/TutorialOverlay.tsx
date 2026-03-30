/**
 * TutorialOverlay - 精确高亮教程引导 (Spotlight 模式)
 *
 * - 全屏遮罩 + 透明高亮窗口 (spotlight)
 * - 气泡说明指向高亮区域，带箭头
 * - 用 measureInWindow 获取屏幕绝对坐标
 * - 无目标时降级为居中卡片
 * - 步骤指示器 + 下一步/跳过
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TouchableWithoutFeedback,
  StyleSheet, Modal, Dimensions, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { TutorialStep, getTutorialTarget, TargetLayout, TUTORIAL_ENABLED } from '../../store/tutorialStore';

const OVERLAY_COLOR = 'rgba(0,0,0,0.72)';
const TOOLTIP_GAP = 14;
const ANIM_DURATION = 250;

interface Props {
  visible: boolean;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
}

export function TutorialOverlay({ visible, steps, currentStep, onNext, onSkip }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [target, setTarget] = useState<TargetLayout | null>(null);
  const { width: SW, height: SH } = Dimensions.get('window');

  const step = visible && currentStep < steps.length ? steps[currentStep] : null;
  const isLast = step ? currentStep === steps.length - 1 : false;
  const padding = step?.highlightPadding ?? 8;
  const borderRadius = step?.highlightBorderRadius ?? 12;

  // Resolve target on step/visibility change
  useEffect(() => {
    if (!visible || !step?.targetKey) {
      setTarget(null);
      return undefined;
    }
    const resolve = () => setTarget(getTutorialTarget(step.targetKey!) ?? null);
    resolve();
    const t1 = setTimeout(resolve, 150);
    const t2 = setTimeout(resolve, 400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [visible, currentStep]);

  // Fade + slide in on step change
  useEffect(() => {
    if (visible && step) {
      fadeAnim.setValue(0);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: ANIM_DURATION, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: ANIM_DURATION + 80, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, currentStep]);

  // Pulse animation on spotlight border
  useEffect(() => {
    if (visible && target) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
    pulseAnim.setValue(1);
    return undefined;
  }, [visible, currentStep, !!target]);

  if (!TUTORIAL_ENABLED || !visible || !step) return null;

  // Calculate spotlight hole — only if target is on-screen and small enough for a useful spotlight
  const targetUsable = target &&
    target.y + target.height > 0 && target.y < SH &&
    target.x + target.width > 0 && target.x < SW &&
    target.height < SH * 0.5; // must leave room for tooltip

  const hole = targetUsable ? {
    x: Math.max(0, target!.x - padding),
    y: Math.max(0, target!.y - padding),
    w: Math.min(target!.width + padding * 2, SW),
    h: Math.min(target!.height + padding * 2, SH * 0.5),
  } : null;

  // Determine tooltip position (above or below highlight)
  let above = false;
  if (hole) {
    const pos = step.tooltipPosition ?? 'auto';
    if (pos === 'top') above = true;
    else if (pos === 'bottom') above = false;
    else above = (hole.y + hole.h / 2) > SH / 2;
  }

  // Tooltip absolute positioning
  const tooltipPos: Record<string, number> = {};
  if (hole) {
    if (above) tooltipPos.bottom = SH - hole.y + TOOLTIP_GAP;
    else tooltipPos.top = hole.y + hole.h + TOOLTIP_GAP;
  } else {
    tooltipPos.top = SH * 0.28;
  }

  // Arrow horizontal position (points to center of highlight)
  const arrowLeft = hole
    ? Math.max(24, Math.min(hole.x + hole.w / 2 - 16 - 10, SW - 60))
    : (SW - 32) / 2 - 10;

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      {/* Background overlay — tap = next (disabled for navigation steps) */}
      <TouchableWithoutFeedback onPress={step.navigateTo ? undefined : onNext}>
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: fadeAnim }]}>
          {hole ? (
            <>
              {/* Top */}
              <View style={[s.rect, { top: 0, left: 0, right: 0, height: hole.y }]} />
              {/* Bottom */}
              <View style={[s.rect, { top: hole.y + hole.h, left: 0, right: 0, bottom: 0 }]} />
              {/* Left */}
              <View style={[s.rect, { top: hole.y, left: 0, width: hole.x, height: hole.h }]} />
              {/* Right */}
              <View style={[s.rect, { top: hole.y, left: hole.x + hole.w, right: 0, height: hole.h }]} />
              {/* Highlight border with pulse */}
              <Animated.View style={[s.border, {
                top: hole.y - 2, left: hole.x - 2,
                width: hole.w + 4, height: hole.h + 4,
                borderRadius: borderRadius + 4,
                opacity: pulseAnim,
              }]} />
            </>
          ) : (
            <View style={[s.rect, StyleSheet.absoluteFillObject]} />
          )}
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Tooltip bubble */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
        <Animated.View style={[
          s.tooltipWrap,
          tooltipPos,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}>
          {/* Arrow pointing toward highlight (above tooltip) */}
          {hole && !above && <View style={[s.arrowUp, { marginLeft: arrowLeft }]} />}

          <TouchableOpacity activeOpacity={step.navigateTo ? 1 : 0.97} onPress={step.navigateTo ? undefined : onNext} style={s.card}>
            {/* Header: icon + title */}
            <View style={s.header}>
              <View style={[s.iconCircle, { backgroundColor: step.iconBg || '#EEF2FF' }]}>
                <MaterialCommunityIcons
                  name={(step.icon || 'information') as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={24}
                  color={step.iconColor || '#4F46E5'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{step.title}</Text>
                <Text style={s.counter}>{currentStep + 1} / {steps.length}</Text>
              </View>
            </View>

            {/* Body */}
            <Text style={s.body}>{step.text}</Text>

            {/* Footer: dots + buttons */}
            <View style={s.footer}>
              <View style={s.dots}>
                {steps.map((_, i) => (
                  <View key={i} style={[s.dot, i === currentStep && s.dotActive]} />
                ))}
              </View>
              <View style={s.btns}>
                <TouchableOpacity onPress={onSkip} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={s.skipText}>跳过</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onNext} style={[s.nextBtn, step.navigateTo && s.navBtn]}>
                  <Text style={s.nextText}>{step.nextButtonText || (isLast ? '开始使用' : '下一步')}</Text>
                  {step.navigateTo
                    ? <MaterialCommunityIcons name="open-in-new" size={14} color="#fff" />
                    : !isLast && <MaterialCommunityIcons name="chevron-right" size={16} color="#fff" />
                  }
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>

          {/* Arrow below tooltip (when tooltip is above highlight) */}
          {hole && above && <View style={[s.arrowDown, { marginLeft: arrowLeft }]} />}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  rect: {
    position: 'absolute',
    backgroundColor: OVERLAY_COLOR,
  },
  border: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  tooltipWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  counter: {
    fontSize: 12,
    color: '#bbb',
    marginTop: 2,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: '#555',
    marginBottom: 16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dots: {
    flexDirection: 'row',
    gap: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#e0e0e0',
  },
  dotActive: {
    backgroundColor: '#4F46E5',
    width: 18,
  },
  btns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skipText: {
    fontSize: 14,
    color: '#999',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    gap: 2,
  },
  nextText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  navBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
  },
  arrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#fff',
    marginBottom: -1,
  },
  arrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#fff',
    marginTop: -1,
  },
});
