-- V20260605_03: 凭证模板默认 seeds — Sprint 4 W2 Chat J C-VOUCHER-TPL-1
--
-- Seed 7 default templates per active factory, 内容 mirror Sprint 3 E 7 generator
-- hardcoded subjectCode 行为. 工厂没主动改时, generator 走 template 路径产出跟
-- hardcoded 完全一致的分录 (借贷必平 + 同 subjectCode + 同金额).
--
-- 工厂未配置自定义 template 时, AbstractVoucherGenerator template-first lookup 命中
-- 这些 default, 行为完全 backward compatible. 工厂自定义 template 后, 此 default 自动
-- 被 setAsDefault(custom) 取消 (clearOtherDefaults 逻辑).
--
-- SpEL: 用 #entity 作为业务实体绑定. 各 generator 字段:
--   SalesReceipt:       #entity.totalAmount
--   Return:             #entity.totalAmount
--   PurchasePayment:    #entity.totalAmount
--   Wage:               #entity.totalWage
--   Expense:            #entity.estimatedCost
--   InventoryTransfer:  #entity.totalAmount
--   Depreciation:       #entity['amount']  (Map 输入)
--
-- amountExpression 求值结果 null → BigDecimal.ZERO (跟现有 nullToZero 行为一致).

INSERT INTO voucher_templates (id, factory_id, voucher_type, name, description,
                               entries_json, is_default, is_active)
SELECT
    gen_random_uuid()::text,
    f.id,
    seed.voucher_type,
    seed.name,
    seed.description,
    seed.entries_json::jsonb,
    TRUE,   -- is_default
    TRUE    -- is_active
FROM factories f
CROSS JOIN (VALUES
    -- 销售收款 (SALES_RECEIPT)
    ('SALES_RECEIPT'::VARCHAR, '销售收款默认模板',
     '借: 1122 应收账款; 贷: 6001 主营业务收入. mirror Sprint 3 E SalesReceiptVoucherGenerator.',
     '[{"sortOrder":1,"subjectCode":"1122","subjectName":"应收账款","direction":"DEBIT","amountExpression":"#entity.totalAmount","description":"销售收入挂账"},
       {"sortOrder":2,"subjectCode":"6001","subjectName":"主营业务收入","direction":"CREDIT","amountExpression":"#entity.totalAmount","description":"销售订单收入"}]'),

    -- 退货 (RETURN) — 反向冲减
    ('RETURN', '退货默认模板',
     '借: 6001 主营业务收入 (冲减); 贷: 1122 应收账款 (冲减). mirror ReturnVoucherGenerator.',
     '[{"sortOrder":1,"subjectCode":"6001","subjectName":"主营业务收入","direction":"DEBIT","amountExpression":"#entity.totalAmount","description":"退货冲减收入"},
       {"sortOrder":2,"subjectCode":"1122","subjectName":"应收账款","direction":"CREDIT","amountExpression":"#entity.totalAmount","description":"客户应收冲减"}]'),

    -- 采购付款 (PURCHASE_PAYMENT)
    ('PURCHASE_PAYMENT', '采购付款默认模板',
     '借: 1405 库存商品; 贷: 2202 应付账款. mirror PurchasePaymentVoucherGenerator.',
     '[{"sortOrder":1,"subjectCode":"1405","subjectName":"库存商品","direction":"DEBIT","amountExpression":"#entity.totalAmount","description":"采购入库"},
       {"sortOrder":2,"subjectCode":"2202","subjectName":"应付账款","direction":"CREDIT","amountExpression":"#entity.totalAmount","description":"供应商应付"}]'),

    -- 工资发放 (WAGE)
    ('WAGE', '工资发放默认模板',
     '借: 2211 应付职工薪酬; 贷: 1002 银行存款. mirror WageVoucherGenerator.',
     '[{"sortOrder":1,"subjectCode":"2211","subjectName":"应付职工薪酬","direction":"DEBIT","amountExpression":"#entity.totalWage","description":"支付职工薪酬"},
       {"sortOrder":2,"subjectCode":"1002","subjectName":"银行存款","direction":"CREDIT","amountExpression":"#entity.totalWage","description":"工资银行划款"}]'),

    -- 报销/损耗 (EXPENSE)
    ('EXPENSE', '损耗费用默认模板',
     '借: 6602.01 管理费用-损耗; 贷: 1405 库存商品. mirror ExpenseVoucherGenerator.',
     '[{"sortOrder":1,"subjectCode":"6602.01","subjectName":"管理费用-损耗","direction":"DEBIT","amountExpression":"#entity.estimatedCost","description":"损耗费用计提"},
       {"sortOrder":2,"subjectCode":"1405","subjectName":"库存商品","direction":"CREDIT","amountExpression":"#entity.estimatedCost","description":"库存减少"}]'),

    -- 库存调拨 (INVENTORY_TRANSFER) — 借贷都是 1405
    ('INVENTORY_TRANSFER', '库存调拨默认模板',
     '借: 1405 库存商品 (调入仓); 贷: 1405 库存商品 (调出仓). mirror InventoryTransferVoucherGenerator.',
     '[{"sortOrder":1,"subjectCode":"1405","subjectName":"库存商品","direction":"DEBIT","amountExpression":"#entity.totalAmount","description":"调入仓库"},
       {"sortOrder":2,"subjectCode":"1405","subjectName":"库存商品","direction":"CREDIT","amountExpression":"#entity.totalAmount","description":"调出仓库"}]'),

    -- 折旧 (DEPRECATION) — 输入是 Map<String,Object>
    ('DEPRECATION', '折旧默认模板',
     '借: 6602.02 管理费用-折旧; 贷: 1602 累计折旧. mirror DepreciationVoucherGenerator (Map input).',
     '[{"sortOrder":1,"subjectCode":"6602.02","subjectName":"管理费用-折旧","direction":"DEBIT","amountExpression":"#entity[''amount'']","description":"折旧计提"},
       {"sortOrder":2,"subjectCode":"1602","subjectName":"累计折旧","direction":"CREDIT","amountExpression":"#entity[''amount'']","description":"累计折旧增加"}]')
) AS seed(voucher_type, name, description, entries_json)
WHERE f.deleted_at IS NULL
  -- R4 (幂等): 同 factory+voucherType+name 已存在则 skip (避免重复跑迁移污染数据)
  AND NOT EXISTS (
      SELECT 1 FROM voucher_templates vt
      WHERE vt.factory_id = f.id
        AND vt.voucher_type = seed.voucher_type
        AND vt.name = seed.name
        AND vt.deleted_at IS NULL
  );
