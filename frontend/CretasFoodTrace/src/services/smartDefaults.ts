import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  lastProduct: '@cretas/lastProduct',
  lastQuantity: '@cretas/lastQuantity',
  lastMaterial: '@cretas/lastMaterial',
  audioFeedback: '@cretas/audioFeedback',
};

export const smartDefaults = {
  getDefaultShift(): string {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return '早班';
    if (hour >= 14 && hour < 22) return '中班';
    return '夜班';
  },

  getDefaultDate(): string {
    return new Date().toISOString().split('T')[0] as string;
  },

  getMostLikelyAction(): string {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 14) return 'report';
    if (hour >= 14 && hour < 18) return 'inventory';
    return 'report';
  },

  async getLastProduct(): Promise<{ label: string; value: string; unit?: string } | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.lastProduct);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async saveLastProduct(product: { label: string; value: string; unit?: string }): Promise<void> {
    try { await AsyncStorage.setItem(KEYS.lastProduct, JSON.stringify(product)); } catch {}
  },

  async getLastQuantity(): Promise<string | null> {
    try { return await AsyncStorage.getItem(KEYS.lastQuantity); } catch { return null; }
  },

  async saveLastQuantity(qty: string): Promise<void> {
    try { await AsyncStorage.setItem(KEYS.lastQuantity, qty); } catch {}
  },

  async getLastMaterial(): Promise<{ label: string; value: string; unit?: string } | null> {
    try {
      const raw = await AsyncStorage.getItem(KEYS.lastMaterial);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  },

  async saveLastMaterial(material: { label: string; value: string; unit?: string }): Promise<void> {
    try { await AsyncStorage.setItem(KEYS.lastMaterial, JSON.stringify(material)); } catch {}
  },

  async getAudioFeedbackEnabled(): Promise<boolean | null> {
    try {
      const val = await AsyncStorage.getItem(KEYS.audioFeedback);
      return val !== null ? val === 'true' : null;
    } catch { return null; }
  },

  async setAudioFeedbackEnabled(enabled: boolean): Promise<void> {
    try { await AsyncStorage.setItem(KEYS.audioFeedback, String(enabled)); } catch {}
  },
};
