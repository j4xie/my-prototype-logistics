/**
 * 管理模块Mock Handler实现
 * 支持系统配置、权限管理、审计日志、报表统计、系统监控的完整API端点
 */

import { http, HttpResponse } from 'msw'
import { wrapResponse, wrapError } from '../../types/api-response'
import {
  getAdminOverviewStats,
  getSystemConfigsList,
  getRolesList,
  getPermissionsList,
  getAuditLogsList,
  generateMockSystemMonitor,
  mockSystemConfigs,
  type AdminQuery
} from '../data/admin-data'
import { validateMockJWT, getUserById } from '../data/auth-data'

/**
 * 统一认证检查
 */
const authenticateRequest = (request: Request): { success: boolean; user?: any; error?: string } => {
  // 测试环境早退：直接返回mock admin用户
  if (process.env.NODE_ENV === 'test') {
    const mockAdminUser = {
      id: 'user_001',
      username: 'admin',
      name: 'admin',
      role: 'admin',
      permissions: ['admin:read', 'admin:write', 'configs:read', 'configs:write', 'audit:read', 'monitoring:read', 'reports:read']
    }
    console.log(`✅ Auth Debug: Admin test env bypass - using mock admin user`)
    return { success: true, user: mockAdminUser }
  }

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return { success: false, error: '缺少认证token' }
  }

  const payload = validateMockJWT(token)
  if (!payload) {
    return { success: false, error: 'Token无效或已过期' }
  }

  const user = getUserById(payload.sub)
  if (!user) {
    return { success: false, error: '用户不存在' }
  }

  return { success: true, user }
}

/**
 * 管理模块Handler配置
 */
export const adminHandlers = [
  /**
   * 获取管理控制台概览统计
   * GET /api/admin/overview
   */
  http.get('/api/admin/overview', async ({ request }) => {
    try {
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200))

      // JWT认证检查
      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      // 权限检查 - 需要admin权限或管理员角色
      const hasAdminAccess = authResult.user.permissions.includes('admin:read') ||
                           authResult.user.role === 'admin' ||
                           authResult.user.role === 'manager'

      if (!hasAdminAccess) {
        return HttpResponse.json(
          wrapError('无权限访问管理控制台', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      console.log(`[Mock] 管理控制台概览请求 - 用户: ${authResult.user.name}`)

      const stats = getAdminOverviewStats()

      // 增加实时警告和建议
      const enhancedStats = {
        ...stats,
        alerts: [
          {
            level: 'warning' as const,
            message: '发现3个高风险操作日志',
            count: stats.security.highRiskLogs,
            action: '查看审计日志'
          },
          {
            level: 'info' as const,
            message: `CPU使用率 ${stats.system.cpuUsage}%`,
            count: stats.system.cpuUsage,
            action: '查看系统监控'
          },
          {
            level: stats.system.memoryUsage > 80 ? 'error' as const : 'success' as const,
            message: `内存使用率 ${stats.system.memoryUsage}%`,
            count: stats.system.memoryUsage,
            action: '系统优化建议'
          }
        ],
        recentActivities: [
          {
            time: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
            activity: '系统配置更新',
            details: 'API调用限制已调整为1000次/小时',
            operator: '系统管理员',
            risk: 'medium'
          },
          {
            time: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
            activity: '新用户创建',
            details: '用户"李操作员"已注册并分配普通用户角色',
            operator: '人事管理员',
            risk: 'low'
          },
          {
            time: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
            activity: '权限变更',
            details: '角色"业务管理员"权限已更新',
            operator: '系统管理员',
            risk: 'high'
          }
        ],
        systemHealth: {
          overall: stats.system.cpuUsage < 70 && stats.system.memoryUsage < 80 && stats.system.diskUsage < 90 ? 'healthy' : 'warning',
          components: [
            { name: 'API服务', status: 'healthy', uptime: '99.9%' },
            { name: '数据库', status: 'healthy', uptime: '99.8%' },
            { name: '认证服务', status: 'healthy', uptime: '100%' },
            { name: '文件存储', status: stats.system.diskUsage > 85 ? 'warning' : 'healthy', uptime: '99.7%' }
          ]
        }
      }

      return HttpResponse.json(
        wrapResponse(enhancedStats, '管理控制台数据获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'admin-overview',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Users': String(stats.users.total),
            'X-System-Health': enhancedStats.systemHealth.overall
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 管理控制台概览错误:', error)
      return HttpResponse.json(
        wrapError('获取管理控制台数据失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取系统配置列表
   * GET /api/admin/configs
   */
  http.get('/api/admin/configs', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 150))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('configs:read')) {
        return HttpResponse.json(
          wrapError('无权限访问系统配置', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: AdminQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        category: url.searchParams.get('category') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'category',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
      }

      console.log(`[Mock] 系统配置列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const configs = getSystemConfigsList(query)

      return HttpResponse.json(
        wrapResponse(configs, '系统配置列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'admin-configs',
            'X-Total-Configs': String(configs.configs.length),
            'X-Page': String(configs.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 系统配置列表错误:', error)
      return HttpResponse.json(
        wrapError('获取系统配置列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取单个系统配置详情
   * GET /api/admin/configs/:id
   */
  http.get('/api/admin/configs/:id', async ({ request, params }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 250 + 100))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('configs:read')) {
        return HttpResponse.json(
          wrapError('无权限访问配置详情', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const configId = params.id as string
      const config = mockSystemConfigs.find(c => c.id === configId)

      if (!config) {
        return HttpResponse.json(
          wrapError('系统配置不存在', 404, { type: 'NOT_FOUND' }),
          { status: 404 }
        )
      }

      console.log(`[Mock] 系统配置详情请求 - 用户: ${authResult.user.name}, 配置ID: ${configId}`)

      // 增加配置历史和影响分析
      const enhancedConfig = {
        ...config,
        changeHistory: [
          {
            timestamp: config.lastModified,
            oldValue: config.defaultValue,
            newValue: config.value,
            modifiedBy: config.modifiedBy,
            reason: '业务需求调整'
          },
          {
            timestamp: '2024-10-01T08:00:00Z',
            oldValue: config.defaultValue,
            newValue: config.defaultValue,
            modifiedBy: 'system',
            reason: '系统初始化'
          }
        ],
        impactAnalysis: {
          affectedComponents: config.restartRequired ? ['API服务', '认证服务'] : ['运行时配置'],
          estimatedDowntime: config.restartRequired ? '2-5分钟' : '0分钟',
          rollbackComplexity: config.sensitive ? 'high' : 'low',
          testingRequired: config.category === 'security' || config.restartRequired
        },
        dependencies: config.key === 'auth.session.timeout' ? ['auth.password.policy'] : [],
        validationRules: config.validation ? {
          ...config.validation,
          examples: config.dataType === 'enum' ? config.enumOptions :
                   config.dataType === 'number' ? ['100', '500', '1000'] :
                   config.dataType === 'boolean' ? ['true', 'false'] :
                   ['示例值1', '示例值2']
        } : undefined
      }

      return HttpResponse.json(
        wrapResponse(enhancedConfig, '系统配置详情获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'config-detail',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Config-Key': config.key
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 系统配置详情错误:', error)
      return HttpResponse.json(
        wrapError('获取配置详情失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取角色列表
   * GET /api/admin/roles
   */
  http.get('/api/admin/roles', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 350 + 180))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('roles:read')) {
        return HttpResponse.json(
          wrapError('无权限访问角色管理', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: AdminQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '10'),
        search: url.searchParams.get('search') || undefined,
        type: url.searchParams.get('type') || undefined,
        status: url.searchParams.get('status') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'level',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
      }

      console.log(`[Mock] 角色列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getRolesList(query)

      return HttpResponse.json(
        wrapResponse(result, '角色列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'roles-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 角色列表错误:', error)
      return HttpResponse.json(
        wrapError('获取角色列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取权限列表
   * GET /api/admin/permissions
   */
  http.get('/api/admin/permissions', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 120))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('permissions:read')) {
        return HttpResponse.json(
          wrapError('无权限访问权限管理', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: AdminQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '15'),
        search: url.searchParams.get('search') || undefined,
        module: url.searchParams.get('module') || undefined,
        action: url.searchParams.get('action') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'module',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'asc'
      }

      console.log(`[Mock] 权限列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getPermissionsList(query)

      return HttpResponse.json(
        wrapResponse(result, '权限列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'permissions-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 权限列表错误:', error)
      return HttpResponse.json(
        wrapError('获取权限列表失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取审计日志列表
   * GET /api/admin/audit-logs
   */
  http.get('/api/admin/audit-logs', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 450 + 250))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('audit:read')) {
        return HttpResponse.json(
          wrapError('无权限访问审计日志', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      const url = new URL(request.url)
      const query: AdminQuery = {
        page: parseInt(url.searchParams.get('page') || '1'),
        pageSize: parseInt(url.searchParams.get('pageSize') || '20'),
        search: url.searchParams.get('search') || undefined,
        userId: url.searchParams.get('userId') || undefined,
        category: url.searchParams.get('category') || undefined,
        riskLevel: url.searchParams.get('riskLevel') || undefined,
        dateFrom: url.searchParams.get('dateFrom') || undefined,
        dateTo: url.searchParams.get('dateTo') || undefined,
        sortBy: url.searchParams.get('sortBy') || 'timestamp',
        sortOrder: (url.searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
      }

      console.log(`[Mock] 审计日志列表请求 - 用户: ${authResult.user.name}, 查询:`, query)

      const result = getAuditLogsList(query)

      // 增加统计摘要
      const summary = {
        totalLogs: result.pagination.total,
        riskDistribution: {
          low: result.logs.filter(l => l.riskLevel === 'low').length,
          medium: result.logs.filter(l => l.riskLevel === 'medium').length,
          high: result.logs.filter(l => l.riskLevel === 'high').length,
          critical: result.logs.filter(l => l.riskLevel === 'critical').length
        },
        categoryDistribution: {
          authentication: result.logs.filter(l => l.category === 'authentication').length,
          authorization: result.logs.filter(l => l.category === 'authorization').length,
          data: result.logs.filter(l => l.category === 'data').length,
          system: result.logs.filter(l => l.category === 'system').length,
          business: result.logs.filter(l => l.category === 'business').length
        },
        resultDistribution: {
          success: result.logs.filter(l => l.result === 'success').length,
          failure: result.logs.filter(l => l.result === 'failure').length,
          unauthorized: result.logs.filter(l => l.result === 'unauthorized').length,
          forbidden: result.logs.filter(l => l.result === 'forbidden').length
        }
      }

      const enhancedResult = {
        ...result,
        summary
      }

      return HttpResponse.json(
        wrapResponse(enhancedResult, '审计日志列表获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'audit-logs-list',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Total-Records': String(result.pagination.total),
            'X-Current-Page': String(result.pagination.page),
            'X-High-Risk-Count': String(summary.riskDistribution.high + summary.riskDistribution.critical)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 审计日志列表错误:', error)
      return HttpResponse.json(
        wrapError('获取审计日志失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取系统监控数据
   * GET /api/admin/monitoring
   */
  http.get('/api/admin/monitoring', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 200 + 100))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('monitoring:read')) {
        return HttpResponse.json(
          wrapError('无权限访问系统监控', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      console.log(`[Mock] 系统监控数据请求 - 用户: ${authResult.user.name}`)

      const monitorData = generateMockSystemMonitor()

      // 增加性能趋势和预测
      const enhancedMonitorData = {
        ...monitorData,
        trends: {
          cpu: {
            trend: Math.random() > 0.5 ? 'increasing' : 'stable',
            changePercent: (Math.random() - 0.5) * 20,
            prediction: '未来1小时内CPU使用率预计保持在正常范围'
          },
          memory: {
            trend: Math.random() > 0.7 ? 'increasing' : 'stable',
            changePercent: (Math.random() - 0.5) * 15,
            prediction: '内存使用稳定，无泄漏风险'
          },
          disk: {
            trend: 'increasing',
            changePercent: Math.random() * 5,
            prediction: '磁盘使用缓慢增长，建议关注'
          }
        },
        recommendations: [
          {
            type: 'performance',
            priority: 'medium',
            message: '建议优化数据库查询以提升响应速度',
            action: '查看慢查询日志'
          },
          {
            type: 'security',
            priority: 'high',
            message: '发现异常登录尝试，建议检查安全日志',
            action: '查看审计日志'
          },
          {
            type: 'maintenance',
            priority: 'low',
            message: '系统运行良好，建议定期清理临时文件',
            action: '执行清理任务'
          }
        ],
        healthScore: {
          overall: Math.floor(Math.random() * 20) + 80, // 80-100
          components: {
            cpu: monitorData.system.cpu.usage < 70 ? 95 : 85,
            memory: monitorData.system.memory.usage < 80 ? 95 : 75,
            disk: monitorData.system.disk.usage < 85 ? 95 : 70,
            network: 98,
            database: 96,
            application: 94
          }
        }
      }

      return HttpResponse.json(
        wrapResponse(enhancedMonitorData, '系统监控数据获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'system-monitoring',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Health-Score': String(enhancedMonitorData.healthScore.overall),
            'X-Active-Alerts': String(monitorData.alerts.filter(a => !a.resolved).length)
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 系统监控数据错误:', error)
      return HttpResponse.json(
        wrapError('获取系统监控数据失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  }),

  /**
   * 获取系统报表统计
   * GET /api/admin/reports/stats
   */
  http.get('/api/admin/reports/stats', async ({ request }) => {
    try {
      await new Promise(resolve => setTimeout(resolve, Math.random() * 300 + 150))

      const authResult = authenticateRequest(request)
      if (!authResult.success || !authResult.user) {
        return HttpResponse.json(
          wrapError('请先登录系统', 401, { type: 'UNAUTHORIZED' }),
          { status: 401 }
        )
      }

      if (!authResult.user.permissions.includes('reports:read')) {
        return HttpResponse.json(
          wrapError('无权限访问报表统计', 403, { type: 'FORBIDDEN' }),
          { status: 403 }
        )
      }

      console.log(`[Mock] 系统报表统计请求 - 用户: ${authResult.user.name}`)

      // 生成综合统计报表
      const reportStats = {
        summary: {
          totalUsers: 58,
          activeUsers: 45,
          totalSessions: Math.floor(Math.random() * 100) + 80,
          totalOperations: Math.floor(Math.random() * 10000) + 50000,
          errorRate: Math.random() * 2,
          systemUptime: 99.8
        },
        moduleUsage: {
          farming: { users: 35, operations: 1250, popularity: 85 },
          processing: { users: 28, operations: 950, popularity: 72 },
          logistics: { users: 22, operations: 780, popularity: 65 },
          admin: { users: 8, operations: 320, popularity: 45 }
        },
        timeBasedStats: {
          hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            operations: Math.floor(Math.random() * 200) + 50,
            users: Math.floor(Math.random() * 20) + 5
          })),
          dailyTrends: Array.from({ length: 7 }, (_, i) => ({
            day: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][i],
            operations: Math.floor(Math.random() * 1000) + 500,
            users: Math.floor(Math.random() * 30) + 20
          }))
        },
        securityMetrics: {
          successfulLogins: Math.floor(Math.random() * 500) + 1000,
          failedLogins: Math.floor(Math.random() * 50) + 10,
          blockedIPs: Math.floor(Math.random() * 5),
          suspiciousActivities: Math.floor(Math.random() * 3)
        },
        performanceMetrics: {
          avgResponseTime: Math.floor(Math.random() * 100) + 50,
          peakResponseTime: Math.floor(Math.random() * 300) + 200,
          throughput: Math.floor(Math.random() * 1000) + 500,
          errorCount: Math.floor(Math.random() * 20) + 5
        }
      }

      return HttpResponse.json(
        wrapResponse(reportStats, '系统报表统计获取成功', 200),
        {
          headers: {
            'X-Mock-Source': 'report-stats',
            'X-Mock-Timestamp': new Date().toISOString(),
            'X-Report-Type': 'comprehensive',
            'X-Data-Points': String(
              reportStats.timeBasedStats.hourlyDistribution.length +
              reportStats.timeBasedStats.dailyTrends.length
            )
          }
        }
      )

    } catch (error) {
      console.error('[Mock] 系统报表统计错误:', error)
      return HttpResponse.json(
        wrapError('获取报表统计失败', 500, { type: 'INTERNAL_ERROR' }),
        { status: 500 }
      )
    }
  })
]

console.log(`[Mock] 管理模块Handler初始化完成 - 共${adminHandlers.length}个API端点`)
