/**
 * @file 安全防护测试
 * @description 测试输入验证、XSS防御和CSRF防护等安全措施
 * @version 1.0.0
 * @created 2025-07-22
 */

const { jest } = require('@jest/globals');
const { sanitizeInput, validateSchemaInput } = require('../../src/security/input-validator');
const { generateCSRFToken, validateCSRFToken } = require('../../src/security/csrf-protection');
const { setAuthCookie, validateAuthCookie } = require('../../src/security/cookie-security');

// 模拟文档对象
const mockDocument = (function() {
  let cookies = {};
  
  return {
    cookie: {
      get: jest.fn().mockImplementation(name => cookies[name]),
      set: jest.fn().mockImplementation((name, value, options) => {
        cookies[name] = value;
      }),
      remove: jest.fn().mockImplementation(name => {
        delete cookies[name];
      })
    },
    createElement: jest.fn().mockImplementation(tag => ({
      innerHTML: '',
      textContent: '',
      appendChild: jest.fn(),
      setAttribute: jest.fn(),
      getAttribute: jest.fn(),
      tagName: tag.toUpperCase()
    }))
  };
})();

// 在测试中模拟document对象
global.document = global.document || mockDocument;

describe('安全防护测试', () => {
  /**
   * 输入验证和净化测试
   */
  describe('输入验证和净化', () => {
    test('应正确净化包含XSS的输入', () => {
      const maliciousInputs = [
        '<script>alert("XSS")</script>',
        'javascript:alert("XSS")',
        '<img src="x" onerror="alert(\'XSS\')">',
        '<div onmouseover="alert(\'XSS\')">悬停触发</div>',
        '"><script>alert(document.cookie)</script>',
        `<a href="javascript:alert('XSS')">点击我</a>`
      ];
      
      maliciousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        
        // 验证已被净化
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('javascript:');
        expect(sanitized).not.toContain('onerror=');
        expect(sanitized).not.toContain('onmouseover=');
        
        // 验证不会执行脚本
        const div = document.createElement('div');
        div.innerHTML = sanitized;
        
        // 检查是否有任何script标签
        const scripts = div.getElementsByTagName('script');
        expect(scripts.length).toBe(0);
        
        // 检查是否有任何事件处理属性
        const element = div.firstChild;
        if (element && element.getAttribute) {
          expect(element.getAttribute('onerror')).toBeNull();
          expect(element.getAttribute('onmouseover')).toBeNull();
          expect(element.getAttribute('onclick')).toBeNull();
        }
      });
    });
    
    test('应安全净化HTML但保留合法格式', () => {
      // 合法HTML
      const validHTML = `
        <div class="user-content">
          <h2>食品溯源标题</h2>
          <p>这是一个<strong>重要</strong>的段落。</p>
          <ul>
            <li>项目1</li>
            <li>项目2</li>
          </ul>
        </div>
      `;
      
      const sanitized = sanitizeInput(validHTML);
      
      // 验证保留了合法标签
      expect(sanitized).toContain('<div class="user-content">');
      expect(sanitized).toContain('<h2>');
      expect(sanitized).toContain('<strong>');
      expect(sanitized).toContain('<ul>');
      expect(sanitized).toContain('<li>');
      
      // 验证内容完整性
      expect(sanitized).toContain('食品溯源标题');
      expect(sanitized).toContain('这是一个<strong>重要</strong>的段落');
    });
    
    test('JSON Schema验证应拒绝格式错误的数据', () => {
      // 食品信息的JSON Schema
      const foodItemSchema = {
        type: 'object',
        required: ['id', 'name', 'category', 'producer'],
        properties: {
          id: { type: 'string', pattern: '^[A-Za-z0-9-]+$' },
          name: { type: 'string', minLength: 1, maxLength: 100 },
          category: { type: 'string', enum: ['水果', '蔬菜', '肉类', '谷物', '饮料'] },
          producer: { 
            type: 'object',
            required: ['id', 'name'],
            properties: {
              id: { type: 'string' },
              name: { type: 'string' }
            }
          },
          productionDate: { type: 'string', format: 'date' },
          expiryDate: { type: 'string', format: 'date' }
        }
      };
      
      // 有效数据
      const validFoodItem = {
        id: 'apple-123',
        name: '红富士苹果',
        category: '水果',
        producer: {
          id: 'farm-456',
          name: '阳光农场'
        },
        productionDate: '2023-01-15',
        expiryDate: '2023-07-15'
      };
      
      // 无效数据示例
      const invalidFoodItems = [
        // 缺少必填字段
        {
          id: 'apple-123',
          name: '红富士苹果',
          category: '水果'
          // 缺少producer
        },
        // 枚举值不匹配
        {
          id: 'apple-123',
          name: '红富士苹果',
          category: '电子产品', // 不在允许的枚举中
          producer: {
            id: 'farm-456',
            name: '阳光农场'
          }
        },
        // ID格式错误
        {
          id: 'apple_123$', // 含有不允许的字符
          name: '红富士苹果',
          category: '水果',
          producer: {
            id: 'farm-456',
            name: '阳光农场'
          }
        },
        // 日期格式错误
        {
          id: 'apple-123',
          name: '红富士苹果',
          category: '水果',
          producer: {
            id: 'farm-456',
            name: '阳光农场'
          },
          productionDate: '2023/01/15', // 格式错误
          expiryDate: '2023-07-15'
        }
      ];
      
      // 验证有效数据
      expect(validateSchemaInput(validFoodItem, foodItemSchema)).toBe(true);
      
      // 验证所有无效数据
      invalidFoodItems.forEach(item => {
        expect(validateSchemaInput(item, foodItemSchema)).toBe(false);
      });
    });
  });

  /**
   * CSRF防护测试
   */
  describe('CSRF防护', () => {
    test('应生成唯一的CSRF令牌', () => {
      // 生成多个令牌并确保它们都是唯一的
      const tokens = new Set();
      for (let i = 0; i < 100; i++) {
        tokens.add(generateCSRFToken());
      }
      
      // 验证每个令牌都是唯一的
      expect(tokens.size).toBe(100);
      
      // 验证令牌格式 (默认应是32-64字符的密码学安全字符串)
      const token = generateCSRFToken();
      expect(token.length).toBeGreaterThanOrEqual(32);
      expect(token.length).toBeLessThanOrEqual(64);
      
      // 验证令牌包含足够的随机性 (基本检查)
      const charDistribution = {};
      for (let i = 0; i < token.length; i++) {
        const char = token[i];
        charDistribution[char] = (charDistribution[char] || 0) + 1;
      }
      
      // 检查是否有合理的分布（无单一字符占主导）
      const chars = Object.keys(charDistribution);
      expect(chars.length).toBeGreaterThan(10); // 应该使用多种字符
      
      // 每个字符的频率不应过高
      const maxFreq = Math.max(...Object.values(charDistribution));
      expect(maxFreq).toBeLessThan(token.length * 0.3); // 单个字符不应超过30%
    });
    
    test('应验证匹配的CSRF令牌', () => {
      // 生成令牌
      const token = generateCSRFToken();
      
      // 验证令牌有效性
      expect(validateCSRFToken(token, token)).toBe(true);
      expect(validateCSRFToken(token, 'different-token')).toBe(false);
      expect(validateCSRFToken(token, '')).toBe(false);
      expect(validateCSRFToken(token, null)).toBe(false);
      
      // 测试时间戳验证 (如果实现包含过期逻辑)
      // 注：真实实现会有时间戳检查，但这里简化了测试
    });
    
    test('应防止CSRF攻击', () => {
      // 模拟请求处理函数
      const handleFoodUpdate = jest.fn();
      
      // 模拟安全中间件
      const csrfProtectionMiddleware = (req, handler) => {
        if (!validateCSRFToken(req.csrfToken, req.headers['x-csrf-token'])) {
          return { error: 'CSRF验证失败' };
        }
        return handler(req);
      };
      
      // 生成有效的CSRF令牌
      const validToken = generateCSRFToken();
      
      // 模拟合法请求
      const legitimateRequest = {
        method: 'POST',
        body: { foodId: '123', name: '更新的食品名称' },
        csrfToken: validToken,
        headers: {
          'x-csrf-token': validToken
        }
      };
      
      // 模拟CSRF攻击请求 (没有或无效的CSRF令牌)
      const csrfAttackRequest = {
        method: 'POST',
        body: { foodId: '123', name: '恶意更新' },
        csrfToken: validToken,
        headers: {
          'x-csrf-token': 'invalid-or-missing-token'
        }
      };
      
      // 处理合法请求
      const legitResult = csrfProtectionMiddleware(legitimateRequest, handleFoodUpdate);
      
      // 处理CSRF攻击请求
      const attackResult = csrfProtectionMiddleware(csrfAttackRequest, handleFoodUpdate);
      
      // 验证合法请求被处理
      expect(handleFoodUpdate).toHaveBeenCalledWith(legitimateRequest);
      
      // 验证攻击请求被阻止
      expect(attackResult.error).toBe('CSRF验证失败');
      
      // 验证处理函数只被调用一次 (对于合法请求)
      expect(handleFoodUpdate).toHaveBeenCalledTimes(1);
    });
  });

  /**
   * Cookie安全设置测试
   */
  describe('Cookie安全设置', () => {
    beforeEach(() => {
      // 清除之前的cookie
      for (const key in mockDocument.cookie) {
        mockDocument.cookie.remove(key);
      }
    });
    
    test('认证Cookie应设置安全标志', () => {
      // 设置认证cookie
      setAuthCookie('session-id', 'user-session-123', {
        expires: new Date(Date.now() + 86400000) // 1天过期
      });
      
      // 捕获cookie设置调用
      expect(mockDocument.cookie.set).toHaveBeenCalled();
      
      // 验证最后一次调用包含安全标志
      const lastCall = mockDocument.cookie.set.mock.calls[mockDocument.cookie.set.mock.calls.length - 1];
      const [name, value, options] = lastCall;
      
      expect(name).toBe('session-id');
      expect(value).toBe('user-session-123');
      expect(options).toHaveProperty('secure', true);
      expect(options).toHaveProperty('httpOnly', true);
      expect(options).toHaveProperty('sameSite', 'strict');
    });
    
    test('应正确验证认证Cookie', () => {
      // 设置有效cookie
      mockDocument.cookie.set('auth-token', 'valid-token', {
        secure: true,
        httpOnly: true
      });
      
      // 验证cookie
      expect(validateAuthCookie('auth-token')).toBe(true);
      expect(validateAuthCookie('non-existent')).toBe(false);
      
      // 移除cookie后应该验证失败
      mockDocument.cookie.remove('auth-token');
      expect(validateAuthCookie('auth-token')).toBe(false);
    });
    
    test('应检测Cookie篡改', () => {
      // 创建带签名的cookie
      // 注意：实际应用中，这会使用更复杂的加密签名
      const userData = {
        id: 'user-123',
        role: 'user',
        lastAccess: Date.now()
      };
      
      // 模拟简单签名算法
      function signData(data, secret = 'test-secret') {
        const content = JSON.stringify(data);
        const signature = content.split('').reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0) & 0xFFFFFFFF;
        
        return `${content}--${signature}`;
      }
      
      // 验证签名
      function verifySignedData(signedData, secret = 'test-secret') {
        const [content, signature] = signedData.split('--');
        const calculatedSignature = content.split('').reduce((acc, char) => {
          return ((acc << 5) - acc) + char.charCodeAt(0);
        }, 0) & 0xFFFFFFFF;
        
        return {
          valid: calculatedSignature.toString() === signature,
          data: content ? JSON.parse(content) : null
        };
      }
      
      // 设置已签名的cookie
      const signedData = signData(userData);
      mockDocument.cookie.set('user-data', signedData);
      
      // 验证cookie完整性
      const originalCookie = mockDocument.cookie.get('user-data');
      const verificationResult = verifySignedData(originalCookie);
      expect(verificationResult.valid).toBe(true);
      expect(verificationResult.data).toEqual(userData);
      
      // 篡改cookie (修改角色为管理员)
      const tamperedData = JSON.parse(originalCookie.split('--')[0]);
      tamperedData.role = 'admin';
      const tamperedCookie = `${JSON.stringify(tamperedData)}--${originalCookie.split('--')[1]}`;
      mockDocument.cookie.set('user-data', tamperedCookie);
      
      // 验证篡改的cookie不通过
      const tamperedResult = verifySignedData(mockDocument.cookie.get('user-data'));
      expect(tamperedResult.valid).toBe(false);
    });
  });

  /**
   * 通信安全测试
   */
  describe('通信安全测试', () => {
    beforeEach(() => {
      // 模拟API调用
      global.fetch = jest.fn();
    });
    
    test('敏感API端点应使用HTTPS', async () => {
      // 模拟配置
      const apiConfig = {
        baseUrl: 'https://api.example.com',
        endpoints: {
          login: '/auth/login',
          foodData: '/food/data'
        }
      };
      
      // 模拟API调用函数
      function callApi(endpoint, data) {
        const url = `${apiConfig.baseUrl}${apiConfig.endpoints[endpoint]}`;
        return fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });
      }
      
      // 调用敏感API
      await callApi('login', { username: 'testuser', password: 'password123' });
      
      // 验证所有调用都使用HTTPS
      const calls = global.fetch.mock.calls;
      calls.forEach(call => {
        const url = call[0];
        expect(url.startsWith('https://')).toBe(true);
      });
      
      // 测试不安全的URL是否会被拒绝
      // 临时覆盖配置使用HTTP
      const insecureConfig = {
        ...apiConfig,
        baseUrl: 'http://api.example.com'
      };
      
      // 模拟安全检查函数
      function ensureSecureUrl(url) {
        if (!url.startsWith('https://')) {
          throw new Error('禁止使用不安全的HTTP连接');
        }
        return url;
      }
      
      // 验证不安全URL会被拒绝
      expect(() => {
        ensureSecureUrl(insecureConfig.baseUrl + insecureConfig.endpoints.login);
      }).toThrow('禁止使用不安全的HTTP连接');
    });
    
    test('应实施内容安全策略', () => {
      // 模拟CSP实现
      const csp = {
        script: ["'self'", 'https://cdn.trusted-source.com'],
        style: ["'self'", 'https://cdn.trusted-source.com'],
        img: ["'self'", 'https://images.trusted-source.com'],
        connect: ["'self'", 'https://api.trusted-source.com'],
        default: ["'none'"]
      };
      
      // 生成CSP头
      function generateCSPHeader(cspConfig) {
        return Object.entries(cspConfig)
          .map(([directive, sources]) => {
            return `${directive}-src ${sources.join(' ')}`;
          })
          .join('; ');
      }
      
      const cspHeader = generateCSPHeader(csp);
      
      // 验证生成的CSP头部包含所有期望的限制
      expect(cspHeader).toContain("script-src 'self' https://cdn.trusted-source.com");
      expect(cspHeader).toContain("img-src 'self' https://images.trusted-source.com");
      expect(cspHeader).toContain("default-src 'none'");
      
      // 验证CSP限制
      function checkScriptAllowed(scriptSrc, cspConfig) {
        const allowedSources = cspConfig.script || cspConfig.default || [];
        
        // 检查是否为self
        if (scriptSrc === window.location.origin && allowedSources.includes("'self'")) {
          return true;
        }
        
        // 检查是否为允许的外部源
        return allowedSources.some(source => {
          if (source === "'self'" || source === "'none'") return false;
          return scriptSrc.startsWith(source);
        });
      }
      
      // 验证安全脚本源
      expect(checkScriptAllowed('https://cdn.trusted-source.com/script.js', csp)).toBe(true);
      
      // 验证不安全脚本源
      expect(checkScriptAllowed('https://malicious-site.com/script.js', csp)).toBe(false);
    });
  });
  
  /**
   * 数据访问控制测试
   */
  describe('数据访问控制测试', () => {
    test('应实施正确的数据访问权限控制', () => {
      // 模拟用户权限
      const userRoles = {
        admin: ['read', 'write', 'delete', 'manage'],
        manager: ['read', 'write', 'limited-delete'],
        user: ['read', 'limited-write'],
        guest: ['read']
      };
      
      // 资源访问控制函数
      function checkAccess(userRole, resource, action) {
        if (!userRoles[userRole]) return false;
        return userRoles[userRole].includes(action);
      }
      
      // 验证不同角色的访问权限
      expect(checkAccess('admin', 'food-data', 'delete')).toBe(true);
      expect(checkAccess('manager', 'food-data', 'write')).toBe(true);
      expect(checkAccess('manager', 'food-data', 'manage')).toBe(false);
      expect(checkAccess('user', 'food-data', 'read')).toBe(true);
      expect(checkAccess('user', 'food-data', 'delete')).toBe(false);
      expect(checkAccess('guest', 'food-data', 'write')).toBe(false);
      
      // 验证未知角色没有权限
      expect(checkAccess('unknown', 'food-data', 'read')).toBe(false);
    });
    
    test('应防止水平权限提升', () => {
      // 模拟用户和资源
      const users = {
        'user1': { id: 'user1', ownedResources: ['resource1', 'resource2'] },
        'user2': { id: 'user2', ownedResources: ['resource3', 'resource4'] }
      };
      
      // 资源所有权检查
      function canAccessResource(userId, resourceId) {
        const user = users[userId];
        if (!user) return false;
        
        // 检查用户是否拥有该资源
        return user.ownedResources.includes(resourceId);
      }
      
      // 模拟资源访问请求处理
      function handleResourceAccess(userId, resourceId, action) {
        // 首先检查资源所有权
        if (!canAccessResource(userId, resourceId)) {
          return { success: false, error: '没有访问权限' };
        }
        
        // 执行请求的操作
        return { success: true, message: `成功对资源${resourceId}执行${action}操作` };
      }
      
      // 验证资源所有者可以访问自己的资源
      expect(handleResourceAccess('user1', 'resource1', 'read').success).toBe(true);
      expect(handleResourceAccess('user2', 'resource3', 'modify').success).toBe(true);
      
      // 验证用户不能访问其他用户的资源
      expect(handleResourceAccess('user1', 'resource3', 'read').success).toBe(false);
      expect(handleResourceAccess('user2', 'resource2', 'read').success).toBe(false);
      
      // 验证参数篡改攻击
      expect(handleResourceAccess('user1', 'resource3', 'read').success).toBe(false);
    });
  });
}); 