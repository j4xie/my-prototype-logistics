import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { theme } from '../../theme';

type StatusVariant = 'success' | 'warning' | 'error' | 'info' | 'default';

interface StatusBadgeProps {
  status: string; // Display text
  variant?: StatusVariant; // Color scheme
  style?: StyleProp<ViewStyle>;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'default',
  style,
}) => {
  const getColors = () => {
    switch (variant) {
      case 'success':
        return { bg: '#E6F9E9', text: theme.custom.colors.success }; // Very light green bg
      case 'warning':
        return { bg: '#FFF9E6', text: theme.custom.colors.warning }; // Very light yellow bg
      case 'error':
        return { bg: '#FEEBEB', text: theme.custom.colors.error }; // Very light red bg
      case 'info':
        return { bg: '#E6F4FF', text: theme.custom.colors.info }; // Very light blue bg
      default:
        return { bg: theme.colors.surfaceVariant, text: theme.colors.onSurfaceVariant };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }, style]}>
      <Text style={[styles.text, { color: colors.text }]}>{status}</Text>
    </View>
  );
};

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

