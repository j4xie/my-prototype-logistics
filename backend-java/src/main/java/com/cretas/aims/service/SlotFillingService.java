package com.cretas.aims.service;

import com.cretas.aims.dto.slot.RequiredSlot;
import com.cretas.aims.entity.config.AIIntentConfig;
import com.cretas.aims.dto.intent.IntentMatchResult;
import com.cretas.aims.dto.ai.IntentExecuteRequest;
import com.cretas.aims.dto.ai.IntentExecuteResponse;

import java.util.List;
import java.util.Map;

/**
 * Slot Filling 服务接口
 *
 * 提供渐进式参数收集（Slot Filling）功能：
 * - 在意图执行前检查必需参数是否缺失
 * - 从用户输入中提取参数
 * - 主动触发参数收集会话
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
public interface SlotFillingService {

    /**
     * 检查并启动 Slot Filling
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param intent 意图配置
     * @param request 执行请求
     * @param matchResult 匹配结果
     * @return 如果需要参数收集返回响应，否则返回 null
     */
    IntentExecuteResponse checkAndStartSlotFilling(
            String factoryId,
            Long userId,
            AIIntentConfig intent,
            IntentExecuteRequest request,
            IntentMatchResult matchResult);

    /**
     * 获取意图的必需槽位定义
     *
     * @param intent 意图配置
     * @return 必需槽位列表
     */
    List<RequiredSlot> getRequiredSlots(AIIntentConfig intent);

    /**
     * 从用户输入提取参数
     *
     * @param userInput 用户输入
     * @param slots 槽位定义
     * @param context 上下文
     * @param matchResult 匹配结果
     * @return 提取的参数
     */
    Map<String, Object> extractParameters(
            String userInput,
            List<RequiredSlot> slots,
            Map<String, Object> context,
            IntentMatchResult matchResult);

    /**
     * 找出缺失的槽位
     *
     * @param requiredSlots 必需槽位
     * @param extractedParams 已提取参数
     * @return 缺失槽位列表
     */
    List<RequiredSlot> findMissingSlots(
            List<RequiredSlot> requiredSlots,
            Map<String, Object> extractedParams);

    /**
     * 启动 Slot Filling 会话
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param intent 意图配置
     * @param missingSlots 缺失槽位
     * @param extractedParams 已提取参数
     * @return 响应
     */
    IntentExecuteResponse startSlotFilling(
            String factoryId,
            Long userId,
            AIIntentConfig intent,
            List<RequiredSlot> missingSlots,
            Map<String, Object> extractedParams);
}
