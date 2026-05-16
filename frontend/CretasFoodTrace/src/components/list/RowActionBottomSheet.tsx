import React, { useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
} from 'react-native';
import { Text, Divider, useTheme } from 'react-native-paper';
import type { AppTheme } from '../../theme';
import type { RowAction } from '../../types/rowActions';

export interface RowActionBottomSheetProps {
  /** Visibility — controlled by parent. */
  visible: boolean;
  /** Called when user taps backdrop, close icon, or after picking an action. */
  onClose: () => void;
  /** Actions to render. Caller filters by status / RBAC via useRowActions. */
  actions: RowAction[];
  /** Header title shown at top of sheet (e.g. "销售单 SO-001"). */
  title?: string;
  /** Show "💬 跟 AI 说" entry above the action list. */
  aiTriggerEnabled?: boolean;
  /** Override the AI entry label. Defaults to "💬 跟 AI 说...". */
  aiTriggerLabel?: string;
  /** Tapped the AI entry. Parent typically navigates to AIChat with entryContext. */
  onAITrigger?: () => void;
}

/**
 * Bottom sheet shown on long-press of a list row, surfacing 8-14 secondary
 * actions plus an AI entry. Keeps the main row clean (chips only).
 *
 * Implementation note: uses RN's built-in Modal with slide animation rather than
 * @gorhom/bottom-sheet to avoid adding a dependency — matches the pattern used
 * by other modals in this codebase (see CustomerSelector, MaterialSelectModal).
 */
export const RowActionBottomSheet: React.FC<RowActionBottomSheetProps> = ({
  visible,
  onClose,
  actions,
  title,
  aiTriggerEnabled = true,
  aiTriggerLabel = '💬 跟 AI 说...',
  onAITrigger,
}) => {
  const theme = useTheme() as AppTheme;
  const styles = makeStyles(theme);

  const handleActionPress = useCallback(
    (action: RowAction) => {
      if (action.disabled) {
        if (action.disabledReason) {
          Alert.alert('无法执行', action.disabledReason);
        }
        return;
      }
      onClose();
      action.onPress?.();
    },
    [onClose]
  );

  const handleDisabledLongPress = useCallback((action: RowAction) => {
    if (action.disabled && action.disabledReason) {
      Alert.alert('为什么不可用', action.disabledReason);
    }
  }, []);

  const handleAIPress = useCallback(() => {
    onClose();
    onAITrigger?.();
  }, [onClose, onAITrigger]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="关闭操作菜单"
        />
        <SafeAreaView style={styles.sheet}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <Text variant="titleMedium" style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
          ) : null}

          {aiTriggerEnabled && onAITrigger ? (
            <>
              <TouchableOpacity
                style={styles.aiRow}
                onPress={handleAIPress}
                accessibilityRole="button"
                accessibilityLabel={aiTriggerLabel}
              >
                <Text style={styles.aiLabel}>{aiTriggerLabel}</Text>
              </TouchableOpacity>
              <Divider />
            </>
          ) : null}

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {actions.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={styles.emptyText}>当前状态没有可用操作</Text>
              </View>
            ) : (
              actions.map((action, idx) => {
                const isDanger = !!action.danger;
                const isDisabled = !!action.disabled;
                return (
                  <TouchableOpacity
                    key={action.id}
                    style={[
                      styles.actionRow,
                      idx === actions.length - 1 && styles.actionRowLast,
                    ]}
                    onPress={() => handleActionPress(action)}
                    onLongPress={() => handleDisabledLongPress(action)}
                    accessibilityRole="button"
                    accessibilityLabel={action.label}
                    accessibilityState={{ disabled: isDisabled }}
                  >
                    <Text
                      style={[
                        styles.actionIcon,
                        isDisabled && styles.actionTextDisabled,
                      ]}
                    >
                      {action.icon}
                    </Text>
                    <Text
                      style={[
                        styles.actionLabel,
                        isDanger && styles.actionLabelDanger,
                        isDisabled && styles.actionTextDisabled,
                      ]}
                    >
                      {action.label}
                    </Text>
                    {action.requiresConfirm ? (
                      <Text style={styles.confirmHint}>需确认</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity
            style={styles.cancelRow}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="取消"
          >
            <Text style={styles.cancelLabel}>取消</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const makeStyles = (theme: AppTheme) => {
  const { colors, custom } = theme;
  const { spacing, borderRadius, shadows } = custom;

  return StyleSheet.create({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.backdrop,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.l,
      borderTopRightRadius: borderRadius.l,
      paddingBottom: spacing.s,
      maxHeight: '85%',
      ...shadows.large,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.outline,
      alignSelf: 'center',
      marginTop: spacing.s,
      marginBottom: spacing.xs,
    },
    header: {
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.s,
    },
    title: {
      color: colors.onSurface,
      fontWeight: '600',
    },
    aiRow: {
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.m,
      backgroundColor: colors.primaryContainer,
    },
    aiLabel: {
      color: colors.onPrimaryContainer,
      fontSize: 16,
      fontWeight: '500',
    },
    scroll: {
      maxHeight: 480,
    },
    scrollContent: {
      paddingVertical: spacing.xs,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.l,
      paddingVertical: spacing.m,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.outlineVariant,
    },
    actionRowLast: {
      borderBottomWidth: 0,
    },
    actionIcon: {
      fontSize: 20,
      width: 28,
      textAlign: 'center',
      marginRight: spacing.m,
    },
    actionLabel: {
      flex: 1,
      fontSize: 16,
      color: colors.onSurface,
    },
    actionLabelDanger: {
      color: colors.error,
    },
    actionTextDisabled: {
      color: colors.onSurfaceVariant,
      opacity: 0.5,
    },
    confirmHint: {
      fontSize: 12,
      color: colors.onSurfaceVariant,
      marginLeft: spacing.s,
    },
    emptyRow: {
      paddingVertical: spacing.xl,
      alignItems: 'center',
    },
    emptyText: {
      color: colors.onSurfaceVariant,
      fontSize: 14,
    },
    cancelRow: {
      marginTop: spacing.s,
      marginHorizontal: spacing.l,
      paddingVertical: spacing.m,
      borderRadius: borderRadius.m,
      backgroundColor: colors.surfaceVariant,
      alignItems: 'center',
    },
    cancelLabel: {
      fontSize: 16,
      color: colors.onSurfaceVariant,
      fontWeight: '500',
    },
  });
};
