import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import logger from './logger.js';

const prisma = new PrismaClient();

/**
 * 安全增强工具类
 */
class SecurityEnhancer {
  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateEncryptionKey();
    this.algorithm = 'aes-256-gcm';
    this.failedAttempts = new Map();
    this.suspiciousIPs = new Set();
  }

  /**
   * 生成加密密钥
   */
  generateEncryptionKey() {
    const key = crypto.randomBytes(32).toString('hex');
    logger.warn('生成了新的加密密钥，请将其添加到环境变量中', { 
      keyPreview: key.substring(0, 8) + '...' 
    });
    return key;
  }

  /**
   * 数据加密
   */
  encrypt(text, additionalData = '') {
    try {
      const iv = crypto.randomBytes(16);
      const key = Buffer.from(this.encryptionKey, 'hex');
      const cipher = crypto.createCipher(this.algorithm, key);
      
      if (additionalData) {
        cipher.setAAD(Buffer.from(additionalData));
      }
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
      };
    } catch (error) {
      logger.error('数据加密失败', { error: error.message });
      throw new Error('数据加密失败');
    }
  }

  /**
   * 数据解密
   */
  decrypt(encryptedData, additionalData = '') {
    try {
      const { encrypted, iv, authTag } = encryptedData;
      const key = Buffer.from(this.encryptionKey, 'hex');
      const decipher = crypto.createDecipher(this.algorithm, key);
      
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData));
      }
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('数据解密失败', { error: error.message });
      throw new Error('数据解密失败');
    }
  }

  /**
   * 敏感数据脱敏
   */
  maskSensitiveData(data, fields = ['password', 'token', 'secret', 'key']) {
    const masked = { ...data };
    
    for (const field of fields) {
      if (masked[field]) {
        const value = masked[field].toString();
        if (value.length <= 6) {
          masked[field] = '*'.repeat(value.length);
        } else {
          masked[field] = value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
        }
      }
    }
    
    return masked;
  }

  /**
   * API速率限制中间件
   */
  createRateLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100, // 最多100个请求
      message: {
        success: false,
        message: '请求过于频繁，请稍后重试'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        this.logSuspiciousActivity(req.ip, 'rate_limit_exceeded', {
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method
        });
        
        res.status(429).json(options.message || {
          success: false,
          message: '请求过于频繁，请稍后重试'
        });
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  /**
   * 请求减速中间件
   */
  createSpeedLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15分钟
      delayAfter: 50, // 50个请求后开始延迟
      delayMs: 500, // 每个请求延迟500ms
      maxDelayMs: 5000, // 最大延迟5秒
      onLimitReached: (req, res, options) => {
        this.logSuspiciousActivity(req.ip, 'speed_limit_reached', {
          userAgent: req.get('User-Agent'),
          path: req.path
        });
      }
    };

    return slowDown({ ...defaultOptions, ...options });
  }

  /**
   * 安全HTTP头中间件
   */
  createSecurityHeaders() {
    return helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"]
        }
      },
      crossOriginEmbedderPolicy: false, // 移动端兼容性
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  /**
   * 输入验证和清理
   */
  sanitizeInput(input, options = {}) {
    const { 
      maxLength = 1000,
      allowedChars = /^[a-zA-Z0-9\u4e00-\u9fa5\s\-_@.,:;!?()[\]{}'"]+$/,
      removeHtml = true,
      trim = true
    } = options;

    if (typeof input !== 'string') {
      return input;
    }

    let sanitized = input;

    // 去除空白字符
    if (trim) {
      sanitized = sanitized.trim();
    }

    // 长度限制
    if (sanitized.length > maxLength) {
      logger.warn('输入超长', { originalLength: sanitized.length, maxLength });
      sanitized = sanitized.substring(0, maxLength);
    }

    // HTML标签清理
    if (removeHtml) {
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    }

    // SQL注入防护
    sanitized = sanitized.replace(/['";\\]/g, '');

    // XSS防护
    sanitized = sanitized
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');

    // 字符白名单验证
    if (!allowedChars.test(sanitized)) {
      logger.warn('输入包含非法字符', { 
        input: sanitized.substring(0, 100),
        pattern: allowedChars.toString()
      });
    }

    return sanitized;
  }

  /**
   * SQL注入检测
   */
  detectSQLInjection(input) {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
      /(--|\/\*|\*\/)/,
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
      /('|\"|`|;|\||&)/
    ];

    for (const pattern of sqlPatterns) {
      if (pattern.test(input)) {
        this.logSuspiciousActivity('unknown', 'sql_injection_attempt', {
          input: input.substring(0, 100),
          pattern: pattern.toString()
        });
        return true;
      }
    }

    return false;
  }

  /**
   * XSS攻击检测
   */
  detectXSS(input) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>.*?<\/iframe>/i,
      /<img[^>]*onerror[^>]*>/i
    ];

    for (const pattern of xssPatterns) {
      if (pattern.test(input)) {
        this.logSuspiciousActivity('unknown', 'xss_attempt', {
          input: input.substring(0, 100),
          pattern: pattern.toString()
        });
        return true;
      }
    }

    return false;
  }

  /**
   * 登录失败次数监控
   */
  async trackFailedLogin(identifier, ip) {
    const key = `${identifier}:${ip}`;
    const attempts = this.failedAttempts.get(key) || 0;
    const newAttempts = attempts + 1;
    
    this.failedAttempts.set(key, newAttempts);
    
    // 5分钟后重置
    setTimeout(() => {
      this.failedAttempts.delete(key);
    }, 5 * 60 * 1000);

    // 记录到数据库
    await this.logSecurityEvent('failed_login', {
      identifier,
      ip,
      attempts: newAttempts,
      timestamp: new Date()
    });

    // 达到阈值时标记为可疑IP
    if (newAttempts >= 5) {
      this.suspiciousIPs.add(ip);
      
      // 30分钟后移除可疑标记
      setTimeout(() => {
        this.suspiciousIPs.delete(ip);
      }, 30 * 60 * 1000);

      logger.warn('检测到暴力破解尝试', {
        identifier,
        ip,
        attempts: newAttempts
      });
    }

    return newAttempts;
  }

  /**
   * 检查是否为可疑IP
   */
  isSuspiciousIP(ip) {
    return this.suspiciousIPs.has(ip);
  }

  /**
   * 密码强度验证
   */
  validatePasswordStrength(password) {
    const result = {
      isValid: false,
      score: 0,
      issues: []
    };

    if (password.length < 8) {
      result.issues.push('密码长度至少8位');
    } else {
      result.score += 20;
    }

    if (!/[a-z]/.test(password)) {
      result.issues.push('需要包含小写字母');
    } else {
      result.score += 20;
    }

    if (!/[A-Z]/.test(password)) {
      result.issues.push('需要包含大写字母');
    } else {
      result.score += 20;
    }

    if (!/\d/.test(password)) {
      result.issues.push('需要包含数字');
    } else {
      result.score += 20;
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      result.issues.push('需要包含特殊字符');
    } else {
      result.score += 20;
    }

    result.isValid = result.issues.length === 0 && result.score >= 80;
    return result;
  }

  /**
   * 安全密码哈希
   */
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  /**
   * 密码验证
   */
  async verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  /**
   * 记录安全事件
   */
  async logSecurityEvent(eventType, details) {
    try {
      await prisma.systemLog.create({
        data: {
          level: 'warn',
          category: 'security',
          message: `安全事件: ${eventType}`,
          details,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('安全事件记录失败', { error: error.message });
    }
  }

  /**
   * 记录可疑活动
   */
  logSuspiciousActivity(ip, activityType, details) {
    const logData = {
      ip,
      activityType,
      details,
      timestamp: new Date(),
      userAgent: details.userAgent || 'unknown'
    };

    logger.warn('可疑活动检测', logData);
    
    // 异步记录到数据库
    this.logSecurityEvent('suspicious_activity', logData).catch(error => {
      logger.error('可疑活动记录失败', { error: error.message });
    });
  }

  /**
   * 数据脱敏中间件
   */
  createDataMaskingMiddleware(sensitiveFields = ['password', 'token', 'secret']) {
    return (req, res, next) => {
      // 请求体脱敏
      if (req.body) {
        req.body = this.maskSensitiveData(req.body, sensitiveFields);
      }

      // 响应体脱敏
      const originalJson = res.json;
      res.json = function(data) {
        if (data && typeof data === 'object') {
          data = maskSensitiveData(data, sensitiveFields);
        }
        originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * API访问监控中间件
   */
  createAccessMonitoringMiddleware() {
    return async (req, res, next) => {
      const startTime = Date.now();
      const ip = req.ip;
      const userAgent = req.get('User-Agent');
      const path = req.path;
      const method = req.method;

      // 检查可疑IP
      if (this.isSuspiciousIP(ip)) {
        logger.warn('可疑IP访问', { ip, path, method, userAgent });
      }

      // 检查输入
      if (req.body) {
        for (const [key, value] of Object.entries(req.body)) {
          if (typeof value === 'string') {
            if (this.detectSQLInjection(value)) {
              return res.status(400).json({
                success: false,
                message: '检测到非法输入'
              });
            }
            
            if (this.detectXSS(value)) {
              return res.status(400).json({
                success: false,
                message: '检测到非法输入'
              });
            }
          }
        }
      }

      // 记录API访问
      res.on('finish', async () => {
        const responseTime = Date.now() - startTime;
        const statusCode = res.statusCode;

        try {
          await prisma.apiAccessLog.create({
            data: {
              method,
              path,
              statusCode,
              responseTime,
              ipAddress: ip,
              userAgent,
              userId: req.user?.id || null,
              factoryId: req.user?.factoryId || null,
              requestBody: this.maskSensitiveData(req.body || {}),
              responseBody: statusCode >= 400 ? { error: 'Error response' } : null,
              timestamp: new Date()
            }
          });
        } catch (error) {
          logger.error('API访问日志记录失败', { error: error.message });
        }
      });

      next();
    };
  }

  /**
   * 获取安全报告
   */
  getSecurityReport() {
    return {
      timestamp: new Date(),
      suspiciousIPs: Array.from(this.suspiciousIPs),
      failedLoginAttempts: this.failedAttempts.size,
      recentSecurityEvents: this.getRecentSecurityEvents(),
      recommendations: this.generateSecurityRecommendations()
    };
  }

  /**
   * 获取最近安全事件
   */
  async getRecentSecurityEvents(hours = 24) {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      const events = await prisma.systemLog.findMany({
        where: {
          category: 'security',
          timestamp: { gte: since }
        },
        orderBy: { timestamp: 'desc' },
        take: 50
      });

      return events;
    } catch (error) {
      logger.error('获取安全事件失败', { error: error.message });
      return [];
    }
  }

  /**
   * 生成安全建议
   */
  generateSecurityRecommendations() {
    const recommendations = [];

    if (this.suspiciousIPs.size > 10) {
      recommendations.push({
        type: 'suspicious_ips',
        priority: 'high',
        message: '检测到大量可疑IP，建议加强访问控制'
      });
    }

    if (this.failedAttempts.size > 50) {
      recommendations.push({
        type: 'brute_force',
        priority: 'high',
        message: '检测到大量登录失败，建议启用账户锁定机制'
      });
    }

    if (!process.env.ENCRYPTION_KEY) {
      recommendations.push({
        type: 'encryption_key',
        priority: 'critical',
        message: '未配置加密密钥，建议设置ENCRYPTION_KEY环境变量'
      });
    }

    return recommendations;
  }
}

// 创建安全增强器实例
const securityEnhancer = new SecurityEnhancer();

export default securityEnhancer;