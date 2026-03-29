/**
 * EditToolbar - Floating bottom toolbar for edit mode
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';

interface EditToolbarProps {
  onCancel: () => void;
  onAddModule: () => void;
  onSave: () => void;
  onAdvancedEdit: () => void;
}

export function EditToolbar({ onCancel, onAddModule, onSave, onAdvancedEdit }: EditToolbarProps) {
  const { t } = useTranslation('home');

  return (
    <View style={styles.editToolbar}>
      <View style={styles.editToolbarInner}>
        <TouchableOpacity
          style={[styles.toolbarBtn, styles.toolbarBtnCancel]}
          onPress={onCancel}
        >
          <Icon source="close" size={20} color="#666" />
          <Text style={styles.toolbarBtnCancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarBtn, styles.toolbarBtnAdd]}
          onPress={onAddModule}
        >
          <Icon source="plus" size={20} color="#48bb78" />
          <Text style={styles.toolbarBtnAddText}>{t('layout.addModule')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolbarBtn, styles.toolbarBtnSave]}
          onPress={onSave}
        >
          <Icon source="check" size={20} color="#fff" />
          <Text style={styles.toolbarBtnSaveText}>{t('layout.done')}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={onAdvancedEdit} style={styles.advancedLink}>
        <Text style={styles.advancedLinkText}>{t('layout.advancedEdit')} →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  editToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  editToolbarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  toolbarBtnCancel: {
    backgroundColor: '#f5f5f5',
  },
  toolbarBtnCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  toolbarBtnAdd: {
    backgroundColor: '#e6ffed',
  },
  toolbarBtnAddText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#48bb78',
  },
  toolbarBtnSave: {
    backgroundColor: '#667eea',
  },
  toolbarBtnSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  advancedLink: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  advancedLinkText: {
    fontSize: 13,
    color: '#667eea',
  },
});
