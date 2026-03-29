/**
 * DevToolsModule - Developer tools section (only in __DEV__)
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ShakingCard } from './ShakingCard';
import { FAHomeStackParamList } from '../../../../types/navigation';
import type { HomeModule } from '../../../../types/decoration';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'FAHome'>;

interface DevToolsModuleProps {
  module: HomeModule;
  index: number;
  isEditMode: boolean;
  onToggleModuleVisibility: (moduleId: string) => void;
}

export function DevToolsModule({
  module,
  index,
  isEditMode,
  onToggleModuleVisibility,
}: DevToolsModuleProps) {
  const { t } = useTranslation('home');
  const navigation = useNavigation<NavigationProp>();

  if (!__DEV__) return null;

  return (
    <ShakingCard isShaking={isEditMode} delay={index * 50} style={styles.devToolsSection}>
      {isEditMode && (
        <TouchableOpacity
          style={styles.sectionEditBadge}
          onPress={() => onToggleModuleVisibility(module.id)}
        >
          <Icon source="minus-circle" size={20} color="#e53e3e" />
        </TouchableOpacity>
      )}
      <Text style={styles.sectionTitle}>{module.name || t('sections.devTools')}</Text>
      <TouchableOpacity
        style={[styles.quickAction, { backgroundColor: '#8B5CF6' }]}
        onPress={() => navigation.navigate('FormilyDemo')}
        activeOpacity={0.8}
      >
        <Icon source="form-select" size={24} color="#fff" />
        <Text style={styles.quickActionLabel}>{t('quickActions.formilyDemo')}</Text>
      </TouchableOpacity>
    </ShakingCard>
  );
}

const styles = StyleSheet.create({
  devToolsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  quickAction: {
    width: '23%',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontSize: 14,
    color: '#4a5568',
    textAlign: 'center',
  },
  sectionEditBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
