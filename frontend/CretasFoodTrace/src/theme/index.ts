import { MD3LightTheme as DefaultTheme } from 'react-native-paper';
import { Platform } from 'react-native';

// Neo Minimal iOS-Style Design Tokens
const brandColors = {
  primary: '#1890FF',      // iOS Blue
  secondary: '#5856D6',    // iOS Indigo
  accent: '#FF2D55',       // iOS Pink
  
  // Neutral Colors
  background: '#F5F5F5',   // Light Gray Background
  surface: '#FFFFFF',      // White Surface
  surfaceVariant: '#F9FAFB', // Very Light Gray for sections
  
  // Text Colors
  text: '#1F2937',         // Gray-900 (Primary Text)
  textSecondary: '#6B7280',// Gray-500 (Secondary Text)
  textTertiary: '#9CA3AF', // Gray-400 (Disabled/Hint)
  
  // Semantic Colors
  success: '#34C759',      // iOS Green
  warning: '#FFCC00',      // iOS Yellow
  error: '#FF3B30',        // iOS Red
  info: '#007AFF',         // iOS Blue
  
  // UI Colors
  border: '#E5E7EB',       // Gray-200
  divider: '#F3F4F6',      // Gray-100
  backdrop: 'rgba(0, 0, 0, 0.4)',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: brandColors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#E6F7FF', // Light Blue Background
    onPrimaryContainer: '#0050B3', // Dark Blue Text
    
    secondary: brandColors.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#F0F5FF',
    onSecondaryContainer: '#2F54EB',
    
    tertiary: brandColors.accent,
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFF0F6',
    onTertiaryContainer: '#C41D7F',
    
    background: brandColors.background,
    onBackground: brandColors.text,
    
    surface: brandColors.surface,
    onSurface: brandColors.text,
    surfaceVariant: brandColors.surfaceVariant,
    onSurfaceVariant: brandColors.textSecondary,
    
    error: brandColors.error,
    onError: '#FFFFFF',
    errorContainer: '#FFF1F0',
    onErrorContainer: '#CF1322',
    
    outline: brandColors.border,
    outlineVariant: brandColors.divider,
    
    backdrop: brandColors.backdrop,
  },
  // 自定义属性 (非Paper标准属性, 但可在应用中使用)
  custom: {
    colors: brandColors,
    spacing: {
      xs: 4,
      s: 8,
      m: 12, // Adjusted for tighter layout
      l: 16, // Standard padding
      xl: 24,
      xxl: 32,
      section: 40,
    },
    borderRadius: {
      xs: 4,
      s: 8,  // Buttons
      m: 12, // Cards
      l: 16, // Large Cards
      xl: 24,
      round: 999,
    },
    shadows: {
      // Soft, diffused shadows (iOS Style)
      small: {
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          },
          android: {
            elevation: 2,
          },
        }),
      },
      medium: {
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 12,
          },
          android: {
            elevation: 4,
          },
        }),
      },
      large: {
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 24,
          },
          android: {
            elevation: 8,
          },
        }),
      },
    },
  },
};

// 导出类型以便在组件中使用
export type AppTheme = typeof theme;
