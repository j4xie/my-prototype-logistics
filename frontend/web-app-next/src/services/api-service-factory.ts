// API服务工厂 - 简化版本
// 提供基础的API服务创建功能

import { getApiConfig } from '@/config/app';

// 基础API服务接口
export interface BaseAPIService {
  get(endpoint: string): Promise<any>;
  post(endpoint: string, data?: any): Promise<any>;
  put(endpoint: string, data?: any): Promise<any>;
  delete(endpoint: string): Promise<any>;
}

// 创建基础API服务
class SimpleAPIService implements BaseAPIService {
  private baseURL: string;

  constructor() {
    const config = getApiConfig();
    this.baseURL = config.baseURL;
  }

  async get(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }

  async post(endpoint: string, data?: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async put(endpoint: string, data?: any): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined
    });
    return response.json();
  }

  async delete(endpoint: string): Promise<any> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });
    return response.json();
  }
}

// 工厂函数
export function createAPIService(): BaseAPIService {
  return new SimpleAPIService();
}

// 默认导出
export default createAPIService; 