-- 商户页面配置多租户唯一约束
-- 确保每个商户 + pageType 组合只有一条配置记录
-- COALESCE 处理 merchant_id 为 NULL 的平台默认配置

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpc_merchant_pagetype
    ON merchant_page_config (COALESCE(merchant_id, -1), page_type);
