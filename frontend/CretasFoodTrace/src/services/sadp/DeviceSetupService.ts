/**
 * 设备配置服务
 * Device Setup Service - Complete Setup Workflow
 *
 * 整合扫描、激活、配置的完整流程，包括：
 * 1. 参数验证
 * 2. 检查激活状态
 * 3. 激活设备（如果未激活）
 * 4. 修改网络配置（如果需要）
 * 5. 等待设备重启
 * 6. 验证连接
 * 7. 配置设备参数（名称、时区等）
 * 8. 配置告警推送（如果启用）
 */

import SadpService from './SadpService';
import DeviceActivationService from './DeviceActivationService';
import type {
  SadpDevice,
  DeviceSetupConfig,
  SetupResult,
  SetupProgress,
  SetupStep,
  SetupStepResult,
  DEVICE_REBOOT_WAIT_TIME,
  CONNECTION_RETRY_COUNT,
  CONNECTION_RETRY_INTERVAL,
} from './types';

// ============================================
// 常量定义
// ============================================

/** 设备重启等待时间 (ms) */
const REBOOT_WAIT_TIME = 30000;

/** 连接重试次数 */
const RETRY_COUNT = 3;

/** 连接重试间隔 (ms) */
const RETRY_INTERVAL = 2000;

/** 步骤描述映射 */
const STEP_DESCRIPTIONS: Record<SetupStep, string> = {
  validate: '验证配置参数',
  check_activation: '检查设备激活状态',
  activate: '激活设备',
  modify_network: '修改网络配置',
  wait_reboot: '等待设备重启',
  verify_connection: '验证设备连接',
  configure_device: '配置设备参数',
  configure_alerts: '配置告警推送',
  complete: '配置完成',
};

/** 配置步骤顺序 */
const SETUP_STEPS: SetupStep[] = [
  'validate',
  'check_activation',
  'activate',
  'modify_network',
  'wait_reboot',
  'verify_connection',
  'configure_device',
  'configure_alerts',
  'complete',
];

// ============================================
// ISAPI 配置接口
// ============================================

/** 设备名称配置路径 */
const ISAPI_DEVICE_INFO = '/ISAPI/System/deviceInfo';

/** 时间配置路径 */
const ISAPI_TIME = '/ISAPI/System/time';

/** NTP 配置路径 */
const ISAPI_NTP = '/ISAPI/System/time/ntpServers';

/** 移动侦测配置路径 */
const ISAPI_MOTION_DETECTION = '/ISAPI/Smart/MotionDetection/1';

/** HTTP 推送配置路径 */
const ISAPI_HTTP_HOST = '/ISAPI/Event/notification/httpHosts';

// ============================================
// XML 生成函数
// ============================================

/**
 * 生成设备名称配置 XML
 */
function buildDeviceNameXml(deviceName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<DeviceInfo version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <deviceName>${escapeXml(deviceName)}</deviceName>
</DeviceInfo>`;
}

/**
 * 生成 NTP 配置 XML
 */
function buildNtpConfigXml(ntpServer: string, timezone: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<NTPServerList version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <NTPServer>
    <id>1</id>
    <addressingFormatType>hostname</addressingFormatType>
    <hostName>${escapeXml(ntpServer)}</hostName>
    <portNo>123</portNo>
    <synchronizeInterval>60</synchronizeInterval>
  </NTPServer>
</NTPServerList>`;
}

/**
 * 生成移动侦测配置 XML
 */
function buildMotionDetectionXml(enabled: boolean, sensitivity: number = 50): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<MotionDetection version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <enabled>${enabled}</enabled>
  <enableHighlight>false</enableHighlight>
  <sensitivityLevel>${sensitivity}</sensitivityLevel>
  <MotionDetectionLayout>
    <sensitivityLevel>${sensitivity}</sensitivityLevel>
    <MotionDetectionRegionList>
      <MotionDetectionRegion>
        <id>1</id>
        <enabled>true</enabled>
        <sensitivityLevel>${sensitivity}</sensitivityLevel>
        <RegionCoordinatesList>
          <RegionCoordinates><positionX>0</positionX><positionY>0</positionY></RegionCoordinates>
          <RegionCoordinates><positionX>704</positionX><positionY>0</positionY></RegionCoordinates>
          <RegionCoordinates><positionX>704</positionX><positionY>576</positionY></RegionCoordinates>
          <RegionCoordinates><positionX>0</positionX><positionY>576</positionY></RegionCoordinates>
        </RegionCoordinatesList>
      </MotionDetectionRegion>
    </MotionDetectionRegionList>
  </MotionDetectionLayout>
</MotionDetection>`;
}

/**
 * 生成 HTTP 推送配置 XML
 */
function buildHttpPushXml(pushUrl: string): string {
  const url = new URL(pushUrl);
  return `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotificationList version="2.0" xmlns="http://www.hikvision.com/ver20/XMLSchema">
  <HttpHostNotification>
    <id>1</id>
    <url>${escapeXml(url.pathname)}</url>
    <protocolType>HTTP</protocolType>
    <parameterFormatType>XML</parameterFormatType>
    <addressingFormatType>hostname</addressingFormatType>
    <hostName>${escapeXml(url.hostname)}</hostName>
    <portNo>${url.port || '80'}</portNo>
    <httpAuthenticationMethod>none</httpAuthenticationMethod>
  </HttpHostNotification>
</HttpHostNotificationList>`;
}

/**
 * XML 特殊字符转义
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ============================================
// 工具函数
// ============================================

/**
 * 延时函数
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带超时的 fetch
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number = 10000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 生成 Basic Auth 头
 */
function buildBasicAuthHeader(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

// ============================================
// 设备配置服务类
// ============================================

type ProgressCallback = (progress: SetupProgress) => void;

class DeviceSetupServiceImpl {
  private currentDevice: SadpDevice | null = null;
  private currentConfig: DeviceSetupConfig | null = null;
  private isCancelled: boolean = false;
  private stepResults: SetupStepResult[] = [];
  private startTime: number = 0;
  private progressCallback: ProgressCallback | null = null;

  // ========== 公开方法 ==========

  /**
   * 执行完整的设备配置流程
   * @param device SADP 发现的设备
   * @param config 配置选项
   * @param onProgress 进度回调
   */
  async setupDevice(
    device: SadpDevice,
    config: DeviceSetupConfig,
    onProgress?: ProgressCallback
  ): Promise<SetupResult> {
    this.currentDevice = device;
    this.currentConfig = config;
    this.isCancelled = false;
    this.stepResults = [];
    this.startTime = Date.now();
    this.progressCallback = onProgress || null;

    console.log('[DeviceSetup] 开始配置设备:', device.ip, device.model);

    try {
      // 步骤 1: 验证参数
      await this.executeStep('validate', () => this.stepValidate());

      // 步骤 2: 检查激活状态
      const activationResult = await this.executeStep('check_activation', () =>
        this.stepCheckActivation()
      );

      // 步骤 3: 激活设备（如果未激活）
      if (!activationResult.isActivated) {
        await this.executeStep('activate', () => this.stepActivate());
      } else {
        this.addSkippedStep('activate', '设备已激活');
      }

      // 步骤 4: 修改网络配置（如果需要）
      if (config.newIp && config.newIp !== device.ip) {
        await this.executeStep('modify_network', () => this.stepModifyNetwork());

        // 步骤 5: 等待设备重启
        await this.executeStep('wait_reboot', () => this.stepWaitReboot());
      } else {
        this.addSkippedStep('modify_network', '无需修改 IP');
        this.addSkippedStep('wait_reboot', '无需等待重启');
      }

      // 步骤 6: 验证连接
      await this.executeStep('verify_connection', () => this.stepVerifyConnection());

      // 步骤 7: 配置设备参数
      await this.executeStep('configure_device', () => this.stepConfigureDevice());

      // 步骤 8: 配置告警推送
      if (config.enableHttpPush && config.httpPushUrl) {
        await this.executeStep('configure_alerts', () => this.stepConfigureAlerts());
      } else {
        this.addSkippedStep('configure_alerts', '未启用 HTTP 推送');
      }

      // 完成
      this.notifyProgress('complete');

      return {
        success: true,
        finalIp: config.newIp || device.ip,
        serialNumber: device.serialNumber,
        stepResults: this.stepResults,
        totalDuration: Date.now() - this.startTime,
      };
    } catch (error) {
      const failedStep = this.stepResults[this.stepResults.length - 1]?.step;

      return {
        success: false,
        finalIp: device.ip,
        serialNumber: device.serialNumber,
        stepResults: this.stepResults,
        failedStep,
        error: this.getErrorMessage(error),
        totalDuration: Date.now() - this.startTime,
      };
    }
  }

  /**
   * 取消配置流程
   */
  cancel(): void {
    this.isCancelled = true;
    console.log('[DeviceSetup] 配置流程已取消');
  }

  /**
   * 获取配置是否可取消
   */
  isCancellable(step: SetupStep): boolean {
    // 在等待重启和修改网络配置期间不可取消
    return !['modify_network', 'wait_reboot'].includes(step);
  }

  // ========== 配置步骤实现 ==========

  /**
   * 步骤 1: 验证参数
   */
  private async stepValidate(): Promise<void> {
    const config = this.currentConfig!;

    // 验证密码
    const passwordValidation = DeviceActivationService.validatePassword(config.password);
    if (!passwordValidation.valid) {
      throw new Error(`密码不符合要求: ${passwordValidation.errors.join(', ')}`);
    }

    // 验证设备名称
    if (!config.deviceName || config.deviceName.trim().length === 0) {
      throw new Error('设备名称不能为空');
    }

    // 验证新 IP（如果提供）
    if (config.newIp) {
      if (!this.isValidIpAddress(config.newIp)) {
        throw new Error('新 IP 地址格式无效');
      }
      if (!config.netmask || !this.isValidIpAddress(config.netmask)) {
        throw new Error('子网掩码格式无效');
      }
      if (!config.gateway || !this.isValidIpAddress(config.gateway)) {
        throw new Error('网关地址格式无效');
      }
    }

    // 验证 HTTP 推送 URL
    if (config.enableHttpPush) {
      if (!config.httpPushUrl) {
        throw new Error('启用 HTTP 推送时必须提供推送 URL');
      }
      try {
        new URL(config.httpPushUrl);
      } catch {
        throw new Error('HTTP 推送 URL 格式无效');
      }
    }
  }

  /**
   * 步骤 2: 检查激活状态
   */
  private async stepCheckActivation(): Promise<{ isActivated: boolean }> {
    const device = this.currentDevice!;
    const result = await DeviceActivationService.checkActivationStatus(device.ip, device.port);

    if (result.error) {
      console.warn('[DeviceSetup] 检查激活状态出错:', result.error);
    }

    return { isActivated: result.isActivated };
  }

  /**
   * 步骤 3: 激活设备
   */
  private async stepActivate(): Promise<void> {
    const device = this.currentDevice!;
    const config = this.currentConfig!;

    const result = await DeviceActivationService.activateDevice({
      ip: device.ip,
      password: config.password,
      port: device.port,
    });

    if (!result.success) {
      throw new Error(`激活失败: ${result.error}`);
    }
  }

  /**
   * 步骤 4: 修改网络配置
   */
  private async stepModifyNetwork(): Promise<void> {
    const device = this.currentDevice!;
    const config = this.currentConfig!;

    if (!config.newIp || !config.netmask || !config.gateway) {
      throw new Error('缺少网络配置参数');
    }

    const result = await SadpService.modifyDeviceIp(
      device.mac,
      config.newIp,
      config.netmask,
      config.gateway,
      config.password
    );

    if (!result.success) {
      throw new Error(`修改 IP 失败: ${result.error}`);
    }
  }

  /**
   * 步骤 5: 等待设备重启
   */
  private async stepWaitReboot(): Promise<void> {
    console.log('[DeviceSetup] 等待设备重启...');

    // 等待固定时间让设备重启
    const waitTime = REBOOT_WAIT_TIME;
    const checkInterval = 5000;
    let elapsed = 0;

    while (elapsed < waitTime) {
      if (this.isCancelled) {
        throw new Error('配置已取消');
      }

      await delay(checkInterval);
      elapsed += checkInterval;

      // 更新进度
      const progress = Math.round((elapsed / waitTime) * 100);
      console.log(`[DeviceSetup] 重启等待进度: ${progress}%`);
    }
  }

  /**
   * 步骤 6: 验证连接
   */
  private async stepVerifyConnection(): Promise<void> {
    const config = this.currentConfig!;
    const targetIp = config.newIp || this.currentDevice!.ip;
    const port = this.currentDevice!.port;

    let connected = false;
    let lastError = '';

    for (let i = 0; i < RETRY_COUNT; i++) {
      if (this.isCancelled) {
        throw new Error('配置已取消');
      }

      console.log(`[DeviceSetup] 尝试连接 ${targetIp} (${i + 1}/${RETRY_COUNT})`);

      try {
        const url = `http://${targetIp}:${port}${ISAPI_DEVICE_INFO}`;
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {
            'Authorization': buildBasicAuthHeader('admin', config.password),
          },
        });

        // 200 或 401 都表示设备可达
        if (response.status === 200 || response.status === 401) {
          connected = true;
          break;
        }

        lastError = `HTTP ${response.status}`;
      } catch (error) {
        lastError = this.getErrorMessage(error);
      }

      if (i < RETRY_COUNT - 1) {
        await delay(RETRY_INTERVAL);
      }
    }

    if (!connected) {
      throw new Error(`无法连接到设备: ${lastError}`);
    }

    // 更新当前设备 IP
    if (config.newIp) {
      this.currentDevice = { ...this.currentDevice!, ip: config.newIp };
    }
  }

  /**
   * 步骤 7: 配置设备参数
   */
  private async stepConfigureDevice(): Promise<void> {
    const config = this.currentConfig!;
    const device = this.currentDevice!;
    const authHeader = buildBasicAuthHeader('admin', config.password);

    // 配置设备名称
    await this.configureDeviceName(device.ip, device.port, config.deviceName, authHeader);

    // 配置 NTP（如果提供）
    if (config.ntpServer) {
      await this.configureNtp(
        device.ip,
        device.port,
        config.ntpServer,
        config.timezone || 'CST-8',
        authHeader
      );
    }

    // 配置移动侦测
    if (config.enableMotionDetection) {
      await this.configureMotionDetection(device.ip, device.port, true, authHeader);
    }
  }

  /**
   * 步骤 8: 配置告警推送
   */
  private async stepConfigureAlerts(): Promise<void> {
    const config = this.currentConfig!;
    const device = this.currentDevice!;

    if (!config.httpPushUrl) {
      return;
    }

    const authHeader = buildBasicAuthHeader('admin', config.password);
    await this.configureHttpPush(device.ip, device.port, config.httpPushUrl, authHeader);
  }

  // ========== 配置子方法 ==========

  /**
   * 配置设备名称
   */
  private async configureDeviceName(
    ip: string,
    port: number,
    deviceName: string,
    authHeader: string
  ): Promise<void> {
    const url = `http://${ip}:${port}${ISAPI_DEVICE_INFO}`;

    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': authHeader,
      },
      body: buildDeviceNameXml(deviceName),
    });

    if (!response.ok) {
      console.warn('[DeviceSetup] 设置设备名称失败:', response.status);
      // 不抛出错误，继续执行
    }
  }

  /**
   * 配置 NTP
   */
  private async configureNtp(
    ip: string,
    port: number,
    ntpServer: string,
    timezone: string,
    authHeader: string
  ): Promise<void> {
    const url = `http://${ip}:${port}${ISAPI_NTP}`;

    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': authHeader,
      },
      body: buildNtpConfigXml(ntpServer, timezone),
    });

    if (!response.ok) {
      console.warn('[DeviceSetup] 设置 NTP 失败:', response.status);
    }
  }

  /**
   * 配置移动侦测
   */
  private async configureMotionDetection(
    ip: string,
    port: number,
    enabled: boolean,
    authHeader: string
  ): Promise<void> {
    const url = `http://${ip}:${port}${ISAPI_MOTION_DETECTION}`;

    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': authHeader,
      },
      body: buildMotionDetectionXml(enabled),
    });

    if (!response.ok) {
      console.warn('[DeviceSetup] 设置移动侦测失败:', response.status);
    }
  }

  /**
   * 配置 HTTP 推送
   */
  private async configureHttpPush(
    ip: string,
    port: number,
    pushUrl: string,
    authHeader: string
  ): Promise<void> {
    const url = `http://${ip}:${port}${ISAPI_HTTP_HOST}`;

    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xml',
        'Authorization': authHeader,
      },
      body: buildHttpPushXml(pushUrl),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`配置 HTTP 推送失败: HTTP ${response.status} - ${errorText}`);
    }
  }

  // ========== 辅助方法 ==========

  /**
   * 执行配置步骤
   */
  private async executeStep<T>(
    step: SetupStep,
    fn: () => Promise<T>
  ): Promise<T> {
    if (this.isCancelled) {
      throw new Error('配置已取消');
    }

    this.notifyProgress(step);
    const startTime = Date.now();

    try {
      const result = await fn();

      this.stepResults.push({
        step,
        success: true,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      this.stepResults.push({
        step,
        success: false,
        duration: Date.now() - startTime,
        error: this.getErrorMessage(error),
      });

      throw error;
    }
  }

  /**
   * 添加跳过的步骤
   */
  private addSkippedStep(step: SetupStep, reason: string): void {
    this.stepResults.push({
      step,
      success: true,
      duration: 0,
      data: { skipped: true, reason },
    });
  }

  /**
   * 通知进度
   */
  private notifyProgress(currentStep: SetupStep): void {
    if (!this.progressCallback) return;

    const stepIndex = SETUP_STEPS.indexOf(currentStep);
    const totalSteps = SETUP_STEPS.length;

    const progress: SetupProgress = {
      currentStep,
      totalSteps,
      stepIndex,
      percentage: Math.round((stepIndex / (totalSteps - 1)) * 100),
      stepDescription: STEP_DESCRIPTIONS[currentStep],
      cancellable: this.isCancellable(currentStep),
    };

    try {
      this.progressCallback(progress);
    } catch (err) {
      console.error('[DeviceSetup] 进度回调错误:', err);
    }
  }

  /**
   * 验证 IP 地址格式
   */
  private isValidIpAddress(ip: string): boolean {
    const ipRegex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipRegex);
    if (!match) return false;

    return match.slice(1).every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return '未知错误';
  }
}

// ============================================
// 单例导出
// ============================================

const DeviceSetupService = new DeviceSetupServiceImpl();

export default DeviceSetupService;
export { DeviceSetupServiceImpl, SETUP_STEPS, STEP_DESCRIPTIONS };
