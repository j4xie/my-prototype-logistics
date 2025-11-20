/**
 * userApiClient 单元测试
 * 测试用户管理API客户端的所有核心方法
 */

import { userApiClient } from '../../../services/api/userApiClient';
import { createApiMock, mockSuccessResponse, mockErrorResponse, resetApiMock } from '../../utils/mockApiClient';
import { mockUser, expectSuccessResponse, expectApiError } from '../../utils/testHelpers';
import MockAdapter from 'axios-mock-adapter';

describe('userApiClient', () => {
  let mock: MockAdapter;
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const TEST_USER_ID = 1;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  describe('getUsers', () => {
    it('应该成功获取用户列表（分页）', async () => {
      const mockResponse = {
        content: [mockUser(), mockUser()],
        totalElements: 2,
        totalPages: 1,
        size: 10,
        number: 0,
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users`,
        mockResponse
      );

      const result = await userApiClient.getUsers({ page: 0, size: 10 });

      expect(result).toEqual(mockResponse);
      expect(result.content).toHaveLength(2);
      expect(result.totalElements).toBe(2);
    });

    it('应该支持关键词搜索参数', async () => {
      const mockResponse = {
        content: [mockUser({ username: 'testuser' })],
        totalElements: 1,
        totalPages: 1,
        size: 10,
        number: 0,
      };

      mock.onGet(/\/api\/mobile\/.*\/users/).reply((config) => {
        expect(config.params).toHaveProperty('keyword', '测试');
        return [200, mockResponse];
      });

      const result = await userApiClient.getUsers({ keyword: '测试' });

      expect(result.content).toHaveLength(1);
    });

    it('应该处理空列表', async () => {
      const mockResponse = {
        content: [],
        totalElements: 0,
        totalPages: 0,
        size: 10,
        number: 0,
      };

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users`,
        mockResponse
      );

      const result = await userApiClient.getUsers();

      expect(result.content).toHaveLength(0);
      expect(result.totalElements).toBe(0);
    });
  });

  describe('createUser', () => {
    it('应该成功创建用户', async () => {
      const newUser = {
        username: 'newuser',
        password: 'Password123!',
        realName: '新用户',
        email: 'new@example.com',
        role: 'factory_user',
      };

      const mockResponse = mockUser({ ...newUser, id: 123 });

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users`,
        mockResponse
      );

      const result = await userApiClient.createUser(newUser);

      expect(result.id).toBe(123);
      expect(result.username).toBe('newuser');
      expect(result.realName).toBe('新用户');
    });

    it('应该在用户名已存在时返回错误', async () => {
      const newUser = {
        username: 'existinguser',
        password: 'Password123!',
        realName: '重复用户',
        role: 'factory_user',
      };

      mockErrorResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users`,
        '用户名已存在',
        400
      );

      await expect(userApiClient.createUser(newUser)).rejects.toThrow();
    });
  });

  describe('getUserById', () => {
    it('应该成功获取用户详情', async () => {
      const mockResponse = mockUser({ id: TEST_USER_ID, username: 'testuser' });

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}`,
        mockResponse
      );

      const result = await userApiClient.getUserById(TEST_USER_ID);

      expect(result.id).toBe(TEST_USER_ID);
      expect(result.username).toBe('testuser');
    });

    it('应该在用户不存在时返回404错误', async () => {
      const NON_EXISTENT_ID = 9999;

      mockErrorResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${NON_EXISTENT_ID}`,
        '用户不存在',
        404
      );

      await expect(userApiClient.getUserById(NON_EXISTENT_ID)).rejects.toThrow();
    });
  });

  describe('updateUser', () => {
    it('应该成功更新用户信息', async () => {
      const updateData = {
        realName: '更新的名字',
        email: 'updated@example.com',
        phone: '13900139000',
      };

      const mockResponse = mockUser({ id: TEST_USER_ID, ...updateData });

      mockSuccessResponse(
        mock,
        'put',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}`,
        mockResponse
      );

      const result = await userApiClient.updateUser(TEST_USER_ID, updateData);

      expect(result.realName).toBe('更新的名字');
      expect(result.email).toBe('updated@example.com');
    });

    it('应该支持部分字段更新', async () => {
      const updateData = { phone: '13800138000' };

      const mockResponse = mockUser({ id: TEST_USER_ID, phone: '13800138000' });

      mockSuccessResponse(
        mock,
        'put',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}`,
        mockResponse
      );

      const result = await userApiClient.updateUser(TEST_USER_ID, updateData);

      expect(result.phone).toBe('13800138000');
    });
  });

  describe('deleteUser', () => {
    it('应该成功删除用户', async () => {
      mockSuccessResponse(
        mock,
        'delete',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}`,
        {}
      );

      await expect(userApiClient.deleteUser(TEST_USER_ID)).resolves.not.toThrow();
    });

    it('应该在删除不存在的用户时返回错误', async () => {
      const NON_EXISTENT_ID = 9999;

      mockErrorResponse(
        mock,
        'delete',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${NON_EXISTENT_ID}`,
        '用户不存在',
        404
      );

      await expect(userApiClient.deleteUser(NON_EXISTENT_ID)).rejects.toThrow();
    });
  });

  describe('activateUser / deactivateUser', () => {
    it('应该成功激活用户', async () => {
      const mockResponse = mockUser({ id: TEST_USER_ID, isActive: true });

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}/activate`,
        mockResponse
      );

      const result = await userApiClient.activateUser(TEST_USER_ID);

      expect(result.isActive).toBe(true);
    });

    it('应该成功停用用户', async () => {
      const mockResponse = mockUser({ id: TEST_USER_ID, isActive: false });

      mockSuccessResponse(
        mock,
        'post',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}/deactivate`,
        mockResponse
      );

      const result = await userApiClient.deactivateUser(TEST_USER_ID);

      expect(result.isActive).toBe(false);
    });
  });

  describe('changePassword', () => {
    it('应该成功修改密码', async () => {
      const passwordData = {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      };

      const mockResponse = { message: '密码修改成功' };

      mockSuccessResponse(
        mock,
        'put',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}/password`,
        mockResponse
      );

      const result = await userApiClient.changePassword(TEST_USER_ID, passwordData);

      expect(result.message).toBe('密码修改成功');
    });

    it('应该在旧密码错误时返回错误', async () => {
      const passwordData = {
        oldPassword: 'WrongPassword',
        newPassword: 'NewPassword456!',
      };

      mockErrorResponse(
        mock,
        'put',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/${TEST_USER_ID}/password`,
        '旧密码错误',
        400
      );

      await expect(userApiClient.changePassword(TEST_USER_ID, passwordData)).rejects.toThrow();
    });
  });

  describe('searchUsers', () => {
    it('应该成功搜索用户', async () => {
      const mockResponse = [
        mockUser({ username: 'user1', realName: '张三' }),
        mockUser({ username: 'user2', realName: '张四' }),
      ];

      mock.onGet(/\/api\/mobile\/.*\/users\/search/).reply((config) => {
        expect(config.params).toHaveProperty('keyword', '张');
        return [200, mockResponse];
      });

      const result = await userApiClient.searchUsers({ keyword: '张' });

      expect(result).toHaveLength(2);
      expect(result[0].realName).toContain('张');
    });

    it('应该支持按角色筛选', async () => {
      const mockResponse = [mockUser({ role: 'admin' })];

      mock.onGet(/\/api\/mobile\/.*\/users\/search/).reply((config) => {
        expect(config.params).toHaveProperty('role', 'admin');
        return [200, mockResponse];
      });

      const result = await userApiClient.searchUsers({ keyword: 'admin', role: 'admin' });

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('admin');
    });
  });

  describe('checkUsernameExists', () => {
    it('应该返回true当用户名已存在', async () => {
      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/check/username`,
        true
      );

      const result = await userApiClient.checkUsernameExists('existinguser');

      expect(result).toBe(true);
    });

    it('应该返回false当用户名不存在', async () => {
      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/check/username`,
        false
      );

      const result = await userApiClient.checkUsernameExists('newuser');

      expect(result).toBe(false);
    });
  });

  describe('getUsersByRole', () => {
    it('应该成功获取指定角色的用户列表', async () => {
      const mockResponse = [
        mockUser({ role: 'admin' }),
        mockUser({ role: 'admin' }),
      ];

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${DEFAULT_FACTORY_ID}/users/role/admin`,
        mockResponse
      );

      const result = await userApiClient.getUsersByRole('admin');

      expect(result).toHaveLength(2);
      result.forEach((user) => {
        expect(user.role).toBe('admin');
      });
    });
  });

  describe('自定义factoryId', () => {
    it('应该支持自定义factoryId', async () => {
      const CUSTOM_FACTORY_ID = 'CUSTOM_2024_999';
      const mockResponse = [mockUser()];

      mockSuccessResponse(
        mock,
        'get',
        `/api/mobile/${CUSTOM_FACTORY_ID}/users`,
        { content: mockResponse, totalElements: 1, totalPages: 1, size: 10, number: 0 }
      );

      const result = await userApiClient.getUsers({ factoryId: CUSTOM_FACTORY_ID });

      expect(result.content).toHaveLength(1);
    });
  });
});
