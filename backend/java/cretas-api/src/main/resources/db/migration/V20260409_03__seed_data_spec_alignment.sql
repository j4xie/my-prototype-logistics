-- V20260409_03__seed_data_spec_alignment.sql
-- Align module_schemas seed data with spec (docs/superpowers/specs/2026-04-09-canvas-configuration-system-design.md)
-- Changes vs V20260409_02:
--   sales_order: +10 fields (deliveryAddress, items, discountAmount, taxAmount, quoteId,
--                estimatedCost, estimatedProfit, invoiceStatus, invoicedAmount, paidAmount,
--                settlementFlag) + finance group + FINANCE_REJECTED state + 4 new transitions
--   bom:         +taxRate field in cost group + 3 validation rules

-- ============================================================
-- 1. Sales Order: full replacement of field_schema + workflow_schema
-- ============================================================
UPDATE module_schemas
SET
    field_schema = '{
  "fields": [
    {
      "code": "orderNumber",
      "label": "订单号",
      "type": "string",
      "required": true,
      "configurable": false,
      "autoGenerate": true,
      "listVisible": true,
      "listOrder": 1,
      "listWidth": 150,
      "group": "basic"
    },
    {
      "code": "customerId",
      "label": "客户",
      "type": "reference",
      "required": true,
      "configurable": false,
      "referenceConfig": {
        "entity": "customer",
        "displayField": "name",
        "valueField": "id",
        "apiEndpoint": "/api/mobile/{factoryId}/customers"
      },
      "listVisible": true,
      "listOrder": 2,
      "listWidth": 140,
      "group": "basic"
    },
    {
      "code": "orderDate",
      "label": "下单日期",
      "type": "date",
      "required": true,
      "configurable": false,
      "defaultValue": "TODAY",
      "listVisible": true,
      "listOrder": 3,
      "listWidth": 120,
      "group": "basic"
    },
    {
      "code": "requiredDeliveryDate",
      "label": "要求交货日期",
      "type": "date",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "listVisible": true,
      "listOrder": 4,
      "listWidth": 120,
      "group": "basic"
    },
    {
      "code": "salesperson",
      "label": "业务员",
      "type": "string",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "group": "basic"
    },
    {
      "code": "remark",
      "label": "备注",
      "type": "textarea",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "group": "basic"
    },
    {
      "code": "deliveryAddress",
      "label": "收货地址",
      "type": "text",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "group": "basic"
    },
    {
      "code": "status",
      "label": "状态",
      "type": "select",
      "required": false,
      "configurable": false,
      "readonly": true,
      "listVisible": true,
      "listOrder": 6,
      "listWidth": 100,
      "group": "basic"
    },
    {
      "code": "items",
      "label": "订单明细",
      "type": "line_items",
      "required": true,
      "configurable": false,
      "group": "items",
      "itemSchema": {
        "fields": [
          {
            "code": "productTypeId",
            "label": "产品",
            "type": "reference",
            "required": true,
            "referenceConfig": {
              "entity": "productType",
              "displayField": "name",
              "valueField": "id"
            }
          },
          {
            "code": "specification",
            "label": "规格",
            "type": "string",
            "required": false
          },
          {
            "code": "quantity",
            "label": "数量",
            "type": "decimal",
            "required": true
          },
          {
            "code": "unit",
            "label": "单位",
            "type": "select",
            "required": true
          },
          {
            "code": "unitPrice",
            "label": "单价",
            "type": "decimal",
            "required": true
          },
          {
            "code": "taxRate",
            "label": "税率",
            "type": "decimal",
            "required": false,
            "options": [
              {"value": 0, "label": "0%"},
              {"value": 9, "label": "9%"},
              {"value": 13, "label": "13%"}
            ]
          },
          {
            "code": "lineAmount",
            "label": "行金额",
            "type": "decimal",
            "required": false,
            "computed": "quantity * unitPrice",
            "readonly": true
          },
          {
            "code": "remark",
            "label": "备注",
            "type": "string",
            "required": false
          }
        ]
      }
    },
    {
      "code": "totalAmount",
      "label": "订单总金额",
      "type": "decimal",
      "required": false,
      "configurable": false,
      "computed": "SUM(items[].lineAmount)",
      "readonly": true,
      "listVisible": true,
      "listOrder": 5,
      "listWidth": 120,
      "formatter": "currency",
      "group": "amounts"
    },
    {
      "code": "discountAmount",
      "label": "折扣金额",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": false,
      "min": 0,
      "precision": 2,
      "group": "amounts"
    },
    {
      "code": "taxAmount",
      "label": "税额",
      "type": "decimal",
      "required": false,
      "configurable": false,
      "computed": "SUM(items[].taxAmount)",
      "readonly": true,
      "group": "amounts"
    },
    {
      "code": "shippingIncluded",
      "label": "是否含运费",
      "type": "boolean",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "defaultValue": false,
      "group": "费用"
    },
    {
      "code": "shippingFee",
      "label": "运费",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "min": 0,
      "dependsOn": {"field": "shippingIncluded", "value": true},
      "group": "费用"
    },
    {
      "code": "extraFees",
      "label": "其他费用",
      "type": "json_array",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "itemSchema": {
        "fields": [
          {"code": "name",   "type": "string",  "label": "费用名", "required": true},
          {"code": "amount", "type": "decimal", "label": "金额",   "required": true, "min": 0},
          {"code": "remark", "type": "string",  "label": "备注",   "required": false}
        ]
      },
      "group": "费用"
    },
    {
      "code": "boxQuantity",
      "label": "下单箱数",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "min": 0,
      "group": "basic"
    },
    {
      "code": "quoteId",
      "label": "关联报价",
      "type": "reference",
      "required": false,
      "configurable": true,
      "defaultVisible": false,
      "referenceConfig": {
        "entity": "operationalQuote",
        "displayField": "quoteNumber",
        "valueField": "id",
        "apiEndpoint": "/api/mobile/{factoryId}/operational-quotes"
      },
      "group": "business"
    },
    {
      "code": "estimatedCost",
      "label": "预估成本",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": false,
      "group": "business"
    },
    {
      "code": "estimatedProfit",
      "label": "预估利润",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": false,
      "computed": "totalAmount - estimatedCost",
      "readonly": true,
      "group": "business"
    },
    {
      "code": "invoiceStatus",
      "label": "开票状态",
      "type": "select",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "options": [
        {"value": "NOT_INVOICED", "label": "未开票"},
        {"value": "PARTIAL",      "label": "部分开票"},
        {"value": "FULL",         "label": "已全额开票"}
      ],
      "group": "finance"
    },
    {
      "code": "invoicedAmount",
      "label": "已开票金额",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "group": "finance"
    },
    {
      "code": "paidAmount",
      "label": "已收款金额",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "group": "finance"
    },
    {
      "code": "settlementFlag",
      "label": "已结清",
      "type": "boolean",
      "required": false,
      "configurable": true,
      "defaultVisible": false,
      "group": "finance"
    }
  ],
  "groups": [
    {"code": "basic",    "label": "基本信息",       "order": 1},
    {"code": "items",    "label": "订单明细",       "order": 2},
    {"code": "amounts",  "label": "金额汇总",       "order": 3},
    {"code": "费用",     "label": "运费与其他费用",  "order": 4},
    {"code": "business", "label": "业务中心",       "order": 5},
    {"code": "finance",  "label": "财务信息",       "order": 6}
  ]
}'::jsonb,

    workflow_schema = '{
  "states": [
    {"code": "DRAFT",                 "label": "草稿",     "isInitial": true, "tagType": "info"},
    {"code": "CONFIRMED",             "label": "已确认",                      "tagType": ""},
    {"code": "PENDING_FINANCE_REVIEW","label": "待财务审核","configurable": true, "tagType": "warning"},
    {"code": "FINANCE_APPROVED",      "label": "财务已审核","configurable": true, "tagType": "success"},
    {"code": "FINANCE_REJECTED",      "label": "财务驳回", "configurable": true, "tagType": "danger"},
    {"code": "PROCESSING",            "label": "生产中",                      "tagType": ""},
    {"code": "PARTIAL_DELIVERED",     "label": "部分发货",                    "tagType": "warning"},
    {"code": "SHIPPED",               "label": "已发货",                      "tagType": "success"},
    {"code": "COMPLETED",             "label": "已完成",   "isFinal": true,  "tagType": "success"},
    {"code": "CANCELLED",             "label": "已取消",   "isFinal": true,  "tagType": "danger"}
  ],
  "transitions": [
    {
      "from": "DRAFT",
      "to": "CONFIRMED",
      "action": "confirm",
      "label": "确认订单",
      "buttonType": "primary"
    },
    {
      "from": "CONFIRMED",
      "to": "PENDING_FINANCE_REVIEW",
      "action": "submitForReview",
      "label": "提交审核",
      "buttonType": "warning",
      "configurable": true
    },
    {
      "from": "PENDING_FINANCE_REVIEW",
      "to": "FINANCE_APPROVED",
      "action": "approveFinance",
      "label": "审核通过",
      "buttonType": "success",
      "configurable": true
    },
    {
      "from": "PENDING_FINANCE_REVIEW",
      "to": "FINANCE_REJECTED",
      "action": "rejectFinance",
      "label": "驳回",
      "buttonType": "danger",
      "configurable": true
    },
    {
      "from": "FINANCE_REJECTED",
      "to": "DRAFT",
      "action": "revise",
      "label": "修订",
      "buttonType": "warning"
    },
    {
      "from": "CONFIRMED",
      "to": "PROCESSING",
      "action": "startProduction",
      "label": "开始生产",
      "buttonType": "primary",
      "condition": "!config.workflow.hasFinanceReview"
    },
    {
      "from": "FINANCE_APPROVED",
      "to": "PROCESSING",
      "action": "startProduction",
      "label": "开始生产",
      "buttonType": "primary"
    },
    {
      "from": "PROCESSING",
      "to": "PARTIAL_DELIVERED",
      "action": "partialDeliver",
      "label": "部分发货",
      "buttonType": "warning"
    },
    {
      "from": "PARTIAL_DELIVERED",
      "to": "COMPLETED",
      "action": "completeRemaining",
      "label": "剩余完成",
      "buttonType": "success"
    },
    {
      "from": "PROCESSING",
      "to": "SHIPPED",
      "action": "ship",
      "label": "确认发货",
      "buttonType": "success"
    },
    {
      "from": "SHIPPED",
      "to": "COMPLETED",
      "action": "complete",
      "label": "完成",
      "buttonType": "success"
    },
    {
      "from": "DRAFT",
      "to": "CANCELLED",
      "action": "cancel",
      "label": "取消",
      "buttonType": "danger"
    },
    {
      "from": "CONFIRMED",
      "to": "CANCELLED",
      "action": "cancel",
      "label": "取消",
      "buttonType": "danger"
    }
  ],
  "options": {
    "hasFinanceReview": {
      "type": "boolean",
      "label": "启用财务审核",
      "default": true,
      "configurable": true
    },
    "allowPartialDelivery": {
      "type": "boolean",
      "label": "允许部分发货",
      "default": true,
      "configurable": true
    }
  }
}'::jsonb,

    updated_at = NOW()
WHERE module_code = 'sales_order';

-- ============================================================
-- 2. BOM: full replacement of field_schema (adds taxRate) + validation_schema
-- ============================================================
UPDATE module_schemas
SET
    field_schema = '{
  "fields": [
    {
      "code": "productTypeId",
      "label": "产品(成品)",
      "type": "reference",
      "required": true,
      "configurable": false,
      "referenceConfig": {
        "entity": "productType",
        "displayField": "name",
        "valueField": "id",
        "apiEndpoint": "/api/mobile/{factoryId}/finished-goods/product-types"
      },
      "listVisible": true,
      "listOrder": 1,
      "listWidth": 160,
      "group": "basic"
    },
    {
      "code": "materialTypeId",
      "label": "原辅料",
      "type": "reference",
      "required": true,
      "configurable": false,
      "referenceConfig": {
        "entity": "materialType",
        "displayField": "name",
        "valueField": "id",
        "apiEndpoint": "/api/mobile/{factoryId}/material-types"
      },
      "listVisible": true,
      "listOrder": 2,
      "listWidth": 160,
      "group": "basic"
    },
    {
      "code": "materialCategory",
      "label": "物料分类",
      "type": "select",
      "required": true,
      "configurable": true,
      "defaultVisible": true,
      "options": [
        {"value": "RAW",       "label": "原料"},
        {"value": "AUXILIARY", "label": "辅料"},
        {"value": "PACKAGING", "label": "包材"}
      ],
      "defaultValue": "RAW",
      "listVisible": true,
      "listOrder": 3,
      "listWidth": 100,
      "group": "basic"
    },
    {
      "code": "standardQuantity",
      "label": "标准用量",
      "type": "decimal",
      "required": true,
      "configurable": false,
      "min": 0.0001,
      "precision": 4,
      "listVisible": true,
      "listOrder": 4,
      "listWidth": 120,
      "group": "dosage"
    },
    {
      "code": "unit",
      "label": "计量单位",
      "type": "select",
      "required": true,
      "configurable": true,
      "options": [
        {"value": "kg",    "label": "公斤"},
        {"value": "g",     "label": "克"},
        {"value": "piece", "label": "个"},
        {"value": "pack",  "label": "包"}
      ],
      "defaultValue": "kg",
      "listVisible": true,
      "listOrder": 5,
      "listWidth": 80,
      "group": "dosage"
    },
    {
      "code": "yieldRate",
      "label": "出成率(%)",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "min": 0.01,
      "max": 100,
      "precision": 2,
      "defaultValue": 100.00,
      "listVisible": true,
      "listOrder": 6,
      "listWidth": 100,
      "group": "dosage"
    },
    {
      "code": "unitPrice",
      "label": "单价",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "min": 0,
      "precision": 4,
      "listVisible": true,
      "listOrder": 7,
      "listWidth": 100,
      "group": "cost"
    },
    {
      "code": "taxRate",
      "label": "税率(%)",
      "type": "decimal",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "min": 0,
      "max": 100,
      "precision": 2,
      "defaultValue": 13,
      "group": "cost"
    },
    {
      "code": "sortOrder",
      "label": "排序",
      "type": "integer",
      "required": false,
      "configurable": true,
      "defaultVisible": false,
      "defaultValue": 0,
      "group": "basic"
    },
    {
      "code": "remark",
      "label": "备注",
      "type": "textarea",
      "required": false,
      "configurable": true,
      "defaultVisible": true,
      "group": "basic"
    }
  ],
  "groups": [
    {"code": "basic",  "label": "基本信息",   "order": 1},
    {"code": "dosage", "label": "用量与出成", "order": 2},
    {"code": "cost",   "label": "成本",       "order": 3}
  ]
}'::jsonb,

    validation_schema = '{
  "rules": [
    {
      "code": "TOTAL_YIELD_RATE_CHECK",
      "label": "总出成率校验",
      "enabled": true,
      "configurable": true
    },
    {
      "code": "REQUIRE_RAW_MATERIAL",
      "label": "必须包含原料",
      "enabled": true,
      "configurable": true
    },
    {
      "code": "DUPLICATE_MATERIAL_CHECK",
      "label": "重复物料校验",
      "enabled": true,
      "configurable": true
    }
  ]
}'::jsonb,

    updated_at = NOW()
WHERE module_code = 'bom';
