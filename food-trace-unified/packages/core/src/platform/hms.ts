// 华为HMS服务平台适配层
import { logger } from './logger';

// HMS服务接口定义
export interface HMSServices {
  push: HMSPushService;
  analytics: HMSAnalyticsService;
  account: HMSAccountService;
  map: HMSMapService;
}

// HMS推送服务
export interface HMSPushService {
  initialize: () => Promise<void>;
  getToken: () => Promise<string>;
  subscribe: (topic: string) => Promise<void>;
  unsubscribe: (topic: string) => Promise<void>;
  onTokenReceived: (callback: (token: string) => void) => void;
  onMessageReceived: (callback: (message: any) => void) => void;
}

// HMS分析服务
export interface HMSAnalyticsService {
  initialize: () => Promise<void>;
  logEvent: (eventName: string, parameters?: Record<string, any>) => void;
  setUserId: (userId: string) => void;
  setUserProperty: (name: string, value: string) => void;
  logPageView: (pageName: string, pageClass?: string) => void;
}

// HMS账户服务
export interface HMSAccountService {
  initialize: () => Promise<void>;
  signIn: () => Promise<HMSAccountInfo>;
  signOut: () => Promise<void>;
  silentSignIn: () => Promise<HMSAccountInfo>;
  isSignedIn: () => Promise<boolean>;
}

export interface HMSAccountInfo {
  id: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
}

// HMS地图服务
export interface HMSMapService {
  initialize: () => Promise<void>;
  getCurrentLocation: () => Promise<HMSLocation>;
  getLocationName: (location: HMSLocation) => Promise<string>;
}

export interface HMSLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

// HMS服务实现类
class HMSServiceImpl implements HMSServices {
  public push: HMSPushService;
  public analytics: HMSAnalyticsService;
  public account: HMSAccountService;
  public map: HMSMapService;

  constructor() {
    this.push = new HMSPushServiceImpl();
    this.analytics = new HMSAnalyticsServiceImpl();
    this.account = new HMSAccountServiceImpl();
    this.map = new HMSMapServiceImpl();
  }

  async initialize(): Promise<void> {
    try {
      await Promise.all([
        this.push.initialize(),
        this.analytics.initialize(),
        this.account.initialize(),
        this.map.initialize(),
      ]);
      logger.info('HMS services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize HMS services:', error);
      throw error;
    }
  }
}

// HMS推送服务实现
class HMSPushServiceImpl implements HMSPushService {
  private tokenCallbacks: ((token: string) => void)[] = [];
  private messageCallbacks: ((message: any) => void)[] = [];

  async initialize(): Promise<void> {
    try {
      // 在真实环境中，这里会初始化HMS Push Kit
      // await HmsPushKit.initialize();
      logger.info('HMS Push service initialized');
    } catch (error) {
      logger.error('HMS Push initialization failed:', error);
      throw error;
    }
  }

  async getToken(): Promise<string> {
    try {
      // 在真实环境中，这里会获取HMS推送token
      // return await HmsPushKit.getToken();
      const mockToken = `hms_push_token_${Date.now()}`;
      logger.info('HMS Push token obtained:', mockToken);
      return mockToken;
    } catch (error) {
      logger.error('Failed to get HMS Push token:', error);
      throw error;
    }
  }

  async subscribe(topic: string): Promise<void> {
    try {
      // await HmsPushKit.subscribe(topic);
      logger.info(`Subscribed to HMS Push topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to subscribe to topic ${topic}:`, error);
      throw error;
    }
  }

  async unsubscribe(topic: string): Promise<void> {
    try {
      // await HmsPushKit.unsubscribe(topic);
      logger.info(`Unsubscribed from HMS Push topic: ${topic}`);
    } catch (error) {
      logger.error(`Failed to unsubscribe from topic ${topic}:`, error);
      throw error;
    }
  }

  onTokenReceived(callback: (token: string) => void): void {
    this.tokenCallbacks.push(callback);
  }

  onMessageReceived(callback: (message: any) => void): void {
    this.messageCallbacks.push(callback);
  }
}

// HMS分析服务实现
class HMSAnalyticsServiceImpl implements HMSAnalyticsService {
  async initialize(): Promise<void> {
    try {
      // await HmsAnalytics.initialize();
      logger.info('HMS Analytics service initialized');
    } catch (error) {
      logger.error('HMS Analytics initialization failed:', error);
      throw error;
    }
  }

  logEvent(eventName: string, parameters?: Record<string, any>): void {
    try {
      // HmsAnalytics.onEvent(eventName, parameters);
      logger.info(`HMS Analytics event: ${eventName}`, parameters);
    } catch (error) {
      logger.error(`Failed to log event ${eventName}:`, error);
    }
  }

  setUserId(userId: string): void {
    try {
      // HmsAnalytics.setUserId(userId);
      logger.info(`HMS Analytics user ID set: ${userId}`);
    } catch (error) {
      logger.error('Failed to set HMS Analytics user ID:', error);
    }
  }

  setUserProperty(name: string, value: string): void {
    try {
      // HmsAnalytics.setUserProfile(name, value);
      logger.info(`HMS Analytics user property: ${name} = ${value}`);
    } catch (error) {
      logger.error(`Failed to set user property ${name}:`, error);
    }
  }

  logPageView(pageName: string, pageClass?: string): void {
    try {
      const parameters = { page_name: pageName };
      if (pageClass) {
        parameters.page_class = pageClass;
      }
      this.logEvent('page_view', parameters);
    } catch (error) {
      logger.error(`Failed to log page view ${pageName}:`, error);
    }
  }
}

// HMS账户服务实现
class HMSAccountServiceImpl implements HMSAccountService {
  async initialize(): Promise<void> {
    try {
      // await HmsAccount.initialize();
      logger.info('HMS Account service initialized');
    } catch (error) {
      logger.error('HMS Account initialization failed:', error);
      throw error;
    }
  }

  async signIn(): Promise<HMSAccountInfo> {
    try {
      // const account = await HmsAccount.signIn();
      const mockAccount: HMSAccountInfo = {
        id: `hms_user_${Date.now()}`,
        displayName: '华为用户',
        email: 'user@huawei.com',
        avatarUrl: 'https://example.com/avatar.jpg'
      };
      logger.info('HMS Account sign in successful:', mockAccount);
      return mockAccount;
    } catch (error) {
      logger.error('HMS Account sign in failed:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      // await HmsAccount.signOut();
      logger.info('HMS Account sign out successful');
    } catch (error) {
      logger.error('HMS Account sign out failed:', error);
      throw error;
    }
  }

  async silentSignIn(): Promise<HMSAccountInfo> {
    try {
      // const account = await HmsAccount.silentSignIn();
      const mockAccount: HMSAccountInfo = {
        id: `hms_user_silent_${Date.now()}`,
        displayName: '华为用户',
        email: 'user@huawei.com'
      };
      logger.info('HMS Account silent sign in successful:', mockAccount);
      return mockAccount;
    } catch (error) {
      logger.error('HMS Account silent sign in failed:', error);
      throw error;
    }
  }

  async isSignedIn(): Promise<boolean> {
    try {
      // return await HmsAccount.isSignedIn();
      return false; // 模拟未登录状态
    } catch (error) {
      logger.error('Failed to check HMS Account sign in status:', error);
      return false;
    }
  }
}

// HMS地图服务实现
class HMSMapServiceImpl implements HMSMapService {
  async initialize(): Promise<void> {
    try {
      // await HmsMap.initialize();
      logger.info('HMS Map service initialized');
    } catch (error) {
      logger.error('HMS Map initialization failed:', error);
      throw error;
    }
  }

  async getCurrentLocation(): Promise<HMSLocation> {
    try {
      // const location = await HmsLocation.getCurrentLocation();
      const mockLocation: HMSLocation = {
        latitude: 39.9042,
        longitude: 116.4074,
        accuracy: 10
      };
      logger.info('HMS current location obtained:', mockLocation);
      return mockLocation;
    } catch (error) {
      logger.error('Failed to get current location:', error);
      throw error;
    }
  }

  async getLocationName(location: HMSLocation): Promise<string> {
    try {
      // const name = await HmsMap.getLocationName(location);
      const mockName = '北京市朝阳区';
      logger.info(`HMS location name: ${mockName}`);
      return mockName;
    } catch (error) {
      logger.error('Failed to get location name:', error);
      return '未知位置';
    }
  }
}

// 导入平台检测器
import { shouldUseHMSServices } from './detector';

// HMS服务单例
let hmsServices: HMSServiceImpl | null = null;

export const getHMSServices = (): HMSServices => {
  if (!hmsServices) {
    hmsServices = new HMSServiceImpl();
  }
  return hmsServices;
};

// 初始化HMS服务
export const initializeHMS = async (): Promise<void> => {
  const useHMS = await shouldUseHMSServices();
  if (useHMS) {
    try {
      const services = getHMSServices();
      await services.initialize();
      logger.info('HMS services are ready');
    } catch (error) {
      logger.error('HMS initialization failed, falling back to Google services:', error);
    }
  } else {
    logger.info('HMS not available or not needed, HMS services skipped');
  }
};

// HMS事件类型
export const HMS_EVENTS = {
  // 用户行为事件
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  USER_REGISTER: 'user_register',
  
  // 业务事件
  TRACE_SCAN: 'trace_scan',
  BATCH_CREATE: 'batch_create',
  QUALITY_CHECK: 'quality_check',
  
  // 页面事件
  PAGE_VIEW: 'page_view',
  BUTTON_CLICK: 'button_click',
  
  // 错误事件
  API_ERROR: 'api_error',
  CRASH: 'crash'
} as const;

// HMS分析事件记录器
export const logHMSEvent = async (eventName: string, parameters?: Record<string, any>): Promise<void> => {
  const useHMS = await shouldUseHMSServices();
  if (useHMS) {
    const services = getHMSServices();
    services.analytics.logEvent(eventName, parameters);
  }
};