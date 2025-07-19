'use client';

import { useEffect, useRef } from 'react';

interface MSWProviderProps {
  children: React.ReactNode;
}

export function MSWProvider({ children }: MSWProviderProps) {
  const initialized = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    if (initialized.current) return;

    // 检查是否启用 Mock API
    const mockEnabled = process.env.NEXT_PUBLIC_MOCK_ENABLED === 'true';
    const mswEnabled = process.env.NEXT_PUBLIC_MSW_ENABLED !== 'false';
    
    console.log('🔍 MSW Provider 配置检查:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- NEXT_PUBLIC_MOCK_ENABLED:', process.env.NEXT_PUBLIC_MOCK_ENABLED);
    console.log('- NEXT_PUBLIC_MSW_ENABLED:', process.env.NEXT_PUBLIC_MSW_ENABLED);
    console.log('- mockEnabled:', mockEnabled);
    console.log('- mswEnabled:', mswEnabled);

    // 在开发环境且启用MSW时初始化（支持混合API模式）
    if (process.env.NODE_ENV === 'development' && mswEnabled) {
      async function initializeMocks() {
        try {
          // 动态导入避免服务端渲染问题
          const { autoInitializeForDevelopment } = await import('@/mocks/setup');
          await autoInitializeForDevelopment();
          console.log('✅ MSW Mock API initialized successfully (Mixed API Mode)');
          console.log('🔍 Service Worker状态:', navigator.serviceWorker?.controller ? '已激活' : '未激活');
          initialized.current = true;
        } catch (error) {
          console.error('❌ Failed to initialize MSW Mock API:', error);
        }
      }

      initializeMocks();
    } else {
      console.log('🚫 MSW Mock API 已禁用 - 使用真实后端API');
      
      // 如果之前有激活的Service Worker，尝试注销它
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          registrations.forEach(registration => {
            if (registration.scope.includes('mockServiceWorker')) {
              console.log('🧹 注销已存在的MSW Service Worker');
              registration.unregister();
            }
          });
        });
      }
    }
  }, []);

  return <>{children}</>;
}
