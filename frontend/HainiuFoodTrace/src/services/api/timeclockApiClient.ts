import { apiClient } from './apiClient';

export interface ClockInRequest {
  workTypeId?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  deviceInfo?: {
    deviceId: string;
    platform: string;
    model?: string;
    osVersion?: string;
  };
  notes?: string;
}

export interface ClockOutRequest {
  notes?: string;
}

export interface BreakRequest {
  notes?: string;
}

export interface ClockRecord {
  id: string;
  userId: number;
  factoryId: string;
  clockType: 'clock_in' | 'clock_out' | 'break_start' | 'break_end';
  clockTime: string;
  workTypeId?: string;
  locationData?: any;
  deviceInfo?: any;
  ipAddress?: string;
  status: 'normal' | 'late' | 'early' | 'invalid';
  notes?: string;
  createdAt: string;
  workType?: {
    id: string;
    typeName: string;
    colorCode?: string;
  };
}

export interface ClockStatus {
  currentStatus: 'not_started' | 'working' | 'on_break' | 'finished';
  permissions: {
    canClockIn: boolean;
    canClockOut: boolean;
    canBreakStart: boolean;
    canBreakEnd: boolean;
  };
  todayClocks: ClockRecord[];
  activeSession?: {
    id: string;
    workType?: {
      id: string;
      typeName: string;
      colorCode?: string;
    };
    startTime: string;
    endTime?: string;
    breakDuration: number;
  };
  todayWorkMinutes: number;
  summary: {
    clockInTime: string | null;
    clockOutTime: string | null;
    totalBreakMinutes: number;
    workType?: {
      id: string;
      typeName: string;
      colorCode?: string;
    } | null;
  };
}

export interface ClockHistoryParams {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface ClockHistoryResponse {
  records: ClockRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const timeclockApiClient = {
  // 上班打卡
  clockIn: async (data: ClockInRequest) => {
    return apiClient.post('/mobile/timeclock/clock-in', data);
  },

  // 下班打卡
  clockOut: async (data: ClockOutRequest) => {
    return apiClient.post('/mobile/timeclock/clock-out', data);
  },

  // 开始休息
  breakStart: async (data: BreakRequest) => {
    return apiClient.post('/mobile/timeclock/break-start', data);
  },

  // 结束休息
  breakEnd: async (data: BreakRequest) => {
    return apiClient.post('/mobile/timeclock/break-end', data);
  },

  // 获取当前打卡状态
  getClockStatus: async (): Promise<{ success: boolean; data: ClockStatus; message?: string }> => {
    return apiClient.get('/mobile/timeclock/status');
  },

  // 获取打卡历史记录
  getClockHistory: async (params?: ClockHistoryParams): Promise<{ success: boolean; data: ClockHistoryResponse; message?: string }> => {
    return apiClient.get('/mobile/timeclock/history', { params });
  },
};