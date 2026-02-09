package com.cretas.aims.service;

import com.cretas.aims.entity.intent.IntentPreviewToken;

import java.util.Map;
import java.util.Optional;

/**
 * 预览令牌服务 - TCC (Try-Confirm-Cancel) 模式
 *
 * 提供预览-确认机制的核心功能:
 * 1. Try (Preview): 创建令牌并持久化
 * 2. Confirm: 验证令牌并执行操作
 * 3. Cancel: 取消令牌
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
public interface PreviewTokenService {

    /**
     * 创建预览令牌 (Try 阶段)
     *
     * @param factoryId 工厂ID
     * @param userId 用户ID
     * @param username 用户名
     * @param intentCode 意图代码
     * @param intentName 意图名称
     * @param entityType 实体类型
     * @param entityId 实体ID
     * @param operation 操作类型
     * @param previewData 预览数据 (Map 会被序列化为 JSON)
     * @param currentValues 当前值快照
     * @param newValues 新值
     * @param expiresInSeconds 过期时间 (秒)
     * @return 创建的令牌实体
     */
    IntentPreviewToken createToken(String factoryId, Long userId, String username,
                                    String intentCode, String intentName,
                                    String entityType, String entityId, String operation,
                                    Map<String, Object> previewData,
                                    Map<String, Object> currentValues,
                                    Map<String, Object> newValues,
                                    int expiresInSeconds);

    /**
     * 创建预览令牌 (默认5分钟过期)
     */
    default IntentPreviewToken createToken(String factoryId, Long userId, String username,
                                            String intentCode, String intentName,
                                            String entityType, String entityId, String operation,
                                            Map<String, Object> previewData,
                                            Map<String, Object> currentValues,
                                            Map<String, Object> newValues) {
        return createToken(factoryId, userId, username, intentCode, intentName,
                entityType, entityId, operation, previewData, currentValues, newValues, 300);
    }

    /**
     * 验证令牌有效性
     *
     * @param token 令牌值
     * @return 有效的令牌实体，如果无效返回 empty
     */
    Optional<IntentPreviewToken> validateToken(String token);

    /**
     * 验证令牌有效性并检查用户匹配
     *
     * @param token 令牌值
     * @param userId 用户ID
     * @return 有效的令牌实体，如果无效或用户不匹配返回 empty
     */
    Optional<IntentPreviewToken> validateTokenForUser(String token, Long userId);

    /**
     * 确认令牌并执行操作 (Confirm 阶段)
     *
     * @param token 令牌值
     * @param userId 执行用户ID
     * @return 确认结果，包含执行状态和消息
     */
    ConfirmResult confirmToken(String token, Long userId);

    /**
     * 取消令牌 (Cancel 阶段)
     *
     * @param token 令牌值
     * @param userId 用户ID
     * @param reason 取消原因
     * @return 是否成功取消
     */
    boolean cancelToken(String token, Long userId, String reason);

    /**
     * 获取令牌的预览数据
     *
     * @param token 令牌值
     * @return 预览数据 Map
     */
    Optional<Map<String, Object>> getPreviewData(String token);

    /**
     * 处理过期令牌 (定时任务调用)
     *
     * @return 处理的过期令牌数量
     */
    int processExpiredTokens();

    /**
     * 清理历史令牌 (保留指定天数内的记录)
     *
     * @param daysToKeep 保留天数
     * @return 删除的记录数
     */
    int cleanupOldTokens(int daysToKeep);

    /**
     * 确认结果
     */
    @lombok.Data
    @lombok.Builder
    @lombok.NoArgsConstructor
    @lombok.AllArgsConstructor
    class ConfirmResult {
        private boolean success;
        private String message;
        private String intentCode;
        private Map<String, Object> executionResult;
        private IntentPreviewToken token;

        public static ConfirmResult success(String message, IntentPreviewToken token, Map<String, Object> result) {
            return ConfirmResult.builder()
                    .success(true)
                    .message(message)
                    .intentCode(token.getIntentCode())
                    .executionResult(result)
                    .token(token)
                    .build();
        }

        public static ConfirmResult failure(String message) {
            return ConfirmResult.builder()
                    .success(false)
                    .message(message)
                    .build();
        }

        public static ConfirmResult invalidToken() {
            return failure("令牌无效或已过期");
        }

        public static ConfirmResult userMismatch() {
            return failure("令牌不属于当前用户");
        }

        public static ConfirmResult expired() {
            return failure("令牌已过期，请重新发起预览");
        }
    }
}
