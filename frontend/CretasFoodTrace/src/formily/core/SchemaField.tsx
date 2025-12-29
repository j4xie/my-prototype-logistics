/**
 * SchemaField - Formily Schema 字段组件
 *
 * 创建已注册 React Native Paper 组件的 SchemaField
 * 用于根据 JSON Schema 动态渲染表单
 */

import { createSchemaField } from '@formily/react';
import {
  FormItem,
  Input,
  NumberInput,
  Select,
  DatePicker,
  Switch,
} from '../components';

/**
 * 创建 SchemaField 组件
 *
 * 注册的组件可以在 Schema 中通过 x-component 引用
 * 例如: { 'x-component': 'Input' }
 */
export const SchemaField = createSchemaField({
  components: {
    // 包装器组件
    FormItem,

    // 输入组件
    Input,
    NumberInput,
    Select,
    DatePicker,
    Switch,

    // 别名 (兼容不同命名习惯)
    TextInput: Input,
    NumberField: NumberInput,
    Dropdown: Select,
    DateField: DatePicker,
    Toggle: Switch,
  },
  scope: {
    // 可以在 Schema 中使用的全局变量和函数
    $self: undefined,
    $form: undefined,
    $values: undefined,
  },
});

export default SchemaField;
