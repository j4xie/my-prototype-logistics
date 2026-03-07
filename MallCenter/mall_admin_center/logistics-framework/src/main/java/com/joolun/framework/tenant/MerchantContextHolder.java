package com.joolun.framework.tenant;

/**
 * 商户上下文 ThreadLocal 持有者
 * 用于 TenantLineInnerInterceptor 获取当前商户ID
 */
public class MerchantContextHolder {

    private static final ThreadLocal<Long> MERCHANT_ID = new ThreadLocal<>();

    /**
     * 是否跳过租户过滤（Admin 后台管理接口需要查看所有商户数据）
     */
    private static final ThreadLocal<Boolean> SKIP_TENANT = ThreadLocal.withInitial(() -> Boolean.FALSE);

    public static void setMerchantId(Long merchantId) {
        MERCHANT_ID.set(merchantId);
    }

    public static Long getMerchantId() {
        return MERCHANT_ID.get();
    }

    public static void setSkipTenant(boolean skip) {
        SKIP_TENANT.set(skip);
    }

    public static boolean isSkipTenant() {
        return Boolean.TRUE.equals(SKIP_TENANT.get());
    }

    public static void clear() {
        MERCHANT_ID.remove();
        SKIP_TENANT.remove();
    }
}
