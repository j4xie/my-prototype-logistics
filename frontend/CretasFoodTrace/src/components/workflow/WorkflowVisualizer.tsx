import React, { Fragment } from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTheme } from 'react-native-paper';
import type { AppTheme } from '../../theme';
import type { WorkflowNode as WorkflowNodeData } from '../../types/workflow';
import { WorkflowNode } from './WorkflowNode';
import { WorkflowConnector } from './WorkflowConnector';

export interface WorkflowVisualizerProps {
  nodes: WorkflowNodeData[];
  title?: string;
  orientation?: 'horizontal' | 'vertical';
  loading?: boolean;
  emptyHint?: string;
  aiTriggerEnabled?: boolean;
  aiTriggerLabel?: string;
  onNodePress?: (nodeId: string) => void;
  onNodeLongPress?: (nodeId: string) => void;
  onAITrigger?: () => void;
}

const DEFAULT_EMPTY_HINT = '暂无工作流数据';
const DEFAULT_AI_LABEL = '💬 跟 AI 说';

export function WorkflowVisualizer({
  nodes,
  title,
  orientation = 'horizontal',
  loading,
  emptyHint = DEFAULT_EMPTY_HINT,
  aiTriggerEnabled,
  aiTriggerLabel = DEFAULT_AI_LABEL,
  onNodePress,
  onNodeLongPress,
  onAITrigger,
}: WorkflowVisualizerProps) {
  const theme = useTheme<AppTheme>();
  const isVertical = orientation === 'vertical';

  const renderHeader = () => {
    if (!title && !aiTriggerEnabled) return null;
    return (
      <View style={styles.header}>
        {title ? (
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          <View />
        )}
        {aiTriggerEnabled && onAITrigger ? (
          <Pressable
            onPress={onAITrigger}
            style={({ pressed }: PressableStateCallbackType) => [
              styles.aiButton,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
              },
              pressed && styles.aiButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="向 AI 助手发起会话"
          >
            <Text style={[styles.aiButtonLabel, { color: theme.colors.onPrimaryContainer }]}>
              {aiTriggerLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  };

  const renderBody = () => {
    if (loading) {
      return (
        <View style={styles.stateRow}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
          <Text style={[styles.stateText, { color: theme.colors.textSecondary }]}>加载中…</Text>
        </View>
      );
    }
    if (!nodes.length) {
      return (
        <View style={styles.stateRow}>
          <Text style={[styles.stateText, { color: theme.colors.textSecondary }]}>{emptyHint}</Text>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.nodesContainer,
          isVertical ? styles.nodesVertical : styles.nodesHorizontal,
        ]}
      >
        {nodes.map((node, i) => (
          <Fragment key={node.id}>
            <WorkflowNode
              node={node}
              onPress={onNodePress}
              onLongPress={onNodeLongPress}
            />
            {i < nodes.length - 1 ? (
              <WorkflowConnector orientation={orientation} />
            ) : null}
          </Fragment>
        ))}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          ...theme.custom.shadows.small,
        },
      ]}
      accessibilityLabel={title ? `${title} 工作流卡片` : '工作流卡片'}
    >
      {renderHeader()}
      {renderBody()}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  aiButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  aiButtonPressed: {
    opacity: 0.75,
  },
  aiButtonLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  nodesContainer: {
    alignItems: 'center',
  },
  nodesHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 12,
  },
  nodesVertical: {
    flexDirection: 'column',
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  stateText: {
    fontSize: 13,
  },
});
