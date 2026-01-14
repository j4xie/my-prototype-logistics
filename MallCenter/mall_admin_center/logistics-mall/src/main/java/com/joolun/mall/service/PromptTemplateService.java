package com.joolun.mall.service;

import com.joolun.mall.entity.DecorationPromptTemplate;

import java.util.List;
import java.util.Map;

/**
 * Prompt模板服务接口
 * 用于管理和构建AI图片生成的prompt模板
 */
public interface PromptTemplateService {

    /**
     * 根据编码获取模板
     * @param code 模板编码，格式: {industry}_{imageType}
     * @return 模板实体，不存在返回null
     */
    DecorationPromptTemplate getByCode(String code);

    /**
     * 根据行业和图片类型获取模板列表
     * @param industryType 行业类型: fresh_food/seafood/dessert/gift/baby/tech/beauty/general
     * @param imageType 图片类型: banner/background/icon/product
     * @return 匹配的模板列表
     */
    List<DecorationPromptTemplate> getByIndustryAndType(String industryType, String imageType);

    /**
     * 根据行业获取所有模板
     * @param industryType 行业类型
     * @return 该行业的所有模板列表
     */
    List<DecorationPromptTemplate> getByIndustry(String industryType);

    /**
     * 使用模板构建prompt
     * 支持变量替换: {product}, {style}, {color_tone}, {size}
     * @param templateCode 模板编码
     * @param variables 变量键值对
     * @return 替换变量后的prompt字符串
     */
    String buildPrompt(String templateCode, Map<String, String> variables);

    /**
     * 获取所有启用的模板
     * @return 所有状态为启用的模板列表
     */
    List<DecorationPromptTemplate> listActive();

    /**
     * 根据行业、风格和图片类型获取最佳匹配模板
     * @param industryType 行业类型
     * @param styleType 风格类型: fresh/luxury/minimal/dopamine/warm
     * @param imageType 图片类型
     * @return 最佳匹配的模板，不存在返回null
     */
    DecorationPromptTemplate getBestMatch(String industryType, String styleType, String imageType);

    /**
     * 增加模板使用次数（用于统计）
     * @param templateId 模板ID
     */
    void incrementUseCount(Long templateId);
}
