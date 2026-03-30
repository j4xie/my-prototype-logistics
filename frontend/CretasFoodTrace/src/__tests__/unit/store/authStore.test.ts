// @ts-nocheck
import { useAuthStore } from '../../../store/authStore';
import { useFactoryFeatureStore } from '../../../store/factoryFeatureStore';

const mockPlatformUser = {
  id: 1,
  username: 'platform_admin',
  userType: 'platform' as const,
  platformUser: { role: 'platform_admin', name: 'Admin' },
};

const mockFactoryUser = {
  id: 2,
  username: 'factory_admin1',
  userType: 'factory' as const,
  factoryUser: { role: 'factory_super_admin', factoryId: 'F001', name: 'Factory Admin' },
};

const mockTokens = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-456',
};

beforeEach(() => {
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

describe('authStore', () => {
  describe('login', () => {
    it('sets user and tokens', () => {
      useAuthStore.getState().login(mockFactoryUser, mockTokens);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockFactoryUser);
      expect(state.tokens).toEqual(mockTokens);
    });

    it('sets isAuthenticated to true', () => {
      useAuthStore.getState().login(mockFactoryUser, mockTokens);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('sets isLoading to false', () => {
      useAuthStore.setState({ isLoading: true });
      useAuthStore.getState().login(mockFactoryUser, mockTokens);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('works with platform user', () => {
      useAuthStore.getState().login(mockPlatformUser, mockTokens);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockPlatformUser);
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    beforeEach(() => {
      useAuthStore.getState().login(mockFactoryUser, mockTokens);
    });

    it('clears user', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('clears tokens', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().tokens).toBeNull();
    });

    it('sets isAuthenticated to false', () => {
      useAuthStore.getState().logout();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('calls factoryFeatureStore reset', () => {
      useFactoryFeatureStore.setState({ loaded: true, modules: { mod1: {} as any } });
      useAuthStore.getState().logout();
      expect(useFactoryFeatureStore.getState().loaded).toBe(false);
    });
  });

  describe('setUser', () => {
    it('sets user', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      expect(useAuthStore.getState().user).toEqual(mockFactoryUser);
    });

    it('sets isAuthenticated to true when user provided', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });

    it('sets isAuthenticated to false when user is null', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      useAuthStore.getState().setUser(null);
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  describe('setTokens', () => {
    it('sets tokens', () => {
      useAuthStore.getState().setTokens(mockTokens);
      expect(useAuthStore.getState().tokens).toEqual(mockTokens);
    });

    it('sets tokens to null', () => {
      useAuthStore.getState().setTokens(mockTokens);
      useAuthStore.getState().setTokens(null);
      expect(useAuthStore.getState().tokens).toBeNull();
    });
  });

  describe('setLoading', () => {
    it('sets isLoading to true', () => {
      useAuthStore.getState().setLoading(true);
      expect(useAuthStore.getState().isLoading).toBe(true);
    });

    it('sets isLoading to false', () => {
      useAuthStore.setState({ isLoading: true });
      useAuthStore.getState().setLoading(false);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('updateUser', () => {
    it('merges partial updates into existing user', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      useAuthStore.getState().updateUser({ username: 'new_name' });
      expect(useAuthStore.getState().user?.username).toBe('new_name');
      expect(useAuthStore.getState().user?.id).toBe(2);
    });

    it('does nothing when user is null', () => {
      useAuthStore.getState().updateUser({ username: 'new_name' });
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('preserves other user fields', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      useAuthStore.getState().updateUser({ username: 'updated' });
      const user = useAuthStore.getState().user;
      expect(user?.userType).toBe('factory');
      expect(user?.id).toBe(2);
    });
  });

  describe('getUserId', () => {
    it('returns user id when logged in', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      expect(useAuthStore.getState().getUserId()).toBe(2);
    });

    it('returns null when no user', () => {
      expect(useAuthStore.getState().getUserId()).toBeNull();
    });
  });

  describe('getUserRole', () => {
    it('returns factory user role', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      expect(useAuthStore.getState().getUserRole()).toBe('factory_super_admin');
    });

    it('returns platform user role', () => {
      useAuthStore.getState().setUser(mockPlatformUser);
      expect(useAuthStore.getState().getUserRole()).toBe('platform_admin');
    });

    it('returns null when no user', () => {
      expect(useAuthStore.getState().getUserRole()).toBeNull();
    });
  });

  describe('getUserType', () => {
    it('returns factory for factory user', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      expect(useAuthStore.getState().getUserType()).toBe('factory');
    });

    it('returns platform for platform user', () => {
      useAuthStore.getState().setUser(mockPlatformUser);
      expect(useAuthStore.getState().getUserType()).toBe('platform');
    });

    it('returns null when no user', () => {
      expect(useAuthStore.getState().getUserType()).toBeNull();
    });
  });

  describe('getFactoryId', () => {
    it('returns factoryId for factory user', () => {
      useAuthStore.getState().setUser(mockFactoryUser);
      expect(useAuthStore.getState().getFactoryId()).toBe('F001');
    });

    it('returns null for platform user', () => {
      useAuthStore.getState().setUser(mockPlatformUser);
      expect(useAuthStore.getState().getFactoryId()).toBeNull();
    });

    it('returns null when no user', () => {
      expect(useAuthStore.getState().getFactoryId()).toBeNull();
    });
  });
});
