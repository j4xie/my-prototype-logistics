package com.cretas.aims.service;

/**
 * 临时令牌服务接口
 *
 * @author Cretas Team
 * @version 1.0.0
 * @since 2025-01-09
 */
public interface TempTokenService {
    /**
     * 生成临时令牌
     *
     * @param phoneNumber 手机号
     * @param durationMinutes 有效期（分钟）
     * @return 临时令牌
     */
    String generateTempToken(String phoneNumber, int durationMinutes);
    /**
     * 验证临时令牌并获取手机号
     * @param tempToken 临时令牌
     * @return 手机号，如果令牌无效或已过期则返回null
     */
    String validateAndGetPhone(String tempToken);
    /**
     * 删除临时令牌
     */
    void deleteTempToken(String tempToken);
    /**
     * 检查临时令牌是否存在
     * @return 是否存在
     */
    boolean exists(String tempToken);
}
