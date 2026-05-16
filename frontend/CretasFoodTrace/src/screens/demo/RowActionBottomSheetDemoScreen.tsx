import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, useTheme, Switch } from 'react-native-paper';
import { RowActionBottomSheet } from '../../components/list/RowActionBottomSheet';
import { COMMON_ACTIONS, type RowAction } from '../../types/rowActions';
import type { AppTheme } from '../../theme';

/**
 * Manual smoke screen for RowActionBottomSheet (Day 1 Track H).
 * Wire it into a debug navigator to long-press a fake row and confirm:
 *   - 10 actions render with icon + label
 *   - AI entry on top is highlighted and dismissable
 *   - Danger row renders red, disabled row greyed
 *   - Tap action dismisses and fires onPress
 */
export const RowActionBottomSheetDemoScreen: React.FC = () => {
  const theme = useTheme() as AppTheme;
  const styles = makeStyles(theme);
  const [visible, setVisible] = useState(false);
  const [aiOn, setAiOn] = useState(true);
  const [includeDanger, setIncludeDanger] = useState(true);
  const [includeDisabled, setIncludeDisabled] = useState(true);

  const actions = useMemo<RowAction[]>(() => {
    const base: RowAction[] = [
      { ...COMMON_ACTIONS.CONVERT_TO_PRODUCTION, onPress: () => Alert.alert('转生产', '已下发到生产排程') },
      { ...COMMON_ACTIONS.CONVERT_TO_PURCHASE, onPress: () => Alert.alert('转采购', '已生成采购需求') },
      { ...COMMON_ACTIONS.CONVERT_TO_OUTSOURCE, onPress: () => Alert.alert('转外购', '已发起外购询价') },
      { ...COMMON_ACTIONS.PRINT_PDF, onPress: () => Alert.alert('打印 PDF', '已发送到打印机') },
      { ...COMMON_ACTIONS.COPY, onPress: () => Alert.alert('复制', '已复制为新单') },
      { ...COMMON_ACTIONS.LOCK, onPress: () => Alert.alert('锁定', '本单已锁定') },
    ];
    if (includeDisabled) {
      base.push({
        ...COMMON_ACTIONS.EDIT_PRICE,
        disabled: true,
        disabledReason: '当前角色 (warehouse_manager) 不能改价格',
      });
    }
    if (includeDanger) {
      base.push({ ...COMMON_ACTIONS.UNDO_APPROVAL, onPress: () => Alert.alert('撤销审批', '已撤销, 状态回到草稿') });
      base.push({ ...COMMON_ACTIONS.CANCEL, onPress: () => Alert.alert('取消订单', '已取消') });
      base.push({ ...COMMON_ACTIONS.DELETE, onPress: () => Alert.alert('删除', '已删除') });
    }
    return base;
  }, [includeDanger, includeDisabled]);

  return (
    <ScrollView contentContainerStyle={styles.root}>
      <Text variant="headlineSmall" style={styles.heading}>RowActionBottomSheet 演示</Text>
      <Text style={styles.note}>UX-A2 Track H — Day 1 抽象组件 smoke 测试</Text>

      <View style={styles.toggleRow}>
        <Text>显示 AI 入口</Text>
        <Switch value={aiOn} onValueChange={setAiOn} />
      </View>
      <View style={styles.toggleRow}>
        <Text>包含 danger 动作</Text>
        <Switch value={includeDanger} onValueChange={setIncludeDanger} />
      </View>
      <View style={styles.toggleRow}>
        <Text>包含 disabled 动作 (改价)</Text>
        <Switch value={includeDisabled} onValueChange={setIncludeDisabled} />
      </View>

      <Button mode="contained" onPress={() => setVisible(true)} style={styles.openBtn}>
        打开 BottomSheet
      </Button>

      <RowActionBottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        actions={actions}
        title="销售单 SO-2026-001"
        aiTriggerEnabled={aiOn}
        onAITrigger={() => Alert.alert('AI', '将携带 entityType=salesOrder, entityId=SO-2026-001 进入 AIChat')}
      />
    </ScrollView>
  );
};

const makeStyles = (theme: AppTheme) =>
  StyleSheet.create({
    root: { padding: theme.custom.spacing.l, gap: theme.custom.spacing.m },
    heading: { color: theme.colors.onSurface, marginBottom: theme.custom.spacing.s },
    note: { color: theme.colors.onSurfaceVariant, marginBottom: theme.custom.spacing.m },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: theme.custom.spacing.s,
    },
    openBtn: { marginTop: theme.custom.spacing.l },
  });
