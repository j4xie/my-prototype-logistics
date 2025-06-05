/**
 * 认证模块Mock数据管理
 * 支持用户认证、权限验证、JWT Token模拟
 */

export interface MockUser {
  id: string
  username: string
  email: string
  name: string
  role: 'admin' | 'manager' | 'operator' | 'viewer'
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
  role: string
  permissions: string[]
  iat: number
  exp: number
  iss: string
}

/**
 * Mock用户数据库
 */
export const mockUsers: Record<string, MockUser> = {
  'admin': {
    id: 'user_001',
    username: 'admin',
    email: 'admin@heiniu.com',
    name: '系统管理员',
    role: 'admin',
    department: '信息技术部',
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'farming:read', 'farming:write', 'farming:delete',
      'processing:read', 'processing:write', 'processing:delete',
      'logistics:read', 'logistics:write', 'logistics:delete',
      'admin:read', 'admin:write', 'admin:delete',
      'trace:read', 'trace:write',
      'system:config', 'system:backup', 'system:audit'
    ],
    avatar: '/avatars/admin.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2小时前
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  'manager': {
    id: 'user_002',
    username: 'manager',
    email: 'manager@heiniu.com',
    name: '生产经理',
    role: 'manager',
    department: '生产部',
    permissions: [
      'users:read',
      'farming:read', 'farming:write',
      'processing:read', 'processing:write',
      'logistics:read', 'logistics:write',
      'trace:read', 'trace:write'
    ],
    avatar: '/avatars/manager.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30分钟前
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  'operator': {
    id: 'user_003',
    username: 'operator',
    email: 'operator@heiniu.com',
    name: '操作员',
    role: 'operator',
    department: '生产车间',
    permissions: [
      'farming:read', 'farming:write',
      'processing:read', 'processing:write',
      'trace:read'
    ],
    avatar: '/avatars/operator.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10分钟前
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  'viewer': {
    id: 'user_004',
    username: 'viewer',
    email: 'viewer@heiniu.com',
    name: '查看员',
    role: 'viewer',
    department: '质检部',
    permissions: [
      'farming:read',
      'processing:read',
      'logistics:read',
      'trace:read'
    ],
    avatar: '/avatars/viewer.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5分钟前
    createdAt: '2024-02-15T00:00:00.000Z',
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
    'admin': 'admin123',
    'manager': 'manager123',
    'operator': 'operator123',
    'viewer': 'viewer123'
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
