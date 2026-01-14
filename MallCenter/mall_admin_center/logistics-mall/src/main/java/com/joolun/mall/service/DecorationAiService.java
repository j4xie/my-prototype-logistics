package com.joolun.mall.service;

import com.joolun.mall.dto.decoration.AiDecorationResult;

/**
 * AI装修服务接口
 * 提供基于AI的店铺装修智能分析和推荐功能
 */
public interface DecorationAiService {

    /**
     * AI分析用户装修需求
     * 根据用户的自然语言描述，分析行业类型、风格偏好、模块需求等
     *
     * @param prompt     用户描述
     * @param merchantId 商户ID
     * @return 分析结果和推荐配置
     */
    AiDecorationResult analyze(String prompt, Long merchantId);

    /**
     * 应用AI生成的配置
     * 将AI分析生成的配置应用到商户的页面设置中
     *
     * @param sessionId 会话ID
     * @return 是否应用成功
     */
    boolean applyConfig(String sessionId);

    /**
     * 微调配置
     * 根据用户的进一步反馈，调整已生成的配置
     *
     * @param sessionId  会话ID
     * @param refinement 用户的微调描述
     * @return 调整后的分析结果
     */
    AiDecorationResult refine(String sessionId, String refinement);

    /**
     * 获取会话信息
     *
     * @param sessionId 会话ID
     * @return 会话的当前分析结果
     */
    AiDecorationResult getSessionResult(String sessionId);

    /**
     * 放弃会话
     *
     * @param sessionId 会话ID
     * @return 是否成功
     */
    boolean abandonSession(String sessionId);

    /**
     * 调用通义万相生成图片
     * 根据用户描述实时生成自定义图片
     *
     * @param prompt 图片描述
     * @param style  风格 (realistic/cartoon/anime/3d/sketch 等)
     * @param size   尺寸 (1280*720/720*1280/1024*1024 等)
     * @return 包含图片URL的结果 Map
     */
    java.util.Map<String, Object> generateImage(String prompt, String style, String size);
}
