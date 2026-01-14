/**
 * BentoGridEditor - Bento Grid 拖拽编辑组件
 * 支持模块拖拽排序、大小调整、显示/隐藏、配置
 */
import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  Switch,
  Pressable,
} from 'react-native';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Icon } from 'react-native-paper';
import type { HomeModule, HomeModuleType, ModuleConfig } from '../../../../types/decoration';
import { ModulePropsEditor } from './ModulePropsEditor';

// ============================================
// 常量
// ============================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_PADDING = 16;
const GRID_GAP = 12;
const GRID_COLUMNS = 2;
const CELL_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / GRID_COLUMNS;
const CELL_HEIGHT = 100;

// 模块图标映射
const MODULE_ICONS: Record<HomeModuleType, string> = {
  welcome: 'hand-wave',
  ai_insight: 'robot',
  stats_grid: 'chart-box',
  quick_actions: 'lightning-bolt',
  dev_tools: 'tools',
};

// 模块颜色映射
const MODULE_COLORS: Record<HomeModuleType, string> = {
  welcome: '#667eea',
  ai_insight: '#8B5CF6',
  stats_grid: '#10B981',
  quick_actions: '#F59E0B',
  dev_tools: '#6B7280',
};

// 尺寸选项
type SizeOption = { w: 1 | 2; h: 1 | 2; label: string };
const SIZE_OPTIONS: SizeOption[] = [
  { w: 1, h: 1, label: '1x1' },
  { w: 2, h: 1, label: '2x1' },
  { w: 1, h: 2, label: '1x2' },
  { w: 2, h: 2, label: '2x2' },
];

// ============================================
// 类型定义
// ============================================

interface BentoGridEditorProps {
  modules: HomeModule[];
  isEditing: boolean;
  onLayoutChange: (modules: HomeModule[]) => void;
  onModulePress?: (module: HomeModule) => void;
  onModuleConfigChange?: (moduleId: string, config: ModuleConfig) => void;
}

interface BentoGridItemProps {
  module: HomeModule;
  isEditing: boolean;
  isDragging: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  onDoubleTap?: () => void;
  onDragStart?: () => void;
  onDragEnd?: (module: HomeModule, position: { x: number; y: number }) => void;
}

interface ModuleControlPanelProps {
  module: HomeModule | null;
  visible: boolean;
  onClose: () => void;
  onToggleVisibility: (moduleId: string) => void;
  onResize: (moduleId: string, size: { w: 1 | 2; h: 1 | 2 }) => void;
  onConfig?: (moduleId: string) => void;
}

// ============================================
// 辅助函数
// ============================================

/**
 * 计算模块在网格中的位置
 */
function calculateModulePosition(module: HomeModule): { x: number; y: number; width: number; height: number } {
  const x = GRID_PADDING + module.gridPosition.x * (CELL_WIDTH + GRID_GAP);
  const y = module.gridPosition.y * (CELL_HEIGHT + GRID_GAP);
  const width = module.gridSize.w * CELL_WIDTH + (module.gridSize.w - 1) * GRID_GAP;
  const height = module.gridSize.h * CELL_HEIGHT + (module.gridSize.h - 1) * GRID_GAP;
  return { x, y, width, height };
}

/**
 * 根据拖拽位置计算网格坐标
 */
function calculateGridPosition(x: number, y: number): { gridX: number; gridY: number } {
  const gridX = Math.round((x - GRID_PADDING) / (CELL_WIDTH + GRID_GAP));
  const gridY = Math.round(y / (CELL_HEIGHT + GRID_GAP));
  return {
    gridX: Math.max(0, Math.min(gridX, GRID_COLUMNS - 1)),
    gridY: Math.max(0, gridY),
  };
}

/**
 * 重新计算所有模块位置（避免重叠）
 */
function recalculatePositions(modules: HomeModule[]): HomeModule[] {
  const sortedModules = [...modules].sort((a, b) => a.order - b.order);
  const grid: boolean[][] = [];

  const markOccupied = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row++) {
      if (!grid[row]) grid[row] = [];
      const gridRow = grid[row]!;
      for (let col = x; col < x + w; col++) {
        gridRow[col] = true;
      }
    }
  };

  const findNextPosition = (w: number, h: number): { x: number; y: number } => {
    let y = 0;
    while (true) {
      for (let x = 0; x <= GRID_COLUMNS - w; x++) {
        let canPlace = true;
        for (let row = y; row < y + h && canPlace; row++) {
          for (let col = x; col < x + w && canPlace; col++) {
            if (grid[row]?.[col]) canPlace = false;
          }
        }
        if (canPlace) return { x, y };
      }
      y++;
      if (y > 100) break; // 安全限制
    }
    return { x: 0, y };
  };

  return sortedModules.map((module) => {
    if (!module.visible) {
      return module;
    }
    const pos = findNextPosition(module.gridSize.w, module.gridSize.h);
    markOccupied(pos.x, pos.y, module.gridSize.w, module.gridSize.h);
    return {
      ...module,
      gridPosition: pos,
    };
  });
}

// ============================================
// BentoGridItem 组件
// ============================================

function BentoGridItem({
  module,
  isEditing,
  isDragging,
  onPress,
  onLongPress,
  onDoubleTap,
  onDragStart,
  onDragEnd,
}: BentoGridItemProps) {
  const { x, y, width, height } = calculateModulePosition(module);

  // 动画值
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const zIndex = useSharedValue(0);

  // 拖拽手势
  const panGesture = Gesture.Pan()
    .enabled(isEditing && module.visible)
    .onStart(() => {
      scale.value = withSpring(1.05);
      zIndex.value = 100;
      if (onDragStart) {
        runOnJS(onDragStart)();
      }
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      const finalX = x + event.translationX;
      const finalY = y + event.translationY;

      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      scale.value = withSpring(1);
      zIndex.value = 0;

      if (onDragEnd) {
        runOnJS(onDragEnd)(module, { x: finalX, y: finalY });
      }
    });

  // 长按手势
  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onStart(() => {
      if (onLongPress) {
        runOnJS(onLongPress)();
      }
    });

  // 双击手势 (用于打开属性编辑器)
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(300)
    .onStart(() => {
      if (onDoubleTap) {
        runOnJS(onDoubleTap)();
      }
    });

  // 单击手势
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    .onStart(() => {
      if (onPress) {
        runOnJS(onPress)();
      }
    });

  // 组合手势 - 双击优先级高于单击
  const composedGesture = Gesture.Race(
    panGesture,
    Gesture.Exclusive(doubleTapGesture, tapGesture),
    longPressGesture
  );

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    zIndex: zIndex.value,
  }));

  const moduleColor = MODULE_COLORS[module.type];
  const moduleIcon = MODULE_ICONS[module.type];

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        style={[
          styles.gridItem,
          {
            position: 'absolute',
            left: x,
            top: y,
            width,
            height,
            backgroundColor: module.visible ? '#fff' : '#f5f5f5',
            opacity: module.visible ? 1 : 0.5,
            borderWidth: isEditing ? 2 : 0,
            borderColor: isDragging ? moduleColor : '#e0e0e0',
            borderStyle: isEditing ? 'dashed' : 'solid',
          },
          animatedStyle,
        ]}
      >
        {/* 模块图标 */}
        <View style={[styles.itemIconWrapper, { backgroundColor: `${moduleColor}15` }]}>
          <Icon source={moduleIcon} size={24} color={moduleColor} />
        </View>

        {/* 模块名称 */}
        <Text style={styles.itemName} numberOfLines={1}>
          {module.name}
        </Text>

        {/* 尺寸标签 */}
        <View style={styles.sizeLabel}>
          <Text style={styles.sizeLabelText}>
            {module.gridSize.w}x{module.gridSize.h}
          </Text>
        </View>

        {/* 编辑模式指示器 */}
        {isEditing && (
          <>
            {/* 拖拽手柄 */}
            <View style={styles.dragHandle}>
              <Icon source="drag" size={20} color="#9CA3AF" />
            </View>

            {/* 隐藏指示 */}
            {!module.visible && (
              <View style={styles.hiddenOverlay}>
                <Icon source="eye-off" size={28} color="#9CA3AF" />
                <Text style={styles.hiddenText}>已隐藏</Text>
              </View>
            )}

            {/* 调整大小手柄 */}
            <View style={styles.resizeHandle}>
              <Icon source="resize-bottom-right" size={16} color="#9CA3AF" />
            </View>
          </>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// ============================================
// ModuleControlPanel 组件
// ============================================

function ModuleControlPanel({
  module,
  visible,
  onClose,
  onToggleVisibility,
  onResize,
  onConfig,
}: ModuleControlPanelProps) {
  if (!module) return null;

  const moduleColor = MODULE_COLORS[module.type];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.controlPanel} onPress={(e) => e.stopPropagation()}>
          {/* 面板头部 */}
          <View style={styles.panelHeader}>
            <View style={styles.panelHeaderLeft}>
              <View style={[styles.panelIconWrapper, { backgroundColor: `${moduleColor}15` }]}>
                <Icon source={MODULE_ICONS[module.type]} size={24} color={moduleColor} />
              </View>
              <Text style={styles.panelTitle}>{module.name}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon source="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* 分割线 */}
          <View style={styles.divider} />

          {/* 显示/隐藏开关 */}
          <View style={styles.controlRow}>
            <View style={styles.controlLabel}>
              <Icon source="eye" size={20} color="#6B7280" />
              <Text style={styles.controlText}>显示模块</Text>
            </View>
            <Switch
              value={module.visible}
              onValueChange={() => onToggleVisibility(module.id)}
              trackColor={{ false: '#E5E7EB', true: `${moduleColor}50` }}
              thumbColor={module.visible ? moduleColor : '#9CA3AF'}
            />
          </View>

          {/* 分割线 */}
          <View style={styles.divider} />

          {/* 尺寸选择 */}
          <View style={styles.sizeSection}>
            <View style={styles.controlLabel}>
              <Icon source="resize" size={20} color="#6B7280" />
              <Text style={styles.controlText}>模块大小</Text>
            </View>
            <View style={styles.sizeOptions}>
              {SIZE_OPTIONS.map((option) => {
                const isSelected =
                  module.gridSize.w === option.w && module.gridSize.h === option.h;
                return (
                  <TouchableOpacity
                    key={option.label}
                    style={[
                      styles.sizeOption,
                      isSelected && { backgroundColor: moduleColor, borderColor: moduleColor },
                    ]}
                    onPress={() => onResize(module.id, { w: option.w, h: option.h })}
                  >
                    {/* 尺寸可视化 */}
                    <View style={styles.sizePreview}>
                      {Array.from({ length: option.h }).map((_, rowIdx) => (
                        <View key={rowIdx} style={styles.sizePreviewRow}>
                          {Array.from({ length: option.w }).map((_, colIdx) => (
                            <View
                              key={colIdx}
                              style={[
                                styles.sizePreviewCell,
                                isSelected && { backgroundColor: '#fff' },
                              ]}
                            />
                          ))}
                        </View>
                      ))}
                    </View>
                    <Text
                      style={[styles.sizeOptionText, isSelected && { color: '#fff' }]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* 分割线 */}
          <View style={styles.divider} />

          {/* 配置按钮 */}
          {onConfig && (
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => onConfig(module.id)}
            >
              <Icon source="cog" size={20} color={moduleColor} />
              <Text style={[styles.configButtonText, { color: moduleColor }]}>
                模块配置
              </Text>
              <Icon source="chevron-right" size={20} color={moduleColor} />
            </TouchableOpacity>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ============================================
// BentoGridEditor 主组件
// ============================================

export function BentoGridEditor({
  modules,
  isEditing,
  onLayoutChange,
  onModulePress,
  onModuleConfigChange,
}: BentoGridEditorProps) {
  const [selectedModule, setSelectedModule] = useState<HomeModule | null>(null);
  const [showControlPanel, setShowControlPanel] = useState(false);
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);

  // 属性编辑器状态
  const [showPropsEditor, setShowPropsEditor] = useState(false);
  const [moduleForProps, setModuleForProps] = useState<HomeModule | null>(null);

  // 排序后的模块列表
  const sortedModules = useMemo(() => {
    return [...modules].sort((a, b) => a.order - b.order);
  }, [modules]);

  // 计算容器高度
  const containerHeight = useMemo(() => {
    let maxY = 0;
    sortedModules.forEach((module) => {
      if (module.visible) {
        const bottom = module.gridPosition.y + module.gridSize.h;
        if (bottom > maxY) maxY = bottom;
      }
    });
    return maxY * (CELL_HEIGHT + GRID_GAP) + GRID_PADDING;
  }, [sortedModules]);

  // 处理模块点击
  const handleModulePress = useCallback(
    (module: HomeModule) => {
      if (isEditing) {
        setSelectedModule(module);
        setShowControlPanel(true);
      } else if (onModulePress) {
        onModulePress(module);
      }
    },
    [isEditing, onModulePress]
  );

  // 处理长按
  const handleModuleLongPress = useCallback(
    (module: HomeModule) => {
      if (isEditing) {
        setSelectedModule(module);
        setShowControlPanel(true);
      }
    },
    [isEditing]
  );

  // 处理拖拽开始
  const handleDragStart = useCallback((moduleId: string) => {
    setDraggingModuleId(moduleId);
  }, []);

  // 处理拖拽结束
  const handleDragEnd = useCallback(
    (module: HomeModule, position: { x: number; y: number }) => {
      setDraggingModuleId(null);

      const { gridX, gridY } = calculateGridPosition(position.x, position.y);

      // 更新模块位置
      const updatedModules = modules.map((m) => {
        if (m.id === module.id) {
          return {
            ...m,
            gridPosition: { x: gridX, y: gridY },
          };
        }
        return m;
      });

      // 重新计算位置避免重叠
      const recalculated = recalculatePositions(updatedModules);
      onLayoutChange(recalculated);
    },
    [modules, onLayoutChange]
  );

  // 处理显示/隐藏切换
  const handleToggleVisibility = useCallback(
    (moduleId: string) => {
      const updatedModules = modules.map((m) => {
        if (m.id === moduleId) {
          return { ...m, visible: !m.visible };
        }
        return m;
      });

      const recalculated = recalculatePositions(updatedModules);
      onLayoutChange(recalculated);
    },
    [modules, onLayoutChange]
  );

  // 处理调整大小
  const handleResize = useCallback(
    (moduleId: string, size: { w: 1 | 2; h: 1 | 2 }) => {
      const updatedModules = modules.map((m) => {
        if (m.id === moduleId) {
          // 如果宽度为2但当前位置在第二列，调整到第一列
          let newX = m.gridPosition.x;
          if (size.w === 2 && newX > 0) {
            newX = 0;
          }
          return {
            ...m,
            gridSize: size,
            gridPosition: { ...m.gridPosition, x: newX },
          };
        }
        return m;
      });

      const recalculated = recalculatePositions(updatedModules);
      onLayoutChange(recalculated);

      // 更新选中模块状态
      const updatedModule = recalculated.find((m) => m.id === moduleId);
      if (updatedModule) {
        setSelectedModule(updatedModule);
      }
    },
    [modules, onLayoutChange]
  );

  // 关闭控制面板
  const handleClosePanel = useCallback(() => {
    setShowControlPanel(false);
    setSelectedModule(null);
  }, []);

  // 处理双击 - 打开属性编辑器
  const handleModuleDoubleTap = useCallback(
    (module: HomeModule) => {
      if (isEditing) {
        setModuleForProps(module);
        setShowPropsEditor(true);
        // 如果控制面板开着，先关闭它
        setShowControlPanel(false);
        setSelectedModule(null);
      }
    },
    [isEditing]
  );

  // 处理从控制面板打开配置
  const handleOpenConfig = useCallback(
    (moduleId: string) => {
      const module = modules.find((m) => m.id === moduleId);
      if (module) {
        setModuleForProps(module);
        setShowPropsEditor(true);
        setShowControlPanel(false);
        setSelectedModule(null);
      }
    },
    [modules]
  );

  // 处理属性保存
  const handlePropsSave = useCallback(
    (moduleId: string, config: ModuleConfig) => {
      // 更新模块配置
      const updatedModules = modules.map((m) => {
        if (m.id === moduleId) {
          return { ...m, config };
        }
        return m;
      });
      onLayoutChange(updatedModules);

      // 通知外部配置变更
      if (onModuleConfigChange) {
        onModuleConfigChange(moduleId, config);
      }

      // 更新本地状态中的 moduleForProps
      setModuleForProps((prev) => (prev ? { ...prev, config } : null));
    },
    [modules, onLayoutChange, onModuleConfigChange]
  );

  // 关闭属性编辑器
  const handleClosePropsEditor = useCallback(() => {
    setShowPropsEditor(false);
    setModuleForProps(null);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { minHeight: containerHeight }]}>
        {/* 网格背景 (编辑模式) */}
        {isEditing && (
          <View style={styles.gridBackground}>
            {Array.from({ length: Math.ceil(containerHeight / (CELL_HEIGHT + GRID_GAP)) }).map(
              (_, rowIdx) =>
                Array.from({ length: GRID_COLUMNS }).map((_, colIdx) => (
                  <View
                    key={`${rowIdx}-${colIdx}`}
                    style={[
                      styles.gridCell,
                      {
                        left: GRID_PADDING + colIdx * (CELL_WIDTH + GRID_GAP),
                        top: rowIdx * (CELL_HEIGHT + GRID_GAP),
                        width: CELL_WIDTH,
                        height: CELL_HEIGHT,
                      },
                    ]}
                  />
                ))
            )}
          </View>
        )}

        {/* 模块列表 */}
        {sortedModules.map((module) => (
          <BentoGridItem
            key={module.id}
            module={module}
            isEditing={isEditing}
            isDragging={draggingModuleId === module.id}
            onPress={() => handleModulePress(module)}
            onLongPress={() => handleModuleLongPress(module)}
            onDoubleTap={() => handleModuleDoubleTap(module)}
            onDragStart={() => handleDragStart(module.id)}
            onDragEnd={handleDragEnd}
          />
        ))}

        {/* 控制面板 */}
        <ModuleControlPanel
          module={selectedModule}
          visible={showControlPanel}
          onClose={handleClosePanel}
          onToggleVisibility={handleToggleVisibility}
          onResize={handleResize}
          onConfig={handleOpenConfig}
        />

        {/* 属性编辑器 */}
        <ModulePropsEditor
          visible={showPropsEditor}
          module={moduleForProps}
          onSave={handlePropsSave}
          onClose={handleClosePropsEditor}
        />
      </View>
    </GestureHandlerRootView>
  );
}

// ============================================
// 样式
// ============================================

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: '100%',
  },

  // 网格背景
  gridBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  gridCell: {
    position: 'absolute',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },

  // 网格项
  gridItem: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  sizeLabel: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sizeLabelText: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },

  // 编辑模式元素
  dragHandle: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hiddenText: {
    marginTop: 4,
    fontSize: 12,
    color: '#9CA3AF',
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  controlPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
  },

  // 面板头部
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  panelHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  panelIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 分割线
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
  },

  // 控制行
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  controlLabel: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },

  // 尺寸选择
  sizeSection: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  sizeOptions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  sizeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  sizePreview: {
    marginBottom: 8,
  },
  sizePreviewRow: {
    flexDirection: 'row',
    gap: 2,
  },
  sizePreviewCell: {
    width: 12,
    height: 12,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    margin: 1,
  },
  sizeOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  // 配置按钮
  configButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  configButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 12,
  },
});

export default BentoGridEditor;
