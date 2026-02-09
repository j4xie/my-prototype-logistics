package com.cretas.aims.listener;

import com.cretas.aims.event.SkuComplexityChangedEvent;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

/**
 * SKU 复杂度变更事件监听器
 *
 * <p>监听 SKU 复杂度变更事件，触发后续处理：
 * <ul>
 *   <li>记录变更日志</li>
 *   <li>通知排产系统更新特征权重</li>
 *   <li>更新工时预估模型</li>
 * </ul>
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-22
 */
@Slf4j
@Component
public class SkuComplexityEventListener {

    /**
     * 处理 SKU 复杂度变更事件
     *
     * @param event 复杂度变更事件
     */
    @EventListener
    @Async
    public void handleSkuComplexityChanged(SkuComplexityChangedEvent event) {
        // 空事件保护
        if (event == null) {
            log.warn("收到空的SKU复杂度变更事件，忽略处理");
            return;
        }

        log.info("收到SKU复杂度变更事件: {}", event);

        try {
            // 记录变更
            logComplexityChange(event);

            // 如果是AI分析结果，可以触发额外处理
            if (event.isAiAnalyzed()) {
                handleAiAnalyzedComplexity(event);
            }

            // 如果复杂度显著变化（超过1级），触发排产参数更新
            if (Math.abs(event.getComplexityDelta()) > 1) {
                triggerSchedulingParameterUpdate(event);
            }

        } catch (Exception e) {
            log.error("处理SKU复杂度变更事件失败: factoryId={}, skuCode={}, error={}",
                    event.getFactoryId(), event.getSkuCode(), e.getMessage(), e);
        }
    }

    /**
     * 记录复杂度变更日志
     */
    private void logComplexityChange(SkuComplexityChangedEvent event) {
        if (event.isNew()) {
            log.info("新建SKU复杂度记录: factoryId={}, skuCode={}, complexity={}({}), source={}",
                    event.getFactoryId(),
                    event.getSkuCode(),
                    event.getNewComplexity(),
                    event.getNewComplexityDescription(),
                    event.getSourceType());
        } else {
            String direction = event.isComplexityIncreased() ? "上升" : "下降";
            log.info("SKU复杂度变更: factoryId={}, skuCode={}, {}->{}({}), source={}, reason={}",
                    event.getFactoryId(),
                    event.getSkuCode(),
                    event.getOldComplexity(),
                    event.getNewComplexity(),
                    direction,
                    event.getSourceType(),
                    event.getReason());
        }
    }

    /**
     * 处理AI分析的复杂度结果
     */
    private void handleAiAnalyzedComplexity(SkuComplexityChangedEvent event) {
        log.info("AI分析复杂度已更新: factoryId={}, skuCode={}, complexity={}, reason={}",
                event.getFactoryId(),
                event.getSkuCode(),
                event.getNewComplexity(),
                event.getReason());

        // TODO: 可以在这里添加以下功能：
        // 1. 将AI分析结果发送到消息队列，供其他服务消费
        // 2. 更新缓存中的SKU特征数据
        // 3. 触发相关报表刷新
    }

    /**
     * 触发排产参数更新
     * 当复杂度显著变化时，需要更新排产系统的相关参数
     */
    private void triggerSchedulingParameterUpdate(SkuComplexityChangedEvent event) {
        log.info("SKU复杂度显著变化，触发排产参数更新: factoryId={}, skuCode={}, delta={}",
                event.getFactoryId(),
                event.getSkuCode(),
                event.getComplexityDelta());

        // TODO: 可以在这里添加以下功能：
        // 1. 调用 APSAdaptiveSchedulingService 更新SKU特征权重
        // 2. 重新计算该SKU相关的未完成订单的预计工时
        // 3. 如果有正在进行的排产，可能需要触发重排建议
    }
}
