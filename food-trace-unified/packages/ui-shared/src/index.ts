// UI共享组件库统一导出

// 基础组件
export * from './components/base/Button';
export * from './components/base/Input';
export * from './components/base/Card';
export * from './components/base/Modal';
export * from './components/base/Loading';
export * from './components/base/Badge';

// 业务组件
export * from './components/business/TraceCard';
export * from './components/business/StatisticsCard';

// 移动端特色组件
export * from './components/mobile/QRScanner';
export * from './components/mobile/PhotoCapture';

// 数据可视化组件
export * from './components/charts/LineChart';
export * from './components/charts/BarChart';

// 类型定义
export type { ButtonProps } from './components/base/Button';
export type { InputProps } from './components/base/Input';
export type { CardProps } from './components/base/Card';
export type { ModalProps } from './components/base/Modal';
export type { LoadingProps } from './components/base/Loading';
export type { BadgeProps } from './components/base/Badge';

export type { TraceData, TraceCardProps } from './components/business/TraceCard';
export type { StatData, StatisticsCardProps, StatisticsGridProps } from './components/business/StatisticsCard';

export type { QRScannerProps, QuickScanButtonProps } from './components/mobile/QRScanner';
export type { PhotoCaptureProps, PhotoUploaderProps } from './components/mobile/PhotoCapture';

export type { DataPoint, LineChartProps, MultiLineChartProps } from './components/charts/LineChart';
export type { BarDataPoint, BarChartProps, GroupedBarChartProps } from './components/charts/BarChart';