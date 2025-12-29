/**
 * 原材料批次表单 Schema 定义
 *
 * 用于动态渲染原材料入库表单
 * 包含字段联动：
 * - 数量 x 单价 = 总金额
 * - 储存类型为冻货时显示冷冻温度
 * - 质检不合格时显示原因
 */

import type { FormSchema } from '../core';

/**
 * 原材料批次表单数据类型
 */
export interface MaterialBatchFormData {
  // 基本信息
  supplierId: string;
  materialTypeId: string;
  quantity: number;
  unitPrice: number;
  totalCost?: number; // 自动计算

  // 储存信息
  storageType: 'fresh' | 'frozen';
  storageLocation: string;
  freezeTemperature?: number; // 仅冻货
  shelfLife: number;
  expiryDate?: string; // 自动计算

  // 质检信息
  inspector: string;
  qualityStatus: 'qualified' | 'unqualified';
  qualityScore?: number;
  unqualifiedReason?: string; // 仅不合格时
  qualityNotes?: string;

  // 其他
  notes?: string;
}

/**
 * 原材料批次表单 Schema
 *
 * 字段说明:
 * - supplierId: 供应商ID (必填，下拉选择)
 * - materialTypeId: 原料类型 (必填)
 * - quantity: 入库重量 (必填，>0)
 * - unitPrice: 单价 (必填，>0)
 * - storageType: 储存类型 (必填，新鲜/冻货)
 * - storageLocation: 储存位置 (必填)
 * - shelfLife: 保质期天数 (必填)
 * - inspector: 质检员 (必填)
 * - qualityStatus: 质检状态 (必填)
 */
export const materialBatchSchema: FormSchema = {
  type: 'object',
  properties: {
    // ========== 基本信息 ==========
    supplierId: {
      type: 'string',
      title: '供应商',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择供应商',
      },
      enum: [], // 运行时动态填充
      'x-validator': [
        {
          required: true,
          message: '请选择供应商',
        },
      ],
    },

    materialTypeId: {
      type: 'string',
      title: '原料类型',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '例如：三文鱼、虾仁、带鱼',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入原料类型',
        },
      ],
    },

    quantity: {
      type: 'number',
      title: '入库重量 (kg)',
      required: true,
      minimum: 0.01,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 0.1,
        precision: 2,
        placeholder: '例如：100.5',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入入库重量',
        },
        {
          minimum: 0.01,
          message: '重量必须大于0',
        },
      ],
    },

    unitPrice: {
      type: 'number',
      title: '单价 (元/kg)',
      required: true,
      minimum: 0.01,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 0.01,
        precision: 2,
        placeholder: '例如：45.00',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入单价',
        },
        {
          minimum: 0.01,
          message: '单价必须大于0',
        },
      ],
    },

    totalCost: {
      type: 'number',
      title: '总金额 (元)',
      description: '自动计算: 重量 × 单价',
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        precision: 2,
        disabled: true,
        placeholder: '自动计算',
      },
      // 联动: 自动计算总金额
      'x-reactions': {
        dependencies: ['quantity', 'unitPrice'],
        fulfill: {
          state: {
            value: '{{($deps[0] || 0) * ($deps[1] || 0)}}',
          },
        },
      },
    },

    // ========== 储存信息 ==========
    storageType: {
      type: 'string',
      title: '储存类型',
      required: true,
      default: 'fresh',
      enum: [
        { label: '新鲜', value: 'fresh' },
        { label: '冻货', value: 'frozen' },
      ],
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择储存类型',
      },
      'x-validator': [
        {
          required: true,
          message: '请选择储存类型',
        },
      ],
    },

    freezeTemperature: {
      type: 'number',
      title: '冷冻温度 (°C)',
      minimum: -50,
      maximum: 0,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 1,
        precision: 0,
        placeholder: '例如：-18',
      },
      // 联动: 仅冻货时显示且必填
      'x-reactions': {
        dependencies: ['storageType'],
        fulfill: {
          state: {
            visible: '{{$deps[0] === "frozen"}}',
            required: '{{$deps[0] === "frozen"}}',
          },
        },
      },
      'x-validator': [
        {
          validator: (value: number, _rule: any, ctx: any) => {
            const storageType = ctx.form?.values?.storageType;
            if (storageType === 'frozen' && (value === undefined || value === null)) {
              return '冻货必须填写冷冻温度';
            }
            if (storageType === 'frozen' && (value > 0 || value < -50)) {
              return '冷冻温度应在-50°C到0°C之间';
            }
            return true;
          },
        },
      ],
    },

    storageLocation: {
      type: 'string',
      title: '储存位置',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '例如：冷库A区-货架3',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入储存位置',
        },
      ],
    },

    shelfLife: {
      type: 'number',
      title: '保质期 (天)',
      required: true,
      minimum: 1,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 1,
        precision: 0,
        placeholder: '例如：30',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入保质期天数',
        },
        {
          minimum: 1,
          message: '保质期至少1天',
        },
      ],
    },

    // ========== 质检信息 ==========
    inspector: {
      type: 'string',
      title: '质检员',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '输入质检员姓名',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入质检员姓名',
        },
      ],
    },

    qualityStatus: {
      type: 'string',
      title: '质检状态',
      required: true,
      default: 'qualified',
      enum: [
        { label: '合格', value: 'qualified' },
        { label: '不合格', value: 'unqualified' },
      ],
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择质检状态',
      },
      'x-validator': [
        {
          required: true,
          message: '请选择质检状态',
        },
      ],
    },

    qualityScore: {
      type: 'number',
      title: '新鲜度评分',
      minimum: 0,
      maximum: 100,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 1,
        precision: 0,
        placeholder: '0-100分 (选填)',
      },
      'x-validator': [
        {
          minimum: 0,
          message: '评分不能低于0',
        },
        {
          maximum: 100,
          message: '评分不能高于100',
        },
      ],
    },

    unqualifiedReason: {
      type: 'string',
      title: '不合格原因',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        multiline: true,
        numberOfLines: 3,
        placeholder: '请详细描述不合格原因',
      },
      // 联动: 仅不合格时显示且必填
      'x-reactions': {
        dependencies: ['qualityStatus'],
        fulfill: {
          state: {
            visible: '{{$deps[0] === "unqualified"}}',
            required: '{{$deps[0] === "unqualified"}}',
          },
        },
      },
      'x-validator': [
        {
          validator: (value: string, _rule: any, ctx: any) => {
            const qualityStatus = ctx.form?.values?.qualityStatus;
            if (qualityStatus === 'unqualified' && !value?.trim()) {
              return '不合格时必须填写原因';
            }
            return true;
          },
        },
      ],
    },

    qualityNotes: {
      type: 'string',
      title: '质检备注',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        multiline: true,
        numberOfLines: 2,
        placeholder: '其他质检说明 (选填)',
      },
    },

    // ========== 其他信息 ==========
    notes: {
      type: 'string',
      title: '备注',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        multiline: true,
        numberOfLines: 2,
        placeholder: '其他备注信息 (选填)',
      },
    },
  },
};

export default materialBatchSchema;
