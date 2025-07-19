/**
 * 认证模块Mock数据管理
 * 支持用户认证、权限验证、JWT Token模拟
 * 更新以支持新的模块级权限系统
 */

import { UserPermissions, USER_ROLES, DEPARTMENTS, generateUserPermissions } from '@/types/permissions';

export interface MockUser {
  id: string
  username: string
  email: string
  name: string
  fullName: string
  role: {
    name: keyof typeof USER_ROLES
    displayName: string
    level: number
  }
  roleCode: keyof typeof USER_ROLES
  department: keyof typeof DEPARTMENTS | null
  permissions: UserPermissions
  legacyPermissions: string[]
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
    name: keyof typeof USER_ROLES
    displayName: string
    level: number
  }
  permissions: UserPermissions
  legacyPermissions: string[]
  iat: number
  exp: number
  iss: string
}

/**
 * Mock用户数据库 - 支持新权限体系
 */
export const mockUsers: Record<string, MockUser> = {
  // 平台管理员
  'super_admin': {
    id: 'user_000',
    username: 'super_admin',
    email: 'super@heiniu.com',
    name: '平台超级管理员',
    fullName: '平台超级管理员',
    role: {
      name: 'PLATFORM_ADMIN',
      displayName: '平台管理员',
      level: 0
    },
    roleCode: 'PLATFORM_ADMIN',
    department: null,
    permissions: generateUserPermissions('PLATFORM_ADMIN'),
    legacyPermissions: [
      'platform:read', 'platform:write', 'platform:delete',
      'factory:create', 'factory:read', 'factory:write', 'factory:delete',
      'subscription:read', 'subscription:write', 'subscription:delete',
      'users:read', 'users:write', 'users:delete',
      'system:config', 'system:backup', 'system:audit'
    ],
    avatar: '/avatars/super_admin.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 工厂超级管理员
  'user': {
    id: 'user_001',
    username: 'user',
    email: 'user@heiniu.com',
    name: '工厂超级管理员',
    fullName: '工厂超级管理员',
    role: {
      name: 'SUPER_ADMIN',
      displayName: '工厂超级管理员',
      level: 0
    },
    roleCode: 'SUPER_ADMIN',
    department: null,
    permissions: generateUserPermissions('SUPER_ADMIN'),
    legacyPermissions: [
      'farming:read', 'farming:write', 'farming:delete',
      'processing:read', 'processing:write', 'processing:delete',
      'logistics:read', 'logistics:write', 'logistics:delete',
      'admin:read', 'admin:write', 'admin:delete',
      'trace:read', 'trace:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/user.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    createdAt: '2024-01-15T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 权限管理员
  'admin': {
    id: 'user_002',
    username: 'admin',
    email: 'admin@heiniu.com',
    name: '权限管理员',
    fullName: '权限管理员',
    role: {
      name: 'PERMISSION_ADMIN',
      displayName: '权限管理员',
      level: 5
    },
    roleCode: 'PERMISSION_ADMIN',
    department: 'ADMIN',
    permissions: generateUserPermissions('PERMISSION_ADMIN'),
    legacyPermissions: [
      'admin:read', 'admin:write',
      'users:read', 'users:write',
      'roles:read', 'roles:write',
      'permissions:read', 'permissions:write'
    ],
    avatar: '/avatars/admin.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-01-10T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 部门管理员 - 养殖部
  'dept_admin': {
    id: 'user_003',
    username: 'dept_admin',
    email: 'dept@heiniu.com',
    name: '养殖部门管理员',
    fullName: '养殖部门管理员',
    role: {
      name: 'DEPARTMENT_ADMIN',
      displayName: '部门管理员',
      level: 10
    },
    roleCode: 'DEPARTMENT_ADMIN',
    department: 'FARMING',
    permissions: generateUserPermissions('DEPARTMENT_ADMIN', 'FARMING'),
    legacyPermissions: [
      'farming:read', 'farming:write',
      'users:read', 'users:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/dept_admin.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-01-20T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 部门管理员 - 生产部
  'processing_admin': {
    id: 'user_004',
    username: 'processing_admin',
    email: 'processing@heiniu.com',
    name: '生产部门管理员',
    fullName: '生产部门管理员',
    role: {
      name: 'DEPARTMENT_ADMIN',
      displayName: '部门管理员',
      level: 10
    },
    roleCode: 'DEPARTMENT_ADMIN',
    department: 'PROCESSING',
    permissions: generateUserPermissions('DEPARTMENT_ADMIN', 'PROCESSING'),
    legacyPermissions: [
      'processing:read', 'processing:write',
      'users:read', 'users:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/processing_admin.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-01-25T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 普通员工 - 养殖部
  'worker': {
    id: 'user_005',
    username: 'worker',
    email: 'worker@heiniu.com',
    name: '养殖部员工',
    fullName: '养殖部员工',
    role: {
      name: 'USER',
      displayName: '普通员工',
      level: 50
    },
    roleCode: 'USER',
    department: 'FARMING',
    permissions: generateUserPermissions('USER', 'FARMING'),
    legacyPermissions: [
      'farming:read', 'farming:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/worker.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-02-01T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 普通员工 - 生产部
  'processor': {
    id: 'user_006',
    username: 'processor',
    email: 'processor@heiniu.com',
    name: '生产部员工',
    fullName: '生产部员工',
    role: {
      name: 'USER',
      displayName: '普通员工',
      level: 50
    },
    roleCode: 'USER',
    department: 'PROCESSING',
    permissions: generateUserPermissions('USER', 'PROCESSING'),
    legacyPermissions: [
      'processing:read', 'processing:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/processor.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-02-05T00:00:00.000Z',
    updatedAt: new Date().toISOString()
  },
  
  // 普通员工 - 物流部
  'logistics_user': {
    id: 'user_007',
    username: 'logistics_user',
    email: 'logistics@heiniu.com',
    name: '物流部员工',
    fullName: '物流部员工',
    role: {
      name: 'USER',
      displayName: '普通员工',
      level: 50
    },
    roleCode: 'USER',
    department: 'LOGISTICS',
    permissions: generateUserPermissions('USER', 'LOGISTICS'),
    legacyPermissions: [
      'logistics:read', 'logistics:write',
      'profile:read', 'profile:write'
    ],
    avatar: '/avatars/logistics_user.png',
    status: 'active',
    lastLogin: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
    createdAt: '2024-02-10T00:00:00.000Z',
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
    'user': 'user123',
    'admin': 'admin123',
    'dept_admin': 'dept123',
    'processing_admin': 'processing123',
    'worker': 'worker123',
    'processor': 'processor123',
    'logistics_user': 'logistics123'
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
    legacyPermissions: user.legacyPermissions,
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
 * 检查用户权限 (兼容新旧权限系统)
 */
export const hasPermission = (user: MockUser, permission: string): boolean => {
  return user.legacyPermissions.includes(permission)
}

/**
 * 检查用户模块权限
 */
export const hasModulePermission = (user: MockUser, module: string): boolean => {
  const moduleMap: Record<string, keyof typeof user.permissions.modules> = {
    'farming': 'farming_access',
    'processing': 'processing_access',
    'logistics': 'logistics_access',
    'admin': 'admin_access',
    'platform': 'platform_access'
  }
  
  const moduleKey = moduleMap[module]
  return moduleKey ? user.permissions.modules[moduleKey] === true : false
}

/**
 * 检查用户功能权限
 */
export const hasFeaturePermission = (user: MockUser, feature: string): boolean => {
  return user.permissions.features.includes(feature)
}

/**
 * 获取用户可访问的模块列表
 */
export const getUserAccessibleModules = (user: MockUser): string[] => {
  const modules: string[] = []
  
  if (user.permissions.modules.farming_access) modules.push('farming')
  if (user.permissions.modules.processing_access) modules.push('processing')
  if (user.permissions.modules.logistics_access) modules.push('logistics')
  if (user.permissions.modules.admin_access) modules.push('admin')
  if (user.permissions.modules.platform_access) modules.push('platform')
  
  return modules
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
