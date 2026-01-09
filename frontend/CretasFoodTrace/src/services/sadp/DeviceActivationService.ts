/**
 * 设备激活服务
 * Device Activation Service via ISAPI
 *
 * 通过 ISAPI 协议激活海康威视设备
 * - 激活未激活的设备（设置管理员密码）
 * - 检查设备激活状态
 * - 修改设备密码
 *
 * 海康威视设备激活 ISAPI 接口：
 * - PUT /ISAPI/System/activate
 * - GET /ISAPI/Security/adminAccesses (检查状态)
 * - PUT /ISAPI/Security/users/1 (修改密码)
 */

import type {
  DeviceActivationRequest,
  DeviceActivationResult,
  ActivationStatusResult,
  PasswordChangeRequest,
  PasswordChangeResult,
  PasswordValidationRule,
  PasswordValidationResult,
  ActivationErrorCode,
  PasswordChangeErrorCode,
  DEFAULT_PASSWORD_RULES,
  DEFAULT_HTTP_PORT,
} from './types';

// ============================================
// 常量定义
// ============================================

/** 激活接口路径 */
const ISAPI_ACTIVATE = '/ISAPI/System/activate';

/** 管理员访问检查路径 */
const ISAPI_ADMIN_ACCESSES = '/ISAPI/Security/adminAccesses';

/** 用户信息路径 */
const ISAPI_USER = '/ISAPI/Security/users/1';

/** 设备信息路径 */
const ISAPI_DEVICE_INFO = '/ISAPI/System/deviceInfo';

/** 默认请求超时 (ms) */
const DEFAULT_TIMEOUT = 10000;

/** 默认用户名 */
const DEFAULT_USERNAME = 'admin';

// ============================================
// XML 模板
// ============================================

/**
 * 生成激活请求 XML
 */
function buildActivateXml(password: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<ActivateInfo version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <password>${escapeXml(password)}</password>
</ActivateInfo>`;
}

/**
 * 生成密码修改请求 XML
 */
function buildPasswordChangeXml(username: string, newPassword: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<User version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <id>1</id>
  <userName>${escapeXml(username)}</userName>
  <password>${escapeXml(newPassword)}</password>
</User>`;
}

/**
 * XML 特殊字符转义
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// HTTP 工具函数
// ============================================

/**
 * 带超时的 fetch 请求
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = DEFAULT_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 生成 Basic Auth 头
 */
function buildBasicAuthHeader(username: string, password: string): string {
  // 注意：React Native 环境下需要使用 base64 编码
  // 这里使用简单的 btoa 实现，生产环境建议使用 react-native-base64
  const credentials = `${username}:${password}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * 生成 Digest Auth 头 (简化实现)
 * 注意：完整的 Digest Auth 需要处理 nonce、realm 等，这里提供基础框架
 */
function buildDigestAuthHeader(
  username: string,
  password: string,
  realm: string,
  nonce: string,
  uri: string,
  method: string
): string {
  // MD5 实现需要引入加密库
  // 这里返回占位符，实际实现需要计算 HA1, HA2, response
  const ha1 = md5(`${username}:${realm}:${password}`);
  const ha2 = md5(`${method}:${uri}`);
  const response = md5(`${ha1}:${nonce}:${ha2}`);

  return `Digest username="${username}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
}

/**
 * 简单 MD5 实现占位符
 * 生产环境应使用 crypto-js 或类似库
 */
function md5(str: string): string {
  // 这是一个占位实现，实际应使用加密库
  // npm install crypto-js
  // import MD5 from 'crypto-js/md5';
  // return MD5(str).toString();
  console.warn('[DeviceActivation] MD5 需要使用加密库实现');
  return str;
}

/**
 * 解析 WWW-Authenticate 头获取 Digest 参数
 */
function parseWWWAuthenticate(header: string): {
  realm: string;
  nonce: string;
  qop?: string;
} | null {
  if (!header || !header.toLowerCase().includes('digest')) {
    return null;
  }

  const params: Record<string, string> = {};
  const regex = /(\w+)="([^"]+)"/g;
  let match;

  while ((match = regex.exec(header)) !== null) {
    const key = match[1];
    const value = match[2];
    if (key && value) {
      params[key] = value;
    }
  }

  if (!params.realm || !params.nonce) {
    return null;
  }

  return {
    realm: params.realm,
    nonce: params.nonce,
    qop: params.qop,
  };
}

/**
 * 解析 XML 响应中的错误信息
 */
function parseErrorFromXml(xml: string): { code: string; message: string } | null {
  const codeMatch = /<statusCode>(\d+)<\/statusCode>/i.exec(xml);
  const msgMatch = /<statusString>([^<]+)<\/statusString>/i.exec(xml);

  if (codeMatch && msgMatch) {
    return {
      code: codeMatch[1] || 'UNKNOWN',
      message: msgMatch[1] || '未知错误',
    };
  }

  return null;
}

// ============================================
// 设备激活服务类
// ============================================

class DeviceActivationServiceImpl {
  private passwordRules: PasswordValidationRule;

  constructor(passwordRules?: PasswordValidationRule) {
    this.passwordRules = passwordRules || {
      minLength: 8,
      maxLength: 16,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: false,
      allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
    };
  }

  // ========== 公开方法 ==========

  /**
   * 激活设备（设置管理员密码）
   * @param request 激活请求
   */
  async activateDevice(request: DeviceActivationRequest): Promise<DeviceActivationResult> {
    const { ip, password, port = 80, useHttps = false } = request;

    // 验证密码
    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('; '),
        errorCode: 'INVALID_PASSWORD',
      };
    }

    const protocol = useHttps ? 'https' : 'http';
    const url = `${protocol}://${ip}:${port}${ISAPI_ACTIVATE}`;

    try {
      console.log('[DeviceActivation] 开始激活设备:', ip);

      const response = await fetchWithTimeout(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/xml',
        },
        body: buildActivateXml(password),
      });

      // 处理响应
      if (response.ok) {
        console.log('[DeviceActivation] 设备激活成功:', ip);
        return {
          success: true,
          activatedAt: new Date().toISOString(),
        };
      }

      // 解析错误
      const errorCode = this.mapActivationError(response.status);
      const responseText = await response.text().catch(() => '');
      const xmlError = parseErrorFromXml(responseText);

      return {
        success: false,
        error: xmlError?.message || `HTTP ${response.status}: ${response.statusText}`,
        errorCode,
      };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      const errorCode = this.getActivationErrorCode(error);

      console.error('[DeviceActivation] 激活失败:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        errorCode,
      };
    }
  }

  /**
   * 检查设备是否已激活
   * @param ip 设备 IP 地址
   * @param port HTTP 端口
   */
  async checkActivationStatus(
    ip: string,
    port: number = 80
  ): Promise<ActivationStatusResult> {
    const url = `http://${ip}:${port}${ISAPI_DEVICE_INFO}`;

    try {
      console.log('[DeviceActivation] 检查激活状态:', ip);

      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml',
        },
      });

      // 401 通常表示设备已激活（需要认证）
      if (response.status === 401) {
        return {
          isActivated: true,
        };
      }

      // 200 且没有认证要求，可能是未激活设备的公开信息
      if (response.ok) {
        const xml = await response.text();
        const serialMatch = /<serialNumber>([^<]+)<\/serialNumber>/i.exec(xml);
        const modelMatch = /<model>([^<]+)<\/model>/i.exec(xml);

        // 检查是否有激活状态字段
        const activatedMatch = /<deviceActivated>([^<]+)<\/deviceActivated>/i.exec(xml);
        const isActivated = activatedMatch
          ? activatedMatch[1]?.toLowerCase() === 'true'
          : false;

        return {
          isActivated,
          serialNumber: serialMatch?.[1],
          model: modelMatch?.[1],
        };
      }

      // 其他状态码，尝试访问激活状态接口
      return await this.checkActivationViaAdminAccesses(ip, port);
    } catch (error) {
      return {
        isActivated: false,
        error: this.getErrorMessage(error),
      };
    }
  }

  /**
   * 修改设备密码
   * @param request 密码修改请求
   */
  async changePassword(request: PasswordChangeRequest): Promise<PasswordChangeResult> {
    const {
      ip,
      oldPassword,
      newPassword,
      port = 80,
      username = DEFAULT_USERNAME,
    } = request;

    // 验证新密码
    const passwordValidation = this.validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return {
        success: false,
        error: passwordValidation.errors.join('; '),
        errorCode: 'INVALID_NEW_PASSWORD',
      };
    }

    // 检查新旧密码是否相同
    if (oldPassword === newPassword) {
      return {
        success: false,
        error: '新密码不能与旧密码相同',
        errorCode: 'SAME_PASSWORD',
      };
    }

    const url = `http://${ip}:${port}${ISAPI_USER}`;

    try {
      console.log('[DeviceActivation] 开始修改密码:', ip);

      // 第一步：发送请求获取认证参数
      const initialResponse = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml',
        },
      });

      if (initialResponse.status !== 401) {
        return {
          success: false,
          error: '无法获取认证参数',
          errorCode: 'CONNECTION_FAILED',
        };
      }

      // 解析 WWW-Authenticate 头
      const wwwAuth = initialResponse.headers.get('WWW-Authenticate');
      const digestParams = wwwAuth ? parseWWWAuthenticate(wwwAuth) : null;

      let authHeader: string;
      if (digestParams) {
        // 使用 Digest 认证
        authHeader = buildDigestAuthHeader(
          username,
          oldPassword,
          digestParams.realm,
          digestParams.nonce,
          ISAPI_USER,
          'PUT'
        );
      } else {
        // 回退到 Basic 认证
        authHeader = buildBasicAuthHeader(username, oldPassword);
      }

      // 第二步：发送密码修改请求
      const response = await fetchWithTimeout(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/xml',
          'Authorization': authHeader,
        },
        body: buildPasswordChangeXml(username, newPassword),
      });

      if (response.ok) {
        console.log('[DeviceActivation] 密码修改成功:', ip);
        return { success: true };
      }

      // 处理错误
      const errorCode = this.mapPasswordChangeError(response.status);
      const responseText = await response.text().catch(() => '');
      const xmlError = parseErrorFromXml(responseText);

      return {
        success: false,
        error: xmlError?.message || `HTTP ${response.status}`,
        errorCode,
      };
    } catch (error) {
      return {
        success: false,
        error: this.getErrorMessage(error),
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * 验证密码是否符合要求
   * @param password 密码
   */
  validatePassword(password: string): PasswordValidationResult {
    const errors: string[] = [];
    const rules = this.passwordRules;

    if (password.length < rules.minLength) {
      errors.push(`密码长度不能少于 ${rules.minLength} 位`);
    }

    if (password.length > rules.maxLength) {
      errors.push(`密码长度不能超过 ${rules.maxLength} 位`);
    }

    if (rules.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }

    if (rules.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }

    if (rules.requireNumber && !/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }

    if (rules.requireSpecialChar) {
      const specialCharRegex = new RegExp(`[${this.escapeRegex(rules.allowedSpecialChars)}]`);
      if (!specialCharRegex.test(password)) {
        errors.push('密码必须包含特殊字符');
      }
    }

    // 检查是否包含用户名
    if (password.toLowerCase().includes('admin')) {
      errors.push('密码不能包含用户名');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * 生成符合要求的随机密码
   */
  generateRandomPassword(): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';

    let password = '';

    // 确保每种字符至少有一个
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];

    if (this.passwordRules.requireSpecialChar) {
      password += special[Math.floor(Math.random() * special.length)];
    }

    // 填充剩余长度
    const allChars = uppercase + lowercase + numbers +
      (this.passwordRules.requireSpecialChar ? special : '');
    const remainingLength = this.passwordRules.minLength - password.length;

    for (let i = 0; i < remainingLength; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // 打乱顺序
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }

  /**
   * 设置密码规则
   */
  setPasswordRules(rules: Partial<PasswordValidationRule>): void {
    this.passwordRules = { ...this.passwordRules, ...rules };
  }

  /**
   * 获取当前密码规则
   */
  getPasswordRules(): PasswordValidationRule {
    return { ...this.passwordRules };
  }

  // ========== 私有方法 ==========

  /**
   * 通过 adminAccesses 接口检查激活状态
   */
  private async checkActivationViaAdminAccesses(
    ip: string,
    port: number
  ): Promise<ActivationStatusResult> {
    const url = `http://${ip}:${port}${ISAPI_ADMIN_ACCESSES}`;

    try {
      const response = await fetchWithTimeout(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/xml',
        },
      });

      // 通常未激活设备会返回特定状态
      if (response.status === 401) {
        return { isActivated: true };
      }

      if (response.ok) {
        const xml = await response.text();
        const activatedMatch = /<activated>([^<]+)<\/activated>/i.exec(xml);
        return {
          isActivated: activatedMatch?.[1]?.toLowerCase() === 'true',
        };
      }

      return { isActivated: false };
    } catch {
      return { isActivated: false };
    }
  }

  /**
   * 映射 HTTP 状态码到激活错误代码
   */
  private mapActivationError(status: number): ActivationErrorCode {
    switch (status) {
      case 400:
        return 'INVALID_PASSWORD';
      case 401:
      case 403:
        return 'ALREADY_ACTIVATED';
      case 408:
        return 'TIMEOUT';
      case 503:
        return 'DEVICE_BUSY';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 映射 HTTP 状态码到密码修改错误代码
   */
  private mapPasswordChangeError(status: number): PasswordChangeErrorCode {
    switch (status) {
      case 400:
        return 'INVALID_NEW_PASSWORD';
      case 401:
        return 'WRONG_PASSWORD';
      case 403:
        return 'UNAUTHORIZED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * 根据错误类型获取激活错误代码
   */
  private getActivationErrorCode(error: unknown): ActivationErrorCode {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return 'TIMEOUT';
      }
      if (error.message.includes('network') || error.message.includes('connect')) {
        return 'CONNECTION_FAILED';
      }
    }
    return 'UNKNOWN';
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return '请求超时';
      }
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// ============================================
// 单例导出
// ============================================

const DeviceActivationService = new DeviceActivationServiceImpl();

export default DeviceActivationService;
export { DeviceActivationServiceImpl };
