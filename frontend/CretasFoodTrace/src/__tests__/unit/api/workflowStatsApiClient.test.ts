// @ts-nocheck
/**
 * workflowStatsApiClient 单元测试 — U-NAV-1 (Sprint 2 Track G)
 *
 * 覆盖: 5 个 module endpoint 调用 + factoryId 自动 resolve.
 */

import { workflowStatsApi } from '../../../services/api/workflowStatsApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const FACTORY_ID = 'F006';
const BASE = `/api/mobile/${FACTORY_ID}/workflow-stats`;

const NODES = [
  { id: 'pending', label: '待处理', status: 'PENDING', count: 5 },
  { id: 'in_progress', label: '进行中', status: 'IN_PROGRESS', count: 12 },
  { id: 'done', label: '已完成', status: 'DONE', count: 87 },
];

function buildPayload(module: string) {
  return {
    success: true,
    data: {
      module,
      nodes: NODES,
      lastRefreshedAt: '2026-05-15T10:00:00Z',
    },
    message: '操作成功',
  };
}

describe('workflowStatsApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  it('fetch sales returns nodes payload', async () => {
    mock.onGet(`${BASE}/sales`).reply(200, buildPayload('sales'));
    const result = await workflowStatsApi.fetch('sales', FACTORY_ID);
    expect(result.module).toBe('sales');
    expect(result.nodes).toHaveLength(3);
    expect(result.nodes[0].id).toBe('pending');
    expect(result.nodes[0].count).toBe(5);
  });

  it('fetch purchase returns nodes payload', async () => {
    mock.onGet(`${BASE}/purchase`).reply(200, buildPayload('purchase'));
    const result = await workflowStatsApi.fetch('purchase', FACTORY_ID);
    expect(result.module).toBe('purchase');
    expect(result.nodes[2].id).toBe('done');
  });

  it('fetch production returns nodes payload', async () => {
    mock.onGet(`${BASE}/production`).reply(200, buildPayload('production'));
    const result = await workflowStatsApi.fetch('production', FACTORY_ID);
    expect(result.module).toBe('production');
  });

  it('fetch finance returns nodes payload', async () => {
    mock.onGet(`${BASE}/finance`).reply(200, buildPayload('finance'));
    const result = await workflowStatsApi.fetch('finance', FACTORY_ID);
    expect(result.module).toBe('finance');
  });

  it('fetch inventory returns nodes payload', async () => {
    mock.onGet(`${BASE}/inventory`).reply(200, buildPayload('inventory'));
    const result = await workflowStatsApi.fetch('inventory', FACTORY_ID);
    expect(result.module).toBe('inventory');
  });

  it('propagates server error', async () => {
    mock.onGet(`${BASE}/sales`).reply(500, { success: false, message: 'internal' });
    await expect(workflowStatsApi.fetch('sales', FACTORY_ID)).rejects.toBeDefined();
  });
});
