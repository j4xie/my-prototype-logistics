package com.cretas.aims.entity.enums;

/**
 * 产品/菜品分类常量
 * ProductType.productCategory 使用 String 存储，此类定义标准值
 * 支持食品工厂和餐饮门店两种业态
 *
 * @author Cretas Team
 * @version 2.0.0
 * @since 2026-02-19
 */
public final class ProductCategory {

    private ProductCategory() {}

    // ==================== 工厂通用 ====================
    /** 成品 */
    public static final String FINISHED_PRODUCT = "FINISHED_PRODUCT";
    /** 原材料 */
    public static final String RAW_MATERIAL = "RAW_MATERIAL";
    /** 包装材料 */
    public static final String PACKAGING = "PACKAGING";
    /** 调味料 */
    public static final String SEASONING = "SEASONING";
    /** 客供料 */
    public static final String CUSTOMER_MATERIAL = "CUSTOMER_MATERIAL";

    // ==================== 餐饮扩展 ====================
    /** 菜品（餐饮出品） */
    public static final String DISH = "DISH";
    /** 套餐（多菜品组合） */
    public static final String COMBO = "COMBO";
    /** 半成品（中央厨房预制） */
    public static final String SEMI_FINISHED = "SEMI_FINISHED";
    /** 加料/配料（可选附加项） */
    public static final String ADD_ON = "ADD_ON";

    /**
     * 判断是否为餐饮类产品
     */
    public static boolean isRestaurantCategory(String category) {
        return DISH.equals(category) || COMBO.equals(category)
                || ADD_ON.equals(category);
    }

    /**
     * 判断是否为可售卖产品（含成品和菜品）
     */
    public static boolean isSellable(String category) {
        return FINISHED_PRODUCT.equals(category) || DISH.equals(category)
                || COMBO.equals(category) || SEMI_FINISHED.equals(category);
    }
}
