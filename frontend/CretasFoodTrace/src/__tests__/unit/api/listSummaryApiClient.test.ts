/**
 * Sprint 2 Track I — listSummaryApiClient unit tests.
 * Verifies POST path shape + envelope passthrough for 5 supported entity types.
 */
// @ts-nocheck
import { listSummaryApiClient } from '../../../services/api/listSummaryApiClient';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const FACTORY_ID = 'CRETAS_2024_001';

describe('listSummaryApiClient', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = createApiMock();
  });

  afterEach(() => {
    resetApiMock(mock);
  });

  it.each([
    'salesOrder',
    'purchaseOrder',
    'inventory',
    'wastage',
    'attendance',
  ])('POSTs to /list-summary/%s with request body', async (entityType) => {
    const expectedPath = `/api/mobile/${FACTORY_ID}/list-summary/${entityType}`;
    mock.onPost(expectedPath).reply(200, {
      success: true,
      data: { entityType, stats: [{ label: '共', value: 5, format: 'number' }] },
    });

    const result = await listSummaryApiClient.getSummary(
      entityType,
      { filterConditions: { status: 'APPROVED' } },
      FACTORY_ID,
    );

    expect(result.success).toBe(true);
    expect(result.data.entityType).toBe(entityType);
    expect(result.data.stats).toHaveLength(1);
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe(expectedPath);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      filterConditions: { status: 'APPROVED' },
    });
  });

  it('passes through dateFrom/dateTo/fields', async () => {
    const path = `/api/mobile/${FACTORY_ID}/list-summary/salesOrder`;
    mock.onPost(path).reply(200, { success: true, data: { entityType: 'salesOrder', stats: [] } });

    await listSummaryApiClient.getSummary(
      'salesOrder',
      {
        dateFrom: '2026-05-01',
        dateTo: '2026-05-15',
        fields: ['totalAmount', 'totalQty'],
      },
      FACTORY_ID,
    );

    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-15',
      fields: ['totalAmount', 'totalQty'],
    });
  });

  it('propagates server-side success=false', async () => {
    const path = `/api/mobile/${FACTORY_ID}/list-summary/salesOrder`;
    mock.onPost(path).reply(200, {
      success: false,
      data: null,
      message: 'Filter invalid',
      code: 'INVALID_FILTER',
    });

    const result = await listSummaryApiClient.getSummary('salesOrder', {}, FACTORY_ID);
    expect(result.success).toBe(false);
    expect(result.message).toBe('Filter invalid');
  });
});
