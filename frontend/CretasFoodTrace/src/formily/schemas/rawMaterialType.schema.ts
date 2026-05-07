/**
 * 原料类型表单 Schema (新建/编辑).
 *
 * 用于 DynamicForm 渲染. 三个下拉项 (category / unit / storageType) 的 enum 列表
 * 在 runtime 由 dictionaryApiClient 填充, 此处仅声明字段+validator.
 *
 * 包装层级 (1-3 级单位换算) 不在此 schema 内 — 因为是 1:1 关联表 + 复合 UI,
 * 由原页面渲染层在 DynamicForm 下方独立处理.
 *
 * @since 2026-05-07
 */
import type { FormSchema } from '../core';

export interface RawMaterialTypeFormData {
  name: string;
  category: string;
  unit: string;
  shelfLifeDays?: number;
  storageType: string;
  notes?: string;
}

export const rawMaterialTypeSchema: FormSchema = {
  type: 'object',
  properties: {
    name: {
      type: 'string',
      title: '原料名称',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '例如: 三文鱼',
      },
      'x-validator': [{ required: true, message: '请输入原料名称' }],
    },

    category: {
      type: 'string',
      title: '类别',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择类别',
      },
      enum: [], // runtime 由 dictionaryApiClient.getEnums('MATERIAL_CATEGORY') 填充
      'x-validator': [{ required: true, message: '请选择类别' }],
    },

    unit: {
      type: 'string',
      title: '单位',
      required: true,
      default: 'kg',
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择单位',
        searchable: true,
      },
      enum: [], // runtime 由 dictionaryApiClient.getUnits() 填充
      'x-validator': [{ required: true, message: '请选择单位' }],
    },

    shelfLifeDays: {
      type: 'number',
      title: '保质期 (天)',
      default: 7,
      minimum: 0,
      maximum: 3650,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        placeholder: '例如: 7',
      },
    },

    storageType: {
      type: 'string',
      title: '储存类型',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择储存类型',
      },
      enum: [], // runtime 由 dictionaryApiClient.getEnums('MATERIAL_STORAGE_TYPE') 填充
      'x-validator': [{ required: true, message: '请选择储存类型' }],
    },

    notes: {
      type: 'string',
      title: '备注',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '原料详细描述（可选）',
        multiline: true,
        numberOfLines: 3,
      },
    },
  },
};
