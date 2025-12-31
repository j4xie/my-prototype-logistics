import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Surface,
  Text,
  RadioButton,
  TextInput,
  Divider,
  Chip,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  DispositionAction,
  DISPOSITION_ACTION_LABELS,
  DISPOSITION_ACTION_COLORS,
  DISPOSITION_ACTION_ICONS,
  requiresApproval,
} from '../../types/qualityDisposition';

/**
 * 处置动作选项
 */
interface ActionOption {
  action: DispositionAction;
  label: string;
  description: string;
  requiresApproval: boolean;
  color: string;
  icon: string;
}

/**
 * 处置动作选择器 Props
 */
interface DispositionActionPickerProps {
  selectedAction: DispositionAction | null;
  onActionChange: (action: DispositionAction) => void;
  operatorComment: string;
  onCommentChange: (comment: string) => void;
  availableActions?: DispositionAction[];
  disabled?: boolean;
}

/**
 * 处置动作选择器组件
 *
 * 功能:
 * - 可选的处置动作列表
 * - 显示每个动作的说明和审批要求
 * - 操作员备注输入
 */
export const DispositionActionPicker: React.FC<DispositionActionPickerProps> = ({
  selectedAction,
  onActionChange,
  operatorComment,
  onCommentChange,
  availableActions,
  disabled = false,
}) => {
  const [actionOptions, setActionOptions] = useState<ActionOption[]>([]);

  /**
   * 获取动作描述
   */
  const getActionDescription = (action: DispositionAction): string => {
    const descriptions: Record<DispositionAction, string> = {
      [DispositionAction.RELEASE]: '质检合格，直接放行到下一工序',
      [DispositionAction.CONDITIONAL_RELEASE]: '质检基本合格，附加条件放行',
      [DispositionAction.REWORK]: '质检不合格，需要返工处理',
      [DispositionAction.SCRAP]: '严重不合格，建议报废处理',
      [DispositionAction.SPECIAL_APPROVAL]: '特殊情况，申请特批放行',
      [DispositionAction.HOLD]: '暂时无法判定，暂扣待定',
    };
    return descriptions[action] || '';
  };

  /**
   * 初始化动作选项
   */
  useEffect(() => {
    const actions = availableActions || Object.values(DispositionAction);

    const options: ActionOption[] = actions.map(action => ({
      action,
      label: DISPOSITION_ACTION_LABELS[action],
      description: getActionDescription(action),
      requiresApproval: requiresApproval(action),
      color: DISPOSITION_ACTION_COLORS[action],
      icon: DISPOSITION_ACTION_ICONS[action],
    }));

    setActionOptions(options);
  }, [availableActions]);

  return (
    <View style={styles.container}>
      {/* 标题 */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="format-list-checks" size={24} color="#2196F3" />
        <Text style={styles.headerText}>选择处置动作</Text>
      </View>

      <Divider style={styles.divider} />

      {/* 动作列表 */}
      <ScrollView style={styles.actionsList}>
        <RadioButton.Group
          onValueChange={value => onActionChange(value as DispositionAction)}
          value={selectedAction || ''}
        >
          {actionOptions.map(option => (
            <Surface
              key={option.action}
              style={[
                styles.actionCard,
                selectedAction === option.action && styles.selectedActionCard,
                { borderLeftColor: option.color },
              ]}
            >
              <View style={styles.actionHeader}>
                <RadioButton.Android
                  value={option.action}
                  disabled={disabled}
                  color={option.color}
                />
                <MaterialCommunityIcons
                  name={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={28}
                  color={option.color}
                  style={styles.actionIcon}
                />
                <View style={styles.actionInfo}>
                  <Text style={[styles.actionLabel, { color: option.color }]}>
                    {option.label}
                  </Text>
                  {option.requiresApproval && (
                    <Chip
                      mode="outlined"
                      compact
                      style={styles.approvalChip}
                      textStyle={styles.approvalChipText}
                    >
                      需审批
                    </Chip>
                  )}
                </View>
              </View>

              <Text style={styles.actionDescription}>{option.description}</Text>

              {/* 审批说明 */}
              {option.requiresApproval && (
                <View style={styles.approvalNotice}>
                  <MaterialCommunityIcons name="alert-circle" size={16} color="#FF9800" />
                  <Text style={styles.approvalNoticeText}>
                    此动作需要{option.action === DispositionAction.SCRAP ? '厂长' : '质检主管'}审批
                  </Text>
                </View>
              )}
            </Surface>
          ))}
        </RadioButton.Group>
      </ScrollView>

      <Divider style={styles.divider} />

      {/* 备注输入 */}
      <View style={styles.commentSection}>
        <Text style={styles.commentLabel}>
          操作备注
          <Text style={styles.optional}> (可选)</Text>
        </Text>
        <TextInput
          value={operatorComment}
          onChangeText={onCommentChange}
          mode="outlined"
          placeholder="请输入处置备注..."
          multiline
          numberOfLines={4}
          disabled={disabled}
          style={styles.commentInput}
          maxLength={500}
        />
        <Text style={styles.charCount}>
          {operatorComment.length} / 500
        </Text>
      </View>

      {/* 提示信息 */}
      {selectedAction && (
        <Surface style={styles.hintCard}>
          <MaterialCommunityIcons name="information" size={20} color="#2196F3" />
          <View style={styles.hintContent}>
            <Text style={styles.hintText}>
              {requiresApproval(selectedAction)
                ? '提交后将进入审批流程，审批通过后自动执行处置动作'
                : '确认后将立即执行处置动作，请仔细核对'}
            </Text>
          </View>
        </Surface>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  divider: {
    marginVertical: 16,
  },
  actionsList: {
    maxHeight: 400,
  },
  actionCard: {
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    elevation: 1,
  },
  selectedActionCard: {
    backgroundColor: '#F0F8FF',
    elevation: 3,
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionIcon: {
    marginLeft: 8,
    marginRight: 8,
  },
  actionInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  approvalChip: {
    height: 24,
    backgroundColor: '#FFF3E0',
    borderColor: '#FF9800',
  },
  approvalChipText: {
    fontSize: 11,
    color: '#FF9800',
  },
  actionDescription: {
    fontSize: 14,
    color: '#666',
    marginLeft: 56,
    lineHeight: 20,
  },
  approvalNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginLeft: 56,
    padding: 8,
    backgroundColor: '#FFF9E6',
    borderRadius: 6,
  },
  approvalNoticeText: {
    fontSize: 12,
    color: '#FF9800',
    marginLeft: 4,
  },
  commentSection: {
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  optional: {
    fontSize: 14,
    color: '#999',
  },
  commentInput: {
    backgroundColor: '#FAFAFA',
  },
  charCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  hintCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 16,
    borderRadius: 8,
    backgroundColor: '#E3F2FD',
  },
  hintContent: {
    flex: 1,
    marginLeft: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#1976D2',
    lineHeight: 18,
  },
});
