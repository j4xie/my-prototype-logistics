/**
 * Dahua DHDiscover Native Module
 *
 * This module provides device discovery and IP configuration capabilities
 * for Dahua-compatible devices using the DHDiscover protocol.
 *
 * Protocol Details:
 * - UDP Port: 37810
 * - Multicast Address: 239.255.255.251
 * - Protocol: JSON-based DHDiscover
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { DahuaModule: NativeDahuaModule } = NativeModules;

/**
 * Device information discovered via DHDiscover protocol
 */
export interface DahuaDevice {
  /** Device IP address */
  ip: string;
  /** Device MAC address */
  mac: string;
  /** Subnet mask */
  netmask: string;
  /** Default gateway */
  gateway: string;
  /** Device type (e.g., "IPC-HDW", "NVR", "XVR") */
  deviceType: string;
  /** Device model name */
  model: string;
  /** Device serial number */
  serialNumber: string;
  /** Firmware version */
  firmwareVersion: string;
  /** HTTP port (default: 80) */
  httpPort: string;
  /** RTSP port (default: 554) */
  rtspPort: string;
  /** Control port (default: 37777) */
  controlPort: string;
  /** Whether the device has been initialized/activated */
  initialized: boolean;
  /** Device vendor (always "Dahua") */
  vendor: string;
  /** Timestamp when the device was discovered */
  discoveredAt: number;
  /** Raw JSON response (for debugging) */
  rawJson?: string;
}

/**
 * Discovery status event
 */
export interface DahuaDiscoveryStatus {
  status: 'started' | 'stopped' | 'error';
  message?: string;
}

/**
 * IP modification result
 */
export interface DahuaModifyIpResult {
  success: boolean;
  message: string;
  status?: string;
}

/**
 * Device initialization result
 */
export interface DahuaInitResult {
  success: boolean;
  message: string;
  serialNumber?: string;
  ipAddress?: string;
  deviceId?: string;
}

/**
 * Password reset result
 */
export interface DahuaResetPasswordResult {
  success: boolean;
  message: string;
  needSecurityCode?: boolean;
  status?: string;
}

/**
 * Event listener callback types
 */
type DahuaDeviceFoundCallback = (device: DahuaDevice) => void;
type DahuaDiscoveryStatusCallback = (status: DahuaDiscoveryStatus) => void;

class DahuaModuleWrapper {
  private eventEmitter: NativeEventEmitter | null = null;
  private deviceFoundListeners: DahuaDeviceFoundCallback[] = [];
  private statusListeners: DahuaDiscoveryStatusCallback[] = [];

  constructor() {
    if (Platform.OS === 'android' && NativeDahuaModule) {
      this.eventEmitter = new NativeEventEmitter(NativeDahuaModule);
    }
  }

  /**
   * Check if Dahua module is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && NativeDahuaModule != null;
  }

  /**
   * Start device discovery
   * Sends DHDiscover.search broadcast and listens for device responses
   */
  async startDiscovery(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Dahua module is only available on Android');
    }

    // Set up event listeners
    this.setupEventListeners();

    return NativeDahuaModule.startDiscovery();
  }

  /**
   * Stop device discovery
   */
  async stopDiscovery(): Promise<boolean> {
    if (!this.isAvailable()) {
      return true;
    }

    this.removeEventListeners();
    return NativeDahuaModule.stopDiscovery();
  }

  /**
   * Check if discovery is currently active
   */
  async isDiscovering(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return NativeDahuaModule.isDiscovering();
  }

  /**
   * Modify device IP address
   *
   * @param mac Device MAC address
   * @param newIp New IP address
   * @param netmask Subnet mask (default: 255.255.255.0)
   * @param gateway Default gateway
   * @param password Device admin password (required for initialized devices)
   */
  async modifyDeviceIp(
    mac: string,
    newIp: string,
    netmask: string = '255.255.255.0',
    gateway: string,
    password?: string
  ): Promise<DahuaModifyIpResult> {
    if (!this.isAvailable()) {
      throw new Error('Dahua module is only available on Android');
    }

    return NativeDahuaModule.modifyDeviceIp(mac, newIp, netmask, gateway, password || '');
  }

  /**
   * Initialize an uninitialized device (set initial password)
   *
   * @param mac Device MAC address
   * @param password Password to set (minimum 8 characters, must contain letters and numbers)
   */
  async initializeDevice(mac: string, password: string): Promise<DahuaInitResult> {
    if (!this.isAvailable()) {
      throw new Error('Dahua module is only available on Android');
    }

    // Dahua password requirements: 8-32 chars, must contain letters and numbers
    if (password.length < 8 || password.length > 32) {
      return {
        success: false,
        message: 'Password must be 8-32 characters',
      };
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      return {
        success: false,
        message: 'Password must contain both letters and numbers',
      };
    }

    return NativeDahuaModule.initializeDevice(mac, password);
  }

  /**
   * Reset device password
   *
   * @param mac Device MAC address
   * @param serialNumber Device serial number for verification
   * @param newPassword New password to set
   * @param securityCode Optional security code from Dahua
   */
  async resetDevicePassword(
    mac: string,
    serialNumber: string,
    newPassword: string,
    securityCode?: string
  ): Promise<DahuaResetPasswordResult> {
    if (!this.isAvailable()) {
      throw new Error('Dahua module is only available on Android');
    }

    if (newPassword.length < 8 || newPassword.length > 32) {
      return {
        success: false,
        message: 'Password must be 8-32 characters',
      };
    }

    return NativeDahuaModule.resetDevicePassword(mac, serialNumber, newPassword, securityCode || null);
  }

  /**
   * Add listener for device found events
   */
  onDeviceFound(callback: DahuaDeviceFoundCallback): () => void {
    this.deviceFoundListeners.push(callback);
    return () => {
      const index = this.deviceFoundListeners.indexOf(callback);
      if (index > -1) {
        this.deviceFoundListeners.splice(index, 1);
      }
    };
  }

  /**
   * Add listener for discovery status events
   */
  onDiscoveryStatus(callback: DahuaDiscoveryStatusCallback): () => void {
    this.statusListeners.push(callback);
    return () => {
      const index = this.statusListeners.indexOf(callback);
      if (index > -1) {
        this.statusListeners.splice(index, 1);
      }
    };
  }

  private setupEventListeners() {
    if (!this.eventEmitter) return;

    this.eventEmitter.addListener('onDahuaDeviceFound', (device: DahuaDevice) => {
      this.deviceFoundListeners.forEach((callback) => callback(device));
    });

    this.eventEmitter.addListener('onDahuaDiscoveryStatus', (status: DahuaDiscoveryStatus) => {
      this.statusListeners.forEach((callback) => callback(status));
    });
  }

  private removeEventListeners() {
    if (!this.eventEmitter) return;

    this.eventEmitter.removeAllListeners('onDahuaDeviceFound');
    this.eventEmitter.removeAllListeners('onDahuaDiscoveryStatus');
  }
}

// Export singleton instance
export const DahuaModule = new DahuaModuleWrapper();

// Export types
export type { DahuaDeviceFoundCallback, DahuaDiscoveryStatusCallback };
