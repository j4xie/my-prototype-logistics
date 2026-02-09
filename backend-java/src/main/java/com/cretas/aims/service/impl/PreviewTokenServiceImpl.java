package com.cretas.aims.service.impl;

import com.cretas.aims.entity.intent.IntentPreviewToken;
import com.cretas.aims.entity.intent.IntentPreviewToken.TokenStatus;
import com.cretas.aims.repository.intent.IntentPreviewTokenRepository;
import com.cretas.aims.service.PreviewTokenService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * 预览令牌服务实现 - TCC (Try-Confirm-Cancel) 模式
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2026-01-24
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PreviewTokenServiceImpl implements PreviewTokenService {

    private final IntentPreviewTokenRepository tokenRepository;
    private final ObjectMapper objectMapper;

    @Override
    @Transactional
    public IntentPreviewToken createToken(String factoryId, Long userId, String username,
                                           String intentCode, String intentName,
                                           String entityType, String entityId, String operation,
                                           Map<String, Object> previewData,
                                           Map<String, Object> currentValues,
                                           Map<String, Object> newValues,
                                           int expiresInSeconds) {
        // 1. 取消同一用户同一意图的旧令牌
        int cancelled = tokenRepository.cancelPreviousTokens(factoryId, userId, intentCode, LocalDateTime.now());
        if (cancelled > 0) {
            log.debug("取消了 {} 个旧的预览令牌: factory={}, user={}, intent={}",
                    cancelled, factoryId, userId, intentCode);
        }

        // 2. 创建新令牌
        IntentPreviewToken token = IntentPreviewToken.builder()
                .token(UUID.randomUUID().toString())
                .factoryId(factoryId)
                .userId(userId)
                .username(username)
                .intentCode(intentCode)
                .intentName(intentName)
                .entityType(entityType)
                .entityId(entityId)
                .operation(operation)
                .status(TokenStatus.PENDING)
                .expiresAt(LocalDateTime.now().plusSeconds(expiresInSeconds))
                .build();

        // 3. 序列化 JSON 数据
        try {
            if (previewData != null) {
                token.setPreviewData(objectMapper.writeValueAsString(previewData));
            }
            if (currentValues != null) {
                token.setCurrentValues(objectMapper.writeValueAsString(currentValues));
            }
            if (newValues != null) {
                token.setNewValues(objectMapper.writeValueAsString(newValues));
            }
        } catch (Exception e) {
            log.error("序列化预览数据失败: {}", e.getMessage(), e);
            throw new RuntimeException("创建预览令牌失败: 数据序列化错误", e);
        }

        // 4. 保存令牌
        IntentPreviewToken saved = tokenRepository.save(token);
        log.info("创建预览令牌: token={}, factory={}, user={}, intent={}, entity={}, expires={}s",
                saved.getToken(), factoryId, userId, intentCode, entityType, expiresInSeconds);

        return saved;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<IntentPreviewToken> validateToken(String token) {
        if (token == null || token.isEmpty()) {
            return Optional.empty();
        }

        Optional<IntentPreviewToken> tokenOpt = tokenRepository.findByTokenAndStatus(token, TokenStatus.PENDING);
        if (tokenOpt.isEmpty()) {
            log.debug("令牌不存在或已处理: token={}", token);
            return Optional.empty();
        }

        IntentPreviewToken previewToken = tokenOpt.get();
        if (previewToken.isExpired()) {
            log.debug("令牌已过期: token={}, expiresAt={}", token, previewToken.getExpiresAt());
            return Optional.empty();
        }

        return Optional.of(previewToken);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<IntentPreviewToken> validateTokenForUser(String token, Long userId) {
        Optional<IntentPreviewToken> tokenOpt = validateToken(token);
        if (tokenOpt.isEmpty()) {
            return Optional.empty();
        }

        IntentPreviewToken previewToken = tokenOpt.get();
        if (!previewToken.getUserId().equals(userId)) {
            log.warn("令牌用户不匹配: token={}, tokenUser={}, requestUser={}",
                    token, previewToken.getUserId(), userId);
            return Optional.empty();
        }

        return Optional.of(previewToken);
    }

    @Override
    @Transactional
    public ConfirmResult confirmToken(String token, Long userId) {
        // 1. 验证令牌
        Optional<IntentPreviewToken> tokenOpt = tokenRepository.findByToken(token);
        if (tokenOpt.isEmpty()) {
            log.warn("确认失败 - 令牌不存在: token={}", token);
            return ConfirmResult.invalidToken();
        }

        IntentPreviewToken previewToken = tokenOpt.get();

        // 2. 检查状态
        if (previewToken.getStatus() != TokenStatus.PENDING) {
            log.warn("确认失败 - 令牌已处理: token={}, status={}", token, previewToken.getStatus());
            return ConfirmResult.failure("令牌已被处理: " + previewToken.getStatus());
        }

        // 3. 检查过期
        if (previewToken.isExpired()) {
            previewToken.expire();
            tokenRepository.save(previewToken);
            log.warn("确认失败 - 令牌已过期: token={}", token);
            return ConfirmResult.expired();
        }

        // 4. 检查用户匹配
        if (!previewToken.getUserId().equals(userId)) {
            log.warn("确认失败 - 用户不匹配: token={}, tokenUser={}, requestUser={}",
                    token, previewToken.getUserId(), userId);
            return ConfirmResult.userMismatch();
        }

        // 5. 标记为已确认
        previewToken.confirm("用户确认执行");
        tokenRepository.save(previewToken);

        log.info("令牌确认成功: token={}, intent={}, entity={}/{}",
                token, previewToken.getIntentCode(), previewToken.getEntityType(), previewToken.getEntityId());

        // 6. 返回确认结果 (实际执行由调用方根据 previewData 处理)
        Map<String, Object> previewData = new HashMap<>();
        try {
            if (previewToken.getPreviewData() != null) {
                previewData = objectMapper.readValue(previewToken.getPreviewData(),
                        new TypeReference<Map<String, Object>>() {});
            }
        } catch (Exception e) {
            log.error("解析预览数据失败: {}", e.getMessage());
        }

        return ConfirmResult.success("确认成功，操作已执行", previewToken, previewData);
    }

    @Override
    @Transactional
    public boolean cancelToken(String token, Long userId, String reason) {
        Optional<IntentPreviewToken> tokenOpt = tokenRepository.findByToken(token);
        if (tokenOpt.isEmpty()) {
            log.warn("取消失败 - 令牌不存在: token={}", token);
            return false;
        }

        IntentPreviewToken previewToken = tokenOpt.get();

        // 检查状态
        if (previewToken.getStatus() != TokenStatus.PENDING) {
            log.warn("取消失败 - 令牌已处理: token={}, status={}", token, previewToken.getStatus());
            return false;
        }

        // 检查用户匹配
        if (!previewToken.getUserId().equals(userId)) {
            log.warn("取消失败 - 用户不匹配: token={}", token);
            return false;
        }

        // 取消令牌
        previewToken.cancel(reason != null ? reason : "用户取消");
        tokenRepository.save(previewToken);

        log.info("令牌已取消: token={}, reason={}", token, reason);
        return true;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Map<String, Object>> getPreviewData(String token) {
        Optional<IntentPreviewToken> tokenOpt = validateToken(token);
        if (tokenOpt.isEmpty()) {
            return Optional.empty();
        }

        IntentPreviewToken previewToken = tokenOpt.get();
        if (previewToken.getPreviewData() == null) {
            return Optional.of(new HashMap<>());
        }

        try {
            Map<String, Object> data = objectMapper.readValue(previewToken.getPreviewData(),
                    new TypeReference<Map<String, Object>>() {});
            return Optional.of(data);
        } catch (Exception e) {
            log.error("解析预览数据失败: token={}, error={}", token, e.getMessage());
            return Optional.empty();
        }
    }

    @Override
    @Transactional
    @Scheduled(fixedRate = 60000) // 每分钟执行
    public int processExpiredTokens() {
        int expired = tokenRepository.expireOldTokens(LocalDateTime.now());
        if (expired > 0) {
            log.info("处理过期令牌: count={}", expired);
        }
        return expired;
    }

    @Override
    @Transactional
    public int cleanupOldTokens(int daysToKeep) {
        LocalDateTime before = LocalDateTime.now().minusDays(daysToKeep);
        int deleted = tokenRepository.deleteOldResolvedTokens(before);
        if (deleted > 0) {
            log.info("清理历史令牌: deleted={}, keepDays={}", deleted, daysToKeep);
        }
        return deleted;
    }
}
