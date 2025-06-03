/**
 * @module ui
 * @description 食品溯源系统 - UI组件统一导出
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 基础组件
export { default as Button } from './Button';
export { default as Card } from './Card';
export { default as StatCard } from './StatCard';
export { default as Modal } from './Modal';
export { default as Loading } from './Loading';
export { default as Table } from './Table';
export { default as Badge, StatusBadge, NumberBadge, DotBadge } from './Badge';

// 表单组件
export { default as Input } from './form/Input';
export { default as Select } from './form/Select';
export { default as Textarea } from './form/Textarea';

// 布局组件
export { default as FluidContainer } from './layout/FluidContainer';
export { default as Row } from './layout/Row';
export { default as Column } from './layout/Column';
export { default as PageLayout } from './layout/PageLayout';

// 导航组件
export { default as MobileNav } from './navigation/MobileNav';
export { default as MobileDrawer, DrawerMenuItem, DrawerMenuGroup, DrawerUserHeader, DrawerQuickActions } from './navigation/MobileDrawer';

// 触摸交互组件
export { default as TouchGesture, SwipeCard, DraggableListItem } from './TouchGesture';

// 搜索组件
export { default as MobileSearch, QuickSearchBar } from './MobileSearch';
export * from './trace-nav';

// UI工具组件
export * from './trace-ui';
export * from './trace-ui-components'; 