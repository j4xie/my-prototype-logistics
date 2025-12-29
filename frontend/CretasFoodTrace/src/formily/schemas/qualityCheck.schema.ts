/**
 * 质检表单 Schema 定义
 *
 * 用于动态渲染质检录入表单
 * 包含字段联动：不合格时显示原因输入
 */

import type { FormSchema } from '../core';

/**
 * 质检表单数据类型
 */
export interface QualityCheckFormData {
  batchNumber: string;
  temperature: number;
  humidity?: number;
  result: 'PASS' | 'FAIL' | 'PENDING';
  failReason?: string;
  notes?: string;
  inspectorConfirm: boolean;
}

/**
 * 质检表单 Schema
 *
 * 字段说明:
 * - batchNumber: 批次号 (必填，扫码或手动输入)
 * - temperature: 中心温度 (必填，-50°C ~ 100°C)
 * - humidity: 湿度 (选填，0% ~ 100%)
 * - result: 检测结果 (必填，合格/不合格/待复检)
 * - failReason: 不合格原因 (仅result=FAIL时显示且必填)
 * - notes: 备注 (选填)
 * - inspectorConfirm: 质检员确认 (必填)
 */
export const qualityCheckSchema: FormSchema = {
  type: 'object',
  properties: {
    batchNumber: {
      type: 'string',
      title: '批次号',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '扫码或输入批次号',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入批次号',
        },
        {
          pattern: '^[A-Z0-9-]+$',
          message: '批次号只能包含大写字母、数字和横线',
        },
      ],
    },

    temperature: {
      type: 'number',
      title: '中心温度(°C)',
      required: true,
      minimum: -50,
      maximum: 100,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 0.1,
        precision: 1,
        placeholder: '输入温度值',
      },
      'x-validator': [
        {
          required: true,
          message: '请输入中心温度',
        },
        {
          minimum: -50,
          message: '温度不能低于-50°C',
        },
        {
          maximum: 100,
          message: '温度不能高于100°C',
        },
      ],
    },

    humidity: {
      type: 'number',
      title: '湿度(%)',
      minimum: 0,
      maximum: 100,
      'x-decorator': 'FormItem',
      'x-component': 'NumberInput',
      'x-component-props': {
        step: 1,
        precision: 0,
        placeholder: '输入湿度值(选填)',
      },
      'x-validator': [
        {
          minimum: 0,
          message: '湿度不能低于0%',
        },
        {
          maximum: 100,
          message: '湿度不能高于100%',
        },
      ],
    },

    result: {
      type: 'string',
      title: '检测结果',
      required: true,
      enum: [
        { label: '合格', value: 'PASS' },
        { label: '不合格', value: 'FAIL' },
        { label: '待复检', value: 'PENDING' },
      ],
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择检测结果',
      },
      'x-validator': [
        {
          required: true,
          message: '请选择检测结果',
        },
      ],
    },

    failReason: {
      type: 'string',
      title: '不合格原因',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        multiline: true,
        numberOfLines: 3,
        placeholder: '请详细描述不合格原因',
      },
      // 联动: 只有结果为"不合格"时才显示且必填
      'x-reactions': {
        dependencies: ['result'],
        fulfill: {
          state: {
            visible: '{{$deps[0] === "FAIL"}}',
            required: '{{$deps[0] === "FAIL"}}',
          },
        },
      },
      'x-validator': [
        {
          validator: (value: string, rule: any, ctx: any) => {
            const result = ctx.form?.values?.result;
            if (result === 'FAIL' && !value?.trim()) {
              return '不合格时必须填写原因';
            }
            return true;
          },
        },
      ],
    },

    notes: {
      type: 'string',
      title: '备注',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        multiline: true,
        numberOfLines: 2,
        placeholder: '其他需要说明的情况(选填)',
      },
    },

    inspectorConfirm: {
      type: 'boolean',
      title: '质检员确认',
      required: true,
      default: false,
      'x-decorator': 'FormItem',
      'x-component': 'Switch',
      'x-component-props': {
        checkedText: '已确认',
        uncheckedText: '未确认',
      },
      'x-validator': [
        {
          validator: (value: boolean) => {
            if (!value) {
              return '请确认质检结果';
            }
            return true;
          },
        },
      ],
    },
  },
};

export default qualityCheckSchema;
