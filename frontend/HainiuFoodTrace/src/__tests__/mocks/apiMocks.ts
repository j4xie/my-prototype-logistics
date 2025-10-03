/**
 * API Mock 配置
 * 用于测试时模拟后端API响应
 */

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import usersData from '../fixtures/users.json';
import apiResponses from '../fixtures/apiResponses.json';

// 创建Mock适配器
const mock = new MockAdapter(axios, { delayResponse: 100 });

/**
 * 设置认证API模拟
 */
export function setupAuthMocks() {
  // 统一登录API
  mock.onPost('/api/mobile/auth/unified-login').reply((config) => {
    const data = JSON.parse(config.data);
    const { username, password } = data;
    
    // 检查测试凭据
    const credentials = usersData.testCredentials as any;
    const isValidCredential = Object.values(credentials).some(
      (cred: any) => cred.username === username && cred.password === password
    );
    
    if (isValidCredential) {
      // 根据用户名返回对应的用户数据
      let user;
      if (username === 'platform_admin') {
        user = usersData.platformUsers.find(u => u.username === username);
      } else {
        user = usersData.factoryUsers.find(u => u.username === username);
      }
      
      const response = {
        ...apiResponses.auth.unifiedLogin.success,
        data: {
          ...apiResponses.auth.unifiedLogin.success.data,
          user
        }
      };
      
      return [200, response];
    } else {
      return [401, apiResponses.auth.unifiedLogin.failure];
    }
  });
  
  // 注册第一阶段API
  mock.onPost('/api/mobile/auth/register-phase-one').reply((config) => {
    const data = JSON.parse(config.data);
    const { phoneNumber } = data;
    
    // 模拟白名单检查
    if (phoneNumber === '+86138000000009') {
      return [200, apiResponses.auth.registerPhaseOne.success];
    } else {
      return [403, apiResponses.auth.registerPhaseOne.phoneNotInWhitelist];
    }
  });
  
  // 注册第二阶段API
  mock.onPost('/api/mobile/auth/register-phase-two').reply(200, 
    apiResponses.auth.registerPhaseTwo.success
  );
  
  // 刷新Token API
  mock.onPost('/api/mobile/auth/refresh-token').reply(200,
    apiResponses.auth.refreshToken.success
  );
  
  // 设备绑定API
  mock.onPost('/api/mobile/auth/bind-device').reply(200, {
    success: true,
    message: '设备绑定成功',
    data: {
      deviceId: 'test-device-123',
      bindingDate: new Date().toISOString()
    }
  });
}

/**
 * 设置权限API模拟
 */
export function setupPermissionMocks() {
  // 批量权限检查API
  mock.onPost('/api/mobile/permissions/batch-check').reply(200,
    apiResponses.permissions.batchCheck.success
  );
}

/**
 * 设置业务API模拟
 */
export function setupBusinessMocks() {
  // 加工仪表板API
  mock.onGet('/api/mobile/processing/dashboard').reply(200,
    apiResponses.processing.dashboard.success
  );
  
  // 工作记录API
  mock.onGet('/api/mobile/processing/work-records').reply(200,
    apiResponses.processing.workRecords.success
  );
  
  // 告警列表API
  mock.onGet('/api/mobile/alerts').reply(200,
    apiResponses.alerts.list.success
  );
  
  // 报表模板API
  mock.onGet('/api/mobile/reports/templates').reply(200,
    apiResponses.reports.templates.success
  );
  
  // 系统健康检查API
  mock.onGet('/api/mobile/health').reply(200,
    apiResponses.system.health.success
  );
  
  // 系统监控API
  mock.onGet('/api/mobile/system/monitor').reply(200,
    apiResponses.system.monitor.success
  );
}

/**
 * 设置文件上传API模拟
 */
export function setupUploadMocks() {
  mock.onPost('/api/mobile/upload/mobile').reply(200, {
    success: true,
    message: '文件上传成功',
    data: {
      fileId: 'file_12345',
      originalName: 'test-image.jpg',
      fileName: 'uploads/2025/01/14/test-image-12345.jpg',
      fileSize: 1024000,
      mimeType: 'image/jpeg',
      uploadDate: new Date().toISOString()
    }
  });
}

/**
 * 初始化所有API模拟
 */
export function setupAllMocks() {
  setupAuthMocks();
  setupPermissionMocks();
  setupBusinessMocks();
  setupUploadMocks();
  
  console.log('🧪 API Mocks initialized for testing');
}

/**
 * 重置所有Mock
 */
export function resetMocks() {
  mock.reset();
}

/**
 * 恢复原始axios实例
 */
export function restoreMocks() {
  mock.restore();
}

export { mock };