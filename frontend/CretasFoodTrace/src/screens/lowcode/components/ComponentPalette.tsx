/**
 * ComponentPalette - Lowcode Page Editor Component Palette
 *
 * Displays a categorized list of available components that can be added to a page.
 * Features:
 * - Search/filter functionality
 * - Categorized component list
 * - Permission-based filtering
 * - Tap to add component to canvas
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Text, Icon } from 'react-native-paper';
import { useComponentPermissions } from '../../../store/roleThemeStore';
import { theme } from '../../../theme';

// ============================================
// Type Definitions
// ============================================

/**
 * Page types for filtering components
 */
export type PageType =
  | 'home'           // Home page
  | 'dashboard'      // Dashboard page
  | 'list'           // List/table page
  | 'detail'         // Detail page
  | 'form'           // Form page
  | 'report';        // Report page

/**
 * Component category types
 */
export type ComponentCategory =
  | 'stats'          // Statistics components
  | 'navigation'     // Navigation components
  | 'data'           // Data display components
  | 'chart'          // Chart components
  | 'form'           // Form components
  | 'layout';        // Layout components

/**
 * Available component definition
 */
export interface AvailableComponent {
  type: string;
  name: string;
  description: string;
  icon: string;
  category: ComponentCategory;
  applicablePageTypes: PageType[];
  defaultConfig?: Record<string, unknown>;
}

/**
 * ComponentPalette props interface
 */
export interface ComponentPaletteProps {
  pageType: PageType;
  onSelectComponent: (componentType: string) => void;
}

// ============================================
// Component Catalog
// ============================================

/**
 * Hardcoded available components array
 * Will be loaded from API in future implementation
 */
export const AVAILABLE_COMPONENTS: AvailableComponent[] = [
  // Stats Category
  {
    type: 'stats_card',
    name: '统计卡片',
    description: '展示单个关键指标的统计卡片',
    icon: 'chart-box-outline',
    category: 'stats',
    applicablePageTypes: ['home', 'dashboard', 'report'],
    defaultConfig: {
      title: '统计指标',
      value: 0,
      unit: '',
      trend: null,
      color: '#1890FF',
    },
  },
  {
    type: 'ai_insight',
    name: 'AI 洞察',
    description: 'AI 驱动的数据分析洞察卡片',
    icon: 'brain',
    category: 'stats',
    applicablePageTypes: ['home', 'dashboard'],
    defaultConfig: {
      showMetrics: true,
      autoRefresh: true,
      refreshInterval: 300,
    },
  },

  // Navigation Category
  {
    type: 'welcome_card',
    name: '欢迎卡片',
    description: '用户欢迎信息和问候语展示',
    icon: 'hand-wave-outline',
    category: 'navigation',
    applicablePageTypes: ['home'],
    defaultConfig: {
      showGreeting: true,
      showDate: true,
      showWeather: false,
    },
  },
  {
    type: 'quick_actions',
    name: '快捷操作',
    description: '常用功能快捷入口按钮组',
    icon: 'lightning-bolt-outline',
    category: 'navigation',
    applicablePageTypes: ['home', 'dashboard'],
    defaultConfig: {
      maxItems: 4,
      layout: 'grid',
      actions: [],
    },
  },

  // Data Category
  {
    type: 'data_table',
    name: '数据表格',
    description: '支持分页、排序的数据表格组件',
    icon: 'table',
    category: 'data',
    applicablePageTypes: ['list', 'dashboard', 'report'],
    defaultConfig: {
      columns: [],
      pageSize: 10,
      sortable: true,
      filterable: true,
    },
  },
  {
    type: 'data_list',
    name: '数据列表',
    description: '垂直滚动的数据列表展示',
    icon: 'format-list-bulleted',
    category: 'data',
    applicablePageTypes: ['list', 'detail'],
    defaultConfig: {
      itemLayout: 'card',
      showAvatar: false,
    },
  },

  // Chart Category
  {
    type: 'chart_bar',
    name: '柱状图',
    description: '柱状图数据可视化组件',
    icon: 'chart-bar',
    category: 'chart',
    applicablePageTypes: ['dashboard', 'report'],
    defaultConfig: {
      horizontal: false,
      showLegend: true,
      showGrid: true,
    },
  },
  {
    type: 'chart_line',
    name: '折线图',
    description: '折线图趋势数据可视化组件',
    icon: 'chart-line',
    category: 'chart',
    applicablePageTypes: ['dashboard', 'report'],
    defaultConfig: {
      showArea: false,
      showPoints: true,
      smooth: true,
    },
  },
  {
    type: 'chart_pie',
    name: '饼图',
    description: '饼图占比数据可视化组件',
    icon: 'chart-pie',
    category: 'chart',
    applicablePageTypes: ['dashboard', 'report'],
    defaultConfig: {
      showLegend: true,
      showLabels: true,
      donut: false,
    },
  },

  // Form Category
  {
    type: 'form_input',
    name: '输入框',
    description: '文本输入框组件',
    icon: 'form-textbox',
    category: 'form',
    applicablePageTypes: ['form', 'detail'],
    defaultConfig: {
      label: '输入框',
      placeholder: '请输入...',
      required: false,
    },
  },
  {
    type: 'form_select',
    name: '下拉选择',
    description: '下拉选择框组件',
    icon: 'form-dropdown',
    category: 'form',
    applicablePageTypes: ['form', 'detail'],
    defaultConfig: {
      label: '选择',
      options: [],
      multiple: false,
    },
  },
  {
    type: 'form_date',
    name: '日期选择',
    description: '日期时间选择器组件',
    icon: 'calendar',
    category: 'form',
    applicablePageTypes: ['form', 'detail'],
    defaultConfig: {
      label: '日期',
      showTime: false,
      format: 'YYYY-MM-DD',
    },
  },

  // Layout Category
  {
    type: 'layout_grid',
    name: '网格布局',
    description: '响应式网格布局容器',
    icon: 'view-grid-outline',
    category: 'layout',
    applicablePageTypes: ['home', 'dashboard', 'list', 'detail', 'form', 'report'],
    defaultConfig: {
      columns: 2,
      gap: 16,
    },
  },
  {
    type: 'layout_card',
    name: '卡片容器',
    description: '带标题的卡片容器组件',
    icon: 'card-outline',
    category: 'layout',
    applicablePageTypes: ['home', 'dashboard', 'detail', 'report'],
    defaultConfig: {
      title: '卡片标题',
      showHeader: true,
      padding: 16,
    },
  },
  {
    type: 'layout_divider',
    name: '分割线',
    description: '内容分割线组件',
    icon: 'minus',
    category: 'layout',
    applicablePageTypes: ['home', 'dashboard', 'list', 'detail', 'form', 'report'],
    defaultConfig: {
      style: 'solid',
      margin: 16,
    },
  },
];

/**
 * Category display configuration
 */
const CATEGORY_CONFIG: Record<ComponentCategory, { label: string; icon: string; color: string }> = {
  stats: {
    label: '统计组件',
    icon: 'chart-box-outline',
    color: '#1890FF',
  },
  navigation: {
    label: '导航组件',
    icon: 'compass-outline',
    color: '#52C41A',
  },
  data: {
    label: '数据组件',
    icon: 'database-outline',
    color: '#722ED1',
  },
  chart: {
    label: '图表组件',
    icon: 'chart-areaspline',
    color: '#FA8C16',
  },
  form: {
    label: '表单组件',
    icon: 'form-select',
    color: '#13C2C2',
  },
  layout: {
    label: '布局组件',
    icon: 'view-dashboard-outline',
    color: '#EB2F96',
  },
};

/**
 * Category order for display
 */
const CATEGORY_ORDER: ComponentCategory[] = [
  'stats',
  'navigation',
  'data',
  'chart',
  'form',
  'layout',
];

// ============================================
// Component Implementation
// ============================================

/**
 * ComponentPalette Component
 *
 * Displays available components grouped by category with search functionality.
 */
export function ComponentPalette({ pageType, onSelectComponent }: ComponentPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<ComponentCategory>>(
    new Set(CATEGORY_ORDER)
  );

  const { canUseComponent } = useComponentPermissions();

  /**
   * Filter components based on page type, search query, and permissions
   */
  const filteredComponents = useMemo(() => {
    return AVAILABLE_COMPONENTS.filter((component) => {
      // Filter by page type
      if (!component.applicablePageTypes.includes(pageType)) {
        return false;
      }

      // Filter by permission
      if (!canUseComponent(component.type)) {
        return false;
      }

      // Filter by search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        return (
          component.name.toLowerCase().includes(query) ||
          component.description.toLowerCase().includes(query) ||
          component.type.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [pageType, searchQuery, canUseComponent]);

  /**
   * Group filtered components by category
   */
  const groupedComponents = useMemo(() => {
    const groups = new Map<ComponentCategory, AvailableComponent[]>();

    for (const category of CATEGORY_ORDER) {
      const categoryComponents = filteredComponents.filter(
        (c) => c.category === category
      );
      if (categoryComponents.length > 0) {
        groups.set(category, categoryComponents);
      }
    }

    return groups;
  }, [filteredComponents]);

  /**
   * Toggle category expansion
   */
  const toggleCategory = useCallback((category: ComponentCategory) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  /**
   * Handle component selection
   */
  const handleSelectComponent = useCallback(
    (componentType: string) => {
      onSelectComponent(componentType);
    },
    [onSelectComponent]
  );

  /**
   * Clear search query
   */
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Icon source="magnify" size={20} color={theme.colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索组件..."
            placeholderTextColor={theme.colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
              <Icon source="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Component List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {groupedComponents.size === 0 ? (
          <View style={styles.emptyState}>
            <Icon source="package-variant" size={48} color={theme.colors.textTertiary} />
            <Text style={styles.emptyStateText}>
              {searchQuery ? '未找到匹配的组件' : '没有可用的组件'}
            </Text>
          </View>
        ) : (
          Array.from(groupedComponents.entries()).map(([category, components]) => (
            <View key={category} style={styles.categorySection}>
              {/* Category Header */}
              <TouchableOpacity
                style={styles.categoryHeader}
                onPress={() => toggleCategory(category)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryHeaderLeft}>
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: `${CATEGORY_CONFIG[category].color}15` },
                    ]}
                  >
                    <Icon
                      source={CATEGORY_CONFIG[category].icon}
                      size={18}
                      color={CATEGORY_CONFIG[category].color}
                    />
                  </View>
                  <Text style={styles.categoryLabel}>
                    {CATEGORY_CONFIG[category].label}
                  </Text>
                  <View style={styles.categoryCount}>
                    <Text style={styles.categoryCountText}>{components.length}</Text>
                  </View>
                </View>
                <Icon
                  source={expandedCategories.has(category) ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>

              {/* Category Components */}
              {expandedCategories.has(category) && (
                <View style={styles.componentList}>
                  {components.map((component) => (
                    <ComponentItem
                      key={component.type}
                      component={component}
                      onSelect={handleSelectComponent}
                    />
                  ))}
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

// ============================================
// Sub-components
// ============================================

interface ComponentItemProps {
  component: AvailableComponent;
  onSelect: (componentType: string) => void;
}

/**
 * Individual component item in the palette
 */
function ComponentItem({ component, onSelect }: ComponentItemProps) {
  const categoryConfig = CATEGORY_CONFIG[component.category];

  return (
    <TouchableOpacity
      style={styles.componentItem}
      onPress={() => onSelect(component.type)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.componentIcon,
          { backgroundColor: `${categoryConfig.color}10` },
        ]}
      >
        <Icon source={component.icon} size={24} color={categoryConfig.color} />
      </View>
      <View style={styles.componentInfo}>
        <Text style={styles.componentName}>{component.name}</Text>
        <Text style={styles.componentDescription} numberOfLines={1}>
          {component.description}
        </Text>
      </View>
      <View style={styles.addButton}>
        <Icon source="plus" size={20} color={theme.colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

// ============================================
// Styles
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.s,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: theme.colors.text,
  },
  clearButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  categorySection: {
    marginTop: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.surface,
  },
  categoryHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.custom.borderRadius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    marginLeft: 12,
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text,
  },
  categoryCount: {
    marginLeft: 8,
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  categoryCountText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  componentList: {
    paddingHorizontal: 16,
  },
  componentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.custom.borderRadius.m,
    padding: 12,
    marginBottom: 8,
  },
  componentIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.custom.borderRadius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  componentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  componentName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
  },
  componentDescription: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: theme.custom.borderRadius.round,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});

export default ComponentPalette;
