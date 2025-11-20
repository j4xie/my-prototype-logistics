package com.cretas.aims.service.impl;

import com.cretas.aims.service.TempTokenService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
/**
 * 临时令牌服务实现
 * 支持Redis不可用时使用内存缓存
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
@Service
public class TempTokenServiceImpl implements TempTokenService {
    private static final Logger log = LoggerFactory.getLogger(TempTokenServiceImpl.class);
    private static final String TEMP_TOKEN_PREFIX = "temp_token:";

    private final StringRedisTemplate redisTemplate;
    private final Map<String, String> memoryCache;
    private final boolean useMemoryCache;

    // Default constructor for memory-only cache
    public TempTokenServiceImpl() {
        this.redisTemplate = null;
        this.memoryCache = new ConcurrentHashMap<>();
        this.useMemoryCache = true;
        log.warn("使用内存临时令牌服务 (Redis不可用)");
    }

    // Constructor with optional RedisTemplate
    @Autowired(required = false)
    public TempTokenServiceImpl(StringRedisTemplate redisTemplate) {
        this.redisTemplate = redisTemplate;
        this.memoryCache = new ConcurrentHashMap<>();
        this.useMemoryCache = (redisTemplate == null);

        if (useMemoryCache) {
            log.warn("使用内存临时令牌服务 (Redis不可用)");
        } else {
            log.info("使用Redis临时令牌服务");
        }
    }
    @Override
    public String generateTempToken(String phoneNumber, int durationMinutes) {
        try {
            // 生成唯一令牌
            String token = "temp_" + UUID.randomUUID().toString().replace("-", "");
            String key = TEMP_TOKEN_PREFIX + token;

            if (useMemoryCache) {
                // 存储到内存缓存（注意：内存缓存不支持自动过期，仅用于测试）
                memoryCache.put(key, phoneNumber);
                log.debug("生成临时令牌(内存): token={}, phone={}, duration={}min", token, phoneNumber, durationMinutes);
            } else {
                // 存储到Redis，设置过期时间
                redisTemplate.opsForValue().set(key, phoneNumber, durationMinutes, TimeUnit.MINUTES);
                log.debug("生成临时令牌(Redis): token={}, phone={}, duration={}min", token, phoneNumber, durationMinutes);
            }
            return token;
        } catch (Exception e) {
            log.error("生成临时令牌失败: {}", e.getMessage());
            return null;
        }
    }
    public String validateAndGetPhone(String tempToken) {
        if (tempToken == null || tempToken.isEmpty()) {
            return null;
        }
        try {
            String key = TEMP_TOKEN_PREFIX + tempToken;
            String phoneNumber = null;

            if (useMemoryCache) {
                phoneNumber = memoryCache.get(key);
            } else {
                phoneNumber = redisTemplate.opsForValue().get(key);
            }

            if (phoneNumber != null) {
                log.debug("临时令牌验证成功: token={}, phone={}", tempToken, phoneNumber);
            } else {
                log.warn("临时令牌验证失败: token={}", tempToken);
            }
            return phoneNumber;
        } catch (Exception e) {
            log.error("验证临时令牌失败: {}", e.getMessage());
            return null;
        }
    }

    @Override
    public void deleteTempToken(String tempToken) {
        if (tempToken == null || tempToken.isEmpty()) {
            return;
        }
        try {
            String key = TEMP_TOKEN_PREFIX + tempToken;

            if (useMemoryCache) {
                String removed = memoryCache.remove(key);
                log.debug("删除临时令牌(内存): token={}, deleted={}", tempToken, removed != null);
            } else {
                Boolean deleted = redisTemplate.delete(key);
                log.debug("删除临时令牌(Redis): token={}, deleted={}", tempToken, deleted);
            }
        } catch (Exception e) {
            log.error("删除临时令牌失败: {}", e.getMessage());
        }
    }

    @Override
    public boolean exists(String tempToken) {
        if (tempToken == null || tempToken.isEmpty()) {
            return false;
        }
        try {
            String key = TEMP_TOKEN_PREFIX + tempToken;

            if (useMemoryCache) {
                return memoryCache.containsKey(key);
            } else {
                Boolean exists = redisTemplate.hasKey(key);
                return Boolean.TRUE.equals(exists);
            }
        } catch (Exception e) {
            log.error("检查临时令牌存在失败: {}", e.getMessage());
            return false;
        }
    }
}
