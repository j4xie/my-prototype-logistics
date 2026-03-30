// @ts-nocheck
import MockAdapter from 'axios-mock-adapter';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import {
  getScaleDevices,
  getScaleDevice,
  createScaleDevice,
  updateScaleDevice,
  deleteScaleDevice,
  bindProtocol,
  testParse,
  getProtocols,
  getProtocol,
  createProtocol,
  updateProtocol,
  deleteProtocol,
  getBrandModels,
  getBrands,
} from '../../../services/api/scaleApiClient';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
// Actual paths from source:
// - Devices: /api/mobile/{factoryId}/scale-devices
// - Protocols: /api/mobile/scale-protocols  (no factoryId!)
// - Brand models: /api/mobile/scale-protocols/brand-models
// - Brands: /api/mobile/scale-protocols/brands
const DEVICES_BASE = `/api/mobile/${DEFAULT_FACTORY_ID}/scale-devices`;
const PROTOCOLS_BASE = '/api/mobile/scale-protocols';
const BRAND_MODELS_BASE = '/api/mobile/scale-protocols/brand-models';

let mock: MockAdapter;

beforeEach(() => {
  mock = createApiMock();
});

afterEach(() => {
  resetApiMock(mock);
});

describe('scaleApiClient', () => {
  // ---- Scale Devices ----

  describe('getScaleDevices', () => {
    it('should GET /scale-devices and return paginated data', async () => {
      // getScaleDevices returns { content, totalElements, totalPages }
      mock.onGet(DEVICES_BASE).reply(200, {
        success: true,
        data: { content: [{ id: 1, equipmentName: 'Scale A', status: 'ACTIVE' }], totalElements: 1, totalPages: 1 },
        message: 'ok',
      });

      const result = await getScaleDevices();
      expect(result.content).toHaveLength(1);
      expect(result.content[0].id).toBe(1);
      expect(result.totalElements).toBe(1);
    });

    it('should return empty content when no devices', async () => {
      mock.onGet(DEVICES_BASE).reply(200, {
        success: true,
        data: { content: [], totalElements: 0, totalPages: 0 },
        message: 'ok',
      });

      const result = await getScaleDevices();
      expect(result.content).toHaveLength(0);
    });
  });

  describe('getScaleDevice', () => {
    it('should GET /scale-devices/{id} and return data', async () => {
      // getScaleDevice takes a number
      mock.onGet(`${DEVICES_BASE}/1`).reply(200, {
        success: true,
        data: { id: 1, equipmentName: 'Scale A', model: 'GX-200' },
        message: 'ok',
      });

      const result = await getScaleDevice(1);
      expect(result.id).toBe(1);
      expect(result.model).toBe('GX-200');
    });
  });

  describe('createScaleDevice', () => {
    it('should POST /scale-devices and return created device', async () => {
      const data = { equipmentName: 'Scale B', equipmentCode: 'SC-002' };
      mock.onPost(DEVICES_BASE).reply(200, {
        success: true,
        data: { id: 2, ...data, status: 'ACTIVE' },
        message: 'Created',
      });

      const result = await createScaleDevice(data);
      expect(result.id).toBe(2);
      expect(result.equipmentName).toBe('Scale B');
    });
  });

  describe('updateScaleDevice', () => {
    it('should PUT /scale-devices/{id} and return updated device', async () => {
      // updateScaleDevice takes (number, request)
      const data = { equipmentName: 'Scale A Updated' };
      mock.onPut(`${DEVICES_BASE}/1`).reply(200, {
        success: true,
        data: { id: 1, equipmentName: 'Scale A Updated' },
        message: 'Updated',
      });

      const result = await updateScaleDevice(1, data);
      expect(result.equipmentName).toBe('Scale A Updated');
    });
  });

  describe('deleteScaleDevice', () => {
    it('should DELETE /scale-devices/{id}', async () => {
      // deleteScaleDevice takes a number, returns void
      mock.onDelete(`${DEVICES_BASE}/1`).reply(200, {
        success: true,
        data: null,
        message: 'Deleted',
      });

      await expect(deleteScaleDevice(1)).resolves.toBeUndefined();
    });
  });

  // ---- Protocol binding & testing ----

  describe('bindProtocol', () => {
    it('should bind protocol to device', async () => {
      // bindProtocol(equipmentId: number, protocolId: string, connectionParams?)
      mock.onPost(`${DEVICES_BASE}/1/bind-protocol`).reply(200, {
        success: true,
        data: { id: 1, scaleProtocolId: 'p1' },
        message: 'Bound',
      });

      const result = await bindProtocol(1, 'p1');
      expect(result.scaleProtocolId).toBe('p1');
    });
  });

  describe('testParse', () => {
    it('should test protocol parsing', async () => {
      // testParse(protocolId, rawDataHex) POSTs to /scale-devices/test-parse
      mock.onPost(`${DEVICES_BASE}/test-parse`).reply(200, {
        success: true,
        data: { success: true, parseResult: { weight: 25.5, unit: 'kg' } },
        message: 'ok',
      });

      const result = await testParse('p1', '48454C4C4F');
      expect(result.success).toBe(true);
    });
  });

  // ---- Protocols ----

  describe('getProtocols', () => {
    it('should GET /scale-protocols and return data', async () => {
      // Protocols path has no factoryId
      mock.onGet(PROTOCOLS_BASE).reply(200, {
        success: true,
        data: [{ id: 'p1', protocolName: 'Standard Protocol', connectionType: 'RS232' }],
        message: 'ok',
      });

      const result = await getProtocols();
      expect(result).toHaveLength(1);
      expect(result[0].protocolName).toBe('Standard Protocol');
    });
  });

  describe('getProtocol', () => {
    it('should GET /scale-protocols/{id}', async () => {
      mock.onGet(`${PROTOCOLS_BASE}/p1`).reply(200, {
        success: true,
        data: { id: 'p1', protocolName: 'Standard Protocol' },
        message: 'ok',
      });

      const result = await getProtocol('p1');
      expect(result.id).toBe('p1');
    });
  });

  describe('createProtocol', () => {
    it('should POST /scale-protocols', async () => {
      const data = { protocolName: 'Custom Protocol', connectionType: 'RS485', frameFormat: 'HEX' };
      mock.onPost(PROTOCOLS_BASE).reply(200, {
        success: true,
        data: { id: 'p2', ...data },
        message: 'Created',
      });

      const result = await createProtocol(data);
      expect(result.id).toBe('p2');
    });
  });

  describe('updateProtocol', () => {
    it('should PUT /scale-protocols/{id}', async () => {
      const data = { protocolName: 'Updated Protocol' };
      mock.onPut(`${PROTOCOLS_BASE}/p1`).reply(200, {
        success: true,
        data: { id: 'p1', protocolName: 'Updated Protocol' },
        message: 'Updated',
      });

      const result = await updateProtocol('p1', data);
      expect(result.protocolName).toBe('Updated Protocol');
    });
  });

  describe('deleteProtocol', () => {
    it('should DELETE /scale-protocols/{id}', async () => {
      // deleteProtocol returns void
      mock.onDelete(`${PROTOCOLS_BASE}/p1`).reply(200, {
        success: true,
        data: null,
        message: 'Deleted',
      });

      await expect(deleteProtocol('p1')).resolves.toBeUndefined();
    });
  });

  // ---- Brand models ----

  describe('getBrandModels', () => {
    it('should GET /scale-protocols/brand-models', async () => {
      mock.onGet(BRAND_MODELS_BASE).reply(200, {
        success: true,
        data: [{ id: 'bm1', brandCode: 'AND', brandName: 'A&D', modelCode: 'GX-200' }],
        message: 'ok',
      });

      const result = await getBrandModels();
      expect(result).toHaveLength(1);
      expect(result[0].brandCode).toBe('AND');
    });
  });

  describe('getBrands', () => {
    it('should GET /scale-protocols/brands', async () => {
      // getBrands returns BrandInfo[] (objects with brandCode, brandName)
      mock.onGet(`${PROTOCOLS_BASE}/brands`).reply(200, {
        success: true,
        data: [
          { brandCode: 'AND', brandName: 'A&D' },
          { brandCode: 'METTLER', brandName: 'Mettler Toledo' },
          { brandCode: 'SARTORIUS', brandName: 'Sartorius' },
        ],
        message: 'ok',
      });

      const result = await getBrands();
      expect(result).toHaveLength(3);
      expect(result[0].brandCode).toBe('AND');
    });
  });

  // ---- Error handling ----

  describe('error handling', () => {
    it('should propagate network errors on device list', async () => {
      mock.onGet(DEVICES_BASE).networkError();
      await expect(getScaleDevices()).rejects.toThrow();
    });

    it('should propagate 404 for non-existent device', async () => {
      mock.onGet(`${DEVICES_BASE}/999`).reply(404, {
        success: false,
        data: null,
        message: 'Device not found',
      });

      await expect(getScaleDevice(999)).rejects.toThrow();
    });

    it('should propagate 500 errors on protocol creation', async () => {
      mock.onPost(PROTOCOLS_BASE).reply(500, {
        success: false,
        data: null,
        message: 'Internal Server Error',
      });

      await expect(createProtocol({ protocolName: 'Bad' })).rejects.toThrow();
    });
  });
});
