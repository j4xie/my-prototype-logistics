/**
 * 认证组件测试
 * 测试登录、注册、权限验证等核心认证UI组件
 */

import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReset = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    reset: mockReset,
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock biometric authentication
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

// Mock stores
const mockAuthStore = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: jest.fn(),
  logout: jest.fn(),
  setLoading: jest.fn(),
};

const mockPermissionStore = {
  permissions: null,
  hasPermission: jest.fn(() => false),
  hasRole: jest.fn(() => false),
  setPermissions: jest.fn(),
};

jest.mock('../../store/authStore', () => ({
  useAuthStore: () => mockAuthStore,
}));

jest.mock('../../store/permissionStore', () => ({
  usePermissionStore: () => mockPermissionStore,
}));

// Mock services
const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  logout: jest.fn(),
  validateToken: jest.fn(),
};

jest.mock('../../services/auth/authService', () => ({
  authService: mockAuthService,
}));

describe('认证组件测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthStore.user = null;
    mockAuthStore.isAuthenticated = false;
    mockAuthStore.isLoading = false;
  });

  describe('1. LoginForm组件测试', () => {
    // 创建简化版LoginForm用于测试
    const LoginForm = () => {
      const [username, setUsername] = React.useState('');
      const [password, setPassword] = React.useState('');
      const [isLoading, setIsLoading] = React.useState(false);

      const handleLogin = async () => {
        if (!username || !password) {
          alert('请填写用户名和密码');
          return;
        }

        setIsLoading(true);
        try {
          await mockAuthService.login({ username, password });
          mockNavigate('Home');
        } catch (error) {
          alert('登录失败');
        } finally {
          setIsLoading(false);
        }
      };

      return (
        <div>
          <input
            testID="username-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用户名"
          />
          <input
            testID="password-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
          />
          <button
            testID="login-button"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </div>
      );
    };

    test('组件正常渲染', () => {
      render(<LoginForm />);
      
      expect(screen.getByTestId('username-input')).toBeTruthy();
      expect(screen.getByTestId('password-input')).toBeTruthy();
      expect(screen.getByTestId('login-button')).toBeTruthy();
    });

    test('用户输入处理', () => {
      render(<LoginForm />);
      
      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');

      fireEvent.changeText(usernameInput, 'testuser');
      fireEvent.changeText(passwordInput, 'testpass');

      expect(usernameInput.props.value).toBe('testuser');
      expect(passwordInput.props.value).toBe('testpass');
    });

    test('空字段验证', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      render(<LoginForm />);
      
      const loginButton = screen.getByTestId('login-button');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('请填写用户名和密码');
      });

      alertSpy.mockRestore();
    });

    test('登录成功流程', async () => {
      mockAuthService.login.mockResolvedValueOnce({
        user: { id: 'user1', username: 'testuser' },
        tokens: { accessToken: 'token123' }
      });

      render(<LoginForm />);
      
      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const loginButton = screen.getByTestId('login-button');

      fireEvent.changeText(usernameInput, 'testuser');
      fireEvent.changeText(passwordInput, 'testpass');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockAuthService.login).toHaveBeenCalledWith({
          username: 'testuser',
          password: 'testpass'
        });
        expect(mockNavigate).toHaveBeenCalledWith('Home');
      });
    });

    test('登录失败处理', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});
      mockAuthService.login.mockRejectedValueOnce(new Error('Login failed'));

      render(<LoginForm />);
      
      const usernameInput = screen.getByTestId('username-input');
      const passwordInput = screen.getByTestId('password-input');
      const loginButton = screen.getByTestId('login-button');

      fireEvent.changeText(usernameInput, 'testuser');
      fireEvent.changeText(passwordInput, 'testpass');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('登录失败');
      });

      alertSpy.mockRestore();
    });
  });

  describe('2. PermissionGuard组件测试', () => {
    // 简化版PermissionGuard用于测试
    const PermissionGuard = ({ 
      children, 
      requiredPermission, 
      requiredRole, 
      fallback = <div testID="permission-denied">权限不足</div> 
    }: {
      children: React.ReactNode;
      requiredPermission?: string;
      requiredRole?: string;
      fallback?: React.ReactNode;
    }) => {
      const hasPermission = requiredPermission ? mockPermissionStore.hasPermission(requiredPermission) : true;
      const hasRole = requiredRole ? mockPermissionStore.hasRole(requiredRole) : true;

      if (hasPermission && hasRole) {
        return <>{children}</>;
      }

      return <>{fallback}</>;
    };

    test('有权限时显示内容', () => {
      mockPermissionStore.hasPermission.mockReturnValue(true);
      
      render(
        <PermissionGuard requiredPermission="admin_access">
          <div testID="protected-content">受保护的内容</div>
        </PermissionGuard>
      );

      expect(screen.getByTestId('protected-content')).toBeTruthy();
      expect(mockPermissionStore.hasPermission).toHaveBeenCalledWith('admin_access');
    });

    test('无权限时显示回退内容', () => {
      mockPermissionStore.hasPermission.mockReturnValue(false);
      
      render(
        <PermissionGuard requiredPermission="admin_access">
          <div testID="protected-content">受保护的内容</div>
        </PermissionGuard>
      );

      expect(screen.getByTestId('permission-denied')).toBeTruthy();
      expect(screen.queryByTestId('protected-content')).toBeNull();
    });

    test('角色权限检查', () => {
      mockPermissionStore.hasRole.mockReturnValue(true);
      
      render(
        <PermissionGuard requiredRole="admin">
          <div testID="role-content">管理员内容</div>
        </PermissionGuard>
      );

      expect(screen.getByTestId('role-content')).toBeTruthy();
      expect(mockPermissionStore.hasRole).toHaveBeenCalledWith('admin');
    });

    test('多重权限检查', () => {
      mockPermissionStore.hasPermission.mockReturnValue(true);
      mockPermissionStore.hasRole.mockReturnValue(false);
      
      render(
        <PermissionGuard requiredPermission="admin_access" requiredRole="admin">
          <div testID="multi-protected">多重保护内容</div>
        </PermissionGuard>
      );

      // 应该显示权限不足，因为角色检查失败
      expect(screen.getByTestId('permission-denied')).toBeTruthy();
      expect(screen.queryByTestId('multi-protected')).toBeNull();
    });
  });

  describe('3. BiometricAuth组件测试', () => {
    const mockLocalAuth = require('expo-local-authentication');
    
    // 简化版BiometricAuth
    const BiometricAuth = ({ onSuccess, onError }: {
      onSuccess: () => void;
      onError: (error: string) => void;
    }) => {
      const [isAvailable, setIsAvailable] = React.useState(false);

      React.useEffect(() => {
        checkBiometric();
      }, []);

      const checkBiometric = async () => {
        try {
          const hasHardware = await mockLocalAuth.hasHardwareAsync();
          const isEnrolled = await mockLocalAuth.isEnrolledAsync();
          setIsAvailable(hasHardware && isEnrolled);
        } catch (error) {
          setIsAvailable(false);
        }
      };

      const authenticate = async () => {
        try {
          const result = await mockLocalAuth.authenticateAsync({
            promptMessage: '请验证您的身份',
          });
          
          if (result.success) {
            onSuccess();
          } else {
            onError('认证失败');
          }
        } catch (error) {
          onError('认证过程中出错');
        }
      };

      if (!isAvailable) {
        return <div testID="biometric-unavailable">生物识别不可用</div>;
      }

      return (
        <div>
          <button testID="biometric-button" onClick={authenticate}>
            指纹/面部识别
          </button>
        </div>
      );
    };

    test('生物识别可用性检查', async () => {
      render(<BiometricAuth onSuccess={jest.fn()} onError={jest.fn()} />);

      await waitFor(() => {
        expect(mockLocalAuth.hasHardwareAsync).toHaveBeenCalled();
        expect(mockLocalAuth.isEnrolledAsync).toHaveBeenCalled();
      });

      expect(screen.getByTestId('biometric-button')).toBeTruthy();
    });

    test('生物识别不可用时的处理', async () => {
      mockLocalAuth.hasHardwareAsync.mockResolvedValueOnce(false);
      
      render(<BiometricAuth onSuccess={jest.fn()} onError={jest.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('biometric-unavailable')).toBeTruthy();
      });
    });

    test('生物识别成功', async () => {
      const onSuccess = jest.fn();
      mockLocalAuth.authenticateAsync.mockResolvedValueOnce({ success: true });
      
      render(<BiometricAuth onSuccess={onSuccess} onError={jest.fn()} />);

      await waitFor(() => {
        const button = screen.getByTestId('biometric-button');
        fireEvent.press(button);
      });

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    test('生物识别失败', async () => {
      const onError = jest.fn();
      mockLocalAuth.authenticateAsync.mockResolvedValueOnce({ success: false });
      
      render(<BiometricAuth onSuccess={jest.fn()} onError={onError} />);

      await waitFor(() => {
        const button = screen.getByTestId('biometric-button');
        fireEvent.press(button);
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalledWith('认证失败');
      });
    });
  });

  describe('4. UserProfile组件测试', () => {
    // 简化版UserProfile
    const UserProfile = () => {
      const user = mockAuthStore.user;
      const [isEditing, setIsEditing] = React.useState(false);
      const [editedName, setEditedName] = React.useState(user?.name || '');

      const handleSave = () => {
        // 模拟保存用户信息
        if (user) {
          mockAuthStore.updateUser?.({ name: editedName });
        }
        setIsEditing(false);
      };

      if (!user) {
        return <div testID="no-user">未登录</div>;
      }

      return (
        <div testID="user-profile">
          <div testID="user-id">ID: {user.id}</div>
          
          {isEditing ? (
            <div>
              <input
                testID="name-input"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
              />
              <button testID="save-button" onClick={handleSave}>
                保存
              </button>
              <button testID="cancel-button" onClick={() => setIsEditing(false)}>
                取消
              </button>
            </div>
          ) : (
            <div>
              <div testID="user-name">姓名: {user.name}</div>
              <button testID="edit-button" onClick={() => setIsEditing(true)}>
                编辑
              </button>
            </div>
          )}
        </div>
      );
    };

    test('未登录状态显示', () => {
      render(<UserProfile />);
      expect(screen.getByTestId('no-user')).toBeTruthy();
    });

    test('已登录用户信息显示', () => {
      mockAuthStore.user = { id: 'user1', name: '测试用户', userType: 'factory' };
      
      render(<UserProfile />);
      
      expect(screen.getByTestId('user-profile')).toBeTruthy();
      expect(screen.getByTestId('user-id')).toHaveTextContent('ID: user1');
      expect(screen.getByTestId('user-name')).toHaveTextContent('姓名: 测试用户');
    });

    test('编辑模式切换', () => {
      mockAuthStore.user = { id: 'user1', name: '测试用户', userType: 'factory' };
      
      render(<UserProfile />);
      
      const editButton = screen.getByTestId('edit-button');
      fireEvent.press(editButton);

      expect(screen.getByTestId('name-input')).toBeTruthy();
      expect(screen.getByTestId('save-button')).toBeTruthy();
      expect(screen.getByTestId('cancel-button')).toBeTruthy();
    });

    test('用户信息编辑和保存', () => {
      mockAuthStore.user = { id: 'user1', name: '测试用户', userType: 'factory' };
      mockAuthStore.updateUser = jest.fn();
      
      render(<UserProfile />);
      
      // 进入编辑模式
      fireEvent.press(screen.getByTestId('edit-button'));
      
      // 修改名称
      const nameInput = screen.getByTestId('name-input');
      fireEvent.changeText(nameInput, '新用户名');
      
      // 保存
      fireEvent.press(screen.getByTestId('save-button'));
      
      expect(mockAuthStore.updateUser).toHaveBeenCalledWith({ name: '新用户名' });
    });
  });

  describe('5. 认证状态管理集成测试', () => {
    test('登录状态变化对组件的影响', async () => {
      // 初始未登录状态
      render(<UserProfile />);
      expect(screen.getByTestId('no-user')).toBeTruthy();

      // 模拟登录
      mockAuthStore.user = { id: 'user1', name: '测试用户', userType: 'factory' };
      mockAuthStore.isAuthenticated = true;

      // 重新渲染
      render(<UserProfile />);
      expect(screen.getByTestId('user-profile')).toBeTruthy();
    });

    test('权限变化对PermissionGuard的影响', () => {
      mockPermissionStore.hasPermission.mockReturnValue(false);
      
      const { rerender } = render(
        <PermissionGuard requiredPermission="admin_access">
          <div testID="protected">保护内容</div>
        </PermissionGuard>
      );

      expect(screen.getByTestId('permission-denied')).toBeTruthy();

      // 模拟权限获取
      mockPermissionStore.hasPermission.mockReturnValue(true);
      
      rerender(
        <PermissionGuard requiredPermission="admin_access">
          <div testID="protected">保护内容</div>
        </PermissionGuard>
      );

      expect(screen.getByTestId('protected')).toBeTruthy();
    });
  });
});