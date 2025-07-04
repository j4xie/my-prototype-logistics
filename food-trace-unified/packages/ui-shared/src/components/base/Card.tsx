import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Card as PaperCard, CardProps as PaperCardProps } from 'react-native-paper';

export interface CardProps extends PaperCardProps {
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'small' | 'medium' | 'large';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  padding = 'medium',
  style,
  children,
  ...props
}) => {
  const cardStyles = [
    styles.base,
    styles[variant],
    styles[`padding${padding.charAt(0).toUpperCase() + padding.slice(1)}` as keyof typeof styles],
    style,
  ];

  return (
    <PaperCard {...props} style={cardStyles}>
      {children}
    </PaperCard>
  );
};

// Card子组件
export const CardHeader: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <PaperCard.Title style={[styles.header, style]}>
    {children}
  </PaperCard.Title>
);

export const CardContent: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <PaperCard.Content style={[styles.content, style]}>
    {children}
  </PaperCard.Content>
);

export const CardActions: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <PaperCard.Actions style={[styles.actions, style]}>
    {children}
  </PaperCard.Actions>
);

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    marginVertical: 4,
  } as ViewStyle,
  
  elevated: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  } as ViewStyle,
  
  outlined: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    elevation: 0,
  } as ViewStyle,
  
  filled: {
    backgroundColor: '#f5f5f5',
    elevation: 0,
  } as ViewStyle,
  
  paddingNone: {
    padding: 0,
  } as ViewStyle,
  
  paddingSmall: {
    padding: 8,
  } as ViewStyle,
  
  paddingMedium: {
    padding: 16,
  } as ViewStyle,
  
  paddingLarge: {
    padding: 24,
  } as ViewStyle,
  
  header: {
    paddingBottom: 8,
  } as ViewStyle,
  
  content: {
    paddingTop: 0,
  } as ViewStyle,
  
  actions: {
    paddingTop: 8,
    justifyContent: 'flex-end',
  } as ViewStyle,
});