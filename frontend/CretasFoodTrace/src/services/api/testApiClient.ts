import { apiClient } from './apiClient';

/**
 * 测试接口API客户端
 * 总计2个API - 路径：/api/test/*
 * 仅用于开发和测试环境
 */

class TestApiClient {
  private basePath = '/api/test';

  /**
   * 测试端点 - 验证API可用性
   */
  async testEndpoint() {
    return await apiClient.get(`${this.basePath}/endpoint`);
  }

  /**
   * 测试数据库连接
   */
  async testDatabaseConnection() {
    return await apiClient.get(`${this.basePath}/database`);
  }
}

export const testApiClient = new TestApiClient();
export default testApiClient;
