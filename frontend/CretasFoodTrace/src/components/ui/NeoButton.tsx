import React from 'react';
import { StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { Button, ButtonProps } from 'react-native-paper';
import { theme } from '../../theme';

interface NeoButtonProps extends Omit<ButtonProps, 'theme'> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'medium' | 'large';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

export const NeoButton: React.FC<NeoButtonProps> = ({
  variant = 'primary',
  size = 'medium',
  style,
  labelStyle,
  children,
  mode, // ignore passed mode, use variant to determine
  ...props
}) => {
  const getButtonConfig = () => {
    switch (variant) {
      case 'primary':
        return {
          mode: 'contained' as const,
          buttonColor: theme.colors.primary,
          textColor: theme.colors.onPrimary,
        };
      case 'secondary':
        return {
          mode: 'contained-tonal' as const,
          buttonColor: theme.colors.secondaryContainer,
          textColor: theme.colors.onSecondaryContainer,
        };
      case 'outline':
        return {
          mode: 'outlined' as const,
          buttonColor: 'transparent',
          textColor: theme.colors.primary,
          style: { borderColor: theme.colors.outline },
        };
      case 'ghost':
        return {
          mode: 'text' as const,
          buttonColor: 'transparent',
          textColor: theme.colors.primary,
        };
      case 'danger':
        return {
          mode: 'contained' as const,
          buttonColor: theme.colors.error,
          textColor: theme.colors.onError,
        };
      default:
        return {
          mode: 'contained' as const,
          buttonColor: theme.colors.primary,
          textColor: theme.colors.onPrimary,
        };
    }
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return {
          height: 32,
          paddingHorizontal: 12,
        };
      case 'large':
        return {
          height: 56,
          paddingHorizontal: 32,
        };
      default: // medium
        return {
          height: 44,
          paddingHorizontal: 20,
        };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'small': return 13;
      case 'large': return 17;
      default: return 15;
    }
  };

  const config = getButtonConfig();

  return (
    <Button
      mode={config.mode}
      buttonColor={config.buttonColor}
      textColor={config.textColor}
      style={[
        styles.button,
        getSizeStyle(),
        config.style,
        style,
      ]}
      labelStyle={[
        styles.label,
        { fontSize: getFontSize() },
        labelStyle,
      ]}
      contentStyle={styles.content}
      {...props}
    >
      {children}
    </Button>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: theme.custom.borderRadius.s,
    justifyContent: 'center',
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.5,
    marginVertical: 0,
    marginHorizontal: 0,
  },
  content: {
    height: '100%',
  },
});

