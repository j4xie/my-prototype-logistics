'use client';

import { useEffect, useState, useRef } from 'react';

interface MSWProviderProps {
  children: React.ReactNode;
}

// 全局初始化状态，防止重复初始化
let mswInitialized = false;
let mswInitializing = false;

export default function MSWProvider({ children }: MSWProviderProps) {
  const [isReady, setIsReady] = useState(() => {
    // 如果已经初始化，直接返回ready状态
    return mswInitialized || process.env.NODE_ENV !== 'development';
  });

  const initRef = useRef(false);

  useEffect(() => {
    // 防止重复初始化
    if (initRef.current || mswInitialized || mswInitializing) {
      setIsReady(true);
      return;
    }

    // 只在开发环境下初始化MSW
    if (process.env.NODE_ENV === 'development') {
      initRef.current = true;
      mswInitializing = true;

      const initMSW = async () => {
        try {
          console.log('🚀 开始初始化MSW...');

          const { autoInitializeForDevelopment } = await import('@/mocks/setup');
          const result = await autoInitializeForDevelopment();

          if (result) {
            console.log('✅ MSW初始化成功');
            mswInitialized = true;
          } else {
            console.warn('⚠️ MSW初始化被跳过');
          }

        } catch (error) {
          console.error('❌ MSW初始化失败:', error);
        } finally {
          mswInitializing = false;
          setIsReady(true);
        }
      };

      initMSW();
    } else {
      setIsReady(true);
    }
  }, []);

  // 在开发环境下，等待MSW初始化完成
  if (process.env.NODE_ENV === 'development' && !isReady) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-sm">Mock服务初始化中...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
