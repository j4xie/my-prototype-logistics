# TASK-RN-009: 基础组件库

> React Native Android开发 - 基础组件库实现任务
>
> 创建时间: 2025-08-05
> 预计工期: 1天 (8小时)
> 优先级: 中
> 状态: 待开始

## 📋 任务概述

基于Material Design 3设计系统，建立完整的基础UI组件库，包括认证相关组件、表格组件、文件上传组件等，为所有业务模块提供统一、美观、可复用的UI基础。

## 🎯 任务目标

- 建立基于Material Design 3的基础UI组件库
- 创建认证相关的专用组件（PermissionPicker, RoleSelector等）
- 实现支持大数据量的表格组件
- 开发文件上传和Excel处理组件
- 确保组件的一致性、可复用性和可访问性

## 📋 详细步骤

### **上午: 基础UI组件和设计系统** (4小时)

#### 1.1 设计系统和主题配置 (2小时)

**1.1.1 Material Design 3主题**
```tsx
// src/theme/theme.ts
import { MD3LightTheme, MD3DarkTheme, configureFonts } from 'react-native-paper';

// 自定义颜色调色板
const lightColors = {
  primary: '#1976D2',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E3F2FD',
  onPrimaryContainer: '#0D47A1',
  
  secondary: '#4CAF50',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#E8F5E8',
  onSecondaryContainer: '#2E7D32',
  
  tertiary: '#FF9800',
  onTertiary: '#FFFFFF',
  tertiaryContainer: '#FFF3E0',
  onTertiaryContainer: '#E65100',
  
  error: '#F44336',
  onError: '#FFFFFF',
  errorContainer: '#FFEBEE',
  onErrorContainer: '#C62828',
  
  warning: '#FF9800',
  onWarning: '#FFFFFF',
  warningContainer: '#FFF3E0',
  onWarningContainer: '#E65100',
  
  success: '#4CAF50',
  onSuccess: '#FFFFFF',
  successContainer: '#E8F5E8',
  onSuccessContainer: '#2E7D32',
  
  background: '#FAFAFA',
  onBackground: '#1A1A1A',
  surface: '#FFFFFF',
  onSurface: '#1A1A1A',
  surfaceVariant: '#F5F5F5',
  onSurfaceVariant: '#424242',
  
  outline: '#E0E0E0',
  outlineVariant: '#F0F0F0',
  
  shadow: '#000000',
  scrim: '#000000',
  
  // 自定义语义化颜色
  info: '#2196F3',
  onInfo: '#FFFFFF',
  infoContainer: '#E3F2FD',
  onInfoContainer: '#0D47A1',
};

const darkColors = {
  primary: '#90CAF9',
  onPrimary: '#0D47A1',
  primaryContainer: '#1565C0',
  onPrimaryContainer: '#E3F2FD',
  
  secondary: '#81C784',
  onSecondary: '#2E7D32',
  secondaryContainer: '#388E3C',
  onSecondaryContainer: '#E8F5E8',
  
  tertiary: '#FFB74D',
  onTertiary: '#E65100',
  tertiaryContainer: '#F57C00',
  onTertiaryContainer: '#FFF3E0',
  
  error: '#EF5350',
  onError: '#C62828',
  errorContainer: '#D32F2F',
  onErrorContainer: '#FFEBEE',
  
  warning: '#FFB74D',
  onWarning: '#E65100',
  warningContainer: '#F57C00',
  onWarningContainer: '#FFF3E0',
  
  success: '#81C784',
  onSuccess: '#2E7D32',
  successContainer: '#388E3C',
  onSuccessContainer: '#E8F5E8',
  
  background: '#121212',
  onBackground: '#FFFFFF',
  surface: '#1E1E1E',
  onSurface: '#FFFFFF',
  surfaceVariant: '#2A2A2A',
  onSurfaceVariant: '#CCCCCC',
  
  outline: '#424242',
  outlineVariant: '#333333',
  
  shadow: '#000000',
  scrim: '#000000',
  
  info: '#64B5F6',
  onInfo: '#0D47A1',
  infoContainer: '#1976D2',
  onInfoContainer: '#E3F2FD',
};

// 字体配置
const fontConfig = {
  web: {
    regular: {
      fontFamily: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'Roboto, "Helvetica Neue", Helvetica, Arial, sans-serif',
      fontWeight: '100',
    },
  },
  ios: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'System',
      fontWeight: '100',
    },
  },
  android: {
    regular: {
      fontFamily: 'Roboto',
      fontWeight: 'normal',
    },
    medium: {
      fontFamily: 'Roboto',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'Roboto',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'Roboto',
      fontWeight: '100',
    },
  },
};

export const lightTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...lightColors,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 8,
  animation: {
    scale: 1.0,
  },
};

export const darkTheme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    ...darkColors,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 8,
  animation: {
    scale: 1.0,
  },
};

// 主题类型定义
export type AppTheme = typeof lightTheme;

// 主题工具函数
export const getThemeColor = (theme: AppTheme, colorName: keyof typeof lightColors) => {
  return theme.colors[colorName] || theme.colors.primary;
};

export const getContrastColor = (theme: AppTheme, backgroundColor: string) => {
  // 简单的对比度计算，实际项目中可能需要更复杂的算法
  const isLight = backgroundColor.includes('#F') || backgroundColor.includes('#f');
  return isLight ? theme.colors.onSurface : theme.colors.surface;
};
```

**1.1.2 通用样式常量**
```tsx
// src/theme/styles.ts
import { StyleSheet } from 'react-native';
import { AppTheme } from './theme';

export const createStyles = (theme: AppTheme) => StyleSheet.create({
  // 通用容器样式
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  
  safeContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingTop: 44, // 状态栏高度
  },
  
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // 卡片样式
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    marginVertical: 4,
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  elevatedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    marginVertical: 8,
    marginHorizontal: 16,
    elevation: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  
  // 文本样式
  heading1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 16,
  },
  
  heading2: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 12,
  },
  
  heading3: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  
  bodyLarge: {
    fontSize: 16,
    color: theme.colors.onSurface,
    lineHeight: 24,
  },
  
  bodyMedium: {
    fontSize: 14,
    color: theme.colors.onSurface,
    lineHeight: 20,
  },
  
  bodySmall: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 16,
  },
  
  caption: {
    fontSize: 10,
    color: theme.colors.onSurfaceVariant,
    lineHeight: 14,
  },
  
  // 按钮样式
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.roundness,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 2,
  },
  
  secondaryButton: {
    backgroundColor: theme.colors.secondary,
    borderRadius: theme.roundness,
    paddingVertical: 12,
    paddingHorizontal: 24,
    elevation: 2,
  },
  
  outlinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: theme.roundness,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  
  // 输入框样式
  input: {
    marginBottom: 16,
  },
  
  inputError: {
    marginBottom: 16,
    borderColor: theme.colors.error,
  },
  
  // 分割线
  divider: {
    height: 1,
    backgroundColor: theme.colors.outline,
    marginVertical: 8,
  },
  
  // 间距
  spacingXS: { margin: 4 },
  spacingS: { margin: 8 },
  spacingM: { margin: 16 },
  spacingL: { margin: 24 },
  spacingXL: { margin: 32 },
  
  paddingXS: { padding: 4 },
  paddingS: { padding: 8 },
  paddingM: { padding: 16 },
  paddingL: { padding: 24 },
  paddingXL: { padding: 32 },
  
  // 边框半径
  radiusS: { borderRadius: 4 },
  radiusM: { borderRadius: theme.roundness },
  radiusL: { borderRadius: 16 },
  radiusXL: { borderRadius: 24 },
  
  // 阴影
  shadowLight: {
    elevation: 1,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
  },
  
  shadowMedium: {
    elevation: 2,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  shadowHeavy: {
    elevation: 4,
    shadowColor: theme.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
});

// 响应式断点
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
};

// 获取响应式值
export const getResponsiveValue = (width: number, values: { mobile: any; tablet?: any; desktop?: any }) => {
  if (width >= breakpoints.desktop && values.desktop !== undefined) {
    return values.desktop;
  }
  if (width >= breakpoints.tablet && values.tablet !== undefined) {
    return values.tablet;
  }
  return values.mobile;
};
```

#### 1.2 基础UI组件 (2小时)

**1.2.1 增强按钮组件**
```tsx
// src/components/ui/Button.tsx
import React from 'react';
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Button as PaperButton, ActivityIndicator, useTheme } from 'react-native-paper';
import { AppTheme } from '@/theme/theme';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'filled' | 'outlined' | 'text' | 'elevated';
  size?: 'small' | 'medium' | 'large';
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onPress,
  variant = 'filled',
  size = 'medium',
  color = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  testID,
}) => {
  const theme = useTheme() as AppTheme;
  const styles = createButtonStyles(theme);

  const getButtonMode = () => {
    switch (variant) {
      case 'outlined':
        return 'outlined';
      case 'text':
        return 'text';
      case 'elevated':
        return 'elevated';
      case 'filled':
      default:
        return 'contained';
    }
  };

  const getButtonColor = () => {
    const colorMap = {
      primary: theme.colors.primary,
      secondary: theme.colors.secondary,
      success: theme.colors.success,
      warning: theme.colors.warning,
      error: theme.colors.error,
      info: theme.colors.info,
    };
    return colorMap[color];
  };

  const getSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallButton;
      case 'large':
        return styles.largeButton;
      case 'medium':
      default:
        return styles.mediumButton;
    }
  };

  const getTextSizeStyle = () => {
    switch (size) {
      case 'small':
        return styles.smallText;
      case 'large':
        return styles.largeText;
      case 'medium':
      default:
        return styles.mediumText;
    }
  };

  return (
    <PaperButton
      mode={getButtonMode()}
      onPress={onPress}
      disabled={disabled || loading}
      loading={loading}
      icon={loading ? undefined : icon}
      style={[
        getSizeStyle(),
        fullWidth && styles.fullWidth,
        style,
      ]}
      labelStyle={[
        getTextSizeStyle(),
        textStyle,
      ]}
      buttonColor={getButtonColor()}
      testID={testID}
    >
      {loading ? <ActivityIndicator size="small" color={theme.colors.onPrimary} /> : children}
    </PaperButton>
  );
};

const createButtonStyles = (theme: AppTheme) => StyleSheet.create({
  smallButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    minHeight: 32,
  },
  mediumButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    minHeight: 40,
  },
  largeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  smallText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mediumText: {
    fontSize: 14,
    fontWeight: '500',
  },
  largeText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
```

**1.2.2 增强卡片组件**
```tsx
// src/components/ui/Card.tsx
import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { Card as PaperCard, Text, useTheme, Surface } from 'react-native-paper';
import { AppTheme } from '@/theme/theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  variant?: 'elevated' | 'filled' | 'outlined';
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  headerStyle?: ViewStyle;
  elevation?: number;
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  variant = 'elevated',
  onPress,
  onLongPress,
  style,
  contentStyle,
  headerStyle,
  elevation,
  testID,
}) => {
  const theme = useTheme() as AppTheme;
  const styles = createCardStyles(theme);

  const getCardVariantStyle = () => {
    switch (variant) {
      case 'filled':
        return styles.filledCard;
      case 'outlined':
        return styles.outlinedCard;
      case 'elevated':
      default:
        return styles.elevatedCard;
    }
  };

  const CardWrapper = onPress || onLongPress ? Pressable : View;

  return (
    <Surface 
      style={[
        getCardVariantStyle(),
        style,
      ]}
      elevation={elevation || (variant === 'elevated' ? 2 : 0)}
    >
      <CardWrapper
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.cardContainer}
        testID={testID}
      >
        {(title || subtitle) && (
          <View style={[styles.header, headerStyle]}>
            {title && <Text variant="titleMedium" style={styles.title}>{title}</Text>}
            {subtitle && <Text variant="bodyMedium" style={styles.subtitle}>{subtitle}</Text>}
          </View>
        )}
        
        <View style={[styles.content, contentStyle]}>
          {children}
        </View>
      </CardWrapper>
    </Surface>
  );
};

const createCardStyles = (theme: AppTheme) => StyleSheet.create({
  elevatedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    margin: 8,
  },
  filledCard: {
    backgroundColor: theme.colors.surfaceVariant,
    borderRadius: theme.roundness,
    margin: 8,
  },
  outlinedCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.roundness,
    borderWidth: 1,
    borderColor: theme.colors.outline,
    margin: 8,
  },
  cardContainer: {
    borderRadius: theme.roundness,
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    color: theme.colors.onSurface,
    marginBottom: 4,
  },
  subtitle: {
    color: theme.colors.onSurfaceVariant,
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
});
```

### **下午: 专业组件和高级功能** (4小时)

#### 2.1 数据表格组件 (2小时)

**2.1.1 高性能数据表格**
```tsx
// src/components/ui/DataTable.tsx
import React, { useState, useMemo, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { 
  DataTable as PaperDataTable, 
  Text, 
  Checkbox, 
  IconButton, 
  Menu,
  Searchbar,
  useTheme 
} from 'react-native-paper';
import { FlashList } from '@shopify/flash-list';
import { AppTheme } from '@/theme/theme';

export interface Column<T = any> {
  key: string;
  title: string;
  width?: number | string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T = any> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  selectable?: boolean;
  selectedRows?: Set<string>;
  onRowSelect?: (rowKey: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string, order: 'asc' | 'desc') => void;
  searchable?: boolean;
  searchValue?: string;
  onSearch?: (value: string) => void;
  onRowPress?: (row: T, index: number) => void;
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
  };
  style?: any;
}

export function DataTable<T = any>({
  data,
  columns,
  loading = false,
  selectable = false,
  selectedRows = new Set(),
  onRowSelect,
  onSelectAll,
  sortBy,
  sortOrder,
  onSort,
  searchable = false,
  searchValue = '',
  onSearch,
  onRowPress,
  getRowKey,
  emptyMessage = '暂无数据',
  pagination,
  style,
}: DataTableProps<T>): React.ReactElement {
  const theme = useTheme() as AppTheme;
  const styles = createDataTableStyles(theme);

  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  // 处理排序
  const handleSort = useCallback((columnKey: string) => {
    if (!onSort) return;
    
    const newOrder = sortBy === columnKey && sortOrder === 'asc' ? 'desc' : 'asc';
    onSort(columnKey, newOrder);
  }, [sortBy, sortOrder, onSort]);

  // 处理全选
  const handleSelectAll = useCallback(() => {
    if (!onSelectAll) return;
    
    const allSelected = selectedRows.size === data.length;
    onSelectAll(!allSelected);
  }, [selectedRows.size, data.length, onSelectAll]);

  // 渲染表头
  const renderHeader = () => (
    <PaperDataTable.Header style={styles.header}>
      {selectable && (
        <PaperDataTable.Title style={styles.checkboxColumn}>
          <Checkbox
            status={
              selectedRows.size === 0 
                ? 'unchecked' 
                : selectedRows.size === data.length 
                  ? 'checked' 
                  : 'indeterminate'
            }
            onPress={handleSelectAll}
          />
        </PaperDataTable.Title>
      )}
      
      {columns.map((column) => (
        <PaperDataTable.Title
          key={column.key}
          style={[
            { width: column.width },
            column.align && { textAlign: column.align },
          ]}
          sortDirection={
            sortBy === column.key ? sortOrder : undefined
          }
          onPress={column.sortable ? () => handleSort(column.key) : undefined}
        >
          {column.title}
        </PaperDataTable.Title>
      ))}
    </PaperDataTable.Header>
  );

  // 渲染行
  const renderRow = useCallback(({ item: row, index }: { item: T; index: number }) => {
    const rowKey = getRowKey(row);
    const isSelected = selectedRows.has(rowKey);

    return (
      <PaperDataTable.Row
        style={[
          styles.row,
          isSelected && styles.selectedRow,
        ]}
        onPress={() => onRowPress?.(row, index)}
      >
        {selectable && (
          <PaperDataTable.Cell style={styles.checkboxColumn}>
            <Checkbox
              status={isSelected ? 'checked' : 'unchecked'}
              onPress={() => onRowSelect?.(rowKey, !isSelected)}
            />
          </PaperDataTable.Cell>
        )}
        
        {columns.map((column) => {
          const value = row[column.key as keyof T];
          const content = column.render 
            ? column.render(value, row, index)
            : String(value || '');

          return (
            <PaperDataTable.Cell
              key={column.key}
              style={[
                { width: column.width },
                column.align && { justifyContent: 
                  column.align === 'center' ? 'center' :
                  column.align === 'right' ? 'flex-end' : 'flex-start'
                },
              ]}
            >
              {content}
            </PaperDataTable.Cell>
          );
        })}
      </PaperDataTable.Row>
    );
  }, [columns, selectedRows, selectable, onRowSelect, onRowPress, getRowKey]);

  // 渲染空状态
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );

  // 渲染分页
  const renderPagination = () => {
    if (!pagination) return null;

    const { page, pageSize, total, onPageChange } = pagination;
    const totalPages = Math.ceil(total / pageSize);

    return (
      <View style={styles.paginationContainer}>
        <Text style={styles.paginationInfo}>
          显示 {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} 项，共 {total} 项
        </Text>
        
        <View style={styles.paginationButtons}>
          <IconButton
            icon="chevron-left"
            disabled={page === 1}
            onPress={() => onPageChange(page - 1)}
          />
          
          <Text style={styles.pageNumber}>
            {page} / {totalPages}
          </Text>
          
          <IconButton
            icon="chevron-right"
            disabled={page === totalPages}
            onPress={() => onPageChange(page + 1)}
          />
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* 搜索栏 */}
      {searchable && (
        <Searchbar
          placeholder="搜索..."
          value={searchValue}
          onChangeText={onSearch}
          style={styles.searchBar}
        />
      )}

      {/* 数据表格 */}
      <PaperDataTable style={styles.table}>
        {renderHeader()}
        
        <FlashList
          data={data}
          renderItem={renderRow}
          keyExtractor={getRowKey}
          estimatedItemSize={56}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.listContent}
        />
      </PaperDataTable>

      {/* 分页 */}
      {renderPagination()}
    </View>
  );
}

const createDataTableStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
    marginBottom: 8,
  },
  table: {
    flex: 1,
  },
  header: {
    backgroundColor: theme.colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outline,
  },
  checkboxColumn: {
    width: 48,
    justifyContent: 'center',
  },
  row: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  selectedRow: {
    backgroundColor: theme.colors.primaryContainer,
  },
  listContent: {
    paddingBottom: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: theme.colors.onSurfaceVariant,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.outline,
  },
  paginationInfo: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
  },
  paginationButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageNumber: {
    fontSize: 14,
    color: theme.colors.onSurface,
    marginHorizontal: 8,
  },
});
```

#### 2.2 文件上传和Excel处理组件 (2小时)

**2.2.1 文件上传组件**
```tsx
// src/components/ui/FileUpload.tsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { 
  Card, 
  Text, 
  Button, 
  ProgressBar, 
  IconButton, 
  List,
  useTheme 
} from 'react-native-paper';
import DocumentPicker, { DocumentPickerResponse } from 'react-native-document-picker';
import XLSX from 'xlsx';
import { AppTheme } from '@/theme/theme';

export interface FileUploadProps {
  accept?: string[];
  multiple?: boolean;
  maxSize?: number; // bytes
  maxFiles?: number;
  onFilesSelected?: (files: FileInfo[]) => void;
  onFileRemoved?: (fileId: string) => void;
  onUploadProgress?: (fileId: string, progress: number) => void;
  onUploadComplete?: (fileId: string, result: any) => void;
  onUploadError?: (fileId: string, error: Error) => void;
  disabled?: boolean;
  supportExcelPreview?: boolean;
  style?: any;
}

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  uri: string;
  uploadProgress?: number;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'error';
  previewData?: any[];
}

export const FileUpload: React.FC<FileUploadProps> = ({
  accept = ['*/*'],
  multiple = false,
  maxSize = 10 * 1024 * 1024, // 10MB
  maxFiles = 5,
  onFilesSelected,
  onFileRemoved,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  disabled = false,
  supportExcelPreview = false,
  style,
}) => {
  const theme = useTheme() as AppTheme;
  const styles = createFileUploadStyles(theme);

  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);

  const generateFileId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const isExcelFile = (type: string): boolean => {
    return type.includes('spreadsheet') || 
           type.includes('excel') || 
           type.includes('vnd.ms-excel') ||
           type.includes('vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  const previewExcelFile = async (file: DocumentPickerResponse): Promise<any[]> => {
    try {
      const response = await fetch(file.uri);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // 返回前10行作为预览
      return jsonData.slice(0, 10) as any[];
    } catch (error) {
      console.error('Excel preview failed:', error);
      return [];
    }
  };

  const handleFileSelection = async () => {
    if (disabled) return;

    try {
      const result = await DocumentPicker.pick({
        type: accept.includes('*/*') ? undefined : accept,
        allowMultiSelection: multiple,
      });

      const files = Array.isArray(result) ? result : [result];
      const processedFiles: FileInfo[] = [];

      for (const file of files) {
        // 检查文件大小
        if (file.size && file.size > maxSize) {
          Alert.alert('文件过大', `文件 ${file.name} 超过了 ${formatFileSize(maxSize)} 的限制`);
          continue;
        }

        // 检查文件数量
        if (selectedFiles.length + processedFiles.length >= maxFiles) {
          Alert.alert('文件数量超限', `最多只能选择 ${maxFiles} 个文件`);
          break;
        }

        const fileInfo: FileInfo = {
          id: generateFileId(),
          name: file.name || 'unknown',
          size: file.size || 0,
          type: file.type || 'unknown',
          uri: file.uri,
          uploadStatus: 'pending',
        };

        // Excel文件预览
        if (supportExcelPreview && isExcelFile(file.type || '')) {
          try {
            fileInfo.previewData = await previewExcelFile(file);
          } catch (error) {
            console.error('Excel preview failed:', error);
          }
        }

        processedFiles.push(fileInfo);
      }

      const newFiles = [...selectedFiles, ...processedFiles];
      setSelectedFiles(newFiles);
      onFilesSelected?.(newFiles);

    } catch (error) {
      if (!DocumentPicker.isCancel(error)) {
        Alert.alert('选择文件失败', error.message);
      }
    }
  };

  const handleFileRemove = (fileId: string) => {
    const newFiles = selectedFiles.filter(file => file.id !== fileId);
    setSelectedFiles(newFiles);
    onFileRemoved?.(fileId);
  };

  const renderFileItem = (file: FileInfo) => {
    const isUploading = file.uploadStatus === 'uploading';
    const isCompleted = file.uploadStatus === 'completed';
    const isError = file.uploadStatus === 'error';

    return (
      <Card key={file.id} style={styles.fileCard}>
        <List.Item
          title={file.name}
          description={`${formatFileSize(file.size)} • ${file.type}`}
          left={(props) => (
            <List.Icon 
              {...props} 
              icon={
                isCompleted ? 'check-circle' :
                isError ? 'alert-circle' :
                isUploading ? 'loading' :
                isExcelFile(file.type) ? 'file-excel' : 'file'
              }
              color={
                isCompleted ? theme.colors.success :
                isError ? theme.colors.error :
                theme.colors.primary
              }
            />
          )}
          right={(props) => (
            <IconButton
              {...props}
              icon="close"
              size={20}
              onPress={() => handleFileRemove(file.id)}
              disabled={isUploading}
            />
          )}
        />

        {/* 上传进度 */}
        {isUploading && file.uploadProgress !== undefined && (
          <View style={styles.progressContainer}>
            <ProgressBar 
              progress={file.uploadProgress / 100} 
              color={theme.colors.primary}
              style={styles.progressBar}
            />
            <Text style={styles.progressText}>{file.uploadProgress}%</Text>
          </View>
        )}

        {/* Excel预览 */}
        {file.previewData && file.previewData.length > 0 && (
          <View style={styles.previewContainer}>
            <Text style={styles.previewTitle}>文件预览 (前10行):</Text>
            <View style={styles.previewTable}>
              {file.previewData.map((row, index) => (
                <View key={index} style={styles.previewRow}>
                  {Array.isArray(row) ? row.slice(0, 5).map((cell, cellIndex) => (
                    <Text 
                      key={cellIndex} 
                      style={styles.previewCell}
                      numberOfLines={1}
                    >
                      {String(cell || '')}
                    </Text>
                  )) : null}
                </View>
              ))}
            </View>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {/* 选择文件区域 */}
      <Card style={styles.uploadArea}>
        <Card.Content style={styles.uploadContent}>
          <List.Icon icon="cloud-upload" size={48} color={theme.colors.primary} />
          <Text style={styles.uploadTitle}>选择文件上传</Text>
          <Text style={styles.uploadDescription}>
            {accept.includes('*/*') ? '支持所有文件格式' : `支持格式: ${accept.join(', ')}`}
          </Text>
          <Text style={styles.uploadDescription}>
            最大文件大小: {formatFileSize(maxSize)}
            {multiple && ` • 最多 ${maxFiles} 个文件`}
          </Text>
          
          <Button
            mode="contained"
            onPress={handleFileSelection}
            disabled={disabled || selectedFiles.length >= maxFiles}
            style={styles.selectButton}
          >
            选择文件
          </Button>
        </Card.Content>
      </Card>

      {/* 已选择的文件列表 */}
      {selectedFiles.length > 0 && (
        <View style={styles.fileListContainer}>
          <Text style={styles.fileListTitle}>
            已选择文件 ({selectedFiles.length})
          </Text>
          {selectedFiles.map(renderFileItem)}
        </View>
      )}
    </View>
  );
};

const createFileUploadStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  uploadArea: {
    margin: 16,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: theme.colors.outline,
  },
  uploadContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginTop: 16,
    marginBottom: 8,
  },
  uploadDescription: {
    fontSize: 14,
    color: theme.colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 4,
  },
  selectButton: {
    marginTop: 16,
  },
  fileListContainer: {
    paddingHorizontal: 16,
  },
  fileListTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  fileCard: {
    marginBottom: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  progressBar: {
    flex: 1,
    marginRight: 8,
  },
  progressText: {
    fontSize: 12,
    color: theme.colors.onSurfaceVariant,
    minWidth: 40,
    textAlign: 'right',
  },
  previewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.colors.onSurface,
    marginBottom: 8,
  },
  previewTable: {
    borderWidth: 1,
    borderColor: theme.colors.outline,
    borderRadius: 4,
    backgroundColor: theme.colors.surface,
  },
  previewRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.outlineVariant,
  },
  previewCell: {
    flex: 1,
    padding: 8,
    fontSize: 12,
    color: theme.colors.onSurface,
    borderRightWidth: 1,
    borderRightColor: theme.colors.outlineVariant,
  },
});
```

## 🏆 交付物

### 技术交付物
- [ ] **Material Design 3主题系统** (theme.ts) - 完整的主题配置
- [ ] **通用样式常量** (styles.ts) - 标准化样式和响应式工具
- [ ] **增强按钮组件** (Button.tsx) - 多变体、多尺寸按钮组件
- [ ] **增强卡片组件** (Card.tsx) - 多变体卡片组件
- [ ] **高性能数据表格** (DataTable.tsx) - 支持大数据量的表格组件
- [ ] **文件上传组件** (FileUpload.tsx) - Excel文件处理和预览
- [ ] **响应式工具函数** - 屏幕适配和断点管理

### 功能交付物
- [ ] **统一的视觉设计语言** - 基于Material Design 3的一致性设计
- [ ] **完整的组件生态** - 覆盖常用UI场景的组件库
- [ ] **高性能数据处理** - 支持大量数据的表格和列表组件
- [ ] **文件处理能力** - Excel文件上传、解析和预览功能
- [ ] **主题系统支持** - 深色/浅色模式和自定义主题
- [ ] **无障碍访问支持** - 完整的辅助功能支持

### 开发体验交付物
- [ ] **类型安全的组件API** - 完整的TypeScript类型定义
- [ ] **组件使用文档** - 详细的使用说明和示例代码
- [ ] **设计系统文档** - 颜色、字体、间距等设计规范
- [ ] **性能优化指南** - 组件性能使用最佳实践
- [ ] **主题定制指南** - 自定义主题的配置方法

## ✅ 验收标准

### 功能完整性验证
- [ ] 所有基础组件正确渲染和交互
- [ ] 主题系统正确切换深色/浅色模式
- [ ] 数据表格正确处理大量数据
- [ ] 文件上传组件正确处理各种文件格式
- [ ] Excel预览功能正确显示数据

### 设计一致性验证
- [ ] 所有组件遵循Material Design 3规范
- [ ] 颜色、字体、间距保持一致
- [ ] 响应式设计在不同屏幕尺寸下正确显示
- [ ] 无障碍功能正确工作
- [ ] 动画和交互效果流畅

### 性能验证
- [ ] 组件渲染性能良好
- [ ] 大数据量表格滚动流畅
- [ ] 文件上传进度正确显示
- [ ] 主题切换响应及时
- [ ] 内存使用合理稳定

### 开发体验验证
- [ ] TypeScript类型检查无错误
- [ ] 组件API易于理解和使用
- [ ] 错误信息清晰有用
- [ ] 文档完整准确
- [ ] 示例代码可正常运行

## 📊 时间分配

| 阶段 | 内容 | 预计时间 | 关键交付物 |
|------|------|----------|-----------|
| 上午前半 | 设计系统和主题 | 2小时 | theme.ts, styles.ts |
| 上午后半 | 基础UI组件 | 2小时 | Button.tsx, Card.tsx |
| 下午前半 | 数据表格组件 | 2小时 | DataTable.tsx |
| 下午后半 | 文件上传组件 | 2小时 | FileUpload.tsx |
| **总计** | **基础组件库完整实现** | **8小时** | **完整组件库** |

## 🚨 风险与对策

### 技术风险
- **风险**: Material Design 3兼容性问题
- **对策**: 使用最新版本React Native Paper，充分测试

- **风险**: 大数据量表格性能问题
- **对策**: 虚拟化渲染、分页加载、性能优化

- **风险**: Excel文件解析失败
- **对策**: 错误处理机制、格式验证、用户提示

### 设计风险
- **风险**: 组件设计不一致
- **对策**: 严格遵循设计系统、设计评审

- **风险**: 响应式适配问题
- **对策**: 多设备测试、断点设计

### 维护风险
- **风险**: 组件库维护成本高
- **对策**: 清晰的文档、标准化的开发流程

- **风险**: 版本升级兼容性
- **对策**: 语义化版本管理、渐进式升级

## 🔄 与其他任务的接口

### 输入依赖
- **所有前置任务**: 使用组件库中的基础组件
- **设计规范**: Material Design 3设计规范

### 输出到项目
- **所有业务模块**: 使用统一的UI组件库
- **主题系统**: 为整个应用提供主题支持
- **设计一致性**: 确保应用视觉和交互一致性

## 📝 开发检查点

### 上午检查点
- [ ] 主题系统是否完整配置
- [ ] 基础组件是否正确实现
- [ ] 设计规范是否正确应用
- [ ] TypeScript类型是否完整

### 下午检查点
- [ ] 数据表格性能是否良好
- [ ] 文件上传功能是否稳定
- [ ] 组件文档是否完整
- [ ] 整体质量是否达标

## 📞 技术支持

**负责人**: [待分配]
**技术支持**: [项目技术负责人]
**参考材料**: 
- Material Design 3规范: https://m3.material.io/
- React Native Paper文档: https://callstack.github.io/react-native-paper/
- React Native性能优化指南

---

**任务创建时间**: 2025-08-05
**计划开始时间**: TASK-RN-008完成后
**计划完成时间**: 开始后1个工作日

*此任务为整个应用提供统一的UI基础，确保视觉和交互的一致性。*