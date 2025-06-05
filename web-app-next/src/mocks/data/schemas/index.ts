// src/mocks/data/schemas/index.ts
// Mock API Schema版本注册系统
// 按照 docs/api/schema-version-management.md 第3节实施

import { z } from 'zod'
import { mockVersionManager } from '../version-manager'

/**
 * 基础Schema定义 - 1.0.0-baseline
 * 按照 TASK-P3-018 建立的基线Schema
 */

// 通用响应Schema
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  timestamp: z.number(),
  version: z.string()
})

// 分页Schema
export const PaginationSchema = z.object({
  page: z.number().min(1),
  pageSize: z.number().min(1).max(100),
  total: z.number().min(0),
  totalPages: z.number().min(0)
})

// 认证相关Schema
export const UserSchema = z.object({
  id: z.string(),
  username: z.string(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'manager', 'operator']),
  department: z.string(),
  status: z.enum(['active', 'inactive', 'suspended']),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLogin: z.string().optional(),
  permissions: z.array(z.string())
})

export const AuthTokenSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
  tokenType: z.literal('Bearer')
})

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
})

// 农业模块Schema
export const CropSchema = z.object({
  id: z.string(),
  name: z.string(),
  variety: z.string(),
  category: z.enum(['vegetables', 'fruits', 'grains', 'herbs']),
  plantingSeason: z.enum(['spring', 'summer', 'autumn', 'winter', 'all']),
  growthPeriod: z.number(), // 生长周期(天)
  expectedYield: z.number(), // 预期产量(kg/亩)
  requirements: z.object({
    temperature: z.object({
      min: z.number(),
      max: z.number(),
      optimal: z.number()
    }),
    humidity: z.object({
      min: z.number(),
      max: z.number()
    }),
    soilPH: z.object({
      min: z.number(),
      max: z.number()
    })
  }),
  nutrition: z.object({
    protein: z.number(),
    fat: z.number(),
    carbohydrate: z.number(),
    fiber: z.number(),
    vitamins: z.array(z.string())
  }),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const FieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.object({
    province: z.string(),
    city: z.string(),
    district: z.string(),
    address: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    })
  }),
  area: z.number(), // 面积(亩)
  soilType: z.enum(['sandy', 'clay', 'loam', 'silt']),
  soilPH: z.number(),
  irrigationType: z.enum(['drip', 'sprinkler', 'flood', 'manual']),
  currentCrop: z.string().nullable(),
  status: z.enum(['active', 'fallow', 'maintenance']),
  createdAt: z.string(),
  updatedAt: z.string()
})

// 加工模块Schema
export const RawMaterialSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.string(),
  supplier: z.string(),
  batchNumber: z.string(),
  quantity: z.number(),
  unit: z.string(),
  expiryDate: z.string(),
  storageConditions: z.object({
    temperature: z.number(),
    humidity: z.number(),
    requirements: z.array(z.string())
  }),
  qualityGrade: z.enum(['A', 'B', 'C']),
  certifications: z.array(z.string()),
  cost: z.number(),
  receivedAt: z.string(),
  createdAt: z.string()
})

export const ProcessingBatchSchema = z.object({
  id: z.string(),
  batchNumber: z.string(),
  productType: z.string(),
  rawMaterials: z.array(z.object({
    materialId: z.string(),
    quantity: z.number(),
    unit: z.string()
  })),
  processSteps: z.array(z.object({
    step: z.string(),
    startTime: z.string(),
    endTime: z.string().optional(),
    status: z.enum(['pending', 'processing', 'completed', 'failed']),
    operator: z.string(),
    parameters: z.record(z.any())
  })),
  expectedOutput: z.number(),
  actualOutput: z.number().optional(),
  status: z.enum(['planned', 'processing', 'completed', 'quality_check', 'failed']),
  startDate: z.string(),
  endDate: z.string().optional(),
  cost: z.object({
    materials: z.number(),
    labor: z.number(),
    utilities: z.number(),
    total: z.number()
  }),
  createdAt: z.string(),
  updatedAt: z.string()
})

// 物流模块Schema
export const WarehouseSchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.object({
    address: z.string(),
    city: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    })
  }),
  capacity: z.object({
    total: z.number(),
    used: z.number(),
    available: z.number(),
    unit: z.string()
  }),
  zones: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['frozen', 'refrigerated', 'dry', 'controlled']),
    temperature: z.number(),
    humidity: z.number(),
    capacity: z.number()
  })),
  facilities: z.array(z.string()),
  manager: z.string(),
  status: z.enum(['active', 'maintenance', 'inactive']),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const TransportOrderSchema = z.object({
  id: z.string(),
  orderNumber: z.string(),
  origin: z.object({
    warehouseId: z.string(),
    address: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    })
  }),
  destination: z.object({
    address: z.string(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }),
    contactPerson: z.string(),
    contactPhone: z.string()
  }),
  cargo: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number(),
    unit: z.string(),
    weight: z.number(),
    volume: z.number()
  })),
  vehicleId: z.string(),
  driverId: z.string(),
  route: z.object({
    distance: z.number(),
    estimatedTime: z.number(),
    waypoints: z.array(z.object({
      latitude: z.number(),
      longitude: z.number(),
      name: z.string()
    }))
  }),
  status: z.enum(['pending', 'assigned', 'in_transit', 'delivered', 'cancelled']),
  scheduledDate: z.string(),
  actualDepartureTime: z.string().optional(),
  actualArrivalTime: z.string().optional(),
  cost: z.number(),
  createdAt: z.string(),
  updatedAt: z.string()
})

// 管理模块Schema
export const SystemConfigSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.any(),
  category: z.enum(['system', 'security', 'notification', 'integration', 'business']),
  description: z.string(),
  dataType: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  isPublic: z.boolean(),
  requiresRestart: z.boolean(),
  validationRules: z.object({
    required: z.boolean(),
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.any()).optional()
  }),
  updatedBy: z.string(),
  updatedAt: z.string(),
  createdAt: z.string()
})

export const RoleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  permissions: z.array(z.string()),
  level: z.number(),
  isBuiltin: z.boolean(),
  inheritsFrom: z.string().optional(),
  constraints: z.object({
    maxUsers: z.number().optional(),
    allowSelfAssign: z.boolean(),
    requireApproval: z.boolean()
  }),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

/**
 * 注册所有Schema版本
 */
export function registerAllSchemas(): void {
  console.log('[SchemaRegistry] 开始注册所有Schema版本...')

  // 注册基线版本 1.0.0-baseline
  mockVersionManager.registerSchema('1.0.0-baseline', z.object({
    // 通用Schema
    apiResponse: ApiResponseSchema,
    pagination: PaginationSchema,

    // 认证模块
    user: UserSchema,
    authToken: AuthTokenSchema,
    loginRequest: LoginRequestSchema,

    // 农业模块
    crop: CropSchema,
    field: FieldSchema,

    // 加工模块
    rawMaterial: RawMaterialSchema,
    processingBatch: ProcessingBatchSchema,

    // 物流模块
    warehouse: WarehouseSchema,
    transportOrder: TransportOrderSchema,

    // 管理模块
    systemConfig: SystemConfigSchema,
    role: RoleSchema
  }), {
    timestamp: Date.now(),
    description: 'TASK-P3-018建立的基线Schema版本，包含所有核心业务模块',
    author: 'Phase-3技术负责人',
    breakingChanges: false,
    migrationRequired: false,
    compatibleVersions: ['1.0.0-baseline'],
    deprecated: false
  })

  // 冻结基线版本
  mockVersionManager.freezeVersion('1.0.0-baseline', true)

  console.log('[SchemaRegistry] Schema版本注册完成')
  console.log('[SchemaRegistry] 基线版本已冻结:', '1.0.0-baseline')
}

/**
 * 获取当前Schema
 */
export function getCurrentSchemas(): z.ZodSchema<any> {
  const currentVersion = mockVersionManager.getCurrentVersion()
  const registration = mockVersionManager.getSchemaRegistry().get(currentVersion)

  if (!registration) {
    throw new Error(`当前版本 ${currentVersion} 的Schema不存在`)
  }

  return registration.schema
}

/**
 * 验证API响应数据
 */
export function validateApiResponse(data: any): { success: boolean; errors?: any[] } {
  return mockVersionManager.validateSchema(mockVersionManager.getCurrentVersion(), {
    apiResponse: data
  })
}

/**
 * 获取Schema统计信息
 */
export function getSchemaStats(): {
  totalSchemas: number
  currentVersion: string
  frozenVersions: number
  availableVersions: string[]
} {
  const status = mockVersionManager.getManagerStatus()

  return {
    totalSchemas: status.totalVersions,
    currentVersion: status.currentVersion,
    frozenVersions: status.frozenVersions,
    availableVersions: mockVersionManager.getVersions()
  }
}
