import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton, ButtonProps as PaperButtonProps } from 'react-native-paper';

export interface ButtonProps extends Omit<PaperButtonProps, 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  style,
  labelStyle,
  children,
  ...props
}) => {
  const buttonStyles = [
    styles.base,
    styles[size],
    fullWidth && styles.fullWidth,
    style,
  ];

  const textStyles = [
    styles.textBase,
    styles[`text${size.charAt(0).toUpperCase() + size.slice(1)}` as keyof typeof styles],
    labelStyle,
  ];

  const getButtonProps = () => {
    switch (variant) {
      case 'primary':
        return {
          mode: 'contained' as const,
          buttonColor: '#2196F3',
          textColor: '#ffffff',
        };
      case 'secondary':
        return {
          mode: 'outlined' as const,
          textColor: '#2196F3',
        };
      case 'danger':
        return {
          mode: 'contained' as const,
          buttonColor: '#f44336',
          textColor: '#ffffff',
        };
      case 'success':
        return {
          mode: 'contained' as const,
          buttonColor: '#4caf50',
          textColor: '#ffffff',
        };
      case 'warning':
        return {
          mode: 'contained' as const,
          buttonColor: '#ff9800',
          textColor: '#ffffff',
        };
      default:
        return {
          mode: 'contained' as const,
          buttonColor: '#2196F3',
          textColor: '#ffffff',
        };
    }
  };

  return (
    <PaperButton
      {...getButtonProps()}
      {...props}
      style={buttonStyles}
      labelStyle={textStyles}
    >
      {children || title}
    </PaperButton>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
  } as ViewStyle,
  
  small: {
    minHeight: 36,
    paddingHorizontal: 12,
  } as ViewStyle,
  
  medium: {
    minHeight: 40,
    paddingHorizontal: 16,
  } as ViewStyle,
  
  large: {
    minHeight: 48,
    paddingHorizontal: 20,
  } as ViewStyle,
  
  fullWidth: {
    alignSelf: 'stretch',
  } as ViewStyle,
  
  textBase: {
    fontWeight: '600',
  } as TextStyle,
  
  textSmall: {
    fontSize: 14,
  } as TextStyle,
  
  textMedium: {
    fontSize: 16,
  } as TextStyle,
  
  textLarge: {
    fontSize: 18,
  } as TextStyle,
});