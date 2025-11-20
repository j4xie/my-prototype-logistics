/**
 * Mock API响应数据
 * 用于测试时模拟后端返回的数据
 */

// ==================== 通用响应格式 ====================

export const mockSuccessResponse = <T>(data: T, message = '操作成功') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

export const mockErrorResponse = (message: string, code?: string) => ({
  success: false,
  message,
  code: code || 'ERROR',
  timestamp: new Date().toISOString(),
});

export const mockPageResponse = <T>(
  items: T[],
  page = 1,
  size = 10,
  total = items.length
) => ({
  success: true,
  data: {
    items,
    pagination: {
      page,
      size,
      total,
      totalPages: Math.ceil(total / size),
    },
  },
});

// ==================== 用户认证 ====================

export const mockUser = {
  id: 1,
  username: 'testuser',
  realName: '测试用户',
  factoryId: 'CRETAS_2024_001',
  factoryName: '白垩纪食品加工厂',
  departmentId: 1,
  departmentName: '生产部',
  role: 'factory_user',
  phone: '13800138000',
  email: 'test@example.com',
};

export const mockLoginResponse = mockSuccessResponse({
  accessToken: 'mock-access-token-12345',
  refreshToken: 'mock-refresh-token-67890',
  expiresIn: 86400,
  user: mockUser,
});

export const mockTokenRefreshResponse = mockSuccessResponse({
  accessToken: 'mock-new-access-token',
  refreshToken: 'mock-new-refresh-token',
  expiresIn: 86400,
});

// ==================== 考勤打卡 ====================

export const mockTimeClockRecord = {
  id: 1,
  userId: 1,
  userName: '测试用户',
  factoryId: 'CRETAS_2024_001',
  clockInTime: '2025-01-20T08:00:00Z',
  clockOutTime: null,
  clockInLocation: { latitude: 31.2304, longitude: 121.4737 },
  clockOutLocation: null,
  clockInPhoto: 'https://example.com/photo1.jpg',
  clockOutPhoto: null,
  workDuration: null,
  status: 'in_progress',
  date: '2025-01-20',
};

export const mockClockInResponse = mockSuccessResponse(mockTimeClockRecord);

export const mockTimeStatsResponse = mockSuccessResponse({
  totalWorkHours: 176.5,
  totalDays: 22,
  avgDailyHours: 8.02,
  overtimeHours: 8.5,
  lateCount: 2,
  earlyLeaveCount: 1,
  absentCount: 0,
});

// ==================== 生产批次 ====================

export const mockProcessingBatch = {
  id: 1,
  batchNumber: 'BATCH_2025_001',
  factoryId: 'CRETAS_2024_001',
  productName: '鸡肉香肠',
  productTypeId: 1,
  plannedQuantity: 1000,
  actualQuantity: 980,
  goodQuantity: 950,
  defectQuantity: 30,
  yieldRate: 96.94,
  status: 'completed',
  startTime: '2025-01-20T08:00:00Z',
  endTime: '2025-01-20T16:00:00Z',
  workDuration: 480,
  supervisorId: 2,
  supervisorName: '张主管',
  equipmentId: 1,
  equipmentName: '切割机A',
  materialCost: 5000.0,
  laborCost: 1200.0,
  equipmentCost: 300.0,
  otherCost: 100.0,
  totalCost: 6600.0,
  unitCost: 6.94,
};

export const mockBatchListResponse = mockPageResponse([mockProcessingBatch], 1, 10, 1);

export const mockBatchDetailResponse = mockSuccessResponse(mockProcessingBatch);

// ==================== 质检 ====================

export const mockQualityInspection = {
  id: 1,
  factoryId: 'CRETAS_2024_001',
  batchId: 1,
  batchNumber: 'BATCH_2025_001',
  inspectorId: 3,
  inspectorName: '李质检',
  inspectionType: 'process',
  result: 'pass',
  score: 95,
  notes: '产品质量良好',
  defectCount: 5,
  sampleCount: 100,
  photos: ['https://example.com/inspect1.jpg'],
  inspectionTime: '2025-01-20T14:00:00Z',
};

export const mockQualityInspectionListResponse = mockPageResponse(
  [mockQualityInspection],
  1,
  10,
  1
);

export const mockCreateInspectionResponse = mockSuccessResponse(mockQualityInspection);

// ==================== 设备 ====================

export const mockEquipment = {
  id: 1,
  code: 'EQ_001',
  name: '切割机A',
  factoryId: 'CRETAS_2024_001',
  type: 'cutting',
  status: 'running',
  location: '生产车间A',
  purchaseDate: '2024-01-01',
  hourlyCost: 50.0,
};

export const mockEquipmentAlert = {
  id: 1,
  equipmentId: 1,
  equipmentCode: 'EQ_001',
  equipmentName: '切割机A',
  alertType: 'maintenance',
  severity: 'warning',
  message: '设备需要定期维护',
  status: 'pending',
  createdAt: '2025-01-20T10:00:00Z',
};

export const mockEquipmentAlertsResponse = mockPageResponse(
  [mockEquipmentAlert],
  1,
  10,
  1
);

// ==================== AI分析 ====================

export const mockAIAnalysisRequest = {
  batchId: 1,
  analysisType: 'cost_optimization',
  prompt: '请分析这个批次的成本构成，提出优化建议',
};

export const mockAIAnalysisResponse = mockSuccessResponse({
  analysisId: 'AI_2025_001',
  result: {
    summary: '成本分析完成',
    insights: [
      '物料成本占总成本的75.8%，建议优化供应商选择',
      '劳动成本合理，在行业平均水平',
      '设备成本较低，设备利用率良好',
    ],
    recommendations: [
      '考虑批量采购原材料以降低单价',
      '优化生产流程以减少物料损耗',
    ],
    costBreakdown: {
      material: 5000.0,
      labor: 1200.0,
      equipment: 300.0,
      other: 100.0,
    },
  },
  usage: {
    inputTokens: 500,
    outputTokens: 300,
    totalCost: 0.05,
  },
  createdAt: '2025-01-20T15:00:00Z',
});

// ==================== 人员报表 ====================

export const mockPersonnelStatisticsResponse = mockSuccessResponse({
  totalEmployees: 150,
  onDutyToday: 145,
  absentToday: 5,
  lateToday: 3,
  avgWorkHours: 8.2,
  overtimeHours: 250.5,
  departments: [
    { name: '生产部', count: 80 },
    { name: '质检部', count: 30 },
    { name: '管理部', count: 40 },
  ],
});

export const mockWorkHoursRankingResponse = mockSuccessResponse([
  { userId: 1, userName: '张三', workHours: 220.5, rank: 1 },
  { userId: 2, userName: '李四', workHours: 218.0, rank: 2 },
  { userId: 3, userName: '王五', workHours: 215.5, rank: 3 },
]);

// ==================== 工厂设置 ====================

export const mockFactorySettings = {
  factoryId: 'CRETAS_2024_001',
  factoryName: '白垩纪食品加工厂',
  address: '上海市浦东新区',
  gpsLocation: { latitude: 31.2304, longitude: 121.4737 },
  workingHours: {
    start: '08:00',
    end: '17:00',
  },
  allowedClockInRadius: 100,
  enableGpsVerification: true,
  enablePhotoCapture: true,
};

export const mockFactorySettingsResponse = mockSuccessResponse(mockFactorySettings);

// ==================== 用户反馈 ====================

export const mockFeedback = {
  feedbackId: '1',
  type: 'bug',
  title: '打卡页面加载慢',
  content: '使用Android手机时，打卡页面加载需要3-5秒',
  contact: '13800138000',
  status: 'pending',
  createdAt: '2025-01-20T10:00:00Z',
  screenshots: ['https://example.com/screenshot1.jpg'],
};

export const mockSubmitFeedbackResponse = mockSuccessResponse(mockFeedback);

// ==================== Dashboard ====================

export const mockDashboardData = mockSuccessResponse({
  overview: {
    todayProduction: 5000,
    todayDefects: 50,
    todayYieldRate: 99.0,
    onDutyEmployees: 145,
  },
  recentBatches: [mockProcessingBatch],
  pendingAlerts: [mockEquipmentAlert],
  recentInspections: [mockQualityInspection],
});
