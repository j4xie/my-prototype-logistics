import React, { memo, useMemo } from 'react';
import {
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import type { AppTheme } from '../../theme';
import type { WorkflowNode as WorkflowNodeData, WorkflowNodeStatus } from '../../types/workflow';

export interface WorkflowNodeProps {
  node: WorkflowNodeData;
  size?: 'sm' | 'md';
  onPress?: (nodeId: string) => void;
  onLongPress?: (nodeId: string) => void;
}

const formatCount = (count: number): string => {
  if (count <= 999) return String(count);
  if (count <= 9999) return `${Math.floor(count / 1000)}K+`;
  return '9K+';
};

interface NodePalette {
  bg: string;
  text: string;
  border: string;
}

const palette = (
  status: WorkflowNodeStatus,
  wf: AppTheme['custom']['workflow'],
): NodePalette => {
  switch (status) {
    case 'PENDING':
      return { bg: wf.pendingBg, text: wf.pendingText, border: wf.pendingBorder };
    case 'IN_PROGRESS':
      return { bg: wf.inProgressBg, text: wf.inProgressText, border: wf.inProgressBorder };
    case 'DONE':
      return { bg: wf.doneBg, text: wf.doneText, border: wf.doneBorder };
  }
};

export const WorkflowNode = memo(function WorkflowNode({
  node,
  size = 'md',
  onPress,
  onLongPress,
}: WorkflowNodeProps) {
  const theme = useTheme<AppTheme>();
  const colors = palette(node.status, theme.custom.workflow);

  const dimensions = size === 'sm' ? { circle: 48, font: 11 } : { circle: 64, font: 13 };

  const containerStyle: ViewStyle = useMemo(
    () => ({
      width: dimensions.circle,
      height: dimensions.circle,
      borderRadius: dimensions.circle / 2,
      backgroundColor: colors.bg,
      borderColor: colors.border,
    }),
    [dimensions.circle, colors.bg, colors.border],
  );

  const accessibilityHint = onLongPress
    ? '长按触发 AI 助手'
    : undefined;

  return (
    <View style={styles.wrapper}>
      <Pressable
        style={({ pressed }: PressableStateCallbackType) => [
          styles.circle,
          containerStyle,
          pressed && styles.pressed,
        ]}
        onPress={onPress ? () => onPress(node.id) : undefined}
        onLongPress={onLongPress ? () => onLongPress(node.id) : undefined}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel={`${node.label}, ${node.count} 项`}
        accessibilityHint={accessibilityHint}
      >
        <Text
          numberOfLines={1}
          style={[styles.count, { color: colors.text, fontSize: dimensions.font + 4 }]}
        >
          {formatCount(node.count)}
        </Text>
      </Pressable>
      <Text
        numberOfLines={1}
        style={[styles.label, { color: theme.colors.text, fontSize: dimensions.font }]}
      >
        {node.label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    minWidth: 64,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  count: {
    fontWeight: '700',
  },
  label: {
    marginTop: 4,
    maxWidth: 72,
    textAlign: 'center',
  },
});
