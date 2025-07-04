import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { initializeCore } from '@food-trace/core';

// 创建查询客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟
      gcTime: 10 * 60 * 1000, // 10分钟
    },
  },
});

// 防止启动屏幕自动隐藏
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    async function initializeApp() {
      try {
        // 初始化核心配置
        await initializeCore({
          platform: 'mobile',
          apiBaseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
          enableLogging: __DEV__,
          storage: {
            type: 'async-storage'
          }
        });
        
        // 隐藏启动屏幕
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error('Failed to initialize app:', error);
        await SplashScreen.hideAsync();
      }
    }

    initializeApp();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <PaperProvider>
            <StatusBar style="auto" />
            <Stack>
              <Stack.Screen 
                name="(auth)" 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="(tabs)" 
                options={{ headerShown: false }} 
              />
              <Stack.Screen 
                name="modal" 
                options={{ presentation: 'modal' }} 
              />
            </Stack>
          </PaperProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}