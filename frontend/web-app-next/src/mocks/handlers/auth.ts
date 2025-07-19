import { http, HttpResponse } from 'msw'
import {
  validateCredentials,
  generateMockJWT,
  validateMockJWT,
  getUserById,
  updateLastLogin,
  hasPermission,
  hasModulePermission,
  hasFeaturePermission,
  getUserAccessibleModules
} from '../data/auth-data'
import { responseHeadersMiddleware } from '../config/middleware'
import { wrapResponse, wrapError } from '../../types/api-response'

/**
 * 认证模块 MSW Handlers
 * Day 3扩展：完整JWT认证流程 + 权限验证 + 会话管理
 *
 * 包含的API端点：
 * - POST /api/auth/login - 用户登录
 * - POST /api/auth/logout - 用户登出
 * - GET /api/auth/status - 认证状态检查
 * - POST /api/auth/verify - Token验证
 * - POST /api/auth/refresh - Token刷新
 */

// 内存中的活跃会话存储 (开发环境)
const activeSessions = new Map<string, {
  userId: string,
  token: string,
  createdAt: number,
  lastActivity: number
}>()

// Token黑名单 (用于登出)
const tokenBlacklist = new Set<string>()

// Session清理 - 清理过期会话
const cleanupExpiredSessions = () => {
  const now = Date.now()
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000

  for (const [sessionId, session] of activeSessions.entries()) {
    if (now - session.lastActivity > TWENTY_FOUR_HOURS) {
      activeSessions.delete(sessionId)
      tokenBlacklist.add(session.token)
    }
  }
}

// 生成会话ID
const generateSessionId = () => {
  return 'sess_' + Math.random().toString(36).substring(2) + Date.now().toString(36)
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

export const authHandlers = [
  // POST /api/auth/login - 用户登录
  http.post(/.*\/api\/auth\/login$/, async ({ request }) => {
    try {
      const body = await request.json() as {
        username?: string;
        email?: string;
        password: string;
        rememberMe?: boolean
      }

      const { username, email, password, rememberMe = false } = body
      const loginIdentifier = username || email

      if (!loginIdentifier || !password) {
        return createErrorResponse('用户名/邮箱和密码不能为空', 400)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200))

      // 清理过期会话
      cleanupExpiredSessions()

      // 验证用户凭据
      const user = validateCredentials(loginIdentifier, password)
      if (!user) {
        // 记录失败尝试
        console.log(`🔒 Login attempt failed for: ${loginIdentifier}`)

        return createErrorResponse('用户名/邮箱或密码错误', 401)
      }

      // 生成JWT Token
      const token = generateMockJWT(user)
      const sessionId = generateSessionId()

      // 记录会话
      activeSessions.set(sessionId, {
        userId: user.id,
        token,
        createdAt: Date.now(),
        lastActivity: Date.now()
      })

      // 更新用户最后登录时间
      updateLastLogin(user.username)

      console.log(`✅ User logged in: ${user.username} (${user.role.name})`)

      return createSuccessResponse({
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          roleCode: user.roleCode,
          department: user.department,
          permissions: user.permissions,
          legacyPermissions: user.legacyPermissions,
          avatar: user.avatar,
          lastLogin: user.lastLogin,
          accessibleModules: getUserAccessibleModules(user)
        },
        token,
        sessionId,
        expiresIn: rememberMe ? 7 * 24 * 60 * 60 : 24 * 60 * 60, // 7天 或 24小时
        rememberMe
      }, '登录成功')

    } catch (error) {
      console.error('Login error:', error)
      return createErrorResponse('登录请求处理失败', 500)
    }
  }),

  // POST /api/auth/register - 用户注册
  http.post(/.*\/api\/auth\/register$/, async ({ request }) => {
    try {
      const body = await request.json() as {
        username: string;
        password: string;
        email: string;
        phone?: string;
        department?: string;
        position?: string;
      }

      const { username, password, email, phone, department, position } = body

      if (!username || !password || !email) {
        return createErrorResponse('用户名、密码和邮箱不能为空', 400)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 400))

      // 模拟用户名检查
      if (username === 'admin' || username === 'test') {
        return createErrorResponse('用户名已存在', 409)
      }

      // 模拟邮箱检查
      if (email === 'admin@example.com') {
        return createErrorResponse('邮箱已被注册', 409)
      }

      // 模拟创建新用户
      const newUser = {
        id: 'user_' + Date.now(),
        username,
        email,
        phone: phone || '',
        department: department || '未指定',
        position: position || '员工',
        name: username, // 默认使用用户名作为显示名
        role: 'user',
        permissions: ['basic:read', 'profile:edit'],
        avatar: '/images/avatar-placeholder.svg',
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: null
      }

      console.log(`✅ User registered: ${newUser.username} (${newUser.email})`)

      return createSuccessResponse({
        user: {
          id: newUser.id,
          username: newUser.username,
          email: newUser.email,
          phone: newUser.phone,
          department: newUser.department,
          position: newUser.position,
          name: newUser.name,
          role: newUser.role,
          status: newUser.status,
          createdAt: newUser.createdAt
        }
      }, '注册成功')

    } catch (error) {
      console.error('Register error:', error)
      return createErrorResponse('注册请求处理失败', 500)
    }
  }),

  // POST /api/auth/logout - 用户登出
  http.post(/.*\/api\/auth\/logout$/, async ({ request }) => {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (token) {
        // 将token加入黑名单
        tokenBlacklist.add(token)

        // 删除相关会话
        for (const [sessionId, session] of activeSessions.entries()) {
          if (session.token === token) {
            activeSessions.delete(sessionId)
            console.log(`🚪 User logged out, session ${sessionId} terminated`)
            break
          }
        }
      }

      return createSuccessResponse(
        { loggedOut: true },
        '登出成功'
      )

    } catch (error) {
      console.error('Logout error:', error)
      return createErrorResponse('登出请求处理失败', 500)
    }
  }),

  // GET /api/auth/status - 认证状态检查
  http.get(/.*\/api\/auth\/status$/, async ({ request }) => {
    try {
      // TEST环境早退：直接返回已认证状态
      if (process.env.NODE_ENV === 'test') {
        return createSuccessResponse({
          authenticated: true,
          user: {
            id: 'user_001',
            username: 'admin',
            role: 'admin'
          }
        }, '认证状态正常')
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 50))

      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (!token) {
        return createErrorResponse('缺少认证token', 401)
      }

      // 检查token是否在黑名单
      if (tokenBlacklist.has(token)) {
        return createErrorResponse('Token已失效', 401)
      }

      // 验证JWT token
      const payload = validateMockJWT(token)
      if (!payload) {
        return createErrorResponse('Token无效或已过期', 401)
      }

      // 获取用户信息
      const user = getUserById(payload.sub)
      if (!user) {
        return createErrorResponse('用户不存在', 401)
      }

      // 更新会话活动时间
      for (const [, session] of activeSessions.entries()) {
        if (session.token === token) {
          session.lastActivity = Date.now()
          break
        }
      }

      return createSuccessResponse({
        authenticated: true,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          permissions: user.permissions,
          avatar: user.avatar,
          status: user.status,
          lastLogin: user.lastLogin
        },
        tokenInfo: {
          issuedAt: new Date(payload.iat * 1000).toISOString(),
          expiresAt: new Date(payload.exp * 1000).toISOString(),
          issuer: payload.iss
        }
      })

    } catch (error) {
      console.error('Auth status error:', error)
      return createErrorResponse('认证状态检查失败', 500)
    }
  }),

  // POST /api/auth/verify - Token验证
  http.post('*/api/auth/verify', async ({ request }) => {
    try {
      const body = await request.json() as { token: string; permission?: string }
      const { token, permission } = body

      if (!token) {
        return createErrorResponse('Token不能为空', 400)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 150 + 50))

      // 检查token是否在黑名单
      if (tokenBlacklist.has(token)) {
        return createErrorResponse('Token已被撤销', 401)
      }

      // 验证JWT token
      const payload = validateMockJWT(token)
      if (!payload) {
        return createErrorResponse('Token无效或已过期', 401)
      }

      // 获取用户信息
      const user = getUserById(payload.sub)
      if (!user) {
        return createErrorResponse('用户不存在', 401)
      }

      // 检查特定权限(如果提供)
      let hasRequiredPermission = true
      if (permission) {
        hasRequiredPermission = hasPermission(user, permission)
      }

      return createSuccessResponse({
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions
        },
        hasPermission: hasRequiredPermission,
        tokenExpiry: new Date(payload.exp * 1000).toISOString()
      }, 'Token验证成功')

    } catch (error) {
      console.error('Token verify error:', error)
      return createErrorResponse('Token验证失败', 500)
    }
  }),

  // POST /api/auth/refresh - Token刷新 (新增)
  http.post('/api/auth/refresh', async ({ request }) => {
    try {
      const authHeader = request.headers.get('Authorization')
      const token = authHeader?.replace('Bearer ', '')

      if (!token) {
        return createErrorResponse('缺少认证token', 401)
      }

      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 100))

      // 检查token是否在黑名单
      if (tokenBlacklist.has(token)) {
        return createErrorResponse('Token已被撤销', 401)
      }

      // 验证当前token
      const payload = validateMockJWT(token)
      if (!payload) {
        return createErrorResponse('Token无效或已过期', 401)
      }

      // 获取用户信息
      const user = getUserById(payload.sub)
      if (!user) {
        return createErrorResponse('用户不存在', 401)
      }

      // 生成新token
      const newToken = generateMockJWT(user)

      // 将旧token加入黑名单
      tokenBlacklist.add(token)

      // 更新会话记录
      activeSessions.set(generateSessionId(), {
        userId: user.id,
        token: newToken,
        createdAt: Date.now(),
        lastActivity: Date.now()
      })

      console.log(`🔄 Token refreshed for user: ${user.username}`)

      return createSuccessResponse({
        token: newToken,
        expiresIn: 24 * 60 * 60, // 24小时
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          permissions: user.permissions
        }
      }, 'Token刷新成功')

    } catch (error) {
      console.error('Token refresh error:', error)
      return createErrorResponse('Token刷新失败', 500)
    }
  }),

  // 处理不支持的HTTP方法 - 针对认证端点
  http.all(/.*\/api\/auth\/login$/, async ({ request }) => {
    if (request.method !== 'POST') {
      return HttpResponse.json(
        wrapError(`方法 ${request.method} 不被支持`, 405),
        { status: 405 }
      )
    }
  })
]
