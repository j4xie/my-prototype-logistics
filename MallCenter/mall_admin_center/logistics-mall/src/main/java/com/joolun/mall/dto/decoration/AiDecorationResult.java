package com.joolun.mall.dto.decoration;

import com.joolun.mall.entity.DecorationModule;
import com.joolun.mall.entity.DecorationThemePreset;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * AI装修分析结果DTO
 */
@Data
public class AiDecorationResult {

    /**
     * 会话ID
     */
    private String sessionId;

    /**
     * 是否分析成功
     */
    private boolean success;

    /**
     * 错误信息（如果有）
     */
    private String errorMessage;

    /**
     * AI分析的行业类型：food/retail/beauty/other
     */
    private String industry;

    /**
     * AI分析的风格：fresh/luxury/simple/dopamine/elegant
     */
    private String style;

    /**
     * AI提取的关键词
     */
    private List<String> keywords;

    /**
     * AI分析的色调偏好：green/gold/blue/orange/pink/neutral
     */
    private String colorTone;

    /**
     * 模块偏好设置
     */
    private ModulePreference modulePreference;

    /**
     * AI分析置信度 (0-1)
     */
    private double confidence;

    /**
     * AI回复内容
     */
    private String aiResponse;

    /**
     * 推荐的主题预设列表
     */
    private List<DecorationThemePreset> recommendedThemes;

    /**
     * 推荐的模块配置列表
     */
    private List<ModuleConfig> recommendedModules;

    /**
     * 最佳匹配的主题预设
     */
    private DecorationThemePreset bestMatchTheme;

    /**
     * 生成的页面配置JSON
     */
    private String generatedConfig;

    /**
     * 模块偏好内部类
     */
    @Data
    public static class ModulePreference {
        /**
         * 是否显示分类模块
         */
        private boolean showCategory = true;

        /**
         * 是否显示轮播图
         */
        private boolean showBanner = true;

        /**
         * 是否显示快捷操作
         */
        private boolean showQuickAction = true;

        /**
         * 是否显示推荐商品
         */
        private boolean showRecommend = true;

        /**
         * 是否显示倒计时/秒杀
         */
        private boolean showCountdown = false;

        /**
         * 是否显示公告
         */
        private boolean showAnnouncement = false;

        /**
         * 是否显示新品
         */
        private boolean showNewArrivals = false;
    }

    /**
     * 模块配置内部类
     */
    @Data
    public static class ModuleConfig {
        /**
         * 模块ID
         */
        private Long moduleId;

        /**
         * 模块编码
         */
        private String moduleCode;

        /**
         * 模块名称
         */
        private String moduleName;

        /**
         * 是否启用
         */
        private boolean enabled;

        /**
         * 排序顺序
         */
        private int sortOrder;

        /**
         * 模块参数配置
         */
        private Map<String, Object> params;
    }

    /**
     * 创建成功结果
     */
    public static AiDecorationResult success(String sessionId) {
        AiDecorationResult result = new AiDecorationResult();
        result.setSessionId(sessionId);
        result.setSuccess(true);
        return result;
    }

    /**
     * 创建失败结果
     */
    public static AiDecorationResult failure(String errorMessage) {
        AiDecorationResult result = new AiDecorationResult();
        result.setSuccess(false);
        result.setErrorMessage(errorMessage);
        return result;
    }
}
