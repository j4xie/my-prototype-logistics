// @ts-nocheck
/**
 * schedulingApiClient 单元测试
 * 测试调度管理API客户端：计划CRUD、排程管理、工人分配、AI辅助
 */

import { schedulingApiClient } from '../../../services/api/schedulingApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

jest.mock('../../../types/dispatcher', () => ({}));

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/scheduling`;

describe('schedulingApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ========== 调度计划 CRUD ==========

  describe('createPlan', () => {
    it('should POST /plans and return created plan', async () => {
      const data = { name: '周一排产计划', planDate: '2026-03-20' };
      const plan = { id: 'plan-1', ...data, status: 'DRAFT' };

      mock.onPost(`${BASE}/plans`).reply(200, { success: true, data: plan, message: 'ok' });

      const result = await schedulingApiClient.createPlan(data);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe('plan-1');
    });

    it('should send request body correctly', async () => {
      const data = { name: '排产', planDate: '2026-03-21', shiftType: 'day' };

      mock.onPost(`${BASE}/plans`).reply(200, { success: true, data: {}, message: 'ok' });

      await schedulingApiClient.createPlan(data);
      expect(JSON.parse(mock.history.post[0].data)).toEqual(data);
    });
  });

  describe('getPlan', () => {
    it('should GET /plans/{planId} and return plan detail', async () => {
      const plan = { id: 'plan-1', name: '排产计划A', status: 'CONFIRMED' };

      mock.onGet(`${BASE}/plans/plan-1`).reply(200, { success: true, data: plan, message: 'ok' });

      const result = await schedulingApiClient.getPlan('plan-1');
      expect(result.success).toBe(true);
      expect(result.data.name).toBe('排产计划A');
    });
  });

  describe('getPlans', () => {
    it('should GET /plans with query params', async () => {
      const pagedData = {
        content: [{ id: 'plan-1' }, { id: 'plan-2' }],
        totalElements: 2,
        totalPages: 1,
      };

      mock.onGet(`${BASE}/plans`).reply(200, { success: true, data: pagedData, message: 'ok' });

      const result = await schedulingApiClient.getPlans({ status: 'CONFIRMED', page: 0, size: 10 });
      expect(result.success).toBe(true);
      expect(result.data.content).toHaveLength(2);
    });

    it('should strip factoryId from query params', async () => {
      mock.onGet(`${BASE}/plans`).reply(200, { success: true, data: { content: [] }, message: 'ok' });

      await schedulingApiClient.getPlans({ factoryId: DEFAULT_FACTORY_ID, status: 'DRAFT' });
      expect(mock.history.get[0].params.factoryId).toBeUndefined();
      expect(mock.history.get[0].params.status).toBe('DRAFT');
    });

    it('should work with no params', async () => {
      mock.onGet(`${BASE}/plans`).reply(200, { success: true, data: { content: [] }, message: 'ok' });

      const result = await schedulingApiClient.getPlans();
      expect(result.success).toBe(true);
    });
  });

  describe('updatePlan', () => {
    it('should PUT /plans/{planId} and return updated plan', async () => {
      const data = { name: '修改后的计划' };
      const updated = { id: 'plan-1', name: '修改后的计划', status: 'DRAFT' };

      mock.onPut(`${BASE}/plans/plan-1`).reply(200, { success: true, data: updated, message: 'ok' });

      const result = await schedulingApiClient.updatePlan('plan-1', data);
      expect(result.data.name).toBe('修改后的计划');
    });
  });

  describe('confirmPlan', () => {
    it('should POST /plans/{planId}/confirm', async () => {
      const confirmed = { id: 'plan-1', status: 'CONFIRMED' };

      mock.onPost(`${BASE}/plans/plan-1/confirm`).reply(200, { success: true, data: confirmed, message: 'ok' });

      const result = await schedulingApiClient.confirmPlan('plan-1');
      expect(result.data.status).toBe('CONFIRMED');
    });
  });

  describe('cancelPlan', () => {
    it('should POST /plans/{planId}/cancel with reason param', async () => {
      mock.onPost(`${BASE}/plans/plan-1/cancel`).reply(200, { success: true, data: null, message: 'ok' });

      const result = await schedulingApiClient.cancelPlan('plan-1', '物料不足');
      expect(result.success).toBe(true);
      expect(mock.history.post[0].params).toEqual({ reason: '物料不足' });
    });

    it('should work without reason', async () => {
      mock.onPost(`${BASE}/plans/plan-1/cancel`).reply(200, { success: true, data: null, message: 'ok' });

      await schedulingApiClient.cancelPlan('plan-1');
      expect(mock.history.post).toHaveLength(1);
    });
  });

  // ========== 产线排程管理 ==========

  describe('getSchedule', () => {
    it('should GET /schedules/{scheduleId}', async () => {
      const schedule = { id: 'sched-1', productionLineId: 'line-1', status: 'SCHEDULED' };

      mock.onGet(`${BASE}/schedules/sched-1`).reply(200, { success: true, data: schedule, message: 'ok' });

      const result = await schedulingApiClient.getSchedule('sched-1');
      expect(result.data.productionLineId).toBe('line-1');
    });
  });

  describe('updateSchedule', () => {
    it('should PUT /schedules/{scheduleId}', async () => {
      const data = { plannedQuantity: 500 };

      mock.onPut(`${BASE}/schedules/sched-1`).reply(200, {
        success: true,
        data: { id: 'sched-1', plannedQuantity: 500 },
        message: 'ok',
      });

      const result = await schedulingApiClient.updateSchedule('sched-1', data);
      expect(result.data.plannedQuantity).toBe(500);
    });
  });

  describe('startSchedule', () => {
    it('should POST /schedules/{scheduleId}/start', async () => {
      mock.onPost(`${BASE}/schedules/sched-1/start`).reply(200, {
        success: true,
        data: { id: 'sched-1', status: 'IN_PROGRESS' },
        message: 'ok',
      });

      const result = await schedulingApiClient.startSchedule('sched-1');
      expect(result.data.status).toBe('IN_PROGRESS');
    });
  });

  describe('completeSchedule', () => {
    it('should POST /schedules/{scheduleId}/complete with completedQuantity param', async () => {
      mock.onPost(`${BASE}/schedules/sched-1/complete`).reply(200, {
        success: true,
        data: { id: 'sched-1', status: 'COMPLETED' },
        message: 'ok',
      });

      const result = await schedulingApiClient.completeSchedule('sched-1', 480);
      expect(result.success).toBe(true);
      expect(mock.history.post[0].params).toEqual({ completedQuantity: 480 });
    });
  });

  // ========== 工人分配管理 ==========

  describe('assignWorkers', () => {
    it('should POST /workers/assign', async () => {
      const data = { scheduleId: 'sched-1', workerIds: [1, 2, 3] };
      const assignments = [
        { id: 'assign-1', workerId: 1 },
        { id: 'assign-2', workerId: 2 },
      ];

      mock.onPost(`${BASE}/workers/assign`).reply(200, { success: true, data: assignments, message: 'ok' });

      const result = await schedulingApiClient.assignWorkers(data);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('removeWorkerAssignment', () => {
    it('should DELETE /workers/assignments/{assignmentId}', async () => {
      mock.onDelete(`${BASE}/workers/assignments/assign-1`).reply(200, {
        success: true,
        data: null,
        message: 'ok',
      });

      const result = await schedulingApiClient.removeWorkerAssignment('assign-1');
      expect(result.success).toBe(true);
    });
  });

  describe('workerCheckIn', () => {
    it('should POST /workers/assignments/{assignmentId}/check-in', async () => {
      mock.onPost(`${BASE}/workers/assignments/assign-1/check-in`).reply(200, {
        success: true,
        data: { id: 'assign-1', checkedInAt: '2026-03-20T08:00:00' },
        message: 'ok',
      });

      const result = await schedulingApiClient.workerCheckIn('assign-1');
      expect(result.data.checkedInAt).toBeDefined();
    });
  });

  describe('workerCheckOut', () => {
    it('should POST /workers/assignments/{assignmentId}/check-out', async () => {
      mock.onPost(`${BASE}/workers/assignments/assign-1/check-out`).reply(200, {
        success: true,
        data: { id: 'assign-1', checkedOutAt: '2026-03-20T17:00:00' },
        message: 'ok',
      });

      const result = await schedulingApiClient.workerCheckOut('assign-1');
      expect(result.data.checkedOutAt).toBeDefined();
    });

    it('should pass performanceScore param when provided', async () => {
      mock.onPost(`${BASE}/workers/assignments/assign-1/check-out`).reply(200, {
        success: true,
        data: { id: 'assign-1' },
        message: 'ok',
      });

      await schedulingApiClient.workerCheckOut('assign-1', 85);
      expect(mock.history.post[0].params).toEqual({ performanceScore: 85 });
    });
  });

  describe('getWorkerAssignments', () => {
    it('should GET /workers/assignments with query params', async () => {
      const assignments = [{ id: 'assign-1', workerId: 1 }];

      mock.onGet(`${BASE}/workers/assignments`).reply(200, {
        success: true,
        data: assignments,
        message: 'ok',
      });

      const result = await schedulingApiClient.getWorkerAssignments({ userId: 1, date: '2026-03-20' });
      expect(result.data).toHaveLength(1);
      expect(mock.history.get[0].params.userId).toBe(1);
    });

    it('should strip factoryId from query params', async () => {
      mock.onGet(`${BASE}/workers/assignments`).reply(200, { success: true, data: [], message: 'ok' });

      await schedulingApiClient.getWorkerAssignments({ factoryId: DEFAULT_FACTORY_ID, userId: 2 });
      expect(mock.history.get[0].params.factoryId).toBeUndefined();
    });
  });

  // ========== AI 辅助功能 ==========

  describe('generateSchedule', () => {
    it('should POST /generate with config data', async () => {
      const config = { planDate: '2026-03-20', shiftType: 'day', optimizeFor: 'efficiency' };
      const aiResult = { plan: { id: 'plan-ai' }, completionProbability: 0.92 };

      mock.onPost(`${BASE}/generate`).reply(200, { success: true, data: aiResult, message: 'ok' });

      const result = await schedulingApiClient.generateSchedule(config);
      expect(result.data.completionProbability).toBe(0.92);
    });
  });

  describe('optimizeWorkers', () => {
    it('should POST /optimize-workers', async () => {
      const data = { planId: 'plan-1', optimizeFor: 'efficiency' };

      mock.onPost(`${BASE}/optimize-workers`).reply(200, {
        success: true,
        data: [{ id: 'assign-opt-1', workerId: 1 }],
        message: 'ok',
      });

      const result = await schedulingApiClient.optimizeWorkers(data);
      expect(result.data).toHaveLength(1);
    });
  });

  describe('calculateCompletionProbability', () => {
    it('should GET /schedules/{scheduleId}/probability', async () => {
      const probData = {
        scheduleId: 'sched-1',
        probability: 0.87,
        riskLevel: 'medium',
        factors: { workerEfficiency: 0.9, equipmentStatus: 0.85 },
      };

      mock.onGet(`${BASE}/schedules/sched-1/probability`).reply(200, {
        success: true,
        data: probData,
        message: 'ok',
      });

      const result = await schedulingApiClient.calculateCompletionProbability('sched-1');
      expect(result.data.probability).toBe(0.87);
      expect(result.data.riskLevel).toBe('medium');
    });
  });

  // ========== error handling ==========

  describe('error handling', () => {
    it('should throw on network error', async () => {
      mock.onGet(`${BASE}/plans/plan-x`).networkError();

      await expect(schedulingApiClient.getPlan('plan-x')).rejects.toThrow();
    });

    it('should throw on 500 server error', async () => {
      mock.onPost(`${BASE}/plans`).reply(500, { success: false, message: '服务器内部错误' });

      await expect(schedulingApiClient.createPlan({ name: 'test' })).rejects.toThrow();
    });
  });
});
