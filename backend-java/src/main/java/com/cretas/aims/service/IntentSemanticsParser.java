package com.cretas.aims.service;

import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.intent.IntentSemantics;
import com.cretas.aims.entity.config.AIIntentConfig;

/**
 * 意图语义解析器接口
 *
 * 负责将意图执行请求解析为结构化的语义对象。
 * 支持多种解析策略：
 * 1. 从结构化context直接解析
 * 2. 调用AI服务解析自然语言
 * 3. 混合解析（两种方式结合）
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-04
 */
public interface IntentSemanticsParser {

    /**
     * 解析意图请求为语义结构
     * 解析优先级：
     * 1. 从结构化context直接解析
     * 2. 调用AI服务解析自然语言
     * 3. 合并两种结果
     *
     * @param request 意图执行请求
     * @param intentConfig 意图配置
     * @param factoryId 工厂ID
     * @return 解析后的语义结构
     */
    IntentSemantics parse(IntentExecuteRequest request, AIIntentConfig intentConfig, String factoryId);

    /**
     * 仅从context解析（不调用AI）
     * 用于快速解析已有结构化数据的场景
     *
     * @param request 意图执行请求
     * @param intentConfig 意图配置
     * @return 解析后的语义结构
     */
    IntentSemantics parseFromContext(IntentExecuteRequest request, AIIntentConfig intentConfig);

    /**
     * 判断是否需要AI辅助解析
     * 当核心语义层级缺失或约束为空时，可能需要AI辅助
     *
     * @param request 意图执行请求
     * @param partialSemantics 部分解析结果
     * @return true表示需要AI辅助解析
     */
    boolean needsAIParsing(IntentExecuteRequest request, IntentSemantics partialSemantics);
}
