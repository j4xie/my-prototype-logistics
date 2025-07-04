import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';

export interface LoadingProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  overlay?: boolean;
  style?: ViewStyle;
}

export const Loading: React.FC<LoadingProps> = ({
  size = 'large',
  color = '#2196F3',
  text,
  overlay = false,
  style,
}) => {
  const containerStyles = [
    styles.container,
    overlay && styles.overlay,
    style,
  ];

  return (
    <View style={containerStyles}>
      <ActivityIndicator size={size} color={color} />
      {text && (
        <Text variant="bodyMedium" style={styles.text}>
          {text}
        </Text>
      )}
    </View>
  );
};

// 页面级别的Loading组件
export const PageLoading: React.FC<{ text?: string }> = ({ text = '加载中...' }) => (
  <Loading 
    size="large" 
    text={text} 
    style={styles.pageLoading}
  />
);

// 内联Loading组件
export const InlineLoading: React.FC<{ text?: string }> = ({ text }) => (
  <Loading 
    size="small" 
    text={text} 
    style={styles.inlineLoading}
  />
);

// 遮罩层Loading组件
export const OverlayLoading: React.FC<{ text?: string }> = ({ text = '处理中...' }) => (
  <Loading 
    size="large" 
    text={text} 
    overlay 
  />
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  } as ViewStyle,
  
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 9999,
  } as ViewStyle,
  
  text: {
    marginTop: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
  
  pageLoading: {
    flex: 1,
    minHeight: 200,
  } as ViewStyle,
  
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  } as ViewStyle,
});