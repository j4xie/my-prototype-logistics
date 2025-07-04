// 应用常量定义

// API相关常量
export const API_CONSTANTS = {
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100
} as const;

// 本地存储键名
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'food_trace_auth_token',
  USER_INFO: 'food_trace_user_info',
  PERMISSIONS: 'food_trace_permissions',
  PREFERENCES: 'food_trace_preferences',
  SEARCH_HISTORY: 'food_trace_search_history',
  OFFLINE_DATA: 'food_trace_offline_data',
  THEME: 'food_trace_theme',
  LANGUAGE: 'food_trace_language'
} as const;

// 用户角色
export const USER_ROLES = {
  FARMER: 'farmer',
  PROCESSOR: 'processor',
  LOGISTICS: 'logistics',
  RETAILER: 'retailer',
  CONSUMER: 'consumer',
  ADMIN: 'admin',
  INSPECTOR: 'inspector'
} as const;

// 用户角色显示名称
export const USER_ROLE_NAMES = {
  [USER_ROLES.FARMER]: '农户',
  [USER_ROLES.PROCESSOR]: '加工商',
  [USER_ROLES.LOGISTICS]: '物流商',
  [USER_ROLES.RETAILER]: '零售商',
  [USER_ROLES.CONSUMER]: '消费者',
  [USER_ROLES.ADMIN]: '管理员',
  [USER_ROLES.INSPECTOR]: '检查员'
} as const;

// 产品分类
export const PRODUCT_CATEGORIES = {
  GRAIN: 'grain',
  VEGETABLE: 'vegetable',
  FRUIT: 'fruit',
  MEAT: 'meat',
  DAIRY: 'dairy',
  SEAFOOD: 'seafood',
  PROCESSED: 'processed'
} as const;

// 产品分类显示名称
export const PRODUCT_CATEGORY_NAMES = {
  [PRODUCT_CATEGORIES.GRAIN]: '粮食',
  [PRODUCT_CATEGORIES.VEGETABLE]: '蔬菜',
  [PRODUCT_CATEGORIES.FRUIT]: '水果',
  [PRODUCT_CATEGORIES.MEAT]: '肉类',
  [PRODUCT_CATEGORIES.DAIRY]: '乳制品',
  [PRODUCT_CATEGORIES.SEAFOOD]: '海产品',
  [PRODUCT_CATEGORIES.PROCESSED]: '加工食品'
} as const;

// 产品状态
export const PRODUCT_STATUS = {
  GROWING: 'growing',
  HARVESTED: 'harvested',
  PROCESSING: 'processing',
  PACKAGED: 'packaged',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  SOLD: 'sold'
} as const;

// 产品状态显示名称
export const PRODUCT_STATUS_NAMES = {
  [PRODUCT_STATUS.GROWING]: '生长中',
  [PRODUCT_STATUS.HARVESTED]: '已收获',
  [PRODUCT_STATUS.PROCESSING]: '加工中',
  [PRODUCT_STATUS.PACKAGED]: '已包装',
  [PRODUCT_STATUS.SHIPPED]: '已发货',
  [PRODUCT_STATUS.DELIVERED]: '已送达',
  [PRODUCT_STATUS.SOLD]: '已售出'
} as const;

// 批次状态
export const BATCH_STATUS = {
  ACTIVE: 'active',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  RECALLED: 'recalled'
} as const;

// 批次状态显示名称
export const BATCH_STATUS_NAMES = {
  [BATCH_STATUS.ACTIVE]: '进行中',
  [BATCH_STATUS.PROCESSING]: '加工中',
  [BATCH_STATUS.SHIPPED]: '已发货',
  [BATCH_STATUS.DELIVERED]: '已送达',
  [BATCH_STATUS.COMPLETED]: '已完成',
  [BATCH_STATUS.RECALLED]: '已召回'
} as const;

// 溯源阶段
export const TRACE_STAGES = {
  FARMING: 'farming',
  PROCESSING: 'processing',
  LOGISTICS: 'logistics',
  RETAIL: 'retail',
  CONSUMER: 'consumer'
} as const;

// 溯源阶段显示名称
export const TRACE_STAGE_NAMES = {
  [TRACE_STAGES.FARMING]: '农业生产',
  [TRACE_STAGES.PROCESSING]: '加工处理',
  [TRACE_STAGES.LOGISTICS]: '物流运输',
  [TRACE_STAGES.RETAIL]: '零售销售',
  [TRACE_STAGES.CONSUMER]: '消费者'
} as const;

// 质量检测结果
export const QUALITY_RESULTS = {
  PASS: 'pass',
  FAIL: 'fail',
  WARNING: 'warning'
} as const;

// 质量检测结果显示名称
export const QUALITY_RESULT_NAMES = {
  [QUALITY_RESULTS.PASS]: '合格',
  [QUALITY_RESULTS.FAIL]: '不合格',
  [QUALITY_RESULTS.WARNING]: '警告'
} as const;

// 治疗类型
export const TREATMENT_TYPES = {
  FERTILIZER: 'fertilizer',
  PESTICIDE: 'pesticide',
  MEDICINE: 'medicine',
  VACCINE: 'vaccine'
} as const;

// 治疗类型显示名称
export const TREATMENT_TYPE_NAMES = {
  [TREATMENT_TYPES.FERTILIZER]: '肥料',
  [TREATMENT_TYPES.PESTICIDE]: '农药',
  [TREATMENT_TYPES.MEDICINE]: '药物',
  [TREATMENT_TYPES.VACCINE]: '疫苗'
} as const;

// 组织类型
export const ORGANIZATION_TYPES = {
  FARM: 'farm',
  PROCESSOR: 'processor',
  LOGISTICS: 'logistics',
  RETAILER: 'retailer'
} as const;

// 组织类型显示名称
export const ORGANIZATION_TYPE_NAMES = {
  [ORGANIZATION_TYPES.FARM]: '农场',
  [ORGANIZATION_TYPES.PROCESSOR]: '加工厂',
  [ORGANIZATION_TYPES.LOGISTICS]: '物流公司',
  [ORGANIZATION_TYPES.RETAILER]: '零售商'
} as const;

// 田地状态
export const FIELD_STATUS = {
  ACTIVE: 'active',
  FALLOW: 'fallow',
  MAINTENANCE: 'maintenance'
} as const;

// 田地状态显示名称
export const FIELD_STATUS_NAMES = {
  [FIELD_STATUS.ACTIVE]: '使用中',
  [FIELD_STATUS.FALLOW]: '休耕',
  [FIELD_STATUS.MAINTENANCE]: '维护中'
} as const;

// 权限动作
export const PERMISSION_ACTIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  MANAGE: 'manage'
} as const;

// 权限范围
export const PERMISSION_SCOPES = {
  OWN: 'own',
  ORGANIZATION: 'organization',
  ALL: 'all'
} as const;

// 通知类型
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success'
} as const;

// 设备类型
export const EQUIPMENT_TYPES = {
  PRODUCTION: 'production',
  QUALITY: 'quality',
  PACKAGING: 'packaging',
  STORAGE: 'storage',
  TRANSPORT: 'transport'
} as const;

// 设备类型显示名称
export const EQUIPMENT_TYPE_NAMES = {
  [EQUIPMENT_TYPES.PRODUCTION]: '生产设备',
  [EQUIPMENT_TYPES.QUALITY]: '质检设备',
  [EQUIPMENT_TYPES.PACKAGING]: '包装设备',
  [EQUIPMENT_TYPES.STORAGE]: '储存设备',
  [EQUIPMENT_TYPES.TRANSPORT]: '运输设备'
} as const;

// 文件类型
export const FILE_TYPES = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
  AUDIO: 'audio'
} as const;

// 支持的图片格式
export const SUPPORTED_IMAGE_FORMATS = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp'
] as const;

// 支持的文档格式
export const SUPPORTED_DOCUMENT_FORMATS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
] as const;

// 文件大小限制 (字节)
export const FILE_SIZE_LIMITS = {
  IMAGE: 5 * 1024 * 1024, // 5MB
  DOCUMENT: 10 * 1024 * 1024, // 10MB
  VIDEO: 50 * 1024 * 1024, // 50MB
  AUDIO: 10 * 1024 * 1024 // 10MB
} as const;

// 分页默认值
export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100
} as const;

// 搜索配置
export const SEARCH_CONFIG = {
  MIN_QUERY_LENGTH: 2,
  MAX_RESULTS: 50,
  DEBOUNCE_DELAY: 300
} as const;

// 缓存配置
export const CACHE_CONFIG = {
  DEFAULT_TTL: 5 * 60 * 1000, // 5分钟
  SHORT_TTL: 1 * 60 * 1000, // 1分钟
  LONG_TTL: 30 * 60 * 1000, // 30分钟
  PERSISTENT_TTL: 24 * 60 * 60 * 1000 // 24小时
} as const;

// 主题配置
export const THEME_CONFIG = {
  LIGHT: 'light',
  DARK: 'dark',
  AUTO: 'auto'
} as const;

// 语言配置
export const LANGUAGE_CONFIG = {
  ZH: 'zh',
  EN: 'en'
} as const;

// 正则表达式
export const REGEX_PATTERNS = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  PHONE: /^1[3-9]\d{9}$/,
  USERNAME: /^[a-zA-Z0-9_]{3,20}$/,
  PASSWORD: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,}$/,
  BATCH_NUMBER: /^[A-Z0-9]{2,20}$/,
  QR_CODE: /^[A-Z0-9]{10,50}$/,
  ID_CARD: /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/,
  URL: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i
} as const;