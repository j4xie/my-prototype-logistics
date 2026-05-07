/**
 * 采购订单 (头部) 表单 Schema.
 *
 * 仅描述订单头部 (供应商 / 预计到货 / 备注). 明细行因为是 array+per-row 联动,
 * 由原页面用原生组件渲染,DynamicForm 不接管 items.
 *
 * Canvas 编辑 schemaJson 后, 头部字段可加可减 (例 加自定义 "采购员" 字段).
 *
 * @since 2026-05-07
 */
import type { FormSchema } from '../core';

export interface PurchaseOrderHeaderFormData {
  supplierId: string;
  expectedDeliveryDate?: string;
  remark?: string;
}

export const purchaseOrderSchema: FormSchema = {
  type: 'object',
  properties: {
    supplierId: {
      type: 'string',
      title: '供应商',
      required: true,
      'x-decorator': 'FormItem',
      'x-component': 'Select',
      'x-component-props': {
        placeholder: '请选择供应商',
        searchable: true,
      },
      enum: [], // runtime 由 supplierApiClient.getActiveSuppliers() 填充
      'x-validator': [{ required: true, message: '请选择供应商' }],
    },

    expectedDeliveryDate: {
      type: 'string',
      title: '预计到货日期',
      'x-decorator': 'FormItem',
      'x-component': 'DatePicker',
      'x-component-props': {
        placeholder: 'YYYY-MM-DD',
        format: 'YYYY-MM-DD',
      },
    },

    remark: {
      type: 'string',
      title: '备注',
      'x-decorator': 'FormItem',
      'x-component': 'Input',
      'x-component-props': {
        placeholder: '订单备注（可选）',
        multiline: true,
        numberOfLines: 2,
      },
    },
  },
};
