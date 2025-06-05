/**
 * 管理模块Mock数据管理
 * 支持系统配置、权限管理、审计日志、报表统计、系统监控
 */

export interface MockSystemConfig {
  id: string
  category: 'system' | 'security' | 'business' | 'integration' | 'notification'
  key: string
  name: string
  value: string | number | boolean | object
  defaultValue: string | number | boolean | object
  description: string
  dataType: 'string' | 'number' | 'boolean' | 'json' | 'enum'
  enumOptions?: string[]
  validation?: {
    required: boolean
    min?: number
    max?: number
    pattern?: string
  }
  scope: 'global' | 'tenant' | 'user'
  editable: boolean
  sensitive: boolean
  restartRequired: boolean
  lastModified: string
  modifiedBy: string
  createdAt: string
}

export interface MockRole {
  id: string
  name: string
  code: string
  description: string
  type: 'system' | 'business' | 'custom'
  level: number // 权限级别 1-10，数字越大权限越高
  permissions: string[]
  constraints: {
    maxUsers?: number
    ipWhitelist?: string[]
    timeRestrictions?: {
      startTime: string
      endTime: string
      allowedDays: number[] // 0-6，0为周日
    }
    dataScope?: 'all' | 'department' | 'self'
  }
  inheritsFrom?: string[] // 继承的角色ID
  status: 'active' | 'inactive' | 'deprecated'
  isDefault: boolean
  assignedUsers: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface MockPermission {
  id: string
  name: string
  code: string
  description: string
  module: string
  resource: string
  action: 'create' | 'read' | 'update' | 'delete' | 'execute' | 'approve'
  scope: 'global' | 'department' | 'personal'
  dependencies?: string[] // 依赖的权限
  conflicts?: string[] // 冲突的权限
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  auditRequired: boolean
  isActive: boolean
  createdAt: string
}

export interface MockAuditLog {
  id: string
  timestamp: string
  userId: string
  userName: string
  userRole: string
  action: string
  resource: string
  resourceId?: string
  details: {
    method: string
    endpoint: string
    userAgent: string
    ipAddress: string
    sessionId: string
    changes?: {
      field: string
      oldValue: any
      newValue: any
    }[]
  }
  result: 'success' | 'failure' | 'unauthorized' | 'forbidden'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  category: 'authentication' | 'authorization' | 'data' | 'system' | 'business'
  tags: string[]
  location?: {
    country: string
    region: string
    city: string
    timezone: string
  }
  duration: number // 操作耗时(ms)
  errorCode?: string
  errorMessage?: string
}

export interface MockSystemReport {
  id: string
  name: string
  type: 'operational' | 'financial' | 'security' | 'performance' | 'compliance'
  description: string
  schedule: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'on-demand'
    time: string
    timezone: string
    lastRun: string
    nextRun: string
  }
  recipients: {
    userId: string
    userName: string
    email: string
    deliveryMethod: 'email' | 'dashboard' | 'sms'
  }[]
  format: 'pdf' | 'excel' | 'csv' | 'json' | 'dashboard'
  status: 'active' | 'paused' | 'error' | 'completed'
  metrics: {
    totalRuns: number
    successfulRuns: number
    failedRuns: number
    avgExecutionTime: number // 秒
    lastExecutionTime: number
  }
  dataSource: {
    modules: string[]
    dateRange: string
    filters: Record<string, any>
  }
  template: {
    sections: {
      name: string
      type: 'table' | 'chart' | 'summary' | 'text'
      config: Record<string, any>
    }[]
  }
  createdAt: string
  updatedAt: string
  createdBy: string
}

export interface MockSystemMonitor {
  timestamp: string
  system: {
    cpu: {
      usage: number // 百分比
      cores: number
      load: number[]
    }
    memory: {
      total: number // GB
      used: number // GB
      free: number // GB
      usage: number // 百分比
    }
    disk: {
      total: number // GB
      used: number // GB
      free: number // GB
      usage: number // 百分比
    }
    network: {
      bytesIn: number
      bytesOut: number
      packetsIn: number
      packetsOut: number
      connectionsActive: number
    }
  }
  application: {
    activeUsers: number
    activeSessions: number
    requestsPerMinute: number
    avgResponseTime: number // ms
    errorRate: number // 百分比
    uptime: number // 秒
  }
  database: {
    connections: {
      active: number
      idle: number
      max: number
    }
    queries: {
      total: number
      slow: number
      avgExecutionTime: number // ms
    }
    size: number // GB
    backup: {
      lastBackup: string
      status: 'success' | 'failed' | 'in-progress'
      size: number // GB
    }
  }
  alerts: {
    id: string
    level: 'info' | 'warning' | 'error' | 'critical'
    message: string
    timestamp: string
    resolved: boolean
  }[]
}

export interface AdminQuery {
  page?: number
  pageSize?: number
  search?: string
  category?: string
  type?: string
  status?: string
  level?: string
  module?: string
  action?: string
  dateFrom?: string
  dateTo?: string
  userId?: string
  riskLevel?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

/**
 * Mock系统配置数据
 */
export const mockSystemConfigs: MockSystemConfig[] = [
  {
    id: 'config_001',
    category: 'system',
    key: 'app.name',
    name: '系统名称',
    value: '黑牛农业管理系统',
    defaultValue: 'Black Cow Management System',
    description: '显示在系统顶部的应用名称',
    dataType: 'string',
    validation: { required: true, min: 1, max: 50 },
    scope: 'global',
    editable: true,
    sensitive: false,
    restartRequired: false,
    lastModified: '2024-12-01T10:00:00Z',
    modifiedBy: 'admin',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'config_002',
    category: 'security',
    key: 'auth.session.timeout',
    name: '会话超时时间',
    value: 24,
    defaultValue: 24,
    description: '用户会话超时时间（小时）',
    dataType: 'number',
    validation: { required: true, min: 1, max: 168 },
    scope: 'global',
    editable: true,
    sensitive: false,
    restartRequired: false,
    lastModified: '2024-11-15T14:30:00Z',
    modifiedBy: 'security_admin',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'config_003',
    category: 'security',
    key: 'auth.password.policy',
    name: '密码策略',
    value: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireDigits: true,
      requireSpecialChars: true,
      maxAge: 90,
      preventReuse: 5
    },
    defaultValue: {
      minLength: 6,
      requireUppercase: false,
      requireLowercase: true,
      requireDigits: true,
      requireSpecialChars: false,
      maxAge: 0,
      preventReuse: 0
    },
    description: '用户密码复杂度和安全策略',
    dataType: 'json',
    scope: 'global',
    editable: true,
    sensitive: true,
    restartRequired: false,
    lastModified: '2024-10-20T09:15:00Z',
    modifiedBy: 'security_admin',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'config_004',
    category: 'business',
    key: 'farming.default.season',
    name: '默认种植季节',
    value: 'spring',
    defaultValue: 'spring',
    description: '新建农业项目时的默认季节',
    dataType: 'enum',
    enumOptions: ['spring', 'summer', 'autumn', 'winter'],
    scope: 'global',
    editable: true,
    sensitive: false,
    restartRequired: false,
    lastModified: '2024-09-10T16:45:00Z',
    modifiedBy: 'farming_manager',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'config_005',
    category: 'integration',
    key: 'api.rate.limit',
    name: 'API调用限制',
    value: 1000,
    defaultValue: 500,
    description: '每小时API调用次数限制',
    dataType: 'number',
    validation: { required: true, min: 100, max: 10000 },
    scope: 'global',
    editable: true,
    sensitive: false,
    restartRequired: true,
    lastModified: '2024-11-30T11:20:00Z',
    modifiedBy: 'system_admin',
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'config_006',
    category: 'notification',
    key: 'email.smtp.enabled',
    name: '邮件服务启用',
    value: true,
    defaultValue: false,
    description: '是否启用SMTP邮件发送服务',
    dataType: 'boolean',
    scope: 'global',
    editable: true,
    sensitive: false,
    restartRequired: true,
    lastModified: '2024-08-25T13:10:00Z',
    modifiedBy: 'system_admin',
    createdAt: '2024-01-01T00:00:00Z'
  }
]

/**
 * Mock角色数据
 */
export const mockRoles: MockRole[] = [
  {
    id: 'role_001',
    name: '超级管理员',
    code: 'super_admin',
    description: '系统最高权限管理员，拥有所有功能访问权限',
    type: 'system',
    level: 10,
    permissions: ['*'], // 通配符表示所有权限
    constraints: {
      ipWhitelist: ['192.168.1.0/24', '10.0.0.0/8'],
      timeRestrictions: {
        startTime: '00:00',
        endTime: '23:59',
        allowedDays: [0, 1, 2, 3, 4, 5, 6]
      },
      dataScope: 'all'
    },
    status: 'active',
    isDefault: false,
    assignedUsers: 2,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-11-20T15:30:00Z',
    createdBy: 'system'
  },
  {
    id: 'role_002',
    name: '系统管理员',
    code: 'system_admin',
    description: '负责系统配置、用户管理、权限分配',
    type: 'system',
    level: 8,
    permissions: [
      'users:read', 'users:write', 'users:delete',
      'roles:read', 'roles:write',
      'configs:read', 'configs:write',
      'audit:read',
      'reports:read'
    ],
    constraints: {
      timeRestrictions: {
        startTime: '08:00',
        endTime: '18:00',
        allowedDays: [1, 2, 3, 4, 5]
      },
      dataScope: 'all'
    },
    status: 'active',
    isDefault: false,
    assignedUsers: 3,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-10-15T10:20:00Z',
    createdBy: 'super_admin'
  },
  {
    id: 'role_003',
    name: '业务管理员',
    code: 'business_admin',
    description: '负责业务数据管理、流程配置',
    type: 'business',
    level: 6,
    permissions: [
      'farming:read', 'farming:write',
      'processing:read', 'processing:write',
      'logistics:read', 'logistics:write',
      'users:read',
      'reports:read'
    ],
    constraints: {
      dataScope: 'department'
    },
    status: 'active',
    isDefault: false,
    assignedUsers: 8,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-09-30T14:45:00Z',
    createdBy: 'system_admin'
  },
  {
    id: 'role_004',
    name: '普通用户',
    code: 'user',
    description: '标准用户角色，基础功能访问权限',
    type: 'business',
    level: 3,
    permissions: [
      'farming:read',
      'processing:read',
      'logistics:read',
      'profile:read', 'profile:write'
    ],
    constraints: {
      dataScope: 'self'
    },
    status: 'active',
    isDefault: true,
    assignedUsers: 45,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-08-20T11:30:00Z',
    createdBy: 'system_admin'
  },
  {
    id: 'role_005',
    name: '审计员',
    code: 'auditor',
    description: '专门负责系统审计、日志查看、合规检查',
    type: 'system',
    level: 5,
    permissions: [
      'audit:read',
      'reports:read',
      'configs:read',
      'users:read'
    ],
    constraints: {
      dataScope: 'all'
    },
    status: 'active',
    isDefault: false,
    assignedUsers: 2,
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: '2024-07-15T16:20:00Z',
    createdBy: 'system_admin'
  }
]

/**
 * Mock权限数据
 */
export const mockPermissions: MockPermission[] = [
  {
    id: 'perm_001',
    name: '查看用户',
    code: 'users:read',
    description: '查看用户列表和用户详情',
    module: 'user_management',
    resource: 'users',
    action: 'read',
    scope: 'global',
    riskLevel: 'low',
    auditRequired: false,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'perm_002',
    name: '管理用户',
    code: 'users:write',
    description: '创建、编辑、禁用用户账户',
    module: 'user_management',
    resource: 'users',
    action: 'update',
    scope: 'global',
    dependencies: ['users:read'],
    riskLevel: 'medium',
    auditRequired: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'perm_003',
    name: '删除用户',
    code: 'users:delete',
    description: '永久删除用户账户',
    module: 'user_management',
    resource: 'users',
    action: 'delete',
    scope: 'global',
    dependencies: ['users:read', 'users:write'],
    riskLevel: 'high',
    auditRequired: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'perm_004',
    name: '查看农业数据',
    code: 'farming:read',
    description: '查看农业生产数据、作物信息',
    module: 'farming',
    resource: 'farming_data',
    action: 'read',
    scope: 'department',
    riskLevel: 'low',
    auditRequired: false,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'perm_005',
    name: '管理农业数据',
    code: 'farming:write',
    description: '创建、编辑农业生产计划和数据',
    module: 'farming',
    resource: 'farming_data',
    action: 'update',
    scope: 'department',
    dependencies: ['farming:read'],
    riskLevel: 'medium',
    auditRequired: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'perm_006',
    name: '查看审计日志',
    code: 'audit:read',
    description: '查看系统审计日志和安全事件',
    module: 'audit',
    resource: 'audit_logs',
    action: 'read',
    scope: 'global',
    riskLevel: 'medium',
    auditRequired: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 'perm_007',
    name: '系统配置管理',
    code: 'configs:write',
    description: '修改系统配置参数',
    module: 'system',
    resource: 'configurations',
    action: 'update',
    scope: 'global',
    dependencies: ['configs:read'],
    riskLevel: 'critical',
    auditRequired: true,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z'
  }
]

/**
 * 生成Mock审计日志数据
 */
export function generateMockAuditLogs(count: number = 100): MockAuditLog[] {
  const logs: MockAuditLog[] = []
  const users = [
    { id: 'user_001', name: '管理员', role: '系统管理员' },
    { id: 'user_002', name: '张经理', role: '业务管理员' },
    { id: 'user_003', name: '李操作员', role: '普通用户' },
    { id: 'user_004', name: '王审计', role: '审计员' }
  ]
  const actions = [
    '用户登录', '用户退出', '修改密码', '创建用户', '删除用户', '更新用户信息',
    '查看农业数据', '编辑农业计划', '创建生产批次', '更新库存',
    '生成报表', '导出数据', '修改系统配置', '角色权限变更'
  ]
  const resources = [
    'authentication', 'users', 'farming_data', 'processing_data',
    'logistics_data', 'system_config', 'reports', 'audit_logs'
  ]
  const results: MockAuditLog['result'][] = ['success', 'failure', 'unauthorized', 'forbidden']
  const categories: MockAuditLog['category'][] = ['authentication', 'authorization', 'data', 'system', 'business']
  const riskLevels: MockAuditLog['riskLevel'][] = ['low', 'medium', 'high', 'critical']

  for (let i = 1; i <= count; i++) {
    const user = users[Math.floor(Math.random() * users.length)]
    const action = actions[Math.floor(Math.random() * actions.length)]
    const resource = resources[Math.floor(Math.random() * resources.length)]
    const result = results[Math.floor(Math.random() * results.length)]
    const category = categories[Math.floor(Math.random() * categories.length)]
    const riskLevel = riskLevels[Math.floor(Math.random() * riskLevels.length)]

    const timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000)

    logs.push({
      id: `audit_${String(i).padStart(3, '0')}`,
      timestamp: timestamp.toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      resource,
      resourceId: `res_${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      details: {
        method: ['GET', 'POST', 'PUT', 'DELETE'][Math.floor(Math.random() * 4)],
        endpoint: `/api/${resource}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ipAddress: `192.168.1.${Math.floor(Math.random() * 254) + 1}`,
        sessionId: `sess_${Math.random().toString(36).substr(2, 9)}`,
        changes: Math.random() > 0.5 ? [
          {
            field: 'status',
            oldValue: 'active',
            newValue: 'inactive'
          }
        ] : undefined
      },
      result,
      riskLevel,
      category,
      tags: ['web', 'internal'].concat(Math.random() > 0.7 ? ['admin'] : []),
      location: {
        country: '中国',
        region: ['北京', '上海', '广东', '江苏'][Math.floor(Math.random() * 4)],
        city: ['北京', '上海', '深圳', '南京'][Math.floor(Math.random() * 4)],
        timezone: 'Asia/Shanghai'
      },
      duration: Math.floor(Math.random() * 5000) + 100,
      errorCode: result === 'failure' ? 'ERR_001' : undefined,
      errorMessage: result === 'failure' ? '操作失败：权限不足' : undefined
    })
  }

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * 生成Mock系统监控数据
 */
export function generateMockSystemMonitor(): MockSystemMonitor {
  const now = new Date()

  return {
    timestamp: now.toISOString(),
    system: {
      cpu: {
        usage: Math.floor(Math.random() * 40) + 20, // 20-60%
        cores: 8,
        load: [
          Math.random() * 2,
          Math.random() * 2,
          Math.random() * 2
        ]
      },
      memory: {
        total: 32,
        used: Math.floor(Math.random() * 16) + 8, // 8-24 GB
        free: 0,
        usage: 0
      },
      disk: {
        total: 1000,
        used: Math.floor(Math.random() * 400) + 300, // 300-700 GB
        free: 0,
        usage: 0
      },
      network: {
        bytesIn: Math.floor(Math.random() * 1000000000),
        bytesOut: Math.floor(Math.random() * 1000000000),
        packetsIn: Math.floor(Math.random() * 1000000),
        packetsOut: Math.floor(Math.random() * 1000000),
        connectionsActive: Math.floor(Math.random() * 100) + 50
      }
    },
    application: {
      activeUsers: Math.floor(Math.random() * 50) + 20,
      activeSessions: Math.floor(Math.random() * 80) + 30,
      requestsPerMinute: Math.floor(Math.random() * 500) + 100,
      avgResponseTime: Math.floor(Math.random() * 200) + 50,
      errorRate: Math.random() * 2,
      uptime: Math.floor(Math.random() * 2592000) + 86400 // 1-30天
    },
    database: {
      connections: {
        active: Math.floor(Math.random() * 20) + 5,
        idle: Math.floor(Math.random() * 10) + 5,
        max: 50
      },
      queries: {
        total: Math.floor(Math.random() * 10000) + 1000,
        slow: Math.floor(Math.random() * 10),
        avgExecutionTime: Math.floor(Math.random() * 100) + 10
      },
      size: Math.floor(Math.random() * 50) + 10,
      backup: {
        lastBackup: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        status: ['success', 'failed', 'in-progress'][Math.floor(Math.random() * 3)] as any,
        size: Math.floor(Math.random() * 20) + 5
      }
    },
    alerts: [
      {
        id: 'alert_001',
        level: 'warning',
        message: 'CPU使用率较高',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: 'alert_002',
        level: 'info',
        message: '数据库备份已完成',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: true
      }
    ]
  }
}

// 预生成数据实例
export const mockAuditLogs = generateMockAuditLogs()

// 计算derived values
mockSystemConfigs.forEach(config => {
  const monitor = generateMockSystemMonitor()
  if (config.key === 'system.memory') {
    monitor.system.memory.free = monitor.system.memory.total - monitor.system.memory.used
    monitor.system.memory.usage = Math.round((monitor.system.memory.used / monitor.system.memory.total) * 100)
  }
  if (config.key === 'system.disk') {
    monitor.system.disk.free = monitor.system.disk.total - monitor.system.disk.used
    monitor.system.disk.usage = Math.round((monitor.system.disk.used / monitor.system.disk.total) * 100)
  }
})

/**
 * 数据获取函数
 */
export function getSystemConfigsList(query: AdminQuery = {}) {
  let configs = mockSystemConfigs

  if (query.search) {
    configs = configs.filter(config =>
      config.name.includes(query.search!) ||
      config.key.includes(query.search!) ||
      config.description.includes(query.search!)
    )
  }

  if (query.category) {
    configs = configs.filter(config => config.category === query.category)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = configs.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    configs: configs.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getRolesList(query: AdminQuery = {}) {
  let roles = mockRoles

  if (query.search) {
    roles = roles.filter(role =>
      role.name.includes(query.search!) ||
      role.code.includes(query.search!) ||
      role.description.includes(query.search!)
    )
  }

  if (query.type) {
    roles = roles.filter(role => role.type === query.type)
  }

  if (query.status) {
    roles = roles.filter(role => role.status === query.status)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = roles.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    roles: roles.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getPermissionsList(query: AdminQuery = {}) {
  let permissions = mockPermissions

  if (query.search) {
    permissions = permissions.filter(permission =>
      permission.name.includes(query.search!) ||
      permission.code.includes(query.search!) ||
      permission.description.includes(query.search!)
    )
  }

  if (query.module) {
    permissions = permissions.filter(permission => permission.module === query.module)
  }

  if (query.action) {
    permissions = permissions.filter(permission => permission.action === query.action)
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 10
  const total = permissions.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    permissions: permissions.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

export function getAuditLogsList(query: AdminQuery = {}) {
  let logs = mockAuditLogs

  if (query.search) {
    logs = logs.filter(log =>
      log.userName.includes(query.search!) ||
      log.action.includes(query.search!) ||
      log.resource.includes(query.search!)
    )
  }

  if (query.userId) {
    logs = logs.filter(log => log.userId === query.userId)
  }

  if (query.category) {
    logs = logs.filter(log => log.category === query.category)
  }

  if (query.riskLevel) {
    logs = logs.filter(log => log.riskLevel === query.riskLevel)
  }

  if (query.dateFrom && query.dateTo) {
    const fromDate = new Date(query.dateFrom)
    const toDate = new Date(query.dateTo)
    logs = logs.filter(log => {
      const logDate = new Date(log.timestamp)
      return logDate >= fromDate && logDate <= toDate
    })
  }

  // 分页
  const page = query.page || 1
  const pageSize = query.pageSize || 20
  const total = logs.length
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize

  return {
    logs: logs.slice(startIndex, endIndex),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: endIndex < total,
      hasPrev: page > 1
    }
  }
}

/**
 * 管理模块统计数据
 */
export function getAdminOverviewStats() {
  const totalUsers = 58
  const activeUsers = 45
  const totalRoles = mockRoles.length
  const totalPermissions = mockPermissions.length
  const totalConfigs = mockSystemConfigs.length
  const activeConfigs = mockSystemConfigs.filter(c => c.editable).length
  const auditLogsToday = mockAuditLogs.filter(log => {
    const today = new Date().toISOString().split('T')[0]
    return log.timestamp.startsWith(today)
  }).length
  const highRiskLogs = mockAuditLogs.filter(log => log.riskLevel === 'high' || log.riskLevel === 'critical').length

  const systemMonitor = generateMockSystemMonitor()

  return {
    users: {
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      newThisMonth: Math.floor(Math.random() * 10) + 5
    },
    security: {
      totalRoles,
      totalPermissions,
      auditLogsToday,
      highRiskLogs,
      securityScore: Math.floor(Math.random() * 20) + 80 // 80-100
    },
    system: {
      totalConfigs,
      activeConfigs,
      cpuUsage: systemMonitor.system.cpu.usage,
      memoryUsage: systemMonitor.system.memory.usage,
      diskUsage: systemMonitor.system.disk.usage,
      uptime: systemMonitor.application.uptime
    },
    performance: {
      responseTime: systemMonitor.application.avgResponseTime,
      errorRate: systemMonitor.application.errorRate,
      requestsPerMinute: systemMonitor.application.requestsPerMinute,
      activeConnections: systemMonitor.system.network.connectionsActive
    }
  }
}
