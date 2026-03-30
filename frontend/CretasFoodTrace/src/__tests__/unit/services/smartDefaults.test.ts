/**
 * smartDefaults 单元测试
 */

describe('smartDefaults', () => {
  function mockHour(hour: number): void {
    const mockDate = new Date(2026, 2, 19, hour, 30, 0);
    jest.spyOn(global, 'Date').mockImplementation(() => mockDate as unknown as Date);
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Time-based tests — import once, no AsyncStorage dependency
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { smartDefaults } = require('../../../services/smartDefaults');

  describe('getDefaultShift', () => {
    it.each([
      [8, '早班'], [6, '早班'], [13, '早班'],
      [16, '中班'], [14, '中班'], [21, '中班'],
      [3, '夜班'], [22, '夜班'], [0, '夜班'],
    ])('hour %i → %s', (hour, expected) => {
      mockHour(hour);
      expect(smartDefaults.getDefaultShift()).toBe(expected);
    });
  });

  describe('getDefaultDate', () => {
    it('returns YYYY-MM-DD format', () => {
      expect(smartDefaults.getDefaultDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getMostLikelyAction', () => {
    it.each([
      [10, 'report'], [6, 'report'],
      [15, 'inventory'], [17, 'inventory'],
      [20, 'report'], [4, 'report'],
    ])('hour %i → %s', (hour, expected) => {
      mockHour(hour);
      expect(smartDefaults.getMostLikelyAction()).toBe(expected);
    });
  });

  describe('AsyncStorage round-trip', () => {
    let sd: typeof smartDefaults;
    const store: Record<string, string> = {};

    beforeEach(() => {
      Object.keys(store).forEach(k => delete store[k]);
      // Reset modules to get fresh imports with our mock bindings intact
      jest.resetModules();
      // Re-mock AsyncStorage with a fresh controllable store
      jest.doMock('@react-native-async-storage/async-storage', () => ({
        __esModule: true,
        default: {
          getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
          setItem: jest.fn((key: string, value: string) => { store[key] = value; return Promise.resolve(); }),
          removeItem: jest.fn((key: string) => { delete store[key]; return Promise.resolve(); }),
        },
      }));
      // Re-require smartDefaults so it picks up the fresh mock
      sd = require('../../../services/smartDefaults').smartDefaults;
    });

    it('saveLastProduct + getLastProduct round-trips', async () => {
      const product = { label: '豆腐', value: 'P001', unit: 'kg' };
      await sd.saveLastProduct(product);
      const result = await sd.getLastProduct();
      expect(result).toEqual(product);
    });

    it('saveLastQuantity + getLastQuantity round-trips', async () => {
      await sd.saveLastQuantity('500');
      const result = await sd.getLastQuantity();
      expect(result).toBe('500');
    });

    it('saveLastMaterial + getLastMaterial round-trips', async () => {
      const material = { label: '面粉', value: 'M001', unit: 'kg' };
      await sd.saveLastMaterial(material);
      const result = await sd.getLastMaterial();
      expect(result).toEqual(material);
    });

    it('setAudioFeedbackEnabled(true) + get returns true', async () => {
      await sd.setAudioFeedbackEnabled(true);
      const result = await sd.getAudioFeedbackEnabled();
      expect(result).toBe(true);
    });

    it('setAudioFeedbackEnabled(false) + get returns false', async () => {
      await sd.setAudioFeedbackEnabled(false);
      const result = await sd.getAudioFeedbackEnabled();
      expect(result).toBe(false);
    });
  });
});
