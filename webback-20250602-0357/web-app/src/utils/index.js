/**
 * @module utils
 * @description 食品溯源系统 - 工具函数统一导出
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 认证相关工具函数
export * from './auth';

// 通用工具函数
export { default as configLoader } from './common/config-loader';
export { default as eventEmitter } from './common/event-emitter';
export { default as logger } from './common/logger';
export { default as Lock } from './common/Lock';
export * from './common/responsive-helper';
export * from './common/trace-common';
export * from './common/browser-compatibility';
export * from './common/trace-error-handler';
export * from './common/trace-routes';

// 网络相关工具函数
export * from './network';

// 性能监控工具函数
export { default as performanceTracker } from './performance/performance-tracker';
export { default as resourceMonitor } from './performance/resource-monitor';
export { default as performanceTestTool } from './performance/performance-test-tool';

// 存储相关工具函数
export * from './storage';

// 为了向后兼容，保留一些常用的直接导出
export { configLoader, eventEmitter, logger, Lock, performanceTracker, resourceMonitor }; 