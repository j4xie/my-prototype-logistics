/**
 * API相关类型定义
 */

import { ApiResponse, PaginationParams, QueryFilter } from './common';

/**
 * API客户端配置
 */
export interface ApiClientConfig {
  baseURL: string;
  timeout: number;
  retries: number;
  retryDelay: number;
  headers?: Record<string, string>;
  interceptors?: {
    request?: RequestInterceptor[];
    response?: ResponseInterceptor[];
    error?: ErrorInterceptor[];
  };
}

/**
 * 请求拦截器
 */
export type RequestInterceptor = (config: RequestConfig) => RequestConfig | Promise<RequestConfig>;

/**
 * 响应拦截器
 */
export type ResponseInterceptor = (response: ApiResponse) => ApiResponse | Promise<ApiResponse>;

/**
 * 错误拦截器
 */
export type ErrorInterceptor = (error: ApiError) => void | Promise<void>;

/**
 * 请求配置
 */
export interface RequestConfig {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTTL?: number;
  signal?: AbortSignal;
}

/**
 * API错误
 */
export interface ApiError extends Error {
  code: string;
  status?: number;
  statusText?: string;
  response?: any;
  request?: any;
  config?: RequestConfig;
  isAxiosError?: boolean;
  isNetworkError?: boolean;
  isTimeoutError?: boolean;
  isCancelledError?: boolean;
}

/**
 * API客户端接口
 */
export interface IApiClient {
  get<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T>;
  post<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>;
  put<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>;
  delete<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T>;
  patch<T = any>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>;
  request<T = any>(config: RequestConfig): Promise<T>;
  
  // 拦截器管理
  addRequestInterceptor(interceptor: RequestInterceptor): number;
  removeRequestInterceptor(id: number): void;
  addResponseInterceptor(interceptor: ResponseInterceptor): number;
  removeResponseInterceptor(id: number): void;
  addErrorInterceptor(interceptor: ErrorInterceptor): number;
  removeErrorInterceptor(id: number): void;
  
  // 实例管理
  createInstance(config?: Partial<ApiClientConfig>): IApiClient;
  setBaseURL(baseURL: string): void;
  setDefaultHeaders(headers: Record<string, string>): void;
  setTimeout(timeout: number): void;
}

/**
 * 认证API接口
 */
export interface IAuthApi {
  login(credentials: LoginRequest): Promise<AuthResponse>;
  logout(): Promise<void>;
  register(data: RegisterRequest): Promise<AuthResponse>;
  refreshToken(refreshToken: string): Promise<TokenResponse>;
  resetPassword(data: PasswordResetRequest): Promise<void>;
  changePassword(data: PasswordChangeRequest): Promise<void>;
  verifyEmail(token: string): Promise<void>;
  resendVerification(email: string): Promise<void>;
  getCurrentUser(): Promise<UserResponse>;
  updateProfile(data: UpdateProfileRequest): Promise<UserResponse>;
}

/**
 * 批次API接口
 */
export interface IBatchApi {
  getBatch(id: string): Promise<BatchResponse>;
  searchBatches(query: BatchSearchRequest): Promise<BatchListResponse>;
  createBatch(data: CreateBatchRequest): Promise<BatchResponse>;
  updateBatch(id: string, data: UpdateBatchRequest): Promise<BatchResponse>;
  deleteBatch(id: string): Promise<void>;
  getBatchHistory(id: string): Promise<BatchHistoryResponse>;
  getBatchQuality(id: string): Promise<QualityResponse>;
  addQualityCheck(id: string, data: QualityCheckRequest): Promise<QualityCheckResponse>;
  generateQRCode(id: string): Promise<QRCodeResponse>;
}

/**
 * 产品API接口
 */
export interface IProductApi {
  getProduct(id: string): Promise<ProductResponse>;
  getProducts(params?: ProductListRequest): Promise<ProductListResponse>;
  createProduct(data: CreateProductRequest): Promise<ProductResponse>;
  updateProduct(id: string, data: UpdateProductRequest): Promise<ProductResponse>;
  deleteProduct(id: string): Promise<void>;
  getProductCategories(): Promise<CategoryListResponse>;
  getProductStandards(productId: string): Promise<StandardListResponse>;
}

/**
 * 供应商API接口
 */
export interface ISupplierApi {
  getSupplier(id: string): Promise<SupplierResponse>;
  getSuppliers(params?: SupplierListRequest): Promise<SupplierListResponse>;
  createSupplier(data: CreateSupplierRequest): Promise<SupplierResponse>;
  updateSupplier(id: string, data: UpdateSupplierRequest): Promise<SupplierResponse>;
  deleteSupplier(id: string): Promise<void>;
  auditSupplier(id: string, data: AuditRequest): Promise<AuditResponse>;
  getSupplierPerformance(id: string, timeRange?: string): Promise<PerformanceResponse>;
}

/**
 * 质量API接口
 */
export interface IQualityApi {
  getQualityStandards(params?: StandardListRequest): Promise<StandardListResponse>;
  createQualityStandard(data: CreateStandardRequest): Promise<StandardResponse>;
  getQualityChecks(params?: QualityCheckListRequest): Promise<QualityCheckListResponse>;
  createQualityCheck(data: CreateQualityCheckRequest): Promise<QualityCheckResponse>;
  getQualityReports(params?: ReportListRequest): Promise<ReportListResponse>;
  generateQualityReport(data: GenerateReportRequest): Promise<ReportResponse>;
}

/**
 * 分析API接口
 */
export interface IAnalyticsApi {
  getDashboardStats(timeRange?: string): Promise<DashboardStatsResponse>;
  getProductionTrends(params: TrendRequest): Promise<TrendResponse>;
  getQualityTrends(params: TrendRequest): Promise<TrendResponse>;
  getSupplierAnalytics(params: AnalyticsRequest): Promise<AnalyticsResponse>;
  getTraceabilityMetrics(params: MetricsRequest): Promise<MetricsResponse>;
  exportData(params: ExportRequest): Promise<ExportResponse>;
}

/**
 * 请求类型定义
 */

// 认证相关请求
export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  preferences?: any;
}

// 批次相关请求
export interface BatchSearchRequest {
  query?: string;
  filters?: BatchFilters;
  pagination?: PaginationParams;
  sort?: SortParams;
}

export interface BatchFilters {
  productType?: string[];
  productionDateRange?: DateRange;
  status?: string[];
  location?: string[];
  supplier?: string[];
}

export interface CreateBatchRequest {
  productId: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  productionDate: string;
  expiryDate?: string;
  location?: string;
  supplier?: string;
  metadata?: Record<string, any>;
}

export interface UpdateBatchRequest {
  quantity?: number;
  expiryDate?: string;
  status?: string;
  location?: string;
  metadata?: Record<string, any>;
}

export interface QualityCheckRequest {
  type: string;
  performedBy: string;
  location?: string;
  checkItems: QualityCheckItem[];
  notes?: string;
}

// 产品相关请求
export interface ProductListRequest {
  category?: string;
  type?: string;
  status?: string;
  pagination?: PaginationParams;
  sort?: SortParams;
}

export interface CreateProductRequest {
  name: string;
  type: string;
  category: string;
  description?: string;
  specifications?: Record<string, any>;
  standards?: string[];
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  specifications?: Record<string, any>;
  status?: string;
}

// 供应商相关请求
export interface SupplierListRequest {
  type?: string;
  status?: string;
  region?: string;
  pagination?: PaginationParams;
  sort?: SortParams;
}

export interface CreateSupplierRequest {
  name: string;
  code: string;
  type: string;
  contact: SupplierContact;
  address: AddressData;
}

export interface UpdateSupplierRequest {
  name?: string;
  contact?: Partial<SupplierContact>;
  address?: Partial<AddressData>;
  status?: string;
}

export interface AuditRequest {
  type: string;
  auditor: string;
  scope: string;
  findings?: AuditFinding[];
}

// 质量相关请求
export interface StandardListRequest {
  category?: string;
  applicableProducts?: string[];
  status?: string;
  pagination?: PaginationParams;
}

export interface CreateStandardRequest {
  name: string;
  version: string;
  category: string;
  parameters: QualityParameter[];
  testMethods: string[];
}

export interface QualityCheckListRequest {
  batchId?: string;
  type?: string;
  result?: string;
  dateRange?: DateRange;
  pagination?: PaginationParams;
}

export interface CreateQualityCheckRequest {
  batchId: string;
  type: string;
  checkItems: QualityCheckItem[];
  performedBy: string;
}

export interface ReportListRequest {
  type?: string;
  dateRange?: DateRange;
  status?: string;
  pagination?: PaginationParams;
}

export interface GenerateReportRequest {
  type: string;
  filters: Record<string, any>;
  format: 'pdf' | 'excel' | 'csv';
  template?: string;
}

// 分析相关请求
export interface TrendRequest {
  metric: string;
  timeRange: string;
  granularity: 'hour' | 'day' | 'week' | 'month';
  filters?: Record<string, any>;
}

export interface AnalyticsRequest {
  type: string;
  timeRange: string;
  dimensions?: string[];
  measures?: string[];
  filters?: Record<string, any>;
}

export interface MetricsRequest {
  metrics: string[];
  timeRange: string;
  groupBy?: string[];
  filters?: Record<string, any>;
}

export interface ExportRequest {
  type: string;
  format: 'csv' | 'excel' | 'json' | 'pdf';
  filters?: Record<string, any>;
  fields?: string[];
}

/**
 * 响应类型定义
 */

// 认证相关响应
export interface AuthResponse extends ApiResponse {
  data: {
    user: UserData;
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface TokenResponse extends ApiResponse {
  data: {
    token: string;
    refreshToken: string;
    expiresIn: number;
  };
}

export interface UserResponse extends ApiResponse {
  data: UserData;
}

// 批次相关响应
export interface BatchResponse extends ApiResponse {
  data: BatchData;
}

export interface BatchListResponse extends ApiResponse {
  data: {
    items: BatchData[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface BatchHistoryResponse extends ApiResponse {
  data: BatchHistoryData[];
}

export interface QRCodeResponse extends ApiResponse {
  data: {
    qrCode: string;
    url: string;
  };
}

// 产品相关响应
export interface ProductResponse extends ApiResponse {
  data: ProductData;
}

export interface ProductListResponse extends ApiResponse {
  data: {
    items: ProductData[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface CategoryListResponse extends ApiResponse {
  data: CategoryData[];
}

// 供应商相关响应
export interface SupplierResponse extends ApiResponse {
  data: SupplierData;
}

export interface SupplierListResponse extends ApiResponse {
  data: {
    items: SupplierData[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface PerformanceResponse extends ApiResponse {
  data: PerformanceData;
}

// 质量相关响应
export interface StandardResponse extends ApiResponse {
  data: StandardData;
}

export interface StandardListResponse extends ApiResponse {
  data: {
    items: StandardData[];
    total: number;
  };
}

export interface QualityResponse extends ApiResponse {
  data: QualityData;
}

export interface QualityCheckResponse extends ApiResponse {
  data: QualityCheckData;
}

export interface QualityCheckListResponse extends ApiResponse {
  data: {
    items: QualityCheckData[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface ReportResponse extends ApiResponse {
  data: ReportData;
}

export interface ReportListResponse extends ApiResponse {
  data: {
    items: ReportData[];
    total: number;
  };
}

// 分析相关响应
export interface DashboardStatsResponse extends ApiResponse {
  data: DashboardStatsData;
}

export interface TrendResponse extends ApiResponse {
  data: TrendData;
}

export interface AnalyticsResponse extends ApiResponse {
  data: AnalyticsData;
}

export interface MetricsResponse extends ApiResponse {
  data: MetricsData;
}

export interface ExportResponse extends ApiResponse {
  data: {
    url: string;
    filename: string;
    size: number;
    expiresAt: string;
  };
}

/**
 * 数据类型定义
 */

export interface UserData {
  id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: string;
  permissions: string[];
  preferences?: any;
  createdAt: string;
  updatedAt: string;
}

export interface BatchData {
  id: string;
  batchNumber: string;
  product: ProductData;
  quantity: number;
  unit: string;
  productionDate: string;
  expiryDate?: string;
  status: string;
  currentStage: string;
  location?: LocationData;
  quality?: QualityData;
  traceability?: TraceabilityData;
  qrCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductData {
  id: string;
  name: string;
  type: string;
  category: string;
  description?: string;
  specifications?: Record<string, any>;
  images?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LocationData {
  id: string;
  name: string;
  type: string;
  address: AddressData;
  coordinates?: CoordinatesData;
}

export interface AddressData {
  country?: string;
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  detail?: string;
  postalCode?: string;
}

export interface CoordinatesData {
  latitude: number;
  longitude: number;
  altitude?: number;
}

export interface QualityData {
  grade: string;
  score?: number;
  checks: QualityCheckData[];
  certifications: CertificationData[];
  overall: string;
}

export interface QualityCheckData {
  id: string;
  type: string;
  result: string;
  score?: number;
  performedBy: string;
  performedAt: string;
  checkItems: QualityCheckItemData[];
}

export interface QualityCheckItemData {
  parameter: string;
  measuredValue: any;
  expectedValue?: any;
  unit?: string;
  result: string;
}

export interface CertificationData {
  id: string;
  name: string;
  type: string;
  number: string;
  issuer: string;
  issuedAt: string;
  expiresAt?: string;
  status: string;
}

export interface SupplierData {
  id: string;
  name: string;
  code: string;
  type: string;
  contact: SupplierContact;
  address: AddressData;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContact {
  person: string;
  phone: string;
  email: string;
}

export interface AuditFinding {
  category: string;
  severity: string;
  description: string;
  requirement: string;
  status: string;
}

export interface PerformanceData {
  qualityScore: number;
  deliveryPerformance: number;
  complianceRate: number;
  trends: TrendPoint[];
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface StandardData {
  id: string;
  name: string;
  version: string;
  category: string;
  parameters: QualityParameter[];
  createdAt: string;
  updatedAt: string;
}

export interface QualityParameter {
  name: string;
  type: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  mandatory: boolean;
}

export interface ReportData {
  id: string;
  type: string;
  title: string;
  format: string;
  url: string;
  size: number;
  generatedAt: string;
}

export interface DashboardStatsData {
  production: ProductionStats;
  quality: QualityStats;
  inventory: InventoryStats;
  orders: OrderStats;
}

export interface ProductionStats {
  total: number;
  daily: number;
  weekly: number;
  monthly: number;
  efficiency: number;
  trend: number;
}

export interface QualityStats {
  passRate: number;
  averageScore: number;
  checksCompleted: number;
  issuesFound: number;
  trend: number;
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStock: number;
  expiringSoon: number;
  turnoverRate: number;
}

export interface OrderStats {
  total: number;
  pending: number;
  completed: number;
  revenue: number;
  averageValue: number;
}

export interface TrendData {
  metric: string;
  timeRange: string;
  data: TrendPoint[];
  summary: {
    total: number;
    average: number;
    growth: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export interface AnalyticsData {
  type: string;
  dimensions: string[];
  measures: string[];
  data: any[];
  summary: Record<string, any>;
}

export interface MetricsData {
  metrics: MetricData[];
  timeRange: string;
  lastUpdated: string;
}

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'stable';
}

export interface TraceabilityData {
  completeness: number;
  confidence: number;
  parentBatches: string[];
  childBatches: string[];
  supplyChain: SupplyChainNode[];
}

export interface SupplyChainNode {
  id: string;
  type: string;
  name: string;
  role: string;
  location: LocationData;
  entryTime?: string;
  exitTime?: string;
}

export interface BatchHistoryData {
  id: string;
  stage: string;
  action: string;
  timestamp: string;
  actor: string;
  location?: LocationData;
  details?: Record<string, any>;
}

export interface CategoryData {
  id: string;
  name: string;
  parent?: string;
  description?: string;
  itemCount: number;
}

/**
 * 通用辅助类型
 */

export interface DateRange {
  start: string;
  end: string;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

export interface AuditResponse extends ApiResponse {
  data: AuditData;
}

export interface AuditData {
  id: string;
  type: string;
  result: string;
  score?: number;
  findings: AuditFinding[];
  performedAt: string;
  performedBy: string;
}