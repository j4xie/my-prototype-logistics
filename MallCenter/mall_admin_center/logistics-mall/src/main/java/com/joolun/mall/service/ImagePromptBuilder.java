package com.joolun.mall.service;

import com.joolun.mall.entity.DecorationPromptTemplate;

/**
 * 图片Prompt构建器服务接口
 * 用于智能构建AI图片生成所需的prompt
 */
public interface ImagePromptBuilder {

    /**
     * 构建完整的图片生成prompt
     * @param industryType 行业类型: fresh_food/seafood/dessert/gift/baby/tech/beauty/general
     * @param styleType 风格类型: fresh/luxury/minimal/dopamine/warm
     * @param productDescription 用户商品描述
     * @param imageType 图片类型: banner/background/icon/product
     * @param size 图片尺寸，格式: 宽x高，如 750*300
     * @return 优化后的prompt字符串，可直接用于AI图片生成
     */
    String buildImagePrompt(String industryType, String styleType, String productDescription, String imageType, String size);

    /**
     * 从用户输入中匹配行业类型
     * 使用关键词映射表进行精确/模糊匹配，带缓存优化
     * @param userInput 用户输入的描述文本
     * @return 匹配的行业类型，无匹配返回 "general"
     */
    String matchIndustry(String userInput);

    /**
     * 从用户输入中匹配风格类型
     * @param userInput 用户输入的描述文本
     * @return 匹配的风格类型，无匹配返回 "fresh"（默认清新风格）
     */
    String matchStyle(String userInput);

    /**
     * 获取推荐的prompt模板
     * 根据行业+风格组合查找最佳模板
     * @param industryType 行业类型
     * @param styleType 风格类型
     * @param imageType 图片类型
     * @return 推荐的模板，不存在返回null
     */
    DecorationPromptTemplate getRecommendedTemplate(String industryType, String styleType, String imageType);

    /**
     * 智能构建prompt（自动识别行业和风格）
     * 从用户描述中自动识别行业和风格，然后构建prompt
     * @param userDescription 用户的商品/店铺描述
     * @param imageType 图片类型
     * @param size 图片尺寸
     * @return 优化后的prompt字符串
     */
    String buildSmartPrompt(String userDescription, String imageType, String size);

    /**
     * 获取负向提示词
     * 用于排除不想要的元素
     * @param industryType 行业类型
     * @param imageType 图片类型
     * @return 负向提示词字符串
     */
    String getNegativePrompt(String industryType, String imageType);
}
