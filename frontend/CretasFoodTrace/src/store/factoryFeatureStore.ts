import { create } from 'zustand';
import { apiClient } from '../services/api/apiClient';

/**
 * Maps screen IDs to their owning module IDs.
 * When a module's `enabled` flag is false, all its screens are automatically disabled.
 * Screen IDs here must match the strings passed to isScreenEnabled() in navigators/home screens.
 */
const SCREEN_TO_MODULE: Record<string, string> = {
  // Factory Admin tabs
  AIAnalysis: 'smartbi',
  Reports: 'production',
  SmartBI: 'smartbi',
  // Dispatcher tabs + home sections
  ProductionPlanning: 'scheduling',
  AISchedule: 'scheduling',
  PersonnelManagement: 'scheduling',
  AICompletionProb: 'scheduling',
  WorkshopStatus: 'scheduling',
  PersonnelTransfer: 'scheduling',
  AIWorkerOptimize: 'scheduling',
  // HR tabs + home sections
  AttendanceManagement: 'hr',
  WhitelistManagement: 'hr',
  NewHireTracking: 'hr',
  // Workshop Supervisor tabs + home sections
  BatchManagement: 'production',
  WorkerManagement: 'production',
  EquipmentMonitoring: 'equipment',
  ScheduleManagement: 'scheduling',
  // Warehouse tabs + home sections
  InboundManagement: 'warehouse',
  OutboundManagement: 'warehouse',
  InventoryCheck: 'warehouse',
  AlertHandling: 'warehouse',
  TempMonitoring: 'warehouse',
  // Quality Inspector tabs
  QualityInspection: 'quality',
  QualityAnalysis: 'quality',
  // SmartBI home feature list
  DataAnalysis: 'smartbi',
  ExcelUpload: 'smartbi',
  NLQuery: 'smartbi',
  // Processing dashboard
  CostAnalysisDashboard: 'finance',
  CostComparison: 'finance',
  AIReportList: 'production',
};

/** Maps report types to their owning module IDs. */
const REPORT_TO_MODULE: Record<string, string> = {
  production: 'production',
  quality: 'quality',
  efficiency: 'hr',
  cost: 'finance',
  personnel: 'hr',
};

interface ModuleConfig {
  enabled: boolean;
  moduleName: string;
  config: {
    analysisDimensions?: string[];
    disabledDimensions?: string[];
    benchmarks?: Record<string, any>;
    inputModes?: Record<string, string>;
    enabledStages?: string[];
    keyStages?: string[];
    quickActions?: string[];
    disabledScreens?: string[];
    disabledReports?: string[];
    priority?: number;
    quickActionOrder?: string[];
  };
  conversationSummary?: string;
}

interface FactoryFeatureState {
  modules: Record<string, ModuleConfig>;
  loaded: boolean;
  loading: boolean;

  loadFeatures: (factoryId: string) => Promise<void>;
  isModuleEnabled: (moduleId: string) => boolean;
  getModuleConfig: (moduleId: string) => ModuleConfig | null;
  getEnabledDimensions: () => string[];
  isScreenEnabled: (screenName: string) => boolean;
  isReportEnabled: (reportType: string) => boolean;
  getEnabledQuickActions: () => string[];
  getBenchmarks: () => Record<string, any>;
  getModulePriority: (moduleId: string) => number;
  getSortedModules: () => Array<{ moduleId: string; priority: number; moduleName: string }>;
  reset: () => void;
}

interface FeatureConfigResponse {
  id: number;
  factoryId: string;
  moduleId: string;
  moduleName: string;
  enabled: boolean;
  config: Record<string, any>;
  conversationSummary?: string;
}

export const useFactoryFeatureStore = create<FactoryFeatureState>((set, get) => ({
  modules: {},
  loaded: false,
  loading: false,

  loadFeatures: async (factoryId: string) => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const res = await apiClient.get<any>(`/api/mobile/${factoryId}/feature-config`);

      // Handle both wrapped {success,data} and direct array responses
      let items: any[] = [];
      if (Array.isArray(res)) {
        items = res;
      } else if (res?.success && Array.isArray(res.data)) {
        items = res.data;
      } else if (Array.isArray(res?.data)) {
        items = res.data;
      }

      const modules: Record<string, ModuleConfig> = {};
      for (const item of items) {
        if (item.moduleId) {
          modules[item.moduleId] = {
            enabled: item.enabled,
            moduleName: item.moduleName,
            config: item.config || {},
            conversationSummary: item.conversationSummary,
          };
        }
      }
      set({ modules, loaded: true });
    } catch (error: any) {
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  isModuleEnabled: (moduleId: string) => {
    const { modules, loaded } = get();
    // If no config loaded, assume all modules enabled (backwards compatible)
    if (!loaded || Object.keys(modules).length === 0) return true;
    const mod = modules[moduleId];
    return mod ? mod.enabled : true;
  },

  getModuleConfig: (moduleId: string) => {
    const { modules } = get();
    return modules[moduleId] || null;
  },

  getEnabledDimensions: () => {
    const { modules, loaded } = get();
    if (!loaded || Object.keys(modules).length === 0) {
      // Default dimensions when no config
      return ['conversionRate', 'laborCost', 'equipmentCost', 'materialCost', 'efficiency'];
    }
    const dims: string[] = [];
    for (const mod of Object.values(modules)) {
      if (mod.enabled && mod.config.analysisDimensions) {
        dims.push(...mod.config.analysisDimensions);
      }
    }
    return [...new Set(dims)];
  },

  isScreenEnabled: (screenName: string) => {
    const { modules, loaded } = get();
    if (!loaded || Object.keys(modules).length === 0) return true;

    // Check if owning module is disabled (enabled=false toggle from Web Admin)
    const owningModuleId = SCREEN_TO_MODULE[screenName];
    if (owningModuleId) {
      const owningModule = modules[owningModuleId];
      if (owningModule && !owningModule.enabled) return false;
    }

    // Check per-screen disabledScreens list
    for (const mod of Object.values(modules)) {
      if (mod.config.disabledScreens?.includes(screenName)) {
        return false;
      }
    }
    return true;
  },

  isReportEnabled: (reportType: string) => {
    const { modules, loaded } = get();
    if (!loaded || Object.keys(modules).length === 0) return true;

    // Check if owning module is disabled
    const owningModuleId = REPORT_TO_MODULE[reportType];
    if (owningModuleId) {
      const owningModule = modules[owningModuleId];
      if (owningModule && !owningModule.enabled) return false;
    }

    // Check per-report disabledReports list
    for (const mod of Object.values(modules)) {
      if (mod.config.disabledReports?.includes(reportType)) {
        return false;
      }
    }
    return true;
  },

  getEnabledQuickActions: () => {
    const { modules, loaded } = get();
    if (!loaded || Object.keys(modules).length === 0) return [];
    const actions: string[] = [];
    for (const mod of Object.values(modules)) {
      if (mod.enabled && mod.config.quickActions) {
        actions.push(...mod.config.quickActions);
      }
    }
    return [...new Set(actions)];
  },

  getBenchmarks: () => {
    const { modules } = get();
    const all: Record<string, any> = {};
    for (const mod of Object.values(modules)) {
      if (mod.config.benchmarks) {
        Object.assign(all, mod.config.benchmarks);
      }
    }
    return all;
  },

  getModulePriority: (moduleId: string) => {
    const { modules } = get();
    return modules[moduleId]?.config?.priority ?? 5;
  },

  getSortedModules: () => {
    const { modules } = get();
    return Object.entries(modules)
      .filter(([_, m]) => m.enabled)
      .map(([id, m]) => ({
        moduleId: id,
        priority: m.config?.priority ?? 5,
        moduleName: m.moduleName,
      }))
      .sort((a, b) => b.priority - a.priority);
  },

  reset: () => set({ modules: {}, loaded: false, loading: false }),
}));
