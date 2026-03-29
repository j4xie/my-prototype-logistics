package com.cretas.aims.service.mobile;

import com.cretas.aims.dto.MobileDTO;

/**
 * 移动端密码管理服务接口
 * <p>
 * 负责修改密码、重置密码、忘记密码（验证码发送/验证/重置）。
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
public interface MobilePasswordService {

    void changePassword(Long userId, String oldPassword, String newPassword);

    void resetPassword(String factoryId, String username, String newPassword);

    MobileDTO.SendVerificationCodeResponse sendVerificationCode(MobileDTO.SendVerificationCodeRequest request);

    MobileDTO.VerifyResetCodeResponse verifyResetCode(MobileDTO.VerifyResetCodeRequest request);

    MobileDTO.ForgotPasswordResponse forgotPassword(MobileDTO.ForgotPasswordRequest request);
}
