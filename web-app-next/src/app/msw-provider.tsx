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

    // 仅在开发环境初始化Mock API
    if (process.env.NODE_ENV === 'development') {
      async function initializeMocks() {
        try {
          // 动态导入避免服务端渲染问题
          const { autoInitializeForDevelopment } = await import('@/mocks/setup');
          await autoInitializeForDevelopment();
          console.log('✅ MSW Mock API initialized successfully');
          console.log('🔍 Service Worker状态:', navigator.serviceWorker?.controller ? '已激活' : '未激活');
          initialized.current = true;
        } catch (error) {
          console.error('❌ Failed to initialize MSW Mock API:', error);
        }
      }

      initializeMocks();
    }
  }, []);

  return <>{children}</>;
}
