package com.joolun.mall.entity;

import com.baomidou.mybatisplus.annotation.*;
import com.baomidou.mybatisplus.extension.activerecord.Model;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * AI装修会话实体
 */
@Data
@TableName("ai_decoration_session")
@EqualsAndHashCode(callSuper = true)
public class AiDecorationSession extends Model<AiDecorationSession> {
    private static final long serialVersionUID = 1L;

    @TableId(type = IdType.AUTO)
    private Long id;

    /**
     * 会话UUID
     */
    private String sessionId;

    /**
     * 商户ID
     */
    private Long merchantId;

    /**
     * 用户ID
     */
    private Long userId;

    /**
     * 关联的页面配置ID
     */
    private Long pageConfigId;

    /**
     * 会话标题
     */
    private String title;

    /**
     * 会话状态：active/completed/abandoned
     */
    private String status;

    /**
     * 用户输入的需求描述
     */
    private String userRequirement;

    /**
     * AI分析结果 JSON
     */
    private String aiAnalysis;

    /**
     * 推荐的模板ID列表 JSON
     */
    private String recommendedTemplates;

    /**
     * 推荐的主题预设ID列表 JSON
     */
    private String recommendedThemes;

    /**
     * 生成的配置 JSON
     */
    private String generatedConfig;

    /**
     * 对话历史 JSON
     */
    private String conversationHistory;

    /**
     * 用户反馈
     */
    private String userFeedback;

    /**
     * 用户评分：1-5
     */
    private Integer userRating;

    /**
     * 是否已应用配置：0否 1是
     */
    private Integer isApplied;

    /**
     * 应用时间
     */
    private LocalDateTime appliedTime;

    /**
     * 过期时间
     */
    private LocalDateTime expireTime;

    // ==================== 引导流程字段 ====================

    /**
     * 当前引导步骤：1-4
     */
    private Integer currentStep;

    /**
     * 选择的行业类型
     */
    private String selectedIndustry;

    /**
     * 选择的风格类型
     */
    private String selectedStyle;

    /**
     * 选择的主题编码
     */
    private String selectedThemeCode;

    /**
     * 选择的布局ID
     */
    private Long selectedLayoutId;

    /**
     * 引导过程中间数据 JSON
     */
    private String guideData;

    /**
     * 创建时间
     */
    private LocalDateTime createTime;

    /**
     * 更新时间
     */
    private LocalDateTime updateTime;
}
