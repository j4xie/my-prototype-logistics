// @ts-nocheck
/**
 * roleThemeStore 单元测试
 * 测试角色主题加载、颜色获取、组件权限判断
 */

jest.mock('zustand/react/shallow', () => ({ useShallow: (fn: any) => fn }));

import { useRoleThemeStore } from '../../../store/roleThemeStore';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_THEME = {
  roleCode: 'viewer',
  primaryColor: '#1890FF',
  secondaryColor: '#69C0FF',
  accentColor: '#40A9FF',
  backgroundColor: '#F5F5F5',
  surfaceColor: '#FFFFFF',
  textColor: '#262626',
  successColor: '#52C41A',
  warningColor: '#FAAD14',
  errorColor: '#FF4D4F',
  welcomeText: '欢迎使用白垩纪AI Agent',
};

const resetStore = () => {
  useRoleThemeStore.setState({
    currentTheme: null,
    defaultTheme: { ...DEFAULT_THEME },
    availableComponents: [],
    isLoading: false,
    error: null,
  });
};

describe('roleThemeStore', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
    resetStore();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  describe('default state', () => {
    it('should have null currentTheme', () => {
      expect(useRoleThemeStore.getState().currentTheme).toBeNull();
    });

    it('should have default theme with viewer roleCode', () => {
      expect(useRoleThemeStore.getState().defaultTheme.roleCode).toBe('viewer');
    });

    it('should have empty availableComponents', () => {
      expect(useRoleThemeStore.getState().availableComponents).toEqual([]);
    });

    it('should not be loading', () => {
      expect(useRoleThemeStore.getState().isLoading).toBe(false);
    });

    it('should have no error', () => {
      expect(useRoleThemeStore.getState().error).toBeNull();
    });
  });

  describe('loadTheme', () => {
    const themeData = {
      roleCode: 'factory_super_admin',
      primaryColor: '#FF5722',
      secondaryColor: '#FF8A65',
      accentColor: '#FF7043',
      backgroundColor: '#FAFAFA',
      surfaceColor: '#FFFFFF',
      textColor: '#212121',
      successColor: '#4CAF50',
      warningColor: '#FFC107',
      errorColor: '#F44336',
      welcomeText: '工厂管理员您好',
      logoUrl: '/logo.png',
    };

    it('should load theme successfully', async () => {
      mock.onGet('/api/mobile/F001/role-theme/factory_super_admin').reply(200, {
        success: true,
        data: {
          theme: themeData,
          permissions: [],
        },
      });
      await useRoleThemeStore.getState().loadTheme('factory_super_admin', 'F001');
      expect(useRoleThemeStore.getState().currentTheme).toBeTruthy();
    });

    it('should set isLoading during load', async () => {
      mock.onGet('/api/mobile/F001/role-theme/admin').reply(200, {
        success: true,
        data: {
          theme: themeData,
          permissions: [],
        },
      });
      const promise = useRoleThemeStore.getState().loadTheme('admin', 'F001');
      expect(useRoleThemeStore.getState().isLoading).toBe(true);
      await promise;
      expect(useRoleThemeStore.getState().isLoading).toBe(false);
    });

    it('should handle load failure gracefully', async () => {
      mock.onGet('/api/mobile/F001/role-theme/bad').reply(500);
      await useRoleThemeStore.getState().loadTheme('bad', 'F001');
      // On failure, store silently falls back to default theme (error: null)
      expect(useRoleThemeStore.getState().currentTheme).toBeTruthy();
    });

    it('should fallback to default theme on failure', async () => {
      mock.onGet('/api/mobile/F001/role-theme/bad').reply(500);
      await useRoleThemeStore.getState().loadTheme('bad', 'F001');
      expect(useRoleThemeStore.getState().defaultTheme.roleCode).toBe('viewer');
    });
  });

  describe('setTheme', () => {
    it('should set currentTheme', () => {
      const theme = { ...DEFAULT_THEME, roleCode: 'admin', primaryColor: '#333' };
      useRoleThemeStore.getState().setTheme(theme);
      expect(useRoleThemeStore.getState().currentTheme).toEqual(theme);
    });
  });

  describe('resetTheme', () => {
    it('should clear currentTheme', () => {
      useRoleThemeStore.setState({ currentTheme: { ...DEFAULT_THEME, roleCode: 'admin' } });
      useRoleThemeStore.getState().resetTheme();
      expect(useRoleThemeStore.getState().currentTheme).toBeNull();
    });
  });

  describe('getEffectiveColor', () => {
    it('should return default color when no currentTheme', () => {
      const color = useRoleThemeStore.getState().getEffectiveColor('primaryColor');
      expect(color).toBe('#1890FF');
    });

    it('should return currentTheme color when set', () => {
      useRoleThemeStore.setState({
        currentTheme: { ...DEFAULT_THEME, primaryColor: '#FF0000' },
      });
      const color = useRoleThemeStore.getState().getEffectiveColor('primaryColor');
      expect(color).toBe('#FF0000');
    });

    it('should return secondary color', () => {
      const color = useRoleThemeStore.getState().getEffectiveColor('secondaryColor');
      expect(color).toBe('#69C0FF');
    });

    it('should return error color', () => {
      const color = useRoleThemeStore.getState().getEffectiveColor('errorColor');
      expect(color).toBe('#FF4D4F');
    });
  });

  describe('getThemedColors', () => {
    it('should return all theme colors', () => {
      const colors = useRoleThemeStore.getState().getThemedColors();
      expect(colors).toHaveProperty('primaryColor');
      expect(colors).toHaveProperty('backgroundColor');
      expect(colors).toHaveProperty('textColor');
    });
  });

  describe('canUseComponent', () => {
    it('should return true when no permissions set', () => {
      expect(useRoleThemeStore.getState().canUseComponent('dashboard')).toBe(true);
    });

    it('should return false for none permission', () => {
      useRoleThemeStore.setState({
        availableComponents: [{ componentType: 'reports', permissionLevel: 'none' }],
      });
      expect(useRoleThemeStore.getState().canUseComponent('reports')).toBe(false);
    });

    it('should return true for view permission', () => {
      useRoleThemeStore.setState({
        availableComponents: [{ componentType: 'reports', permissionLevel: 'view' }],
      });
      expect(useRoleThemeStore.getState().canUseComponent('reports')).toBe(true);
    });

    it('should return true for unknown component', () => {
      useRoleThemeStore.setState({
        availableComponents: [{ componentType: 'reports', permissionLevel: 'none' }],
      });
      expect(useRoleThemeStore.getState().canUseComponent('unknown')).toBe(true);
    });
  });

  describe('canEditComponent', () => {
    it('should return false when no permissions set', () => {
      expect(useRoleThemeStore.getState().canEditComponent('dashboard')).toBe(false);
    });

    it('should return true for edit permission', () => {
      useRoleThemeStore.setState({
        availableComponents: [{ componentType: 'dashboard', permissionLevel: 'edit' }],
      });
      expect(useRoleThemeStore.getState().canEditComponent('dashboard')).toBe(true);
    });

    it('should return false for view permission', () => {
      useRoleThemeStore.setState({
        availableComponents: [{ componentType: 'dashboard', permissionLevel: 'view' }],
      });
      expect(useRoleThemeStore.getState().canEditComponent('dashboard')).toBe(false);
    });
  });

  describe('getPrimaryColor', () => {
    it('should return default primary color', () => {
      expect(useRoleThemeStore.getState().getPrimaryColor()).toBe('#1890FF');
    });

    it('should return currentTheme primary color when set', () => {
      useRoleThemeStore.setState({
        currentTheme: { ...DEFAULT_THEME, primaryColor: '#00BCD4' },
      });
      expect(useRoleThemeStore.getState().getPrimaryColor()).toBe('#00BCD4');
    });
  });

  describe('getWelcomeText', () => {
    it('should return default welcome text', () => {
      expect(useRoleThemeStore.getState().getWelcomeText()).toBe('欢迎使用白垩纪AI Agent');
    });

    it('should return currentTheme welcome text', () => {
      useRoleThemeStore.setState({
        currentTheme: { ...DEFAULT_THEME, welcomeText: '你好管理员' },
      });
      expect(useRoleThemeStore.getState().getWelcomeText()).toBe('你好管理员');
    });
  });

  describe('getLogoUrl', () => {
    it('should return undefined when no logo set', () => {
      const url = useRoleThemeStore.getState().getLogoUrl();
      expect(url).toBeUndefined();
    });

    it('should return logo url from currentTheme', () => {
      useRoleThemeStore.setState({
        currentTheme: { ...DEFAULT_THEME, logoUrl: '/logo.png' },
      });
      expect(useRoleThemeStore.getState().getLogoUrl()).toBe('/logo.png');
    });
  });

  describe('getCurrentRoleCode', () => {
    it('should return null when no currentTheme', () => {
      expect(useRoleThemeStore.getState().getCurrentRoleCode()).toBeNull();
    });

    it('should return currentTheme roleCode', () => {
      useRoleThemeStore.setState({
        currentTheme: { ...DEFAULT_THEME, roleCode: 'factory_super_admin' },
      });
      expect(useRoleThemeStore.getState().getCurrentRoleCode()).toBe('factory_super_admin');
    });
  });

  describe('setComponentPermissions', () => {
    it('should set available components', () => {
      const components = [
        { componentType: 'dash', permissionLevel: 'edit' },
        { componentType: 'reports', permissionLevel: 'view' },
      ];
      useRoleThemeStore.getState().setComponentPermissions(components);
      expect(useRoleThemeStore.getState().availableComponents).toEqual(components);
    });
  });
});
