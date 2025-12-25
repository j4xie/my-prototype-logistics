package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 关键词统计表 (聚合表)
 * 对搜索关键词进行统计分析
 */
@Data
@TableName("search_keyword_stats")
@EqualsAndHashCode(callSuper = true)
public class SearchKeywordStats extends Model<SearchKeywordStats> {
    private static final long serialVersionUID = 1L;

    /**
     * 统计ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 关键词(标准化后)
     */
    private String keyword;

    /**
     * 原始关键词变体列表 (JSON)
     */
    private String originalKeywords;

    /**
     * 总搜索次数
     */
    private Integer searchCount;

    /**
     * 无结果搜索次数
     */
    private Integer noResultCount;

    /**
     * 独立用户数
     */
    private Integer uniqueUsers;

    /**
     * 独立商户数
     */
    private Integer uniqueMerchants;

    /**
     * 首次搜索时间
     */
    private LocalDateTime firstSearchTime;

    /**
     * 最近搜索时间
     */
    private LocalDateTime lastSearchTime;

    /**
     * 状态: 0=待处理 1=已匹配 2=已通知 3=无需处理
     */
    private Integer status;

    /**
     * 优先级: 0=普通 1=中等 2=高
     */
    private Integer priority;

    /**
     * 是否热门关键词
     */
    private Integer isHot;

    /**
     * 匹配到的商品ID列表 (JSON)
     */
    private String matchedProductIds;

    /**
     * 匹配到的分类ID列表 (JSON)
     */
    private String matchedCategoryIds;

    /**
     * 管理员备注
     */
    private String adminNote;

    /**
     * 创建时间
     */
    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
