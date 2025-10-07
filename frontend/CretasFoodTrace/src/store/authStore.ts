import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, AuthTokens } from '../types/auth';

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
  getUserId: () => string | null;
  getUserRole: () => string | null;
  getUserType: () => 'platform' | 'factory' | null;
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
        console.log('🔐 AuthStore.login - User:', JSON.stringify(user, null, 2));
        console.log('🔐 AuthStore.login - Has platformUser?', !!(user as any).platformUser);
        console.log('🔐 AuthStore.login - Has factoryUser?', !!(user as any).factoryUser);

        set({
          user,
          tokens,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () =>
        set({
          user: null,
          tokens: null,
          isAuthenticated: false,
          isLoading: false,
        }),

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
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
    }),
    {
      name: 'auth-storage-v2', // 存储key - 更改版本号清除旧缓存
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);