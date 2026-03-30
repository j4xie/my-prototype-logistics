// @ts-nocheck
import { useFactoryFeatureStore } from '../../../store/factoryFeatureStore';
import { createApiMock, resetApiMock } from '../../utils/mockApiClient';
import MockAdapter from 'axios-mock-adapter';

const DEFAULT_FACTORY_ID = 'CRETAS_2024_001';
const FEATURE_URL = `/api/mobile/${DEFAULT_FACTORY_ID}/feature-config`;

let mock: MockAdapter;

beforeEach(() => {
  mock = createApiMock();
  useFactoryFeatureStore.setState({ modules: {}, loaded: false, loading: false });
});

afterEach(() => {
  resetApiMock(mock);
});

const sampleModules = [
  {
    moduleId: 'production',
    enabled: true,
    moduleName: 'Production',
    config: {
      analysisDimensions: ['product', 'line'],
      disabledScreens: ['OldScreen'],
      disabledReports: ['OldReport'],
      quickActions: ['action1'],
      benchmarks: { yield: 0.95 },
      priority: 3,
      mode: 'PROCESS',
    },
  },
  {
    moduleId: 'warehouse',
    enabled: false,
    moduleName: 'Warehouse',
    config: {
      analysisDimensions: ['location'],
      disabledScreens: [],
      disabledReports: [],
      quickActions: ['action2'],
      benchmarks: {},
      priority: 7,
    },
  },
  {
    moduleId: 'quality',
    enabled: true,
    moduleName: 'Quality',
    config: {
      analysisDimensions: ['product'],
      disabledScreens: [],
      disabledReports: ['QReport'],
      quickActions: [],
      benchmarks: { defect: 0.02 },
      priority: 1,
    },
  },
];

describe('factoryFeatureStore', () => {
  describe('loadFeatures', () => {
    it('loads from direct array response', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      const state = useFactoryFeatureStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.loading).toBe(false);
      expect(state.modules['production']).toBeDefined();
    });

    it('loads from wrapped {success, data} response', async () => {
      mock.onGet(FEATURE_URL).reply(200, { success: true, data: sampleModules });
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().modules['production']).toBeDefined();
      expect(useFactoryFeatureStore.getState().loaded).toBe(true);
    });

    it('loads from {data} response', async () => {
      mock.onGet(FEATURE_URL).reply(200, { data: sampleModules });
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().modules['production']).toBeDefined();
    });

    it('sets loading during fetch', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      const promise = useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().loading).toBe(true);
      await promise;
      expect(useFactoryFeatureStore.getState().loading).toBe(false);
    });

    it('skips concurrent load when already loading', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      useFactoryFeatureStore.setState({ loading: true });
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      // Should not have made the request since loading was true
      expect(mock.history.get.length).toBe(0);
    });

    it('handles error gracefully', async () => {
      mock.onGet(FEATURE_URL).reply(500);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      const state = useFactoryFeatureStore.getState();
      expect(state.loaded).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('handles network error gracefully', async () => {
      mock.onGet(FEATURE_URL).networkError();
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().loaded).toBe(true);
    });
  });

  describe('isModuleEnabled', () => {
    it('returns true when not loaded (backwards compat)', () => {
      expect(useFactoryFeatureStore.getState().isModuleEnabled('production')).toBe(true);
    });

    it('returns true for enabled module', () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      return useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID).then(() => {
        expect(useFactoryFeatureStore.getState().isModuleEnabled('production')).toBe(true);
      });
    });

    it('returns false for disabled module', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().isModuleEnabled('warehouse')).toBe(false);
    });

    it('returns true for unknown module', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().isModuleEnabled('unknown_module')).toBe(true);
    });
  });

  describe('isScreenEnabled', () => {
    beforeEach(async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
    });

    it('returns false when module is disabled', () => {
      // 'InboundManagement' maps to 'warehouse' which is disabled
      expect(useFactoryFeatureStore.getState().isScreenEnabled('InboundManagement')).toBe(false);
    });

    it('returns false when screen is in disabledScreens', () => {
      // 'OldScreen' is in production's config.disabledScreens
      expect(useFactoryFeatureStore.getState().isScreenEnabled('OldScreen')).toBe(false);
    });

    it('returns true for normal enabled screen', () => {
      // 'BatchManagement' maps to 'production' which is enabled and not in disabledScreens
      expect(useFactoryFeatureStore.getState().isScreenEnabled('BatchManagement')).toBe(true);
    });

    it('returns true when not loaded', () => {
      useFactoryFeatureStore.setState({ modules: {}, loaded: false, loading: false });
      expect(useFactoryFeatureStore.getState().isScreenEnabled('AnyScreen')).toBe(true);
    });
  });

  describe('isReportEnabled', () => {
    beforeEach(async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
    });

    it('returns false when report is in disabledReports', () => {
      // 'QReport' is in quality's config.disabledReports
      expect(useFactoryFeatureStore.getState().isReportEnabled('QReport')).toBe(false);
    });

    it('returns true for normal enabled report', () => {
      // 'production' maps to 'production' module which is enabled
      expect(useFactoryFeatureStore.getState().isReportEnabled('production')).toBe(true);
    });

    it('returns true when not loaded', () => {
      useFactoryFeatureStore.setState({ modules: {}, loaded: false, loading: false });
      expect(useFactoryFeatureStore.getState().isReportEnabled('production')).toBe(true);
    });
  });

  describe('getEnabledDimensions', () => {
    it('returns deduplicated dimensions from enabled modules', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      const dims = useFactoryFeatureStore.getState().getEnabledDimensions();
      expect(dims).toContain('product');
      expect(dims).toContain('line');
      // warehouse is disabled, so 'location' should not be included
      expect(dims).not.toContain('location');
    });

    it('returns default when not loaded', () => {
      const dims = useFactoryFeatureStore.getState().getEnabledDimensions();
      expect(Array.isArray(dims)).toBe(true);
    });
  });

  describe('getEnabledQuickActions', () => {
    it('returns quick actions from enabled modules only', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      const actions = useFactoryFeatureStore.getState().getEnabledQuickActions();
      expect(actions).toContain('action1');
      // warehouse disabled, action2 should not be included
      expect(actions).not.toContain('action2');
    });
  });

  describe('getBenchmarks', () => {
    it('returns merged benchmarks from enabled modules', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      const benchmarks = useFactoryFeatureStore.getState().getBenchmarks();
      expect(benchmarks.yield).toBe(0.95);
      expect(benchmarks.defect).toBe(0.02);
    });
  });

  describe('getModulePriority', () => {
    it('returns configured priority', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().getModulePriority('production')).toBe(3);
    });

    it('returns default 5 for unknown module', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().getModulePriority('unknown')).toBe(5);
    });
  });

  describe('getSortedModules', () => {
    it('returns modules sorted by priority', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      const sorted = useFactoryFeatureStore.getState().getSortedModules();
      expect(sorted.length).toBeGreaterThan(0);
      // Sort is descending by priority: production (3) before quality (1). warehouse disabled, excluded.
      const ids = sorted.map((m: any) => m.moduleId);
      expect(ids.indexOf('production')).toBeLessThan(ids.indexOf('quality'));
    });
  });

  describe('getProductionMode', () => {
    it('returns configured production mode', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().getProductionMode()).toBe('PROCESS');
    });

    it('returns BATCH as default', () => {
      expect(useFactoryFeatureStore.getState().getProductionMode()).toBe('BATCH');
    });
  });

  describe('isProcessMode', () => {
    it('returns true when production mode is PROCESS', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      expect(useFactoryFeatureStore.getState().isProcessMode()).toBe(true);
    });

    it('returns false when default BATCH', () => {
      expect(useFactoryFeatureStore.getState().isProcessMode()).toBe(false);
    });
  });

  describe('reset', () => {
    it('resets all state', async () => {
      mock.onGet(FEATURE_URL).reply(200, sampleModules);
      await useFactoryFeatureStore.getState().loadFeatures(DEFAULT_FACTORY_ID);
      useFactoryFeatureStore.getState().reset();
      const state = useFactoryFeatureStore.getState();
      expect(state.modules).toEqual({});
      expect(state.loaded).toBe(false);
      expect(state.loading).toBe(false);
    });
  });
});
