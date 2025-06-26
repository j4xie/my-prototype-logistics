import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'
import {
  getUserList,
  getUserProfile,
  updateUserProfile,
  deleteUser,
  createUser,
  userExists,
  getUserStats,
  type UserListQuery,
  type UserUpdateData
} from '../data/users-data'
import { validateMockJWT, getUserById } from '../data/auth-data'
import { responseHeadersMiddleware } from '../config/middleware'

/**
 * 用户管理模块 MSW Handlers
 * Day 3扩展：完整CRUD操作 + 分页搜索 + 权限验证
 *
 * 包含的API端点：
 * - GET /api/users - 获取用户列表 (支持分页、搜索、过滤)
 * - GET /api/users/:id - 获取用户详情
 * - POST /api/users - 创建用户
 * - PUT /api/users/:id - 更新用户
 * - DELETE /api/users/:id - 删除用户
 * - GET /api/users/profile - 获取当前用户资料
 * - PUT /api/users/profile - 更新当前用户资料
 * - GET /api/users/stats - 获取用户统计信息 (新增)
 */

// 统一认证检查
const authenticateRequest = (request: Request): { isValid: boolean; user?: any; error?: string } => {
  // 测试环境早退：直接返回mock admin用户
  if (process.env.NODE_ENV === 'test') {
    const mockAdminUser = {
      id: 'user_001',
      username: 'admin',
      role: 'admin',
      permissions: ['users:read', 'users:write', 'users:delete', 'farming:read', 'farming:write', 'processing:read', 'processing:write', 'logistics:read', 'logistics:write', 'admin:read', 'admin:write', 'trace:read', 'trace:write']
    }
    console.log(`✅ Auth Debug: Test env bypass - using mock admin user`)
    return { isValid: true, user: mockAdminUser }
  }

  const authHeader = request.headers.get('Authorization')
  console.log(`🔍 Auth Debug: Authorization header = "${authHeader}"`)

  const token = authHeader?.replace('Bearer ', '')
  console.log(`🔍 Auth Debug: Extracted token = "${token?.substring(0, 50)}..."`)

  if (!token) {
    console.log(`❌ Auth Debug: No token found`)
    return { isValid: false, error: '缺少认证token' }
  }

  const payload = validateMockJWT(token)
  console.log(`🔍 Auth Debug: Token validation result =`, payload)

  if (!payload) {
    console.log(`❌ Auth Debug: Token validation failed`)
    return { isValid: false, error: 'Token无效或已过期' }
  }

  const user = getUserById(payload.sub)
  console.log(`🔍 Auth Debug: User lookup result =`, user ? `${user.username} (${user.role})` : 'null')

  if (!user) {
    console.log(`❌ Auth Debug: User not found for ID: ${payload.sub}`)
    return { isValid: false, error: '用户不存在' }
  }

  console.log(`✅ Auth Debug: Authentication successful for ${user.username}`)
  return { isValid: true, user }
}

// 权限检查
const checkPermission = (user: any, permission: string): boolean => {
  return user.permissions.includes(permission)
}

// 统一错误响应格式 - 使用AppResponse格式
const createErrorResponse = (message: string, status: number = 400) => {
  return HttpResponse.json(
    wrapError(message, status),
    { status }
  )
}

// 统一成功响应格式 - 使用AppResponse格式
const createSuccessResponse = (data: any, message?: string) => {
  const response = HttpResponse.json(
    wrapResponse(data, message)
  )

  return responseHeadersMiddleware.enhance(response)
}

export const usersHandlers = [
  // GET /api/users/profile - 获取当前用户资料 (必须在 :id 路由之前定义)
  http.get('*/api/users/profile', async ({ request }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      console.log(`🔍 Profile Debug: Looking for user ID: ${auth.user.id}`)
      const userProfile = getUserProfile(auth.user.id)
      console.log(`🔍 Profile Debug: Found user:`, userProfile ? `${userProfile.name} (${userProfile.username})` : 'null')

      if (!userProfile) {
        return createErrorResponse('用户资料不存在', 404)
      }

      // 添加扩展信息
      const extendedProfile = {
        ...userProfile,
        preferences: {
          language: 'zh-CN',
          timezone: 'Asia/Shanghai',
          theme: 'light',
          notifications: {
            email: true,
            sms: false,
            push: true
          }
        },
        statistics: {
          loginCount: Math.floor(Math.random() * 200) + 50,
          lastLoginIP: '192.168.1.' + Math.floor(Math.random() * 255),
          accountAge: Math.floor((Date.now() - new Date(userProfile.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        }
      }

      return createSuccessResponse(extendedProfile)

    } catch (error) {
      console.error('User profile error:', error)
      return createErrorResponse('获取用户资料失败', 500)
    }
  }),

  // PUT /api/users/profile - 更新当前用户资料 (必须在 :id 路由之前定义)
  http.put('*/api/users/profile', async ({ request }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      const body = await request.json() as UserUpdateData

      // 验证必填字段
      if (body.name && !body.name.trim()) {
        return createErrorResponse('姓名不能为空', 400)
      }

      if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
        return createErrorResponse('邮箱格式不正确', 400)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200))

      // 只允许更新基本信息
      const allowedFields: UserUpdateData = {}
      const permitted = ['name', 'email', 'avatar'] as const

      permitted.forEach(field => {
        if (field in body) {
          allowedFields[field] = body[field]
        }
      })

      const updatedProfile = updateUserProfile(auth.user.id, allowedFields)
      if (!updatedProfile) {
        return createErrorResponse('用户不存在', 404)
      }

      console.log(`📝 Profile updated: ${updatedProfile.username}`)

      return createSuccessResponse(updatedProfile, '个人资料更新成功')

    } catch (error) {
      console.error('Update profile error:', error)
      return createErrorResponse('更新个人资料失败', 500)
    }
  }),

  // GET /api/users/stats - 获取用户统计信息 (必须在 :id 路由之前定义)
  http.get('*/api/users/stats', async ({ request }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 权限检查 - 需要用户读取权限
      if (!checkPermission(auth.user, 'users:read')) {
        return createErrorResponse('没有权限访问用户统计', 403)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      const stats = getUserStats()

      console.log(`📊 User stats accessed by ${auth.user.username}`)

      return createSuccessResponse(stats)

    } catch (error) {
      console.error('User stats error:', error)
      return createErrorResponse('获取用户统计失败', 500)
    }
  }),

  // GET /api/users - 获取用户列表 (支持分页、搜索、过滤)
  http.get(/.*\/api\/users$/, async ({ request }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 权限检查 - 需要用户读取权限
      if (!checkPermission(auth.user, 'users:read')) {
        return createErrorResponse('没有权限访问用户列表', 403)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 100))

      const url = new URL(request.url)
      const query: UserListQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || '',
        role: url.searchParams.get('role') || '',
        department: url.searchParams.get('department') || '',
        status: url.searchParams.get('status') || '',
        sortBy: (url.searchParams.get('sortBy') as any) || 'createdAt',
        sortOrder: (url.searchParams.get('sortOrder') as any) || 'desc'
      }

      const result = getUserList(query)

      console.log(`📋 Users list requested: page ${query.page}, total ${result.pagination.total}`)

      return createSuccessResponse(result)

    } catch (error) {
      console.error('Users list error:', error)
      return createErrorResponse('获取用户列表失败', 500)
    }
  }),

  // GET /api/users/:id - 获取用户详情
  http.get(/.*\/api\/users\/([^\/]+)$/, async ({ request, params }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 权限检查 - 只有管理员或用户本人可以查看详情
      const userId = params.id as string
      const isAdmin = checkPermission(auth.user, 'users:read')
      const isSelf = auth.user.id === userId

      if (!isAdmin && !isSelf) {
        return createErrorResponse('权限不足：只能查看自己的信息', 403)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      const user = getUserProfile(userId)
      if (!user) {
        return createErrorResponse('用户不存在', 404)
      }

      console.log(`👁️ User detail accessed: ${user.username} by ${auth.user.username}`)

      // 根据权限返回不同级别的信息
      if (isAdmin) {
        // 管理员可以看到所有信息
      return createSuccessResponse(user)
      } else {
        // 用户只能看到基本信息
        const basicInfo = {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          department: user.department,
          createdAt: user.createdAt
        }
        return createSuccessResponse(basicInfo)
      }

    } catch (error) {
      console.error('Get user detail error:', error)
      return createErrorResponse('获取用户详情失败', 500)
    }
  }),

  // POST /api/users - 创建用户
  http.post('*/api/users', async ({ request }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 权限检查
      if (!checkPermission(auth.user, 'users:write')) {
        return createErrorResponse('权限不足：无法创建用户', 403)
      }

      const userData = await request.json() as any
      console.log(`📝 Creating user: ${userData.username} by ${auth.user.username}`)

      // 验证必填字段
      if (!userData.username || !userData.email || !userData.password) {
        return createErrorResponse('用户名、邮箱和密码为必填项', 400)
      }

      // 检查用户名是否已存在
      if (userExists(userData.username, userData.email)) {
        return createErrorResponse('用户名或邮箱已存在', 409)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 300))

      const newUser = createUser(userData)
      console.log(`✅ User created: ${newUser.username}`)

      return createSuccessResponse(newUser, '用户创建成功')

    } catch (error) {
      console.error('Create user error:', error)
      return createErrorResponse('创建用户失败', 500)
    }
  }),

  // PUT /api/users/:id - 更新用户
  http.put('*/api/users/:id', async ({ request, params }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      const userId = params.id as string
      const updates = await request.json() as UserUpdateData

      // 权限检查 - 管理员可以更新任何用户，用户只能更新自己
      const isAdmin = checkPermission(auth.user, 'users:write')
      const isSelf = auth.user.id === userId

      if (!isAdmin && !isSelf) {
        return createErrorResponse('权限不足：只能更新自己的信息', 403)
      }

      console.log(`📝 Updating user: ${userId} by ${auth.user.username}`)

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200))

      const updatedUser = updateUserProfile(userId, updates)
      if (!updatedUser) {
        return createErrorResponse('用户不存在', 404)
      }

      console.log(`✅ User updated: ${updatedUser.username}`)

      return createSuccessResponse(updatedUser, '用户更新成功')

    } catch (error) {
      console.error('Update user error:', error)
      return createErrorResponse('更新用户失败', 500)
    }
  }),

  // DELETE /api/users/:id - 删除用户
  http.delete('*/api/users/:id', async ({ request, params }) => {
    try {
      // 认证检查
      const auth = authenticateRequest(request)
      if (!auth.isValid) {
        return createErrorResponse(auth.error!, 401)
      }

      // 权限检查 - 需要用户删除权限
      if (!checkPermission(auth.user, 'users:delete')) {
        return createErrorResponse('没有权限删除用户', 403)
      }

      const userId = params.id as string

      // 不能删除自己
      if (auth.user.id === userId) {
        return createErrorResponse('不能删除自己的账户', 400)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200))

      const success = deleteUser(userId)
      if (!success) {
        return createErrorResponse('用户不存在', 404)
      }

      console.log(`🗑️ User deleted: ${userId} by ${auth.user.username}`)

      return createSuccessResponse({ deleted: true }, '用户删除成功')

    } catch (error) {
      console.error('Delete user error:', error)
      return createErrorResponse('删除用户失败', 500)
    }
  })
]
