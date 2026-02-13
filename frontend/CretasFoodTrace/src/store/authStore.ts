import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthTokens, isPlatformUser, isFactoryUser } from '../types/auth';
import { useFactoryFeatureStore } from './factoryFeatureStore';
import { logger } from '../utils/logger';

// 创建AuthStore专用logger
const storeLogger = logger.createContextLogger('AuthStore');

interface AuthState {
  // 状态
  user: User | null;
  tokens: AuthTokens | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setTokens: (tokens: AuthTokens | null) => void;
  setLoading: (loading: boolean) => void;
  login: (user: User, tokens: AuthTokens) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  
  // Getters
  getUserId: () => number | null;
  getUserRole: () => string | null;
  getUserType: () => 'platform' | 'factory' | null;
  getFactoryId: () => string | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      user: null,
      tokens: null,
      isLoading: false,
      isAuthenticated: false,

      // Actions
      setUser: (user) =>
        set((state) => ({
          user,
          isAuthenticated: !!user,
        })),

      setTokens: (tokens) =>
        set({ tokens }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      login: (user, tokens) => {
        storeLogger.debug('用户登录', {
          userId: user.id,
          userType: user.userType,
          isPlatform: isPlatformUser(user),
          isFactory: isFactoryUser(user)
        });

        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        useFactoryFeatureStore.getState().reset();
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } as User : null,
        })),

      // Getters
      getUserId: () => {
        const { user } = get();
        return user?.id || null;
      },

      getUserRole: () => {
        const { user } = get();
        if (!user) return null;

        // 平台用户
        if (user.userType === 'platform') {
          return 'platformUser' in user ? user.platformUser.role : null;
        }

        // 工厂用户
        if (user.userType === 'factory') {
          return 'factoryUser' in user ? user.factoryUser.role : null;
        }

        return null;
      },

      getUserType: () => {
        const { user } = get();
        return user?.userType || null;
      },

      getFactoryId: () => {
        const { user } = get();
        if (!user) return null;

        // 工厂用户 - 返回 factoryId
        if (user.userType === 'factory' && 'factoryUser' in user) {
          return user.factoryUser.factoryId;
        }

        // 平台用户没有 factoryId
        return null;
      },
    }),
    {
      name: 'auth-storage-v3', // 存储key - 更改版本号清除旧缓存 (v3: fixed auth sync)
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);