package com.cretas.aims.utils;

import com.cretas.aims.exception.BusinessException;

/**
 * Token工具类
 * 统一处理Token提取逻辑
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public class TokenUtils {

    private static final String BEARER_PREFIX = "Bearer ";
    private static final int BEARER_PREFIX_LENGTH = 7;

    /**
     * 从Authorization头中提取Token
     *
     * @param authorization Authorization头内容
     * @return JWT Token字符串
     * @throws BusinessException 如果Authorization头格式无效
     */
    public static String extractToken(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) {
            throw new BusinessException("Authorization头不能为空");
        }

        if (!authorization.startsWith(BEARER_PREFIX)) {
            throw new BusinessException("无效的Authorization头格式，必须以'Bearer '开头");
        }

        String token = authorization.substring(BEARER_PREFIX_LENGTH).trim();
        if (token.isEmpty()) {
            throw new BusinessException("Token不能为空");
        }

        return token;
    }

    /**
     * 验证Authorization头格式是否有效
     *
     * @param authorization Authorization头内容
     * @return true如果格式有效，false否则
     */
    public static boolean isValidAuthorizationHeader(String authorization) {
        if (authorization == null || authorization.trim().isEmpty()) {
            return false;
        }

        if (!authorization.startsWith(BEARER_PREFIX)) {
            return false;
        }

        String token = authorization.substring(BEARER_PREFIX_LENGTH).trim();
        return !token.isEmpty();
    }
}
