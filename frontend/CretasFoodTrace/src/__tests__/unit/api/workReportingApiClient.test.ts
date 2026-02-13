/**
 * workReportingApiClient 单元测试
 * 测试报工API客户端：提交、查询、签到/签退、schema
 */

import { workReportingApiClient } from '../../../services/api/workReportingApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

describe('workReportingApiClient', () => {
  let mock: MockAdapter;
  const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
  const BASE_PATH = `/api/mobile/${DEFAULT_FACTORY_ID}/work-reporting`;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  // ========== submitReport ==========
  describe('submitReport', () => {
    it('应该成功提交报工', async () => {
      const submitData = {
        reportType: 'PROGRESS' as const,
        reportDate: '2026-02-13',
        processCategory: '切割',
        outputQuantity: 100,
        goodQuantity: 95,
        defectQuantity: 5,
      };

      const expectedResponse = {
        success: true,
        code: 200,
        message: '提交成功',
        data: {
          id: 1,
          factoryId: 'F001',
          workerId: 22,
          reportType: 'PROGRESS',
          reportDate: '2026-02-13',
          processCategory: '切割',
          outputQuantity: 100,
          status: 'SUBMITTED',
          syncedToSmartbi: false,
          createdAt: '2026-02-13T10:00:00Z',
          updatedAt: '2026-02-13T10:00:00Z',
        },
      };

      mock.onPost(`${BASE_PATH}/reports?workerId=22`).reply(200, expectedResponse);

      const result = await workReportingApiClient.submitReport(submitData, 22);

      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
      expect(result.data.reportType).toBe('PROGRESS');
      expect(result.data.status).toBe('SUBMITTED');
    });

    it('工时报工应包含hourEntries', async () => {
      const submitData = {
        reportType: 'HOURS' as const,
        reportDate: '2026-02-13',
        productName: '鸡肉香肠',
        hourEntries: [
          { fullTimeWorkers: 10, fullTimeHours: 8 },
        ],
        totalWorkers: 10,
      };

      mock.onPost(/\/reports\?workerId=/).reply((config) => {
        const body = JSON.parse(config.data);
        expect(body.reportType).toBe('HOURS');
        expect(body.hourEntries).toHaveLength(1);
        expect(body.totalWorkers).toBe(10);
        return [200, {
          success: true,
          code: 200,
          message: '成功',
          data: { id: 2, reportType: 'HOURS', status: 'SUBMITTED' },
        }];
      });

      const result = await workReportingApiClient.submitReport(submitData, 22);
      expect(result.success).toBe(true);
    });

    it('提交失败（500）应抛出错误', async () => {
      mock.onPost(/\/reports\?workerId=/).reply(500, {
        success: false,
        message: '服务器内部错误',
        code: 'INTERNAL_ERROR',
      });

      await expect(
        workReportingApiClient.submitReport(
          { reportType: 'PROGRESS', reportDate: '2026-02-13' },
          22
        )
      ).rejects.toThrow();
    });
  });

  // ========== getReports ==========
  describe('getReports', () => {
    it('应该成功获取报工列表（分页）', async () => {
      const mockResponse = {
        success: true,
        code: 200,
        message: '成功',
        data: {
          content: [
            {
              id: 1,
              reportType: 'PROGRESS',
              reportDate: '2026-02-13',
              status: 'SUBMITTED',
            },
            {
              id: 2,
              reportType: 'HOURS',
              reportDate: '2026-02-12',
              status: 'APPROVED',
            },
          ],
          totalElements: 2,
          totalPages: 1,
        },
      };

      mock.onGet(`${BASE_PATH}/reports`).reply(200, mockResponse);

      const result = await workReportingApiClient.getReports({ page: 0, size: 10 });

      expect(result.success).toBe(true);
      expect(result.data.content).toHaveLength(2);
      expect(result.data.totalElements).toBe(2);
    });

    it('应该支持日期范围过滤', async () => {
      mock.onGet(`${BASE_PATH}/reports`).reply((config) => {
        expect(config.params).toHaveProperty('startDate', '2026-02-01');
        expect(config.params).toHaveProperty('endDate', '2026-02-13');
        return [200, {
          success: true,
          code: 200,
          message: '成功',
          data: { content: [], totalElements: 0, totalPages: 0 },
        }];
      });

      await workReportingApiClient.getReports({
        startDate: '2026-02-01',
        endDate: '2026-02-13',
      });
    });

    it('应该支持按类型过滤', async () => {
      mock.onGet(`${BASE_PATH}/reports`).reply((config) => {
        expect(config.params).toHaveProperty('type', 'PROGRESS');
        return [200, {
          success: true,
          code: 200,
          message: '成功',
          data: { content: [], totalElements: 0, totalPages: 0 },
        }];
      });

      await workReportingApiClient.getReports({ type: 'PROGRESS' });
    });

    it('无参数也应正常返回', async () => {
      mock.onGet(`${BASE_PATH}/reports`).reply(200, {
        success: true,
        code: 200,
        message: '成功',
        data: { content: [], totalElements: 0, totalPages: 0 },
      });

      const result = await workReportingApiClient.getReports();
      expect(result.success).toBe(true);
      expect(result.data.content).toHaveLength(0);
    });
  });

  // ========== checkin ==========
  describe('checkin', () => {
    it('应该成功签到', async () => {
      const checkinData = {
        batchId: 101,
        employeeId: 33,
        checkinMethod: 'QR' as const,
        assignedBy: 22,
      };

      const expectedResponse = {
        success: true,
        code: 200,
        message: '签到成功',
        data: {
          id: 1,
          batchId: 101,
          employeeId: 33,
          checkInTime: '2026-02-13T08:00:00Z',
          status: 'working',
          checkinMethod: 'QR',
        },
      };

      mock.onPost(`${BASE_PATH}/checkin`).reply(200, expectedResponse);

      const result = await workReportingApiClient.checkin(checkinData);

      expect(result.success).toBe(true);
      expect(result.data.employeeId).toBe(33);
      expect(result.data.status).toBe('working');
    });

    it('重复签到应返回失败', async () => {
      mock.onPost(`${BASE_PATH}/checkin`).reply(200, {
        success: false,
        code: 400,
        message: '员工已签到',
        data: null,
      });

      const result = await workReportingApiClient.checkin({
        batchId: 101,
        employeeId: 33,
        checkinMethod: 'QR',
      });

      expect(result.success).toBe(false);
      expect(result.message).toBe('员工已签到');
    });
  });

  // ========== checkout ==========
  describe('checkout', () => {
    it('应该成功签退', async () => {
      const expectedResponse = {
        success: true,
        code: 200,
        message: '签退成功',
        data: {
          id: 1,
          batchId: 101,
          employeeId: 33,
          checkInTime: '2026-02-13T08:00:00Z',
          checkOutTime: '2026-02-13T17:00:00Z',
          workMinutes: 540,
          status: 'completed',
        },
      };

      mock.onPost(`${BASE_PATH}/checkout`).reply(200, expectedResponse);

      const result = await workReportingApiClient.checkout({
        batchId: 101,
        employeeId: 33,
      });

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('completed');
      expect(result.data.workMinutes).toBe(540);
    });
  });

  // ========== getCheckinList ==========
  describe('getCheckinList', () => {
    it('应该获取指定批次的签到列表', async () => {
      const batchId = 101;
      const expectedResponse = {
        success: true,
        code: 200,
        message: '成功',
        data: [
          { id: 1, batchId: 101, employeeId: 33, status: 'working', checkInTime: '2026-02-13T08:00:00Z' },
          { id: 2, batchId: 101, employeeId: 34, status: 'completed', checkInTime: '2026-02-13T08:05:00Z' },
        ],
      };

      mock.onGet(`${BASE_PATH}/checkin/batch/${batchId}`).reply(200, expectedResponse);

      const result = await workReportingApiClient.getCheckinList(batchId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.status).toBe('working');
      expect(result.data[1]?.status).toBe('completed');
    });

    it('空批次应返回空数组', async () => {
      mock.onGet(/\/checkin\/batch\//).reply(200, {
        success: true,
        code: 200,
        message: '成功',
        data: [],
      });

      const result = await workReportingApiClient.getCheckinList(999);
      expect(result.data).toHaveLength(0);
    });
  });

  // ========== getTodayCheckins ==========
  describe('getTodayCheckins', () => {
    it('应该获取员工今日签到记录', async () => {
      const employeeId = 33;
      mock.onGet(new RegExp(`${BASE_PATH}/checkin/today`)).reply(200, {
        success: true,
        code: 200,
        message: '成功',
        data: [
          { id: 1, batchId: 101, employeeId: 33, status: 'working', checkInTime: '2026-02-13T08:00:00Z' },
        ],
      });

      const result = await workReportingApiClient.getTodayCheckins(employeeId);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });
  });

  // ========== getSchema ==========
  describe('getSchema', () => {
    it('应该获取报工schema模板', async () => {
      const expectedResponse = {
        success: true,
        code: 200,
        message: '成功',
        data: {
          id: 'tpl_1',
          name: '生产进度报工模板',
          entityType: 'PRODUCTION_PROGRESS_REPORT',
          schemaJson: JSON.stringify({
            fields: [
              { key: 'processCategory', label: '生产类目', type: 'text', required: true },
            ],
          }),
          isActive: true,
          version: 1,
        },
      };

      mock.onGet(`${BASE_PATH}/schemas/PRODUCTION_PROGRESS_REPORT`).reply(200, expectedResponse);

      const result = await workReportingApiClient.getSchema('PRODUCTION_PROGRESS_REPORT');

      expect(result.success).toBe(true);
      expect(result.data.entityType).toBe('PRODUCTION_PROGRESS_REPORT');
      const schema = JSON.parse(result.data.schemaJson);
      expect(schema.fields).toHaveLength(1);
      expect(schema.fields[0].key).toBe('processCategory');
    });

    it('不存在的schema应返回404', async () => {
      mock.onGet(/\/schemas\//).reply(404, {
        success: false,
        message: '模板不存在',
        code: 'NOT_FOUND',
      });

      await expect(
        workReportingApiClient.getSchema('NON_EXISTENT')
      ).rejects.toThrow();
    });
  });

  // ========== 错误处理 ==========
  describe('错误处理', () => {
    it('401未授权应抛出错误', async () => {
      mock.onGet(`${BASE_PATH}/reports`).reply(401, {
        success: false,
        message: 'Token过期',
        code: 'UNAUTHORIZED',
      });

      await expect(
        workReportingApiClient.getReports()
      ).rejects.toThrow();
    });

    it('500服务器错误应抛出错误', async () => {
      mock.onPost(`${BASE_PATH}/checkin`).reply(500, {
        success: false,
        message: '服务器内部错误',
      });

      await expect(
        workReportingApiClient.checkin({
          batchId: 101,
          employeeId: 33,
          checkinMethod: 'QR',
        })
      ).rejects.toThrow();
    });

    it('网络超时应抛出错误', async () => {
      mock.onGet(`${BASE_PATH}/reports`).timeout();

      await expect(
        workReportingApiClient.getReports()
      ).rejects.toThrow();
    });

    it('网络断开应抛出错误', async () => {
      mock.onGet(`${BASE_PATH}/reports`).networkError();

      await expect(
        workReportingApiClient.getReports()
      ).rejects.toThrow();
    });
  });

  // ========== getReport (单条) ==========
  describe('getReport', () => {
    it('应该获取单条报工详情', async () => {
      const reportId = 1;
      mock.onGet(`${BASE_PATH}/reports/${reportId}`).reply(200, {
        success: true,
        code: 200,
        message: '成功',
        data: {
          id: 1,
          reportType: 'PROGRESS',
          processCategory: '切割',
          outputQuantity: 100,
          status: 'SUBMITTED',
        },
      });

      const result = await workReportingApiClient.getReport(reportId);
      expect(result.success).toBe(true);
      expect(result.data.id).toBe(1);
    });
  });

  // ========== approveReport ==========
  describe('approveReport', () => {
    it('应该审批通过报工', async () => {
      const reportId = 1;
      mock.onPost(`${BASE_PATH}/reports/${reportId}/approve?approved=true`).reply(200, {
        success: true,
        code: 200,
        message: '审批成功',
        data: {
          id: 1,
          status: 'APPROVED',
        },
      });

      const result = await workReportingApiClient.approveReport(reportId, true);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('APPROVED');
    });

    it('应该拒绝报工', async () => {
      const reportId = 1;
      mock.onPost(`${BASE_PATH}/reports/${reportId}/approve?approved=false`).reply(200, {
        success: true,
        code: 200,
        message: '已拒绝',
        data: {
          id: 1,
          status: 'REJECTED',
        },
      });

      const result = await workReportingApiClient.approveReport(reportId, false);
      expect(result.success).toBe(true);
      expect(result.data.status).toBe('REJECTED');
    });
  });

  // ========== getSummary ==========
  describe('getSummary', () => {
    it('应该获取报工统计', async () => {
      mock.onGet(`${BASE_PATH}/summary`).reply(200, {
        success: true,
        code: 200,
        message: '成功',
        data: {
          totalReports: 50,
          approvedCount: 40,
          pendingCount: 10,
        },
      });

      const result = await workReportingApiClient.getSummary();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('totalReports', 50);
    });
  });
});
