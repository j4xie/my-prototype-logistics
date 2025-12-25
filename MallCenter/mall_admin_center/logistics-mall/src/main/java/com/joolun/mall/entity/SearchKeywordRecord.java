package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * 搜索关键词记录表
 * 记录用户搜索的关键词，特别是无结果的搜索
 */
@Data
@TableName("search_keyword_record")
@EqualsAndHashCode(callSuper = true)
public class SearchKeywordRecord extends Model<SearchKeywordRecord> {
    private static final long serialVersionUID = 1L;

    /**
     * 记录ID
     */
    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 搜索关键词
     */
    private String keyword;

    /**
     * 标准化后的关键词(去空格/小写)
     */
    private String normalizedKeyword;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 商户ID(如果是商户用户)
     */
    private Long merchantId;

    /**
     * 联系电话
     */
    private String phone;

    /**
     * 微信openid
     */
    private String openid;

    /**
     * 搜索结果数量
     */
    private Integer resultCount;

    /**
     * 搜索来源: search_bar/ai_chat/category
     */
    private String searchSource;

    /**
     * 状态: 0=待处理 1=已匹配 2=已通知 3=已忽略
     */
    private Integer status;

    /**
     * 匹配到的商品ID列表 (JSON)
     */
    private String matchedProductIds;

    /**
     * 匹配时间
     */
    private LocalDateTime matchedTime;

    /**
     * 匹配操作人ID
     */
    private Long matchedBy;

    /**
     * 关联的通知ID
     */
    private Long notificationId;

    /**
     * 通知时间
     */
    private LocalDateTime notifiedTime;

    /**
     * 扩展数据(设备信息、位置等) JSON
     */
    private String extraData;

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
