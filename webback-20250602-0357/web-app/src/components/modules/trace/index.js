/**
 * @module trace
 * @description 食品溯源系统 - 追溯模块组件统一导出
 * @version 2.0.0
 * @author 食品溯源系统开发团队
 */

// 现代化React组件
export { default as TraceRecordView } from './TraceRecordView.jsx';
export { default as TraceRecordForm } from './TraceRecordForm.jsx';

// 传统组件（逐步迁移中）
export { TraceRecordQuery } from './TraceRecordQuery.js';
export { TraceRecordDetails } from './TraceRecordDetails.js';

// 工具模块
export * from './trace-data.js';
export * from './trace-batch.js';
export * from './trace-core.js';
export * from './trace-blockchain.js';
export * from './trace-map.js';
export * from './trace-scanner.js'; 