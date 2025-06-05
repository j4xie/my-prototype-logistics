/**
 * 用户管理模块Mock数据管理
 * 支持用户CRUD操作、分页、搜索、过滤
 */

import { type MockUser, mockUsers } from './auth-data'

export interface UserListQuery {
  page?: number
  pageSize?: number
  search?: string
  role?: string
  department?: string
  status?: string
  sortBy?: 'name' | 'role' | 'department' | 'createdAt' | 'lastLogin'
  sortOrder?: 'asc' | 'desc'
}

export interface UserListResponse {
  users: MockUser[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
  filters: {
    roles: string[]
    departments: string[]
    statuses: string[]
  }
}

export interface UserUpdateData {
  name?: string
  email?: string
  department?: string
  permissions?: string[]
  avatar?: string
  status?: 'active' | 'inactive' | 'suspended'
  [key: string]: any
}

/**
 * 生成Mock用户列表数据
 */
export const generateMockUsers = (count: number = 20): MockUser[] => {
  const departments = ['信息技术部', '生产部', '生产车间', '质检部', '物流部', '销售部', '财务部', '人事部']
  const roles: Array<'admin' | 'manager' | 'operator' | 'viewer'> = ['admin', 'manager', 'operator', 'viewer']
  const statuses: Array<'active' | 'inactive' | 'suspended'> = ['active', 'inactive', 'suspended']

  const names = [
    '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十',
    '陈十一', '褚十二', '卫十三', '蒋十四', '沈十五', '韩十六', '杨十七', '朱十八',
    '秦十九', '尤二十', '许二一', '何二二', '吕二三', '施二四', '张二五', '孔二六'
  ]

  const users: MockUser[] = []

  for (let i = 0; i < count; i++) {
    const role = roles[Math.floor(Math.random() * roles.length)]
    const status = Math.random() > 0.1 ? 'active' : statuses[Math.floor(Math.random() * statuses.length)]
    const name = names[i % names.length]
    const department = departments[Math.floor(Math.random() * departments.length)]

    // 根据角色分配权限
    let permissions: string[] = []
    switch (role) {
      case 'admin':
        permissions = [
          'users:read', 'users:write', 'users:delete',
          'farming:read', 'farming:write', 'farming:delete',
          'processing:read', 'processing:write', 'processing:delete',
          'logistics:read', 'logistics:write', 'logistics:delete',
          'admin:read', 'admin:write', 'admin:delete',
          'trace:read', 'trace:write',
          'system:config', 'system:backup', 'system:audit'
        ]
        break
      case 'manager':
        permissions = [
          'users:read',
          'farming:read', 'farming:write',
          'processing:read', 'processing:write',
          'logistics:read', 'logistics:write',
          'trace:read', 'trace:write'
        ]
        break
      case 'operator':
        permissions = [
          'farming:read', 'farming:write',
          'processing:read', 'processing:write',
          'trace:read'
        ]
        break
      case 'viewer':
        permissions = [
          'farming:read', 'processing:read', 'logistics:read', 'trace:read'
        ]
        break
    }

    const user: MockUser = {
      id: `user_${String(i + 100).padStart(3, '0')}`,
      username: `user${i + 100}`,
      email: `${name.toLowerCase()}@heiniu.com`,
      name,
      role,
      department,
      permissions,
      avatar: `/avatars/${role}_${i + 1}.png`,
      status,
      lastLogin: status === 'active'
        ? new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
        : undefined,
      createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString()
    }

    users.push(user)
  }

  return users
}

// 生成扩展用户数据 (除了基础的4个用户)
const extendedUsers = generateMockUsers(16)

// 合并基础用户和扩展用户
export const allMockUsers: MockUser[] = [
  ...Object.values(mockUsers),
  ...extendedUsers
]

/**
 * 获取用户列表 (支持分页、搜索、过滤)
 */
export const getUserList = (query: UserListQuery): UserListResponse => {
  const {
    page = 1,
    pageSize = 10,
    search = '',
    role = '',
    department = '',
    status = '',
    sortBy = 'createdAt',
    sortOrder = 'desc'
  } = query

  let filteredUsers = [...allMockUsers]

  // 搜索过滤
  if (search) {
    const searchLower = search.toLowerCase()
    filteredUsers = filteredUsers.filter(user =>
      user.name.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.department.toLowerCase().includes(searchLower)
    )
  }

  // 角色过滤
  if (role) {
    filteredUsers = filteredUsers.filter(user => user.role === role)
  }

  // 部门过滤
  if (department) {
    filteredUsers = filteredUsers.filter(user => user.department === department)
  }

  // 状态过滤
  if (status) {
    filteredUsers = filteredUsers.filter(user => user.status === status)
  }

  // 排序
  filteredUsers.sort((a, b) => {
    let aValue: any = a[sortBy]
    let bValue: any = b[sortBy]

    if (sortBy === 'createdAt' || sortBy === 'lastLogin') {
      aValue = new Date(aValue || 0).getTime()
      bValue = new Date(bValue || 0).getTime()
    }

    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase()
      bValue = bValue.toLowerCase()
    }

    if (sortOrder === 'asc') {
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
    } else {
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
    }
  })

  // 分页
  const total = filteredUsers.length
  const totalPages = Math.ceil(total / pageSize)
  const offset = (page - 1) * pageSize
  const paginatedUsers = filteredUsers.slice(offset, offset + pageSize)

  // 生成过滤器选项
  const roles = Array.from(new Set(allMockUsers.map(u => u.role)))
  const departments = Array.from(new Set(allMockUsers.map(u => u.department)))
  const statuses = Array.from(new Set(allMockUsers.map(u => u.status)))

  return {
    users: paginatedUsers,
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    },
    filters: {
      roles,
      departments,
      statuses
    }
  }
}

/**
 * 获取用户资料
 */
export const getUserProfile = (userId: string): MockUser | null => {
  return allMockUsers.find(user => user.id === userId) || null
}

/**
 * 更新用户资料
 */
export const updateUserProfile = (userId: string, updateData: UserUpdateData): MockUser | null => {
  const userIndex = allMockUsers.findIndex(user => user.id === userId)

  if (userIndex === -1) {
    return null
  }

  // 更新用户数据
  const updatedUser = {
    ...allMockUsers[userIndex],
    ...updateData,
    updatedAt: new Date().toISOString()
  }

  allMockUsers[userIndex] = updatedUser

  return updatedUser
}

/**
 * 删除用户 (软删除，设置状态为inactive)
 */
export const deleteUser = (userId: string): boolean => {
  const userIndex = allMockUsers.findIndex(user => user.id === userId)

  if (userIndex === -1) {
    return false
  }

  // 软删除：设置状态为inactive
  allMockUsers[userIndex] = {
    ...allMockUsers[userIndex],
    status: 'inactive',
    updatedAt: new Date().toISOString()
  }

  return true
}

/**
 * 创建新用户
 */
export const createUser = (userData: Omit<MockUser, 'id' | 'createdAt' | 'updatedAt'>): MockUser => {
  const newUser: MockUser = {
    ...userData,
    id: `user_${Date.now()}_${Math.random().toString(36).substring(2)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  allMockUsers.push(newUser)

  return newUser
}

/**
 * 检查用户是否存在
 */
export const userExists = (username: string, email: string, excludeUserId?: string): boolean => {
  return allMockUsers.some(user =>
    user.id !== excludeUserId &&
    (user.username === username || user.email === email)
  )
}

/**
 * 获取用户统计信息
 */
export const getUserStats = () => {
  const total = allMockUsers.length
  const active = allMockUsers.filter(u => u.status === 'active').length
  const inactive = allMockUsers.filter(u => u.status === 'inactive').length
  const suspended = allMockUsers.filter(u => u.status === 'suspended').length

  const roleStats = allMockUsers.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const departmentStats = allMockUsers.reduce((acc, user) => {
    acc[user.department] = (acc[user.department] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return {
    total,
    byStatus: { active, inactive, suspended },
    byRole: roleStats,
    byDepartment: departmentStats
  }
}
