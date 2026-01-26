import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../../theme';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: string; // Display text
  variant?: StatusVariant; // Color scheme
  style?: StyleProp<ViewStyle>;
}

// P3 Fix: Extract color config outside component to avoid object recreation
const VARIANT_COLORS = {
  success: { bg: '#E6F9E9', text: theme.custom.colors.success },
  warning: { bg: '#FFF9E6', text: theme.custom.colors.warning },
  error: { bg: '#FEEBEB', text: theme.custom.colors.error },
  info: { bg: '#E6F4FF', text: theme.custom.colors.info },
  default: { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant },
} as const;

// P3 Fix: Wrap component with React.memo
export const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({
  status,
  variant = 'default',
  style,
}) => {
  const colors = VARIANT_COLORS[variant] || VARIANT_COLORS.default;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{status}</Text>
    </View>
  );
});

StatusBadge.displayName = 'StatusBadge';

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: theme.custom.borderRadius.round,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'transparent', // Can add border if needed
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
