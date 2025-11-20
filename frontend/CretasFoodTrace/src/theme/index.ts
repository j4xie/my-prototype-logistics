import { MD3LightTheme as DefaultTheme, configureFonts } from 'react-native-paper';

// 定义品牌色
const brandColors = {
  primary: '#4ECDC4',      // 品牌主色 (Teal)
  secondary: '#667eea',    // 辅助色 (Blue-Purple)
  accent: '#FF6B6B',       // 强调色 (Red/Coral)
  background: '#F5F7FA',   // 背景色 (Light Grey)
  surface: '#FFFFFF',      // 卡片/表面色 (White)
  text: '#2D3436',         // 主要文本色 (Dark Grey)
  textSecondary: '#636E72',// 次要文本色 (Grey)
  success: '#00B894',      // 成功色 (Green)
  warning: '#FD79A8',      // 警告色 (Pinkish)
  error: '#D63031',        // 错误色 (Red)
  info: '#0984E3',         // 信息色 (Blue)
};

// 自定义字体配置 (如果需要)
const fontConfig = {
  fontFamily: 'System',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: brandColors.primary,
    onPrimary: '#FFFFFF',
    primaryContainer: '#E0F2F1',
    onPrimaryContainer: '#004D40',
    
    secondary: brandColors.secondary,
    onSecondary: '#FFFFFF',
    secondaryContainer: '#E8EAF6',
    onSecondaryContainer: '#1A237E',
    
    tertiary: brandColors.accent,
    onTertiary: '#FFFFFF',
    tertiaryContainer: '#FFEBEE',
    onTertiaryContainer: '#B71C1C',
    
    background: brandColors.background,
    onBackground: brandColors.text,
    
    surface: brandColors.surface,
    onSurface: brandColors.text,
    surfaceVariant: '#F0F2F5',
    onSurfaceVariant: brandColors.textSecondary,
    
    error: brandColors.error,
    onError: '#FFFFFF',
    
    outline: '#DFE6E9',
  },
  // 自定义属性 (非Paper标准属性, 但可在应用中使用)
  custom: {
    colors: brandColors,
    spacing: {
      xs: 4,
      s: 8,
      m: 16,
      l: 24,
      xl: 32,
      xxl: 48,
    },
    borderRadius: {
      s: 4,
      m: 8,
      l: 12,
      xl: 20,
      round: 999,
    },
    shadows: {
      small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
      large: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
      },
    },
  },
};

// 导出类型以便在组件中使用
export type AppTheme = typeof theme;
