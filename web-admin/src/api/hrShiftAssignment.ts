/**
 * HR 排班分配 API 客户端 (#835 follow-up — shift calendar UI).
 *
 * 后端路由:
 *   GET    /api/mobile/{factoryId}/hr/attendance-shifts          班次 palette
 *   GET    /api/mobile/{factoryId}/hr/shift-assignments          月度全部分配
 *   POST   /api/mobile/{factoryId}/hr/shift-assignments          单格 upsert
 *   POST   /api/mobile/{factoryId}/hr/shift-assignments/bulk     批量分配 (用户 × 日期段)
 *   DELETE /api/mobile/{factoryId}/hr/shift-assignments/{id}     清除某 cell
 */
import { get, post, del } from '@/api/request';

export type ShiftAssignmentStatus = 'SCHEDULED' | 'CLOCKED' | 'MISSED' | 'EXCEPTION';

export interface AttendanceShift {
  id: string;
  factoryId: string;
  shiftCode: string;
  shiftName: string;
  startTime: string; // "HH:mm:ss"
  endTime: string;
  isOvernight: boolean;
  isActive: boolean;
  notes?: string;
}

export interface EmployeeShiftAssignment {
  id: string;
  factoryId: string;
  userId: number;
  workDate: string; // "YYYY-MM-DD"
  shiftId: string;
  status: ShiftAssignmentStatus;
  notes?: string;
}

export interface BulkAssignResult {
  total: number;
  created: number;
  updated: number;
  rows: EmployeeShiftAssignment[];
}

export function listShifts(factoryId: string, activeOnly = true) {
  return get<AttendanceShift[]>(`/${factoryId}/hr/attendance-shifts`, {
    params: { activeOnly },
  });
}

export function listAssignments(
  factoryId: string,
  startDate: string,
  endDate: string,
  userId?: number
) {
  const params: Record<string, string | number> = { startDate, endDate };
  if (userId !== undefined) params.userId = userId;
  return get<EmployeeShiftAssignment[]>(`/${factoryId}/hr/shift-assignments`, { params });
}

export function upsertAssignment(
  factoryId: string,
  body: { userId: number; workDate: string; shiftId: string; notes?: string }
) {
  return post<EmployeeShiftAssignment>(`/${factoryId}/hr/shift-assignments`, body);
}

export function bulkAssign(
  factoryId: string,
  body: { userIds: number[]; dates: string[]; shiftId: string; notes?: string }
) {
  return post<BulkAssignResult>(`/${factoryId}/hr/shift-assignments/bulk`, body);
}

export function deleteAssignment(factoryId: string, id: string) {
  return del(`/${factoryId}/hr/shift-assignments/${id}`);
}
