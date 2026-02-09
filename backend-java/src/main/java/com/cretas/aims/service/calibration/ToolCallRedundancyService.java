package com.cretas.aims.service.calibration;

import com.cretas.aims.entity.calibration.ToolCallRecord;

import java.util.Map;
import java.util.Optional;

/**
 * 工具调用冗余检测服务接口
 * 用于检测和管理会话内的重复工具调用，避免不必要的资源浪费
 *
 * 基于 ET-Agent 论文 (arXiv:2601.06860) 的行为校准设计
 * - 使用 SHA-256 哈希进行参数比较
 * - 支持可配置的缓存 TTL
 * - 记录冗余调用以用于后续分析和校准
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-18
 */
public interface ToolCallRedundancyService {

    /**
     * 默认缓存 TTL（分钟）
     */
    int DEFAULT_CACHE_TTL_MINUTES = 5;

    /**
     * 检查工具调用是否为冗余调用
     * 基于会话ID、工具名称和参数哈希进行匹配
     *
     * @param sessionId  会话ID
     * @param toolName   工具名称
     * @param parameters 工具调用参数
     * @return true 如果是冗余调用，false 否则
     */
    boolean isRedundant(String sessionId, String toolName, Map<String, Object> parameters);

    /**
     * 记录工具调用
     * 将工具调用信息持久化到数据库，用于后续分析
     *
     * @param record 工具调用记录
     * @return 保存后的记录（包含生成的ID）
     */
    ToolCallRecord recordToolCall(ToolCallRecord record);

    /**
     * 获取缓存的结果
     * 如果存在未过期的相同调用缓存，返回其结果
     *
     * @param sessionId  会话ID
     * @param toolName   工具名称
     * @param parameters 工具调用参数
     * @return 缓存的结果（如果存在且未过期），否则返回 Optional.empty()
     */
    Optional<String> getCachedResult(String sessionId, String toolName, Map<String, Object> parameters);

    /**
     * 缓存工具调用结果
     * 将成功的工具调用结果缓存起来，供后续相同调用复用
     *
     * @param sessionId      会话ID
     * @param toolName       工具名称
     * @param parameters     工具调用参数
     * @param result         调用结果（JSON 格式）
     * @param originalCallId 原始调用记录ID
     */
    void cacheResult(String sessionId, String toolName, Map<String, Object> parameters,
                     String result, Long originalCallId);

    /**
     * 使用自定义 TTL 缓存工具调用结果
     *
     * @param sessionId      会话ID
     * @param toolName       工具名称
     * @param parameters     工具调用参数
     * @param result         调用结果（JSON 格式）
     * @param originalCallId 原始调用记录ID
     * @param ttlMinutes     缓存有效期（分钟）
     */
    void cacheResult(String sessionId, String toolName, Map<String, Object> parameters,
                     String result, Long originalCallId, int ttlMinutes);

    /**
     * 清除会话的所有缓存
     * 用于会话结束或需要强制刷新时
     *
     * @param sessionId 会话ID
     * @return 被清除的缓存条目数量
     */
    int clearSessionCache(String sessionId);

    /**
     * 计算参数的 SHA-256 哈希值
     * 用于快速比较参数是否相同
     *
     * @param parameters 工具调用参数
     * @return SHA-256 哈希值（64 字符十六进制字符串）
     */
    String computeParametersHash(Map<String, Object> parameters);

    /**
     * 获取会话的冗余调用统计
     *
     * @param sessionId 会话ID
     * @return 冗余调用统计信息
     */
    RedundancyStats getSessionStats(String sessionId);

    /**
     * 标记工具调用为冗余
     * 更新现有的调用记录，标记其为冗余调用
     *
     * @param recordId       调用记录ID
     * @param originalCallId 原始调用ID
     * @param reason         冗余原因描述
     */
    void markAsRedundant(Long recordId, Long originalCallId, String reason);

    /**
     * 清理过期缓存
     * 删除所有已过期的缓存条目
     *
     * @return 被清理的缓存条目数量
     */
    int cleanupExpiredCache();

    /**
     * 冗余调用统计信息
     */
    interface RedundancyStats {
        /**
         * @return 总调用次数
         */
        long getTotalCalls();

        /**
         * @return 冗余调用次数
         */
        long getRedundantCalls();

        /**
         * @return 冗余率 (0.0 - 1.0)
         */
        double getRedundancyRate();

        /**
         * @return 缓存命中次数
         */
        long getCacheHits();

        /**
         * @return 估算节省的执行时间（毫秒）
         */
        long getEstimatedTimeSavedMs();
    }
}
