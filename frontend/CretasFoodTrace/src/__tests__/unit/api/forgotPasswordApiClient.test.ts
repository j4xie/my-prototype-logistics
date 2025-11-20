/**
 * forgotPasswordAPI 单元测试
 * 测试忘记密码流程的所有API方法
 */

import { forgotPasswordAPI } from '../../../services/api/forgotPasswordApiClient';
import { createApiMock, mockSuccessResponse, mockErrorResponse, resetApiMock } from '../../utils/mockApiClient';
import { expectSuccessResponse, expectValidISODate } from '../../utils/testHelpers';
import MockAdapter from 'axios-mock-adapter';

describe('forgotPasswordAPI', () => {
  let mock: MockAdapter;
  const TEST_PHONE = '13800138000';
  const TEST_CODE = '123456';
  const TEST_TOKEN = 'reset-token-abc123';
  const TEST_PASSWORD = 'NewPassword123!';

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  describe('sendVerificationCode', () => {
    it('应该成功发送验证码', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        verificationType: 'password_reset' as const,
      };

      const mockData = {
        success: true,
        message: '验证码已发送',
        expiresIn: 300,
        retryAfter: 60,
        sentAt: new Date().toISOString(),
      };

      const mockResponse = {
        success: true,
        data: mockData,
        message: '验证码已发送',
      };

      mockSuccessResponse(
        mock,
        'post',
        '/api/mobile/auth/send-verification-code',
        mockResponse
      );

      const result = await forgotPasswordAPI.sendVerificationCode(request);

      expectSuccessResponse(result);
      expect(result.data.success).toBe(true);
      expect(result.data.expiresIn).toBe(300);
      expect(result.data.retryAfter).toBe(60);
      expectValidISODate(result.data.sentAt);
    });

    it('应该在手机号格式错误时返回错误', async () => {
      const request = {
        phoneNumber: 'invalid-phone',
        verificationType: 'password_reset' as const,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/send-verification-code',
        '手机号格式错误',
        400
      );

      await expect(forgotPasswordAPI.sendVerificationCode(request)).rejects.toThrow();
    });

    it('应该在频繁发送时返回错误', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        verificationType: 'password_reset' as const,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/send-verification-code',
        '请60秒后再试',
        429
      );

      await expect(forgotPasswordAPI.sendVerificationCode(request)).rejects.toThrow();
    });

    it('应该支持不同的验证类型', async () => {
      const types: Array<'password_reset' | 'phone_verify' | 'login_verify'> = [
        'password_reset',
        'phone_verify',
        'login_verify',
      ];

      for (const type of types) {
        const mockData = {
          success: true,
          message: '验证码已发送',
          expiresIn: 300,
          retryAfter: 60,
          sentAt: new Date().toISOString(),
        };

        mockSuccessResponse(
          mock,
          'post',
          '/api/mobile/auth/send-verification-code',
          { success: true, data: mockData }
        );

        const result = await forgotPasswordAPI.sendVerificationCode({
          phoneNumber: TEST_PHONE,
          verificationType: type,
        });

        expect(result.success).toBe(true);

        mock.reset();
      }
    });
  });

  describe('verifyResetCode', () => {
    it('应该成功验证重置码', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        verificationCode: TEST_CODE,
      };

      const mockData = {
        success: true,
        message: '验证成功',
        resetToken: TEST_TOKEN,
        expiresIn: 600,
        verifiedAt: new Date().toISOString(),
      };

      const mockResponse = {
        success: true,
        data: mockData,
        message: '验证成功',
      };

      mockSuccessResponse(
        mock,
        'post',
        '/api/mobile/auth/verify-reset-code',
        mockResponse
      );

      const result = await forgotPasswordAPI.verifyResetCode(request);

      expectSuccessResponse(result);
      expect(result.data.success).toBe(true);
      expect(result.data.resetToken).toBe(TEST_TOKEN);
      expect(result.data.expiresIn).toBe(600);
      expectValidISODate(result.data.verifiedAt);
    });

    it('应该在验证码错误时返回错误', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        verificationCode: 'WRONG_CODE',
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/verify-reset-code',
        '验证码错误',
        400
      );

      await expect(forgotPasswordAPI.verifyResetCode(request)).rejects.toThrow();
    });

    it('应该在验证码过期时返回错误', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        verificationCode: TEST_CODE,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/verify-reset-code',
        '验证码已过期',
        400
      );

      await expect(forgotPasswordAPI.verifyResetCode(request)).rejects.toThrow();
    });

    it('应该在手机号不匹配时返回错误', async () => {
      const request = {
        phoneNumber: '13900139000', // Different phone
        verificationCode: TEST_CODE,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/verify-reset-code',
        '手机号不匹配',
        400
      );

      await expect(forgotPasswordAPI.verifyResetCode(request)).rejects.toThrow();
    });
  });

  describe('forgotPassword', () => {
    it('应该成功重置密码', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        resetToken: TEST_TOKEN,
        newPassword: TEST_PASSWORD,
      };

      const mockData = {
        success: true,
        message: '密码重置成功',
        resetAt: new Date().toISOString(),
      };

      const mockResponse = {
        success: true,
        data: mockData,
        message: '密码重置成功',
      };

      mockSuccessResponse(
        mock,
        'post',
        '/api/mobile/auth/forgot-password',
        mockResponse
      );

      const result = await forgotPasswordAPI.forgotPassword(request);

      expectSuccessResponse(result);
      expect(result.data.success).toBe(true);
      expect(result.data.message).toBe('密码重置成功');
      expectValidISODate(result.data.resetAt);
    });

    it('应该在resetToken无效时返回错误', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        resetToken: 'INVALID_TOKEN',
        newPassword: TEST_PASSWORD,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/forgot-password',
        '重置令牌无效',
        400
      );

      await expect(forgotPasswordAPI.forgotPassword(request)).rejects.toThrow();
    });

    it('应该在resetToken过期时返回错误', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        resetToken: TEST_TOKEN,
        newPassword: TEST_PASSWORD,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/forgot-password',
        '重置令牌已过期',
        400
      );

      await expect(forgotPasswordAPI.forgotPassword(request)).rejects.toThrow();
    });

    it('应该在密码强度不足时返回错误', async () => {
      const request = {
        phoneNumber: TEST_PHONE,
        resetToken: TEST_TOKEN,
        newPassword: '123', // 太简单
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/forgot-password',
        '密码强度不足',
        400
      );

      await expect(forgotPasswordAPI.forgotPassword(request)).rejects.toThrow();
    });

    it('应该在手机号不匹配时返回错误', async () => {
      const request = {
        phoneNumber: '13900139000', // Different phone
        resetToken: TEST_TOKEN,
        newPassword: TEST_PASSWORD,
      };

      mockErrorResponse(
        mock,
        'post',
        '/api/mobile/auth/forgot-password',
        '手机号不匹配',
        400
      );

      await expect(forgotPasswordAPI.forgotPassword(request)).rejects.toThrow();
    });
  });

  describe('完整流程测试', () => {
    it('应该成功完成忘记密码的完整流程', async () => {
      // Step 1: 发送验证码
      const sendCodeMock = {
        success: true,
        data: {
          success: true,
          message: '验证码已发送',
          expiresIn: 300,
          retryAfter: 60,
          sentAt: new Date().toISOString(),
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        '/api/mobile/auth/send-verification-code',
        sendCodeMock
      );

      const sendResult = await forgotPasswordAPI.sendVerificationCode({
        phoneNumber: TEST_PHONE,
        verificationType: 'password_reset',
      });

      expect(sendResult.success).toBe(true);

      // Step 2: 验证验证码
      const verifyMock = {
        success: true,
        data: {
          success: true,
          message: '验证成功',
          resetToken: TEST_TOKEN,
          expiresIn: 600,
          verifiedAt: new Date().toISOString(),
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        '/api/mobile/auth/verify-reset-code',
        verifyMock
      );

      const verifyResult = await forgotPasswordAPI.verifyResetCode({
        phoneNumber: TEST_PHONE,
        verificationCode: TEST_CODE,
      });

      expect(verifyResult.success).toBe(true);
      expect(verifyResult.data.resetToken).toBe(TEST_TOKEN);

      // Step 3: 重置密码
      const resetMock = {
        success: true,
        data: {
          success: true,
          message: '密码重置成功',
          resetAt: new Date().toISOString(),
        },
      };

      mockSuccessResponse(
        mock,
        'post',
        '/api/mobile/auth/forgot-password',
        resetMock
      );

      const resetResult = await forgotPasswordAPI.forgotPassword({
        phoneNumber: TEST_PHONE,
        resetToken: TEST_TOKEN,
        newPassword: TEST_PASSWORD,
      });

      expect(resetResult.success).toBe(true);
      expect(resetResult.data.message).toBe('密码重置成功');
    });
  });
});
