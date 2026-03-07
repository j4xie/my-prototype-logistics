package com.joolun.framework.tenant;

import com.baomidou.mybatisplus.extension.plugins.handler.TenantLineHandler;
import net.sf.jsqlparser.expression.Expression;
import net.sf.jsqlparser.expression.LongValue;
import net.sf.jsqlparser.expression.NullValue;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/**
 * 多租户处理器
 * 仅对含 merchant_id 列的表生效，自动追加 WHERE merchant_id = ?
 */
public class MerchantTenantHandler implements TenantLineHandler {

    /**
     * 需要租户隔离的表（即有 merchant_id 列的表）
     */
    private static final Set<String> TENANT_TABLES = new HashSet<>(Arrays.asList(
            "merchant_page_config",
            "merchant_page_config_version",
            "goods_spu",
            "ai_decoration_session",
            "ai_demand_record",
            "search_keyword_record",
            "merchant_staff"
    ));

    @Override
    public Expression getTenantId() {
        Long merchantId = MerchantContextHolder.getMerchantId();
        if (merchantId == null) {
            return new NullValue();
        }
        return new LongValue(merchantId);
    }

    @Override
    public String getTenantIdColumn() {
        return "merchant_id";
    }

    @Override
    public boolean ignoreTable(String tableName) {
        // 如果标记跳过租户过滤（Admin 后台），跳过所有表
        if (MerchantContextHolder.isSkipTenant()) {
            return true;
        }
        // 如果没有设置 merchantId，跳过（公开只读接口）
        if (MerchantContextHolder.getMerchantId() == null) {
            return true;
        }
        // 只对租户表生效，其他表忽略
        return !TENANT_TABLES.contains(tableName.toLowerCase());
    }
}
