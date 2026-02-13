/**
 * EmptyStateCard — 通用零状态引导卡片
 * 当页面/区块无数据时显示友好引导，替代空白或全零状态
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface EmptyStateCardProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export default function EmptyStateCard({
  icon = 'inbox-outline',
  title,
  description,
  actionLabel,
  onAction,
  compact = false,
}: EmptyStateCardProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <MaterialCommunityIcons
        name={icon as any}
        size={compact ? 36 : 48}
        color="#C0C4CC"
      />
      <Text style={[styles.title, compact && styles.titleCompact]}>{title}</Text>
      {description ? (
        <Text style={styles.description}>{description}</Text>
      ) : null}
      {actionLabel && onAction ? (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction} activeOpacity={0.7}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    backgroundColor: '#FAFBFC',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  containerCompact: {
    paddingVertical: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#606266',
    marginTop: 12,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 14,
    marginTop: 8,
  },
  description: {
    fontSize: 13,
    color: '#909399',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  actionBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#409EFF',
    borderRadius: 6,
  },
  actionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
});
