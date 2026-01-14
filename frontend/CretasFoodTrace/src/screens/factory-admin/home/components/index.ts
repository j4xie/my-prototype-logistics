/**
 * 首页组件导出
 */
export { BentoGridEditor, default as BentoGridEditorDefault } from './BentoGridEditor';
export { AILayoutAssistant } from './AILayoutAssistant';
export type { AILayoutAssistantProps } from './AILayoutAssistant';
export { ModulePropsEditor, default as ModulePropsEditorDefault } from './ModulePropsEditor';

// Schema exports
export {
  HOME_MODULE_SCHEMAS,
  getModuleSchema,
  getModuleDefaultConfig,
  getFieldDefaultValue,
} from './homeModuleSchemas';
export type {
  ModuleSchema,
  SchemaField,
  FieldType,
  EnumOption,
} from './homeModuleSchemas';
