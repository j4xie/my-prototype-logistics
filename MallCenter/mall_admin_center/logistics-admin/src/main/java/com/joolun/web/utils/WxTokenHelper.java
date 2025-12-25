package com.joolun.web.utils;

import com.joolun.common.core.redis.RedisCache;
import com.joolun.common.utils.uuid.IdUtils;
import com.joolun.weixin.entity.WxUser;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * 小程序Token工具类
 * 用于生成微信小程序用户的JWT Token
 *
 * @author JL
 * @date 2024-12-25
 */
@Slf4j
@Component
public class WxTokenHelper {

    private static final String WX_TOKEN_KEY = "wx:token:";
    private static final String WX_USER_KEY = "wx:user:";

    /**
     * 令牌秘钥 (复用系统配置)
     */
    @Value("${token.secret}")
    private String secret;

    /**
     * 访问令牌有效期（分钟），默认120分钟
     */
    @Value("${token.expireTime:120}")
    private int expireTime;

    /**
     * 刷新令牌有效期（天），默认7天
     */
    private static final int REFRESH_TOKEN_EXPIRE_DAYS = 7;

    private final RedisCache redisCache;

    public WxTokenHelper(RedisCache redisCache) {
        this.redisCache = redisCache;
    }

    /**
     * 为微信用户创建访问令牌和刷新令牌
     *
     * @param wxUser 微信用户
     * @return Map 包含 accessToken 和 refreshToken
     */
    public Map<String, String> createTokens(WxUser wxUser) {
        String uuid = IdUtils.fastUUID();

        // 存储用户信息到Redis
        String userCacheKey = WX_USER_KEY + uuid;
        redisCache.setCacheObject(userCacheKey, wxUser, expireTime, TimeUnit.MINUTES);

        // 生成 AccessToken
        Map<String, Object> accessClaims = new HashMap<>();
        accessClaims.put("uuid", uuid);
        accessClaims.put("userId", wxUser.getId());
        accessClaims.put("phone", wxUser.getPhone());
        accessClaims.put("type", "access");

        String accessToken = Jwts.builder()
                .setClaims(accessClaims)
                .signWith(SignatureAlgorithm.HS512, secret)
                .compact();

        // 生成 RefreshToken (有效期更长)
        String refreshUuid = IdUtils.fastUUID();
        Map<String, Object> refreshClaims = new HashMap<>();
        refreshClaims.put("uuid", refreshUuid);
        refreshClaims.put("userId", wxUser.getId());
        refreshClaims.put("linkedAccessUuid", uuid);
        refreshClaims.put("type", "refresh");

        String refreshToken = Jwts.builder()
                .setClaims(refreshClaims)
                .signWith(SignatureAlgorithm.HS512, secret)
                .compact();

        // 存储刷新令牌映射
        String refreshCacheKey = WX_TOKEN_KEY + "refresh:" + refreshUuid;
        redisCache.setCacheObject(refreshCacheKey, uuid, REFRESH_TOKEN_EXPIRE_DAYS, TimeUnit.DAYS);

        log.debug("为用户 {} 创建Token成功, uuid={}", wxUser.getPhone(), uuid);

        Map<String, String> result = new HashMap<>();
        result.put("accessToken", accessToken);
        result.put("refreshToken", refreshToken);
        return result;
    }

    /**
     * 获取缓存的用户信息
     *
     * @param uuid Token中的uuid
     * @return 微信用户信息
     */
    public WxUser getWxUser(String uuid) {
        if (uuid == null || uuid.isEmpty()) {
            return null;
        }
        String userCacheKey = WX_USER_KEY + uuid;
        return redisCache.getCacheObject(userCacheKey);
    }

    /**
     * 刷新访问令牌
     *
     * @param refreshUuid 刷新令牌中的uuid
     * @param wxUser 用户信息
     * @return 新的Token Map，如果刷新失败返回null
     */
    public Map<String, String> refreshAccessToken(String refreshUuid, WxUser wxUser) {
        String refreshCacheKey = WX_TOKEN_KEY + "refresh:" + refreshUuid;
        String oldAccessUuid = redisCache.getCacheObject(refreshCacheKey);

        if (oldAccessUuid == null) {
            log.warn("刷新令牌已过期或无效: {}", refreshUuid);
            return null;
        }

        // 删除旧的访问令牌缓存
        String oldUserCacheKey = WX_USER_KEY + oldAccessUuid;
        redisCache.deleteObject(oldUserCacheKey);

        // 删除旧的刷新令牌
        redisCache.deleteObject(refreshCacheKey);

        // 创建新的Token对
        return createTokens(wxUser);
    }

    /**
     * 使令牌失效 (登出)
     *
     * @param uuid Token中的uuid
     */
    public void invalidateToken(String uuid) {
        if (uuid != null && !uuid.isEmpty()) {
            String userCacheKey = WX_USER_KEY + uuid;
            redisCache.deleteObject(userCacheKey);
        }
    }
}
