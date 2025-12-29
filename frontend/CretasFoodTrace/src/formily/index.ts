/**
 * Formily React Native Paper 适配层
 *
 * 提供动态表单渲染能力，支持通过 JSON Schema 配置表单
 *
 * @example
 * ```tsx
 * import { DynamicForm, FormSchema } from '../formily';
 *
 * const schema: FormSchema = {
 *   type: 'object',
 *   properties: {
 *     name: {
 *       type: 'string',
 *       title: '姓名',
 *       required: true,
 *       'x-decorator': 'FormItem',
 *       'x-component': 'Input',
 *     },
 *   },
 * };
 *
 * <DynamicForm
 *   schema={schema}
 *   onSubmit={(values) => console.log(values)}
 * />
 * ```
 */

// 核心组件
export * from './core';

// UI 组件
export * from './components';

// 业务表单 Schema
export * from './schemas';

// 联动效果
export * from './effects';

// 服务层 (Schema 合并等)
export * from './services';

// Hooks (AI 表单助手等)
export * from './hooks';
