/**
 * useEditMode - iPhone-style long-press edit mode with layout management
 */
import { useState, useCallback } from 'react';
import { Vibration, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useHomeLayoutStore } from '../../../../store/homeLayoutStore';
import type { HomeModule } from '../../../../types/decoration';

export interface EditModeResult {
  isEditMode: boolean;
  hasChanges: boolean;
  showAddModuleSheet: boolean;
  showAddStatCardSheet: boolean;
  showAddQuickActionSheet: boolean;
  editingModuleId: string | null;
  setShowAddModuleSheet: (show: boolean) => void;
  setShowAddStatCardSheet: (show: boolean) => void;
  setShowAddQuickActionSheet: (show: boolean) => void;
  setEditingModuleId: (id: string | null) => void;
  handleLongPressEdit: () => void;
  exitEditMode: () => void;
  handleSaveLayout: (factoryId: string | undefined) => Promise<void>;
  handleAdvancedEdit: () => void;
  toggleModuleVisibility: (moduleId: string) => void;
  handleAddModule: () => void;
}

export function useEditMode(
  navigateToEditor: () => void,
  draftModules: HomeModule[],
): EditModeResult {
  const { t } = useTranslation('home');

  const [isEditMode, setIsEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddModuleSheet, setShowAddModuleSheet] = useState(false);
  const [showAddStatCardSheet, setShowAddStatCardSheet] = useState(false);
  const [showAddQuickActionSheet, setShowAddQuickActionSheet] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // Store actions (stable references, won't cause re-renders)
  const startEditing = useHomeLayoutStore(state => state.startEditing);
  const cancelEditing = useHomeLayoutStore(state => state.cancelEditing);
  const saveDraft = useHomeLayoutStore(state => state.saveDraft);
  const toggleModuleVisibilityStore = useHomeLayoutStore(state => state.toggleModuleVisibility);

  const handleLongPressEdit = useCallback(() => {
    if (isEditMode) return;
    Vibration.vibrate(50);
    startEditing();
    setIsEditMode(true);
    setHasChanges(false);
  }, [isEditMode, startEditing]);

  const exitEditMode = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        t('layout.unsavedTitle', 'Unsaved changes'),
        t('layout.unsavedDesc', 'You have unsaved changes. Discard?'),
        [
          { text: t('common.cancel', 'Cancel'), style: 'cancel' },
          {
            text: t('layout.discard', 'Discard'),
            style: 'destructive',
            onPress: () => {
              cancelEditing();
              setIsEditMode(false);
              setHasChanges(false);
            },
          },
        ],
      );
    } else {
      cancelEditing();
      setIsEditMode(false);
    }
  }, [hasChanges, t, cancelEditing]);

  const handleSaveLayout = useCallback(
    async (factoryId: string | undefined) => {
      if (!factoryId) {
        Alert.alert(t('error.saveFailed', 'Save failed'), t('error.noFactoryId', 'Cannot get factory ID'));
        return;
      }
      try {
        await saveDraft(factoryId);
        Vibration.vibrate(30);
        setIsEditMode(false);
        setHasChanges(false);
        Alert.alert(t('layout.saveSuccess', 'Saved'), t('layout.saveSuccessDesc', 'Layout saved'));
      } catch (err) {
        Alert.alert(t('error.saveFailed', 'Save failed'), String(err));
      }
    },
    [saveDraft, t],
  );

  const handleAdvancedEdit = useCallback(() => {
    setIsEditMode(false);
    navigateToEditor();
  }, [navigateToEditor]);

  const toggleModuleVisibility = useCallback(
    (moduleId: string) => {
      Vibration.vibrate(30);
      toggleModuleVisibilityStore(moduleId);
      setHasChanges(true);
    },
    [toggleModuleVisibilityStore],
  );

  const handleAddModule = useCallback(() => {
    const hiddenModules = draftModules.filter(m => !m.visible);
    if (hiddenModules.length === 0) {
      Alert.alert(t('layout.addModule'), t('layout.noMoreModules'));
      return;
    }
    setShowAddModuleSheet(true);
  }, [draftModules, t]);

  return {
    isEditMode,
    hasChanges,
    showAddModuleSheet,
    showAddStatCardSheet,
    showAddQuickActionSheet,
    editingModuleId,
    setShowAddModuleSheet,
    setShowAddStatCardSheet,
    setShowAddQuickActionSheet,
    setEditingModuleId,
    handleLongPressEdit,
    exitEditMode,
    handleSaveLayout,
    handleAdvancedEdit,
    toggleModuleVisibility,
    handleAddModule,
  };
}
