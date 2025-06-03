'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';
import { initWebSocket } from '@/lib/websocket';
import { initAIService } from '@/lib/ai-service';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1分钟
            retry: 2,
          },
        },
      })
  );

  useEffect(() => {
    // 初始化WebSocket连接
    const wsConfig = {
      url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
      autoConnect: true,
      reconnection: true,
      timeout: 5000,
    };

    try {
      const ws = initWebSocket(wsConfig);
      ws.connect().catch(console.error);
    } catch (error) {
      console.warn('WebSocket初始化失败:', error);
    }

    // 初始化AI服务
    const aiConfig = {
      apiKey: process.env.NEXT_PUBLIC_AI_API_KEY || '',
      endpoint:
        process.env.NEXT_PUBLIC_AI_ENDPOINT ||
        'http://localhost:8000/api/v1/ai',
      model: process.env.NEXT_PUBLIC_AI_MODEL || 'gpt-3.5-turbo',
      timeout: 30000,
    };

    if (aiConfig.apiKey) {
      try {
        initAIService(aiConfig);
      } catch (error) {
        console.warn('AI服务初始化失败:', error);
      }
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
