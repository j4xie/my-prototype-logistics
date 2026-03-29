package com.cretas.aims.service.mobile.impl;

import com.cretas.aims.dto.MobileDTO;
import com.cretas.aims.entity.User;
import com.cretas.aims.exception.BusinessException;
import com.cretas.aims.exception.ResourceNotFoundException;
import com.cretas.aims.repository.SessionRepository;
import com.cretas.aims.repository.UserRepository;
import com.cretas.aims.service.TempTokenService;
import com.cretas.aims.service.mobile.MobilePasswordService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 移动端密码管理服务实现
 *
 * @author Cretas Team
 * @since 2026-03-28
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MobilePasswordServiceImpl implements MobilePasswordService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final PasswordEncoder passwordEncoder;
    private final TempTokenService tempTokenService;

    // 验证码存储（实际应使用Redis）
    private final Map<String, VerificationCodeData> verificationCodes = new ConcurrentHashMap<>();

    /**
     * 验证码数据结构
     */
    private static class VerificationCodeData {
        String code;
        LocalDateTime createdAt;
        LocalDateTime expiresAt;
        int retryCount;

        public VerificationCodeData(String code, LocalDateTime createdAt, LocalDateTime expiresAt) {
            this.code = code;
            this.createdAt = createdAt;
            this.expiresAt = expiresAt;
            this.retryCount = 0;
        }
    }

    @Override
    @Transactional
    public void changePassword(Long userId, String oldPassword, String newPassword) {
        // 查询用户
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));

        // 验证旧密码
        if (!passwordEncoder.matches(oldPassword, user.getPasswordHash())) {
            throw new BusinessException("原密码错误");
        }

        // 更新密码
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 撤销所有会话
        sessionRepository.revokeAllUserSessions(userId.longValue());
    }

    @Override
    @Transactional
    public void resetPassword(String factoryId, String username, String newPassword) {
        User user = userRepository.findByFactoryIdAndUsername(factoryId, username)
                .orElseThrow(() -> new ResourceNotFoundException("用户不存在"));

        // 更新密码
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);

        // 撤销所有会话
        sessionRepository.revokeAllUserSessions(user.getId().longValue());
    }

    @Override
    @Transactional
    public MobileDTO.SendVerificationCodeResponse sendVerificationCode(MobileDTO.SendVerificationCodeRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String verificationType = request.getVerificationType();

        log.info("发送验证码: phone={}, type={}", phoneNumber, verificationType);

        // 检查该手机号是否存在用户
        List<User> users = userRepository.findAllByPhone(phoneNumber);
        if (users.isEmpty()) {
            throw new BusinessException("该手机号未注册");
        }

        // 检查是否在冷却期（60秒内只能发送一次）
        String cacheKey = "verification_" + phoneNumber;
        VerificationCodeData existingData = verificationCodes.get(cacheKey);
        if (existingData != null && existingData.createdAt.plusSeconds(60).isAfter(LocalDateTime.now())) {
            long retryAfter = 60 - java.time.Duration.between(existingData.createdAt, LocalDateTime.now()).getSeconds();
            return MobileDTO.SendVerificationCodeResponse.builder()
                    .success(false)
                    .message("发送过于频繁，请稍后再试")
                    .expiresIn(null)
                    .retryAfter((int) retryAfter)
                    .sentAt(existingData.createdAt)
                    .build();
        }

        // 生成6位数字验证码
        String code = String.format("%06d", new Random().nextInt(999999));
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(5); // 5分钟有效期

        // 存储验证码
        VerificationCodeData codeData = new VerificationCodeData(code, now, expiresAt);
        verificationCodes.put(cacheKey, codeData);

        // TODO: 实际应调用SMS服务发送短信
        log.info("【模拟短信】验证码: {} (有效期5分钟)", code);
        log.info("发送验证码到 {}: {}", phoneNumber, code);

        return MobileDTO.SendVerificationCodeResponse.builder()
                .success(true)
                .message("验证码已发送")
                .expiresIn(300) // 5分钟
                .retryAfter(60) // 60秒后可重试
                .sentAt(now)
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.VerifyResetCodeResponse verifyResetCode(MobileDTO.VerifyResetCodeRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String inputCode = request.getVerificationCode();

        log.info("验证重置码: phone={}, code={}", phoneNumber, inputCode);

        // 检查验证码是否存在
        String cacheKey = "verification_" + phoneNumber;
        VerificationCodeData codeData = verificationCodes.get(cacheKey);

        if (codeData == null) {
            throw new BusinessException("验证码不存在或已过期");
        }

        // 检查是否过期
        if (LocalDateTime.now().isAfter(codeData.expiresAt)) {
            verificationCodes.remove(cacheKey);
            throw new BusinessException("验证码已过期");
        }

        // 验证码错误次数限制（最多3次）
        if (codeData.retryCount >= 3) {
            verificationCodes.remove(cacheKey);
            throw new BusinessException("验证码错误次数过多，请重新获取");
        }

        // 验证码校验
        if (!codeData.code.equals(inputCode)) {
            codeData.retryCount++;
            throw new BusinessException("验证码错误");
        }

        // 验证成功，生成重置令牌（30分钟有效）
        String resetToken = tempTokenService.generateTempToken(phoneNumber, 30);
        LocalDateTime now = LocalDateTime.now();

        // 删除验证码
        verificationCodes.remove(cacheKey);

        log.info("验证码验证成功: phone={}", phoneNumber);

        return MobileDTO.VerifyResetCodeResponse.builder()
                .success(true)
                .message("验证成功")
                .resetToken(resetToken)
                .expiresIn(1800) // 30分钟
                .verifiedAt(now)
                .build();
    }

    @Override
    @Transactional
    public MobileDTO.ForgotPasswordResponse forgotPassword(MobileDTO.ForgotPasswordRequest request) {
        String phoneNumber = request.getPhoneNumber();
        String resetToken = request.getResetToken();
        String newPassword = request.getNewPassword();

        log.info("忘记密码-重置密码: phone={}", phoneNumber);

        // 验证重置令牌
        String phoneFromToken = tempTokenService.validateAndGetPhone(resetToken);
        if (phoneFromToken == null || !phoneFromToken.equals(phoneNumber)) {
            throw new BusinessException("重置令牌无效或已过期");
        }

        // 查找用户（手机号可能对应多个用户）
        List<User> users = userRepository.findAllByPhone(phoneNumber);
        if (users.isEmpty()) {
            throw new BusinessException("该手机号未注册");
        }

        // 更新所有匹配用户的密码
        String encodedPassword = passwordEncoder.encode(newPassword);
        int updatedCount = 0;
        for (User user : users) {
            user.setPasswordHash(encodedPassword);
            userRepository.save(user);

            // 撤销该用户所有会话
            sessionRepository.revokeAllUserSessions(user.getId().longValue());

            updatedCount++;
            log.info("密码已重置: userId={}, username={}", user.getId(), user.getUsername());
        }

        // 删除重置令牌
        tempTokenService.deleteTempToken(resetToken);

        LocalDateTime now = LocalDateTime.now();
        log.info("密码重置完成: phone={}, 更新了{}个账户", phoneNumber, updatedCount);

        return MobileDTO.ForgotPasswordResponse.builder()
                .success(true)
                .message(updatedCount > 1
                        ? String.format("密码重置成功，已更新%d个关联账户", updatedCount)
                        : "密码重置成功")
                .resetAt(now)
                .build();
    }
}
