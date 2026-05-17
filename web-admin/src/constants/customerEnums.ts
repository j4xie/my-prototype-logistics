/**
 * Customer CRM enums — Sprint 4 W2 S-CRM-FULL-1
 *
 * 与后端 CustomerStatus / CustomerImportance / CustomerSource 一一对应。
 * Single source of truth for el-select options + tag colors + Chinese labels.
 *
 * 防呆 R3 — 列表 filter + dialog edit 全部使用 dropdown, 不允许自由输入。
 */

export interface EnumOption<T extends string = string> {
  value: T;
  label: string;
  /** Element Plus tag type — visual cue for status/importance badges */
  tagType?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  description?: string;
}

// ==================== 客户生命周期 (11 阶段) ====================

export type CustomerStatusValue =
  | 'LEAD'
  | 'INITIAL_CONTACT'
  | 'SAMPLE_SENT'
  | 'QUOTING'
  | 'NEGOTIATING'
  | 'SIGNING'
  | 'RECURRING'
  | 'INACTIVE'
  | 'LOST'
  | 'BLACKLIST'
  | 'RECOVERED';

export const CUSTOMER_STATUS_OPTIONS: EnumOption<CustomerStatusValue>[] = [
  { value: 'LEAD',            label: '潜在客户',  tagType: 'info'    },
  { value: 'INITIAL_CONTACT', label: '初步接触',  tagType: 'info'    },
  { value: 'SAMPLE_SENT',     label: '样品已寄',  tagType: 'warning' },
  { value: 'QUOTING',         label: '报价中',    tagType: 'warning' },
  { value: 'NEGOTIATING',     label: '商务谈判',  tagType: 'warning' },
  { value: 'SIGNING',         label: '签约中',    tagType: 'primary' },
  { value: 'RECURRING',       label: '成交复购',  tagType: 'success' },
  { value: 'INACTIVE',        label: '沉睡客户',  tagType: 'info'    },
  { value: 'LOST',            label: '已流失',    tagType: 'danger'  },
  { value: 'BLACKLIST',       label: '黑名单',    tagType: 'danger'  },
  { value: 'RECOVERED',       label: '回流复活',  tagType: 'success' },
];

// ==================== 客户重要程度 (4 级) ====================

export type CustomerImportanceValue = 'VIP' | 'IMPORTANT' | 'NORMAL' | 'LOW';

export const CUSTOMER_IMPORTANCE_OPTIONS: EnumOption<CustomerImportanceValue>[] = [
  { value: 'VIP',       label: 'VIP',  tagType: 'danger'  },
  { value: 'IMPORTANT', label: '重要', tagType: 'warning' },
  { value: 'NORMAL',    label: '普通', tagType: 'info'    },
  { value: 'LOW',       label: '低',   tagType: 'info'    },
];

// ==================== 客户来源渠道 (11 渠道) ====================

export type CustomerSourceValue =
  | 'EXHIBITION'
  | 'REFERRAL'
  | 'WEBSITE'
  | 'SEARCH_ENGINE'
  | 'WECHAT'
  | 'PHONE'
  | 'COLD_VISIT'
  | 'PLATFORM'
  | 'PARTNER'
  | 'REPEAT_PURCHASE'
  | 'OTHER';

export const CUSTOMER_SOURCE_OPTIONS: EnumOption<CustomerSourceValue>[] = [
  { value: 'EXHIBITION',      label: '展会'           },
  { value: 'REFERRAL',        label: '客户介绍'       },
  { value: 'WEBSITE',         label: '官网'           },
  { value: 'SEARCH_ENGINE',   label: '搜索引擎'       },
  { value: 'WECHAT',          label: '微信'           },
  { value: 'PHONE',           label: '电话'           },
  { value: 'COLD_VISIT',      label: '陌拜'           },
  { value: 'PLATFORM',        label: '平台'           },
  { value: 'PARTNER',         label: '合作伙伴'       },
  { value: 'REPEAT_PURCHASE', label: '老客户复购'     },
  { value: 'OTHER',           label: '其他'           },
];

// ==================== Helpers ====================

const STATUS_LABEL_MAP = new Map(CUSTOMER_STATUS_OPTIONS.map(o => [o.value, o]));
const IMPORTANCE_LABEL_MAP = new Map(CUSTOMER_IMPORTANCE_OPTIONS.map(o => [o.value, o]));
const SOURCE_LABEL_MAP = new Map(CUSTOMER_SOURCE_OPTIONS.map(o => [o.value, o]));

export function getCustomerStatusOption(value?: string | null): EnumOption<CustomerStatusValue> | undefined {
  return value ? STATUS_LABEL_MAP.get(value as CustomerStatusValue) : undefined;
}

export function getCustomerImportanceOption(value?: string | null): EnumOption<CustomerImportanceValue> | undefined {
  return value ? IMPORTANCE_LABEL_MAP.get(value as CustomerImportanceValue) : undefined;
}

export function getCustomerSourceOption(value?: string | null): EnumOption<CustomerSourceValue> | undefined {
  return value ? SOURCE_LABEL_MAP.get(value as CustomerSourceValue) : undefined;
}
