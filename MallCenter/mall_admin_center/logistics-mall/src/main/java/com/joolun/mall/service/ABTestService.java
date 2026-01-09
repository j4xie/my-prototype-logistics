package com.joolun.mall.service;

import java.util.Map;

/**
 * A/B 测试服务接口
 * 用于推荐算法和AI对话的效果评估
 */
public interface ABTestService {

    /**
     * 为用户分配实验组
     * @param userId 用户ID
     * @param experimentName 实验名称
     * @return 实验组名称 (control/treatment/treatment_b等)
     */
    String assignGroup(Long userId, String experimentName);

    /**
     * 记录实验指标
     * @param userId 用户ID
     * @param experimentName 实验名称
     * @param metricName 指标名称 (click, purchase, session_duration等)
     * @param value 指标值
     */
    void recordMetric(Long userId, String experimentName, String metricName, double value);

    /**
     * 获取实验统计数据
     * @param experimentName 实验名称
     * @return 各组指标统计
     */
    Map<String, Object> getExperimentStats(String experimentName);

    /**
     * 检查实验是否启用
     * @param experimentName 实验名称
     * @return 是否启用
     */
    boolean isExperimentEnabled(String experimentName);

    /**
     * 获取用户所在的实验组
     * @param userId 用户ID
     * @param experimentName 实验名称
     * @return 实验组名称，如果用户未参与则返回null
     */
    String getUserGroup(Long userId, String experimentName);

    // 预定义的实验名称常量
    String EXP_VECTOR_SEARCH = "vector_search_v1";           // 向量搜索实验
    String EXP_EXPRESS_MATCH = "express_match_v1";           // 极速匹配服务实验
    String EXP_RAG_KNOWLEDGE = "rag_knowledge_v1";           // RAG知识库实验
    String EXP_FEATURE_128D = "feature_128d_v1";             // 128维特征实验
}
