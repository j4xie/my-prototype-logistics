'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/**
 * Mock认证Hook
 * - 预览模式：自动认证，不保存到localStorage
 * - 开发环境：自动认证，保存到localStorage
 * - 生产环境：检查真实token
 */
export function useMockAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    // 检测预览模式
    const isPreviewMode = typeof window !== 'undefined' &&
      (window.location.search.includes('preview=1') || window.parent !== window);

    // 检测开发环境
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isPreviewMode || isDevelopment) {
      // 预览模式或开发环境：自动提供Mock认证
      const mockUser: User = {
        id: 'mock_user_001',
        username: 'dev_user',
        name: '开发用户',
        role: 'admin',
        permissions: [
          'farming:read', 'farming:write',
          'processing:read', 'processing:write',
          'logistics:read', 'logistics:write',
          'admin:read', 'admin:write'
        ]
      };

      setAuthState({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
      });

      // 控制台提示
      if (isPreviewMode) {
        console.log('🔍 预览模式 - 自动认证:', mockUser.name);
      } else {
        console.log('🔧 开发模式 - Mock认证:', mockUser.name);
      }
    } else {
      // 生产环境：检查真实token
      const token = localStorage.getItem('auth_token');
      const userInfo = localStorage.getItem('user_info');

      if (token && userInfo) {
        try {
          const userData = JSON.parse(userInfo);
          setAuthState({
            user: userData,
            isAuthenticated: true,
            isLoading: false,
          });
          console.log('✅ 生产环境 - 使用真实认证:', userData.name);
        } catch (error) {
          console.error('❌ 用户信息解析失败');
          setAuthState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      } else {
        setAuthState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });
        console.log('🔒 生产环境 - 需要登录');
      }
    }
  }, []);

  return authState;
}
