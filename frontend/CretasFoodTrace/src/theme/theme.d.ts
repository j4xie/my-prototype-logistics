import 'react-native-paper';

// Augment the React Native Paper theme types to include our custom colors
declare global {
  namespace ReactNativePaper {
    interface ThemeColors {
      // Custom text colors
      text: string;
      textSecondary: string;
      textTertiary: string;

      // Custom semantic colors
      success: string;
      warning: string;
      info: string;

      // Custom UI colors
      border: string;
      divider: string;
    }
  }
}

export {};
