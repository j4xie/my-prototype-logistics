/**
 * SADP 设备发现与激活服务类型定义
 * SADP (Search Active Devices Protocol) Device Discovery & Activation Types
 *
 * SADP 是海康威视私有协议，用于发现局域网内的设备
 */

// ============================================
// SADP 设备类型
// ============================================

/**
 * SADP 发现的设备
 */
export interface SadpDevice {
  /** MAC 地址 (唯一标识) */
  mac: string;
  /** IP 地址 */
  ip: string;
  /** HTTP 端口 */
  port: number;
  /** 设备型号 */
  model: string;
  /** 序列号 */
  serialNumber: string;
  /** 固件版本 */
  firmwareVersion: string;
  /** 是否已激活 */
  isActivated: boolean;
  /** 设备类型 (IPC/NVR/DVR) */
  deviceType: string;
  /** 设备名称 */
  deviceName?: string;
  /** 子网掩码 */
  netmask?: string;
  /** 网关地址 */
  gateway?: string;
  /** DNS 服务器 */
  dns?: string;
  /** DHCP 是否启用 */
  dhcpEnabled?: boolean;
  /** IPv6 地址 */
  ipv6Address?: string;
  /** 发现时间戳 */
  discoveredAt: number;
  /** 最后心跳时间 */
  lastSeenAt: number;
}

/**
 * SADP 发现选项
 */
export interface SadpDiscoveryOptions {
  /** 扫描超时时间 (ms)，默认 10000 */
  timeout?: number;
  /** 是否持续监听，默认 false */
  continuous?: boolean;
  /** 过滤设备类型 */
  deviceTypeFilter?: string[];
  /** 只显示未激活设备 */
  unactivatedOnly?: boolean;
}

/**
 * SADP 发现状态
 */
export type SadpDiscoveryStatus =
  | 'idle'        // 空闲
  | 'discovering' // 扫描中
  | 'stopped'     // 已停止
  | 'error';      // 错误

/**
 * SADP 发现进度
 */
export interface SadpDiscoveryProgress {
  /** 扫描状态 */
  status: SadpDiscoveryStatus;
  /** 发现的设备数量 */
  deviceCount: number;
  /** 已扫描时间 (ms) */
  elapsedTime: number;
  /** 错误信息 */
  error?: string;
}

// ============================================
// 网络配置类型
// ============================================

/**
 * 网络配置修改请求
 */
export interface NetworkConfigRequest {
  /** 设备 MAC 地址 */
  mac: string;
  /** 新 IP 地址 */
  newIp: string;
  /** 子网掩码 */
  netmask: string;
  /** 网关 */
  gateway: string;
  /** DNS (可选) */
  dns?: string;
  /** 是否启用 DHCP */
  dhcpEnabled?: boolean;
  /** 管理员密码 (用于验证) */
  password?: string;
}

/**
 * 网络配置结果
 */
export interface NetworkConfigResult {
  /** 是否成功 */
  success: boolean;
  /** 新 IP 地址 */
  newIp?: string;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: string;
}

// ============================================
// 设备激活类型
// ============================================

/**
 * 设备激活请求
 */
export interface DeviceActivationRequest {
  /** 设备 IP 地址 */
  ip: string;
  /** 管理员密码 */
  password: string;
  /** HTTP 端口，默认 80 */
  port?: number;
  /** 使用 HTTPS */
  useHttps?: boolean;
}

/**
 * 设备激活结果
 */
export interface DeviceActivationResult {
  /** 是否成功 */
  success: boolean;
  /** 激活时间 */
  activatedAt?: string;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: ActivationErrorCode;
}

/**
 * 激活错误代码
 */
export type ActivationErrorCode =
  | 'ALREADY_ACTIVATED'     // 设备已激活
  | 'INVALID_PASSWORD'      // 密码不符合要求
  | 'CONNECTION_FAILED'     // 连接失败
  | 'TIMEOUT'               // 超时
  | 'DEVICE_BUSY'           // 设备忙
  | 'UNKNOWN';              // 未知错误

/**
 * 激活状态检查结果
 */
export interface ActivationStatusResult {
  /** 是否已激活 */
  isActivated: boolean;
  /** 设备序列号 */
  serialNumber?: string;
  /** 设备型号 */
  model?: string;
  /** 错误信息 */
  error?: string;
}

/**
 * 密码修改请求
 */
export interface PasswordChangeRequest {
  /** 设备 IP 地址 */
  ip: string;
  /** 原密码 */
  oldPassword: string;
  /** 新密码 */
  newPassword: string;
  /** HTTP 端口 */
  port?: number;
  /** 用户名，默认 admin */
  username?: string;
}

/**
 * 密码修改结果
 */
export interface PasswordChangeResult {
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 错误代码 */
  errorCode?: PasswordChangeErrorCode;
}

/**
 * 密码修改错误代码
 */
export type PasswordChangeErrorCode =
  | 'WRONG_PASSWORD'        // 原密码错误
  | 'INVALID_NEW_PASSWORD'  // 新密码不符合要求
  | 'SAME_PASSWORD'         // 新旧密码相同
  | 'CONNECTION_FAILED'     // 连接失败
  | 'UNAUTHORIZED'          // 未授权
  | 'UNKNOWN';              // 未知错误

// ============================================
// 设备配置流程类型
// ============================================

/**
 * 设备配置选项
 */
export interface DeviceSetupConfig {
  /** 新 IP 地址 (如果需要修改) */
  newIp?: string;
  /** 子网掩码 */
  netmask?: string;
  /** 网关 */
  gateway?: string;
  /** 管理员密码 */
  password: string;
  /** 设备名称 */
  deviceName: string;
  /** 是否启用移动侦测 */
  enableMotionDetection: boolean;
  /** 是否配置 HTTP 推送到云端 */
  enableHttpPush: boolean;
  /** HTTP 推送目标 URL */
  httpPushUrl?: string;
  /** NTP 服务器地址 */
  ntpServer?: string;
  /** 时区 */
  timezone?: string;
}

/**
 * 设备配置步骤
 */
export type SetupStep =
  | 'validate'              // 验证参数
  | 'check_activation'      // 检查激活状态
  | 'activate'              // 激活设备
  | 'modify_network'        // 修改网络配置
  | 'wait_reboot'           // 等待设备重启
  | 'verify_connection'     // 验证连接
  | 'configure_device'      // 配置设备参数
  | 'configure_alerts'      // 配置告警
  | 'complete';             // 完成

/**
 * 设备配置进度
 */
export interface SetupProgress {
  /** 当前步骤 */
  currentStep: SetupStep;
  /** 总步骤数 */
  totalSteps: number;
  /** 当前步骤索引 (0-based) */
  stepIndex: number;
  /** 进度百分比 (0-100) */
  percentage: number;
  /** 步骤描述 */
  stepDescription: string;
  /** 是否可取消 */
  cancellable: boolean;
}

/**
 * 设备配置结果
 */
export interface SetupResult {
  /** 是否成功 */
  success: boolean;
  /** 设备最终 IP */
  finalIp: string;
  /** 设备序列号 */
  serialNumber?: string;
  /** 配置的各项结果 */
  stepResults: SetupStepResult[];
  /** 失败的步骤 */
  failedStep?: SetupStep;
  /** 错误信息 */
  error?: string;
  /** 总耗时 (ms) */
  totalDuration: number;
}

/**
 * 单步配置结果
 */
export interface SetupStepResult {
  /** 步骤 */
  step: SetupStep;
  /** 是否成功 */
  success: boolean;
  /** 耗时 (ms) */
  duration: number;
  /** 错误信息 */
  error?: string;
  /** 附加数据 */
  data?: Record<string, unknown>;
}

// ============================================
// 原生模块事件类型
// ============================================

/**
 * SADP 原生模块事件
 */
export interface SadpNativeEvent {
  /** 事件类型 */
  type: 'deviceFound' | 'deviceLost' | 'error' | 'statusChanged';
  /** 设备数据 (deviceFound/deviceLost) */
  device?: SadpDevice;
  /** 错误信息 (error) */
  error?: string;
  /** 状态 (statusChanged) */
  status?: SadpDiscoveryStatus;
}

/**
 * SADP 原生模块接口
 */
export interface SadpNativeModule {
  /** 开始发现 */
  startDiscovery(options?: SadpDiscoveryOptions): Promise<void>;
  /** 停止发现 */
  stopDiscovery(): Promise<void>;
  /** 修改设备 IP */
  modifyDeviceIp(request: NetworkConfigRequest): Promise<NetworkConfigResult>;
  /** 获取当前状态 */
  getStatus(): Promise<SadpDiscoveryStatus>;
  /** 获取已发现设备 */
  getDiscoveredDevices(): Promise<SadpDevice[]>;
}

// ============================================
// 密码验证规则
// ============================================

/**
 * 密码验证规则
 */
export interface PasswordValidationRule {
  /** 最小长度 */
  minLength: number;
  /** 最大长度 */
  maxLength: number;
  /** 需要大写字母 */
  requireUppercase: boolean;
  /** 需要小写字母 */
  requireLowercase: boolean;
  /** 需要数字 */
  requireNumber: boolean;
  /** 需要特殊字符 */
  requireSpecialChar: boolean;
  /** 允许的特殊字符 */
  allowedSpecialChars: string;
}

/**
 * 密码验证结果
 */
export interface PasswordValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误信息 */
  errors: string[];
}

// ============================================
// 默认值常量
// ============================================

/**
 * 默认密码验证规则 (海康威视设备要求)
 */
export const DEFAULT_PASSWORD_RULES: PasswordValidationRule = {
  minLength: 8,
  maxLength: 16,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: false,
  allowedSpecialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

/**
 * 默认 SADP 发现超时 (ms)
 */
export const DEFAULT_DISCOVERY_TIMEOUT = 10000;

/**
 * 默认 HTTP 端口
 */
export const DEFAULT_HTTP_PORT = 80;

/**
 * 默认 HTTPS 端口
 */
export const DEFAULT_HTTPS_PORT = 443;

/**
 * 设备重启等待时间 (ms)
 */
export const DEVICE_REBOOT_WAIT_TIME = 30000;

/**
 * 连接重试次数
 */
export const CONNECTION_RETRY_COUNT = 3;

/**
 * 连接重试间隔 (ms)
 */
export const CONNECTION_RETRY_INTERVAL = 2000;
