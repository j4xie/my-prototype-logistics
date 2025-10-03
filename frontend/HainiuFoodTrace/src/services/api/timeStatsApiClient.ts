import { apiClient } from './apiClient';

export interface StatsQueryParams {
  startDate?: string;
  endDate?: string;
  workTypeId?: string;
  department?: 'farming' | 'processing' | 'logistics' | 'quality' | 'management';
}

export interface DailyStatsResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  totalStats: {
    totalDays: number;
    totalWorkMinutes: number;
    totalBreakMinutes: number;
    averageWorkMinutesPerDay: number;
  };
  dailyStats: Array<{
    date: string;
    totalMinutes: number;
    totalBreakMinutes: number;
    workMinutes: number;
    sessions: any[];
    workTypes: { [key: string]: { minutes: number; count: number; color: string } };
  }>;
}

export interface WeeklyStatsResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  weeklyStats: Array<{
    weekStart: string;
    weekEnd: string;
    totalMinutes: number;
    workDays: number;
    sessions: any[];
    workTypes: { [key: string]: { minutes: number; color: string } };
  }>;
}

export interface MonthlyStatsResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  monthlyStats: Array<{
    month: string;
    totalMinutes: number;
    workDays: number;
    sessions: any[];
    workTypes: { [key: string]: { minutes: number; color: string } };
  }>;
}

export interface WorkTypeStatsResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  totalMinutes: number;
  workTypeStats: Array<{
    workType: {
      id: string;
      typeName: string;
      colorCode?: string;
    };
    totalMinutes: number;
    totalSessions: number;
    averageMinutesPerSession: number;
    totalDays: number;
    percentage: number;
  }>;
}

export interface ProductivityAnalysisResponse {
  period: {
    startDate: string;
    endDate: string;
  };
  userStats: {
    totalMinutes: number;
    workDays: number;
    totalSessions: number;
    averageSessionMinutes: number;
    averageDailyMinutes: number;
  };
  departmentAverage?: {
    averageSessionMinutes: number;
    averageDailyMinutes: number;
  } | null;
  trend: {
    recentWeekAverage: number;
    previousWeekAverage: number;
    changePercentage: number;
  };
  performance: {
    rating: string;
    suggestions: string[];
  };
}

export const timeStatsApiClient = {
  // 获取日统计
  getDailyStats: async (params?: StatsQueryParams): Promise<{ success: boolean; data: DailyStatsResponse; message?: string }> => {
    return apiClient.get('/mobile/time-stats/daily', { params });
  },

  // 获取周统计
  getWeeklyStats: async (params?: StatsQueryParams): Promise<{ success: boolean; data: WeeklyStatsResponse; message?: string }> => {
    return apiClient.get('/mobile/time-stats/weekly', { params });
  },

  // 获取月统计
  getMonthlyStats: async (params?: StatsQueryParams): Promise<{ success: boolean; data: MonthlyStatsResponse; message?: string }> => {
    return apiClient.get('/mobile/time-stats/monthly', { params });
  },

  // 按工作类型统计
  getStatsByWorkType: async (params?: StatsQueryParams): Promise<{ success: boolean; data: WorkTypeStatsResponse; message?: string }> => {
    return apiClient.get('/mobile/time-stats/by-type', { params });
  },

  // 获取工作效率分析
  getProductivityAnalysis: async (): Promise<{ success: boolean; data: ProductivityAnalysisResponse; message?: string }> => {
    return apiClient.get('/mobile/time-stats/productivity');
  },
};