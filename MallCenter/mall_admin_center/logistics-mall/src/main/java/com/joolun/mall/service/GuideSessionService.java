package com.joolun.mall.service;

import com.joolun.mall.entity.AiDecorationSession;

import java.util.List;
import java.util.Map;

/**
 * 引导式装修会话服务接口
 * 提供4步骤引导流程的会话管理
 */
public interface GuideSessionService {

    /**
     * 开始新的引导会话
     *
     * @param merchantId 商户ID
     * @return 包含sessionId和行业选项的Map
     */
    Map<String, Object> startGuide(Long merchantId);

    /**
     * 处理用户在当前步骤的选择
     * 返回下一步的选项、预览数据等
     *
     * @param sessionId 会话ID
     * @param step      当前步骤 (1-4)
     * @param selection 用户选择
     * @return 下一步数据
     */
    Map<String, Object> processSelection(String sessionId, int step, String selection);

    /**
     * 获取行业选项（步骤1）
     *
     * @return 行业选项列表
     */
    List<Map<String, Object>> getIndustryOptions();

    /**
     * 获取指定行业的风格选项（步骤2）
     *
     * @param industryType 行业类型
     * @return 风格选项列表
     */
    List<Map<String, Object>> getStyleOptions(String industryType);

    /**
     * 获取行业+风格对应的主题预览（步骤3）
     *
     * @param industryType 行业类型
     * @param styleType    风格类型
     * @return 主题预览数据
     */
    Map<String, Object> getThemePreview(String industryType, String styleType);

    /**
     * 完成引导并保存配置
     *
     * @param sessionId   会话ID
     * @param finalConfig 最终配置
     * @return 保存结果
     */
    Map<String, Object> finishGuide(String sessionId, Map<String, Object> finalConfig);

    /**
     * 根据会话ID获取会话
     *
     * @param sessionId 会话UUID
     * @return 会话实体
     */
    AiDecorationSession getSession(String sessionId);

    /**
     * 更新会话
     *
     * @param session 会话实体
     * @return 更新是否成功
     */
    boolean updateSession(AiDecorationSession session);
}
