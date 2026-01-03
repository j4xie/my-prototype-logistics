/**
 * i18n 资源文件导入
 * 集中管理所有翻译文件
 */

// ========== zh-CN 中文资源 ==========
import zhCommon from './locales/zh-CN/common.json';
import zhAuth from './locales/zh-CN/auth.json';
import zhHome from './locales/zh-CN/home.json';
import zhProfile from './locales/zh-CN/profile.json';
import zhProcessing from './locales/zh-CN/processing.json';
import zhManagement from './locales/zh-CN/management.json';
import zhWarehouse from './locales/zh-CN/warehouse.json';
import zhHr from './locales/zh-CN/hr.json';
import zhDispatcher from './locales/zh-CN/dispatcher.json';
import zhQuality from './locales/zh-CN/quality.json';
import zhReports from './locales/zh-CN/reports.json';
import zhAlerts from './locales/zh-CN/alerts.json';
import zhErrors from './locales/zh-CN/errors.json';
import zhPlatform from './locales/zh-CN/platform.json';
import zhWorkshop from './locales/zh-CN/workshop.json';

// ========== en-US 英文资源 ==========
import enCommon from './locales/en-US/common.json';
import enAuth from './locales/en-US/auth.json';
import enHome from './locales/en-US/home.json';
import enProfile from './locales/en-US/profile.json';
import enProcessing from './locales/en-US/processing.json';
import enManagement from './locales/en-US/management.json';
import enWarehouse from './locales/en-US/warehouse.json';
import enHr from './locales/en-US/hr.json';
import enDispatcher from './locales/en-US/dispatcher.json';
import enQuality from './locales/en-US/quality.json';
import enReports from './locales/en-US/reports.json';
import enAlerts from './locales/en-US/alerts.json';
import enErrors from './locales/en-US/errors.json';
import enPlatform from './locales/en-US/platform.json';
import enWorkshop from './locales/en-US/workshop.json';

/**
 * 翻译资源配置
 * 按语言和命名空间组织
 */
export const resources = {
  'zh-CN': {
    common: zhCommon,
    auth: zhAuth,
    home: zhHome,
    profile: zhProfile,
    processing: zhProcessing,
    management: zhManagement,
    warehouse: zhWarehouse,
    hr: zhHr,
    dispatcher: zhDispatcher,
    quality: zhQuality,
    reports: zhReports,
    alerts: zhAlerts,
    errors: zhErrors,
    platform: zhPlatform,
    workshop: zhWorkshop,
  },
  'en-US': {
    common: enCommon,
    auth: enAuth,
    home: enHome,
    profile: enProfile,
    processing: enProcessing,
    management: enManagement,
    warehouse: enWarehouse,
    hr: enHr,
    dispatcher: enDispatcher,
    quality: enQuality,
    reports: enReports,
    alerts: enAlerts,
    errors: enErrors,
    platform: enPlatform,
    workshop: enWorkshop,
  },
} as const;

export type Resources = typeof resources;
