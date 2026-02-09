package com.cretas.aims.entity.smartbi.enums;

/**
 * 区域类型枚举
 * 用于区分不同级别的地理区域
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-20
 */
public enum RegionType {
    /**
     * 大区
     * 例如：华东、华南、华北、华中、西南、西北、东北
     */
    REGION,

    /**
     * 省/直辖市/自治区
     * 例如：浙江省、上海市、广东省、新疆维吾尔自治区
     */
    PROVINCE,

    /**
     * 城市
     * 例如：杭州市、深圳市、北京市
     */
    CITY
}
