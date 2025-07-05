/**
 * 认证模块Mock数据管理
 * 支持用户认证、权限验证、JWT Token模拟
 */

export interface MockUser {
  id: string
  username: string
  email: string
  name: string
  role: {
    name: 'super_admin' | 'user'
    displayName: string
  }
  department: string
  permissions: string[]
  avatar?: string
  status: 'active' | 'inactive' | 'suspended'
  lastLogin?: string
  createdAt: string
  updatedAt: string
}

export interface MockJWTPayload {
  sub: string // user id
  username: string
  role: {
    name: 'super_admin' | 'user'
    displayName: string
  }
  permissions: string[]
  iat: number
  exp: number
  iss: string
}

/**
 * Mock用户数据库 - 简化版本
 */
export const mockUsers: Record<string, MockUser> = {
  'super_admin': {
    id: 'user_000',
    username: 'super_admin',
    email: 'super@heiniu.com',
    name: '平台超级管理员',
    role: {
      name: 'super_admin',
      displayName: '平台超级管理员'
    },
    department: '平台运营部',
    permissions: [
      'platform:read', 'platform:write', 'platform:delete',
      'factory:create', 'factory:read', 'factory:write', 'factory:delete',
      'subscription:read', 'subscription:write', 'subscription:delete',
      'users:read', 'users:write', 'users:delete',
      'farming:read', 'farming:write', 'farming:delete',
      'processing:read', 'processing:write', 'processing:delete',
      'logistics:read', 'logistics:write', 'logistics:delete',
      'admin:read', 'admin:write', 'admin:delete',
      'trace:read', 'trace:write',
      'system:config', 'system:backup', 'system:audit'
    ],
    avatar: '/avatars/super_admin.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1小时前
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  'user': {
    id: 'user_001',
    username: 'user',
    email: 'user@heiniu.com',
    name: '工厂用户',
    role: {
      name: 'user',
      displayName: '工厂用户'
    },
    department: '生产部',
    permissions: [
      'farming:read', 'farming:write',
      'processing:read', 'processing:write',
      'logistics:read', 'logistics:write',
      'trace:read', 'trace:write',
      'admin:read', 'admin:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/user.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30分钟前
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  }
}

/**
 * 用户凭据验证
 */
export const validateCredentials = (username: string, password: string): MockUser | null => {
  const user = mockUsers[username]
  if (!user) return null

  // 简单密码验证 (开发环境)
  const validPasswords: Record<string, string> = {
    'super_admin': 'super123',
    'user': 'user123'
  }

  if (validPasswords[username] === password && user.status === 'active') {
    return user
  }

  return null
}

/**
 * 生成Mock JWT Token
 */
export const generateMockJWT = (user: MockUser): string => {
  const payload: MockJWTPayload = {
    sub: user.id,
    username: user.username,
    role: user.role,
    permissions: user.permissions,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24小时过期
    iss: 'heiniu-mock-api'
  }

  // Mock JWT格式 - 兼容Jest环境和浏览器环境
  let header: string, payloadBase64: string
  if (typeof Buffer !== 'undefined') {
    // Node.js/Jest环境
    header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64')
    payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64')
  } else {
    // 浏览器环境
    header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    payloadBase64 = btoa(JSON.stringify(payload))
  }

  const signature = 'mock-signature-' + Date.now()

  return `${header}.${payloadBase64}.${signature}`
}

/**
 * 验证Mock JWT Token
 */
export const validateMockJWT = (token: string): MockJWTPayload | null => {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null

    // 兼容Jest环境和浏览器环境的base64解码
    let payload: MockJWTPayload
    if (typeof Buffer !== 'undefined') {
      // Node.js/Jest环境
      payload = JSON.parse(Buffer.from(parts[1], 'base64').toString()) as MockJWTPayload
    } else {
      // 浏览器环境
      payload = JSON.parse(atob(parts[1])) as MockJWTPayload
    }

    // 检查过期时间
    if (payload.exp * 1000 < Date.now()) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

/**
 * 获取用户通过ID
 */
export const getUserById = (id: string): MockUser | null => {
  return Object.values(mockUsers).find(user => user.id === id) || null
}

/**
 * 获取用户通过用户名
 */
export const getUserByUsername = (username: string): MockUser | null => {
  return mockUsers[username] || null
}

/**
 * 检查用户权限
 */
export const hasPermission = (user: MockUser, permission: string): boolean => {
  return user.permissions.includes(permission)
}

/**
 * 更新用户最后登录时间
 */
export const updateLastLogin = (username: string): void => {
  if (mockUsers[username]) {
    mockUsers[username].lastLogin = new Date().toISOString()
    mockUsers[username].updatedAt = new Date().toISOString()
  }
}
