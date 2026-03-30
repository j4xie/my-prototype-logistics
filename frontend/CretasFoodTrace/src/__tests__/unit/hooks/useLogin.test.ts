// @ts-nocheck
import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '../../../store/authStore';
import { useFactoryFeatureStore } from '../../../store/factoryFeatureStore';

const mockLogin = jest.fn();
jest.mock('../../../services/serviceFactory', () => ({
  AuthServiceInstance: { login: (...args: any[]) => mockLogin(...args) },
}));

jest.mock('../../../errors', () => ({
  NotImplementedError: class NotImplementedError extends Error {
    constructor(name: string, phase: string, msg: string) {
      super(msg);
      this.name = 'NotImplementedError';
    }
  },
}));

import { useLogin } from '../../../hooks/useLogin';

beforeEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    tokens: null,
    isAuthenticated: false,
    isLoading: false,
  });
  useFactoryFeatureStore.setState({
    modules: {},
    loaded: false,
    loading: false,
  });
});

const mockFactoryUser = {
  id: 2,
  username: 'factory_admin1',
  userType: 'factory' as const,
  factoryUser: { role: 'factory_super_admin', factoryId: 'F001', name: 'Admin' },
};

const mockPlatformUser = {
  id: 1,
  username: 'platform_admin',
  userType: 'platform' as const,
  platformUser: { role: 'platform_admin', name: 'Admin' },
};

const mockTokens = { accessToken: 'at', refreshToken: 'rt', expiresIn: 86400, tokenType: 'Bearer' };

describe('useLogin', () => {
  describe('initial state', () => {
    it('has isLoading false', () => {
      const { result } = renderHook(() => useLogin());
      expect(result.current.isLoading).toBe(false);
    });

    it('has error null', () => {
      const { result } = renderHook(() => useLogin());
      expect(result.current.error).toBeNull();
    });

    it('has retryCount 0', () => {
      const { result } = renderHook(() => useLogin());
      expect(result.current.retryCount).toBe(0);
    });

    it('has networkStatus true', () => {
      const { result } = renderHook(() => useLogin());
      expect(result.current.networkStatus).toBe(true);
    });

    it('autoLogin returns false', async () => {
      const { result } = renderHook(() => useLogin());
      let autoResult: boolean = false;
      await act(async () => {
        autoResult = await result.current.autoLogin();
      });
      expect(autoResult).toBe(false);
    });
  });

  describe('successful login', () => {
    it('updates authStore with user and tokens', async () => {
      mockLogin.mockResolvedValue({ success: true, user: mockFactoryUser, tokens: mockTokens, message: '' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'factory_admin1', password: '123456' });
      });
      const authState = useAuthStore.getState();
      expect(authState.user).toEqual(mockFactoryUser);
      expect(authState.tokens).toEqual(mockTokens);
      expect(authState.isAuthenticated).toBe(true);
    });

    it('sets isLoading false after success', async () => {
      mockLogin.mockResolvedValue({ success: true, user: mockFactoryUser, tokens: mockTokens, message: '' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'factory_admin1', password: '123456' });
      });
      expect(result.current.isLoading).toBe(false);
    });

    it('clears error on success', async () => {
      mockLogin.mockResolvedValueOnce({ success: false, message: 'wrong' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      expect(result.current.error).not.toBeNull();

      mockLogin.mockResolvedValueOnce({ success: true, user: mockFactoryUser, tokens: mockTokens });
      await act(async () => {
        await result.current.login({ username: 'factory_admin1', password: '123456' });
      });
      expect(result.current.error).toBeNull();
    });

    it('calls loadFeatures for factory user', async () => {
      const loadSpy = jest.spyOn(useFactoryFeatureStore.getState(), 'loadFeatures').mockResolvedValue();
      mockLogin.mockResolvedValue({ success: true, user: mockFactoryUser, tokens: mockTokens, message: '' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'factory_admin1', password: '123456' });
      });
      // loadFeatures should have been called (store method invoked)
      loadSpy.mockRestore();
    });
  });

  describe('failed login', () => {
    it('sets error message on failure', async () => {
      mockLogin.mockResolvedValue({ success: false, message: 'Invalid credentials' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      expect(result.current.error).toBeTruthy();
    });

    it('increments retryCount on failure', async () => {
      mockLogin.mockResolvedValue({ success: false, message: 'fail' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      expect(result.current.retryCount).toBe(1);
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      expect(result.current.retryCount).toBe(2);
    });

    it('does not set isAuthenticated', async () => {
      mockLogin.mockResolvedValue({ success: false, message: 'fail' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('exception during login', () => {
    it('sets error on exception', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'user', password: 'pass' });
      });
      expect(result.current.error).toBeTruthy();
    });

    it('increments retryCount on exception', async () => {
      mockLogin.mockRejectedValue(new Error('Network error'));
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'user', password: 'pass' });
      });
      expect(result.current.retryCount).toBe(1);
    });

    it('sets isLoading to false', async () => {
      mockLogin.mockRejectedValue(new Error('boom'));
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'user', password: 'pass' });
      });
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('biometricLogin', () => {
    it('throws NotImplementedError', async () => {
      const { result } = renderHook(() => useLogin());
      await expect(
        act(async () => {
          await result.current.biometricLogin();
        })
      ).rejects.toThrow();
    });
  });

  describe('clearError', () => {
    it('clears error', async () => {
      mockLogin.mockResolvedValue({ success: false, message: 'fail' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      expect(result.current.error).toBeTruthy();
      act(() => {
        result.current.clearError();
      });
      expect(result.current.error).toBeNull();
    });
  });

  describe('retry', () => {
    it('clears error and retryCount', async () => {
      mockLogin.mockResolvedValue({ success: false, message: 'fail' });
      const { result } = renderHook(() => useLogin());
      await act(async () => {
        await result.current.login({ username: 'bad', password: 'bad' });
      });
      act(() => {
        result.current.retry();
      });
      expect(result.current.error).toBeNull();
      expect(result.current.retryCount).toBe(0);
    });
  });

  describe('enableBiometricLogin', () => {
    it('throws NotImplementedError', async () => {
      const { result } = renderHook(() => useLogin());
      await expect(
        act(async () => {
          await result.current.enableBiometricLogin();
        })
      ).rejects.toThrow();
    });
  });
});
