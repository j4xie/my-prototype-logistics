package com.cretas.aims.service.impl;

import com.cretas.aims.service.TempTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 临时令牌服务 - 内存实现（无需Redis）
 *
 * 当Redis不可用时自动启用此实现
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
@Primary
public class InMemoryTempTokenServiceImpl implements TempTokenService {
    private static final Logger log = LoggerFactory.getLogger(InMemoryTempTokenServiceImpl.class);

    // 存储: token -> TokenData
    private final Map<String, TokenData> tokenStore = new ConcurrentHashMap<>();

    // 清理过期token的调度器
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();

    // Token数据类
    private static class TokenData {
        String phoneNumber;
        long expiryTime;

        TokenData(String phoneNumber, long expiryTime) {
            this.phoneNumber = phoneNumber;
            this.expiryTime = expiryTime;
        }

        boolean isExpired() {
            return System.currentTimeMillis() > expiryTime;
        }
    }

    public InMemoryTempTokenServiceImpl() {
        log.info("使用内存临时令牌服务 (Redis不可用)");

        // 每分钟清理一次过期token
        scheduler.scheduleAtFixedRate(this::cleanExpiredTokens, 1, 1, TimeUnit.MINUTES);
    }

    @Override
    public String generateTempToken(String phoneNumber, int durationMinutes) {
        // 生成唯一令牌
        String token = "temp_" + UUID.randomUUID().toString().replace("-", "");

        // 计算过期时间
        long expiryTime = System.currentTimeMillis() + TimeUnit.MINUTES.toMillis(durationMinutes);

        // 存储到内存
        tokenStore.put(token, new TokenData(phoneNumber, expiryTime));

        log.info("生成临时令牌: token={}, phone={}, duration={}min", token, phoneNumber, durationMinutes);
        return token;
    }

    @Override
    public String validateAndGetPhone(String tempToken) {
        if (tempToken == null || tempToken.isEmpty()) {
            return null;
        }

        TokenData data = tokenStore.get(tempToken);

        if (data == null) {
            log.warn("临时令牌不存在: token={}", tempToken);
            return null;
        }

        if (data.isExpired()) {
            log.warn("临时令牌已过期: token={}", tempToken);
            tokenStore.remove(tempToken);
            return null;
        }

        log.info("临时令牌验证成功: token={}, phone={}", tempToken, data.phoneNumber);
        return data.phoneNumber;
    }

    @Override
    public void deleteTempToken(String tempToken) {
        if (tempToken == null || tempToken.isEmpty()) {
            return;
        }

        TokenData removed = tokenStore.remove(tempToken);
        log.info("删除临时令牌: token={}, existed={}", tempToken, removed != null);
    }

    @Override
    public boolean exists(String tempToken) {
        if (tempToken == null || tempToken.isEmpty()) {
            return false;
        }

        TokenData data = tokenStore.get(tempToken);

        if (data == null) {
            return false;
        }

        if (data.isExpired()) {
            tokenStore.remove(tempToken);
            return false;
        }

        return true;
    }

    /**
     * 清理过期的token
     */
    private void cleanExpiredTokens() {
        int cleaned = 0;

        for (Map.Entry<String, TokenData> entry : tokenStore.entrySet()) {
            if (entry.getValue().isExpired()) {
                tokenStore.remove(entry.getKey());
                cleaned++;
            }
        }

        if (cleaned > 0) {
            log.debug("清理了 {} 个过期的临时令牌", cleaned);
        }
    }
}
