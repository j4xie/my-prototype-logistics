import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { Modal as PaperModal, Portal, Text, IconButton } from 'react-native-paper';

export interface ModalProps {
  visible: boolean;
  onDismiss: () => void;
  title?: string;
  size?: 'small' | 'medium' | 'large' | 'fullscreen';
  dismissable?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

export const Modal: React.FC<ModalProps> = ({
  visible,
  onDismiss,
  title,
  size = 'medium',
  dismissable = true,
  showCloseButton = true,
  children,
  style,
}) => {
  const modalStyles = [
    styles.base,
    styles[size],
    style,
  ];

  return (
    <Portal>
      <PaperModal
        visible={visible}
        onDismiss={dismissable ? onDismiss : undefined}
        contentContainerStyle={modalStyles}
      >
        {(title || showCloseButton) && (
          <div style={styles.header}>
            {title && (
              <Text variant="headlineSmall" style={styles.title}>
                {title}
              </Text>
            )}
            {showCloseButton && (
              <IconButton
                icon="close"
                size={24}
                onPress={onDismiss}
                style={styles.closeButton}
              />
            )}
          </div>
        )}
        <div style={styles.content}>
          {children}
        </div>
      </PaperModal>
    </Portal>
  );
};

// Modal子组件
export const ModalHeader: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <div style={[styles.header, style]}>
    {children}
  </div>
);

export const ModalContent: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <div style={[styles.content, style]}>
    {children}
  </div>
);

export const ModalActions: React.FC<{ children: React.ReactNode; style?: ViewStyle }> = ({
  children,
  style,
}) => (
  <div style={[styles.actions, style]}>
    {children}
  </div>
);

const styles = StyleSheet.create({
  base: {
    backgroundColor: 'white',
    borderRadius: 12,
    margin: 20,
    maxHeight: '90%',
  } as ViewStyle,
  
  small: {
    width: '80%',
    alignSelf: 'center',
  } as ViewStyle,
  
  medium: {
    width: '90%',
    alignSelf: 'center',
  } as ViewStyle,
  
  large: {
    width: '95%',
    alignSelf: 'center',
  } as ViewStyle,
  
  fullscreen: {
    width: '100%',
    height: '100%',
    margin: 0,
    borderRadius: 0,
  } as ViewStyle,
  
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  } as ViewStyle,
  
  title: {
    flex: 1,
    fontWeight: 'bold',
  },
  
  closeButton: {
    margin: 0,
  } as ViewStyle,
  
  content: {
    flex: 1,
    padding: 24,
  } as ViewStyle,
  
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  } as ViewStyle,
});