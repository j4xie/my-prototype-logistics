/**
 * PageEditor - General Purpose Page Configuration Editor
 * Phase 3 - Low-code Page Configuration System
 *
 * Supports editing various page types: dashboard, list, detail, form
 * Features: ComponentPalette, BentoGrid Canvas, PropertyPanel, Undo/Redo
 */
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { Icon } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  usePageConfigStore,
  PageType,
  PageModule,
  ModulePosition,
  ModuleSize,
  usePageEditState,
  usePageUndoRedo,
  usePageModuleActions,
  usePageConfigActions,
} from '../../store/pageConfigStore';
import { logger } from '../../utils/logger';
import {
  ComponentPalette,
  AVAILABLE_COMPONENTS,
  PageType as PalettePageType,
} from './components/ComponentPalette';

// ============================================
// Constants
// ============================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LEFT_SIDEBAR_WIDTH = 240;
const RIGHT_SIDEBAR_WIDTH = 280;
const TOP_TOOLBAR_HEIGHT = 56;
const BOTTOM_BAR_HEIGHT = 52;
const GRID_PADDING = 16;
const GRID_GAP = 12;
const GRID_COLUMNS = 2;

// Calculate canvas dimensions
const CANVAS_WIDTH = SCREEN_WIDTH - LEFT_SIDEBAR_WIDTH - RIGHT_SIDEBAR_WIDTH;
const CELL_WIDTH = (CANVAS_WIDTH - GRID_PADDING * 2 - GRID_GAP) / GRID_COLUMNS;
const CELL_HEIGHT = 100;

// Fallback component types for inline palette
const FALLBACK_COMPONENTS = [
  { type: 'header', icon: 'page-layout-header', label: 'Header', color: '#667eea' },
  { type: 'stats_card', icon: 'chart-box', label: 'Stats', color: '#10B981' },
  { type: 'list', icon: 'format-list-bulleted', label: 'List', color: '#F59E0B' },
  { type: 'chart', icon: 'chart-line', label: 'Chart', color: '#8B5CF6' },
  { type: 'form', icon: 'form-textbox', label: 'Form', color: '#EC4899' },
  { type: 'image', icon: 'image', label: 'Image', color: '#06B6D4' },
  { type: 'text', icon: 'text', label: 'Text', color: '#6B7280' },
  { type: 'button', icon: 'gesture-tap-button', label: 'Button', color: '#EF4444' },
];

// Page type labels
const PAGE_TYPE_LABELS: Record<PageType, string> = {
  [PageType.HOME]: 'Home Page',
  [PageType.DASHBOARD]: 'Dashboard',
  [PageType.LIST]: 'List Page',
  [PageType.DETAIL]: 'Detail Page',
  [PageType.FORM]: 'Form Page',
};

// Create logger for PageEditor
const editorLogger = logger.createContextLogger('PageEditor');

// ============================================
// Types
// ============================================

export interface PageEditorProps {
  pageId: string;
  factoryId: string;
  pageType: PageType;
  onSave?: () => void;
  onPublish?: () => void;
  onClose?: () => void;
}

interface PropertyPanelProps {
  selectedModule: PageModule | null;
  onUpdateProps: (moduleId: string, props: Record<string, unknown>) => void;
  onResizeModule: (moduleId: string, size: ModuleSize) => void;
  onToggleVisibility: (moduleId: string) => void;
  onDeleteModule: (moduleId: string) => void;
}

interface CanvasGridProps {
  modules: PageModule[];
  selectedModuleId: string | null;
  isPreview: boolean;
  onSelectModule: (moduleId: string | null) => void;
  onMoveModule: (moduleId: string, position: ModulePosition) => void;
}

// ============================================
// PropertyPanel - Right Sidebar
// ============================================

function PropertyPanel({
  selectedModule,
  onUpdateProps,
  onResizeModule,
  onToggleVisibility,
  onDeleteModule,
}: PropertyPanelProps) {
  if (!selectedModule) {
    return (
      <View style={styles.rightSidebar}>
        <Text style={styles.sidebarTitle}>Properties</Text>
        <View style={styles.emptyPanel}>
          <Icon source="cursor-default-click" size={48} color="#D1D5DB" />
          <Text style={styles.emptyPanelText}>
            Select a module to edit its properties
          </Text>
        </View>
      </View>
    );
  }

  const sizeOptions: Array<{ w: 1 | 2 | 3 | 4; h: 1 | 2 | 3 | 4; label: string }> = [
    { w: 1, h: 1, label: '1x1' },
    { w: 2, h: 1, label: '2x1' },
    { w: 1, h: 2, label: '1x2' },
    { w: 2, h: 2, label: '2x2' },
  ];

  return (
    <View style={styles.rightSidebar}>
      <Text style={styles.sidebarTitle}>Properties</Text>
      <ScrollView
        style={styles.propertyScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Module Info */}
        <View style={styles.propertySection}>
          <Text style={styles.propertySectionTitle}>Module Info</Text>
          <View style={styles.propertyRow}>
            <Text style={styles.propertyLabel}>Type</Text>
            <Text style={styles.propertyValue}>{selectedModule.componentType}</Text>
          </View>
          <View style={styles.propertyRow}>
            <Text style={styles.propertyLabel}>ID</Text>
            <Text style={styles.propertyValueSmall} numberOfLines={1}>
              {selectedModule.id}
            </Text>
          </View>
        </View>

        {/* Visibility Toggle */}
        <View style={styles.propertySection}>
          <Text style={styles.propertySectionTitle}>Visibility</Text>
          <TouchableOpacity
            style={styles.visibilityToggle}
            onPress={() => onToggleVisibility(selectedModule.id)}
          >
            <Icon
              source={selectedModule.visible ? 'eye' : 'eye-off'}
              size={20}
              color={selectedModule.visible ? '#10B981' : '#9CA3AF'}
            />
            <Text style={styles.visibilityText}>
              {selectedModule.visible ? 'Visible' : 'Hidden'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Size Options */}
        <View style={styles.propertySection}>
          <Text style={styles.propertySectionTitle}>Size</Text>
          <View style={styles.sizeGrid}>
            {sizeOptions.map((option) => {
              const isSelected =
                selectedModule.size.width === option.w &&
                selectedModule.size.height === option.h;
              return (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.sizeOption,
                    isSelected && styles.sizeOptionSelected,
                  ]}
                  onPress={() =>
                    onResizeModule(selectedModule.id, {
                      width: option.w,
                      height: option.h,
                    })
                  }
                >
                  <Text
                    style={[
                      styles.sizeOptionText,
                      isSelected && styles.sizeOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Position Info */}
        <View style={styles.propertySection}>
          <Text style={styles.propertySectionTitle}>Position</Text>
          <View style={styles.positionInfo}>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>X</Text>
              <Text style={styles.positionValue}>{selectedModule.position.x}</Text>
            </View>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Y</Text>
              <Text style={styles.positionValue}>{selectedModule.position.y}</Text>
            </View>
            <View style={styles.positionItem}>
              <Text style={styles.positionLabel}>Order</Text>
              <Text style={styles.positionValue}>{selectedModule.position.order}</Text>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        <View style={styles.propertySection}>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              Alert.alert(
                'Delete Module',
                'Are you sure you want to delete this module?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => onDeleteModule(selectedModule.id),
                  },
                ]
              );
            }}
          >
            <Icon source="delete" size={20} color="#EF4444" />
            <Text style={styles.deleteButtonText}>Delete Module</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================
// CanvasGrid - Center Canvas
// ============================================

function CanvasGrid({
  modules,
  selectedModuleId,
  isPreview,
  onSelectModule,
  onMoveModule,
}: CanvasGridProps) {
  // Calculate container height based on modules
  const containerHeight = useMemo(() => {
    let maxY = 0;
    modules.forEach((module) => {
      if (module.visible || !isPreview) {
        const bottom = module.position.y + module.size.height;
        if (bottom > maxY) maxY = bottom;
      }
    });
    return Math.max(maxY * (CELL_HEIGHT + GRID_GAP) + GRID_PADDING * 2, 400);
  }, [modules, isPreview]);

  // Calculate module position in canvas
  const calculateModuleStyle = (module: PageModule) => {
    const x = GRID_PADDING + module.position.x * (CELL_WIDTH + GRID_GAP);
    const y = GRID_PADDING + module.position.y * (CELL_HEIGHT + GRID_GAP);
    const width =
      module.size.width * CELL_WIDTH + (module.size.width - 1) * GRID_GAP;
    const height =
      module.size.height * CELL_HEIGHT + (module.size.height - 1) * GRID_GAP;
    return { x, y, width, height };
  };

  // Category color mapping
  const CATEGORY_COLORS: Record<string, string> = {
    stats: '#10B981',
    navigation: '#667eea',
    data: '#F59E0B',
    chart: '#8B5CF6',
    form: '#EC4899',
    layout: '#06B6D4',
  };

  // Get component color based on category
  const getComponentColor = (type: string): string => {
    const component = AVAILABLE_COMPONENTS.find((c) => c.type === type);
    if (component?.category) {
      const categoryColor = CATEGORY_COLORS[component.category];
      if (categoryColor) {
        return categoryColor;
      }
    }
    // Fallback to type-based color
    const fallback = FALLBACK_COMPONENTS.find((c) => c.type === type);
    return fallback?.color || '#6B7280';
  };

  // Get component icon
  const getComponentIcon = (type: string): string => {
    const component = AVAILABLE_COMPONENTS.find((c) => c.type === type);
    if (component?.icon) {
      return component.icon;
    }
    // Fallback
    const fallback = FALLBACK_COMPONENTS.find((c) => c.type === type);
    return fallback?.icon || 'cube-outline';
  };

  return (
    <ScrollView
      style={styles.canvasContainer}
      contentContainerStyle={{ minHeight: containerHeight }}
      showsVerticalScrollIndicator={true}
    >
      {/* Grid Background (editing mode) */}
      {!isPreview && (
        <View style={styles.gridBackground}>
          {Array.from({
            length: Math.ceil(containerHeight / (CELL_HEIGHT + GRID_GAP)),
          }).map((_, rowIdx) =>
            Array.from({ length: GRID_COLUMNS }).map((_, colIdx) => (
              <View
                key={`${rowIdx}-${colIdx}`}
                style={[
                  styles.gridCell,
                  {
                    left: GRID_PADDING + colIdx * (CELL_WIDTH + GRID_GAP),
                    top: GRID_PADDING + rowIdx * (CELL_HEIGHT + GRID_GAP),
                    width: CELL_WIDTH,
                    height: CELL_HEIGHT,
                  },
                ]}
              />
            ))
          )}
        </View>
      )}

      {/* Modules */}
      {modules
        .filter((m) => m.visible || !isPreview)
        .sort((a, b) => a.position.order - b.position.order)
        .map((module) => {
          const { x, y, width, height } = calculateModuleStyle(module);
          const isSelected = selectedModuleId === module.id;
          const color = getComponentColor(module.componentType);
          const icon = getComponentIcon(module.componentType);

          return (
            <TouchableOpacity
              key={module.id}
              style={[
                styles.moduleItem,
                {
                  position: 'absolute',
                  left: x,
                  top: y,
                  width,
                  height,
                  borderColor: isSelected ? color : '#E5E7EB',
                  borderWidth: isSelected ? 2 : 1,
                  opacity: module.visible ? 1 : 0.5,
                },
              ]}
              onPress={() => onSelectModule(isSelected ? null : module.id)}
              activeOpacity={0.8}
            >
              {/* Module Content */}
              <View
                style={[
                  styles.moduleIconWrapper,
                  { backgroundColor: `${color}15` },
                ]}
              >
                <Icon source={icon} size={24} color={color} />
              </View>
              <Text style={styles.moduleName} numberOfLines={1}>
                {module.name || module.componentType}
              </Text>
              <Text style={styles.moduleSize}>
                {module.size.width}x{module.size.height}
              </Text>

              {/* Hidden Indicator */}
              {!module.visible && !isPreview && (
                <View style={styles.hiddenBadge}>
                  <Icon source="eye-off" size={14} color="#9CA3AF" />
                </View>
              )}

              {/* Selection Indicator */}
              {isSelected && !isPreview && (
                <View style={[styles.selectionBorder, { borderColor: color }]} />
              )}
            </TouchableOpacity>
          );
        })}

      {/* Empty State */}
      {modules.length === 0 && (
        <View style={styles.emptyCanvas}>
          <Icon source="plus-circle-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyCanvasText}>
            Add components from the left panel
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

// ============================================
// PageEditor - Main Component
// ============================================

export function PageEditor({
  pageId,
  factoryId,
  pageType,
  onSave,
  onPublish,
  onClose,
}: PageEditorProps) {
  // Local state
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  // Store state
  const { isEditing, hasUnsavedChanges, isLoading, error } = usePageEditState();
  const { canUndo, canRedo, undo, redo } = usePageUndoRedo();
  const {
    addModule,
    removeModule,
    updateModuleProps,
    resizeModule,
    moveModule,
    toggleModuleVisibility,
  } = usePageModuleActions();
  const {
    loadConfig,
    saveConfig,
    publishConfig,
    startEditing,
    cancelEditing,
    resetToDefault,
  } = usePageConfigActions();

  // Get modules from store
  const modules = usePageConfigStore((state) => state.getModules(pageId));
  const config = usePageConfigStore((state) => state.getConfig(pageId));

  // Get selected module
  const selectedModule = useMemo(() => {
    if (!selectedModuleId) return null;
    return modules.find((m) => m.id === selectedModuleId) || null;
  }, [modules, selectedModuleId]);

  // Load config on mount
  useEffect(() => {
    editorLogger.debug('Loading page config', { pageId, factoryId });
    loadConfig(pageId, factoryId).then(() => {
      startEditing();
    });
  }, [pageId, factoryId, loadConfig, startEditing]);

  // Handle add component from palette
  const handleAddComponent = useCallback(
    (componentType: string) => {
      const newOrder = modules.length;
      const newPosition: ModulePosition = {
        x: newOrder % GRID_COLUMNS,
        y: Math.floor(newOrder / GRID_COLUMNS),
        order: newOrder,
      };
      addModule(pageId, componentType, newPosition);
      editorLogger.debug('Added module', { componentType, position: newPosition });
    },
    [pageId, modules.length, addModule]
  );

  // Handle save
  const handleSave = useCallback(async () => {
    try {
      await saveConfig(pageId);
      editorLogger.info('Config saved successfully');
      onSave?.();
      Alert.alert('Success', 'Page configuration saved successfully');
    } catch (err) {
      editorLogger.error('Failed to save config', err);
      Alert.alert('Error', 'Failed to save configuration');
    }
  }, [pageId, saveConfig, onSave]);

  // Handle publish
  const handlePublish = useCallback(async () => {
    Alert.alert(
      'Publish Page',
      'Are you sure you want to publish this page? It will be visible to users.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Publish',
          onPress: async () => {
            try {
              await publishConfig(pageId);
              editorLogger.info('Config published successfully');
              onPublish?.();
              Alert.alert('Success', 'Page published successfully');
            } catch (err) {
              editorLogger.error('Failed to publish config', err);
              Alert.alert('Error', 'Failed to publish page');
            }
          },
        },
      ]
    );
  }, [pageId, publishConfig, onPublish]);

  // Handle close
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to close?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              cancelEditing();
              onClose?.();
            },
          },
          {
            text: 'Save & Close',
            onPress: async () => {
              await handleSave();
              onClose?.();
            },
          },
        ]
      );
    } else {
      cancelEditing();
      onClose?.();
    }
  }, [hasUnsavedChanges, cancelEditing, onClose, handleSave]);

  // Handle module operations
  const handleResizeModule = useCallback(
    (moduleId: string, size: ModuleSize) => {
      resizeModule(pageId, moduleId, size);
    },
    [pageId, resizeModule]
  );

  const handleToggleVisibility = useCallback(
    (moduleId: string) => {
      toggleModuleVisibility(pageId, moduleId);
    },
    [pageId, toggleModuleVisibility]
  );

  const handleDeleteModule = useCallback(
    (moduleId: string) => {
      removeModule(pageId, moduleId);
      if (selectedModuleId === moduleId) {
        setSelectedModuleId(null);
      }
    },
    [pageId, removeModule, selectedModuleId]
  );

  const handleUpdateProps = useCallback(
    (moduleId: string, props: Record<string, unknown>) => {
      updateModuleProps(pageId, moduleId, props);
    },
    [pageId, updateModuleProps]
  );

  const handleMoveModule = useCallback(
    (moduleId: string, position: ModulePosition) => {
      moveModule(pageId, moduleId, position);
    },
    [pageId, moveModule]
  );

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>Loading page configuration...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />

        {/* Top Toolbar */}
        <View style={styles.topToolbar}>
          {/* Left: Close & Page Info */}
          <View style={styles.toolbarLeft}>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
              <Icon source="close" size={24} color="#374151" />
            </TouchableOpacity>
            <View style={styles.pageInfo}>
              <Text style={styles.pageName} numberOfLines={1}>
                {config?.pageId || pageId}
              </Text>
              <Text style={styles.pageType}>
                {PAGE_TYPE_LABELS[pageType] || pageType}
              </Text>
            </View>
          </View>

          {/* Center: Preview Toggle */}
          <View style={styles.toolbarCenter}>
            <TouchableOpacity
              style={[
                styles.previewToggle,
                isPreview && styles.previewToggleActive,
              ]}
              onPress={() => setIsPreview(!isPreview)}
            >
              <Icon
                source={isPreview ? 'eye' : 'pencil'}
                size={18}
                color={isPreview ? '#fff' : '#667eea'}
              />
              <Text
                style={[
                  styles.previewToggleText,
                  isPreview && styles.previewToggleTextActive,
                ]}
              >
                {isPreview ? 'Preview' : 'Edit'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Right: Actions */}
          <View style={styles.toolbarRight}>
            <TouchableOpacity
              style={[styles.actionButton, styles.saveButton]}
              onPress={handleSave}
              disabled={!hasUnsavedChanges}
            >
              <Icon
                source="content-save"
                size={18}
                color={hasUnsavedChanges ? '#fff' : '#9CA3AF'}
              />
              <Text
                style={[
                  styles.actionButtonText,
                  !hasUnsavedChanges && styles.actionButtonTextDisabled,
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.publishButton]}
              onPress={handlePublish}
            >
              <Icon source="rocket-launch" size={18} color="#10B981" />
              <Text style={[styles.actionButtonText, { color: '#10B981' }]}>
                Publish
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.mainContent}>
          {/* Left Sidebar - Component Palette */}
          {!isPreview && (
            <ComponentPalette
              pageType={pageType as unknown as PalettePageType}
              onSelectComponent={handleAddComponent}
            />
          )}

          {/* Center - Canvas */}
          <CanvasGrid
            modules={modules}
            selectedModuleId={selectedModuleId}
            isPreview={isPreview}
            onSelectModule={setSelectedModuleId}
            onMoveModule={handleMoveModule}
          />

          {/* Right Sidebar - Property Panel */}
          {!isPreview && (
            <PropertyPanel
              selectedModule={selectedModule}
              onUpdateProps={handleUpdateProps}
              onResizeModule={handleResizeModule}
              onToggleVisibility={handleToggleVisibility}
              onDeleteModule={handleDeleteModule}
            />
          )}
        </View>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          {/* Undo/Redo */}
          <View style={styles.undoRedoGroup}>
            <TouchableOpacity
              style={[styles.undoRedoButton, !canUndo && styles.undoRedoDisabled]}
              onPress={undo}
              disabled={!canUndo}
            >
              <Icon source="undo" size={20} color={canUndo ? '#374151' : '#D1D5DB'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.undoRedoButton, !canRedo && styles.undoRedoDisabled]}
              onPress={redo}
              disabled={!canRedo}
            >
              <Icon source="redo" size={20} color={canRedo ? '#374151' : '#D1D5DB'} />
            </TouchableOpacity>
          </View>

          {/* Page Info */}
          <View style={styles.bottomInfo}>
            <Text style={styles.bottomInfoText}>
              {modules.length} modules | {modules.filter((m) => m.visible).length}{' '}
              visible
            </Text>
            {hasUnsavedChanges && (
              <View style={styles.unsavedIndicator}>
                <View style={styles.unsavedDot} />
                <Text style={styles.unsavedText}>Unsaved changes</Text>
              </View>
            )}
          </View>

          {/* Status */}
          <View style={styles.statusGroup}>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    config?.status === 'published' ? '#D1FAE5' : '#FEF3C7',
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color: config?.status === 'published' ? '#059669' : '#D97706',
                  },
                ]}
              >
                {config?.status === 'published' ? 'Published' : 'Draft'}
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },

  // Top Toolbar
  topToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: TOP_TOOLBAR_HEIGHT,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  toolbarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  pageInfo: {
    marginLeft: 12,
  },
  pageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  pageType: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  toolbarCenter: {
    flex: 1,
    alignItems: 'center',
  },
  previewToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#667eea',
  },
  previewToggleActive: {
    backgroundColor: '#667eea',
  },
  previewToggleText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#667eea',
  },
  previewToggleTextActive: {
    color: '#fff',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'flex-end',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: '#667eea',
  },
  publishButton: {
    backgroundColor: '#D1FAE5',
  },
  actionButtonText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  actionButtonTextDisabled: {
    color: '#9CA3AF',
  },

  // Main Content
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },

  // Left Sidebar
  leftSidebar: {
    width: LEFT_SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    borderRightWidth: 1,
    borderRightColor: '#E5E7EB',
  },
  sidebarTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  paletteScroll: {
    flex: 1,
  },
  paletteItem: {
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  paletteIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  paletteLabel: {
    fontSize: 11,
    color: '#6B7280',
    textAlign: 'center',
  },

  // Canvas
  canvasContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  gridBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  gridCell: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  moduleItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  moduleIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  moduleSize: {
    position: 'absolute',
    top: 8,
    right: 8,
    fontSize: 10,
    color: '#9CA3AF',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hiddenBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    padding: 4,
  },
  selectionBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'solid',
  },
  emptyCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyCanvasText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // Right Sidebar
  rightSidebar: {
    width: RIGHT_SIDEBAR_WIDTH,
    backgroundColor: '#fff',
    borderLeftWidth: 1,
    borderLeftColor: '#E5E7EB',
  },
  propertyScroll: {
    flex: 1,
  },
  emptyPanel: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyPanelText: {
    marginTop: 16,
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
  propertySection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  propertySectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  propertyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  propertyLabel: {
    fontSize: 13,
    color: '#6B7280',
  },
  propertyValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  propertyValueSmall: {
    fontSize: 11,
    color: '#9CA3AF',
    maxWidth: 120,
  },
  visibilityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  visibilityText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeOption: {
    width: '48%',
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sizeOptionSelected: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  sizeOptionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  sizeOptionTextSelected: {
    color: '#fff',
  },
  positionInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  positionItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  positionLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  positionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteButtonText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
    color: '#EF4444',
  },

  // Bottom Bar
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: BOTTOM_BAR_HEIGHT,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  undoRedoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  undoRedoButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
  },
  undoRedoDisabled: {
    backgroundColor: '#F9FAFB',
  },
  bottomInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomInfoText: {
    fontSize: 12,
    color: '#6B7280',
  },
  unsavedIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  unsavedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
    marginRight: 6,
  },
  unsavedText: {
    fontSize: 12,
    color: '#F59E0B',
  },
  statusGroup: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default PageEditor;
