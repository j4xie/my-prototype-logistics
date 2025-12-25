package com.joolun.mall.dto.industry;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 行业趋势项
 * 如: AI智能溯源兴起、区块链溯源标准化
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendItem {

    /**
     * 趋势标题
     */
    private String title;

    /**
     * 标签类型: hot/rising/stable
     */
    private String tag;

    /**
     * 趋势描述
     */
    private String description;

    /**
     * 热度指数 (0-100)
     */
    private Integer hotIndex;

    /**
     * 相关关键词
     */
    private String[] keywords;
}
