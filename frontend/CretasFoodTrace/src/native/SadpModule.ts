/**
 * SADP (Search Active Device Protocol) Native Module
 *
 * This module provides device discovery and IP configuration capabilities
 * for Hikvision-compatible devices using the SADP protocol.
 *
 * Protocol Details:
 * - UDP Port: 37020
 * - Multicast Address: 239.255.255.250
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SadpModule: NativeSadpModule } = NativeModules;

/**
 * Device information discovered via SADP protocol
 */
export interface SadpDevice {
  /** Device IP address */
  ip: string;
  /** Device MAC address */
  mac: string;
  /** Subnet mask */
  netmask: string;
  /** Default gateway */
  gateway: string;
  /** Device type (e.g., "IPC", "NVR", "DVR") */
  deviceType: string;
  /** Device model name */
  model: string;
  /** Device serial number */
  serialNumber: string;
  /** Firmware version */
  firmwareVersion: string;
  /** HTTP port */
  httpPort: string;
  /** Whether the device has been activated */
  activated: boolean;
  /** Whether DHCP is enabled */
  dhcp: boolean;
  /** Timestamp when the device was discovered */
  discoveredAt: number;
  /** Raw XML response (for debugging) */
  rawXml?: string;
}

/**
 * Discovery status event
 */
export interface DiscoveryStatus {
  status: 'started' | 'stopped' | 'error';
  message?: string;
}

/**
 * IP modification result
 */
export interface ModifyIpResult {
  success: boolean;
  message: string;
  status?: string;
}

/**
 * Device activation result
 */
export interface ActivateResult {
  success: boolean;
  message: string;
  /** Device serial number (returned from native module) */
  serialNumber?: string;
  /** IP address (returned from native module) */
  ipAddress?: string;
  /** Device ID in backend (after auto-import) */
  deviceId?: string;
}

/**
 * Password reset result
 */
export interface ResetPasswordResult {
  success: boolean;
  message: string;
  needSecurityCode?: boolean;
  status?: string;
}

/**
 * Factory restore result
 */
export interface RestoreResult {
  success: boolean;
  message: string;
  status?: string;
}

/**
 * Event listener callback types
 */
type DeviceFoundCallback = (device: SadpDevice) => void;
type DiscoveryStatusCallback = (status: DiscoveryStatus) => void;

class SadpModuleWrapper {
  private eventEmitter: NativeEventEmitter | null = null;
  private deviceFoundListeners: DeviceFoundCallback[] = [];
  private statusListeners: DiscoveryStatusCallback[] = [];

  constructor() {
    if (Platform.OS === 'android' && NativeSadpModule) {
      this.eventEmitter = new NativeEventEmitter(NativeSadpModule);
    }
  }

  /**
   * Check if SADP module is available
   */
  isAvailable(): boolean {
    return Platform.OS === 'android' && NativeSadpModule != null;
  }

  /**
   * Start device discovery
   * Sends multicast probe and listens for device responses
   */
  async startDiscovery(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('SADP module is only available on Android');
    }

    // Set up event listeners
    this.setupEventListeners();

    return NativeSadpModule.startDiscovery();
  }

  /**
   * Stop device discovery
   */
  async stopDiscovery(): Promise<boolean> {
    if (!this.isAvailable()) {
      return true;
    }

    this.removeEventListeners();
    return NativeSadpModule.stopDiscovery();
  }

  /**
   * Check if discovery is currently active
   */
  async isDiscovering(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }
    return NativeSadpModule.isDiscovering();
  }

  /**
   * Modify device IP address
   *
   * @param mac Device MAC address
   * @param newIp New IP address
   * @param netmask Subnet mask (default: 255.255.255.0)
   * @param gateway Default gateway
   * @param password Device admin password (required for activated devices)
   */
  async modifyDeviceIp(
    mac: string,
    newIp: string,
    netmask: string = '255.255.255.0',
    gateway: string,
    password?: string
  ): Promise<ModifyIpResult> {
    if (!this.isAvailable()) {
      throw new Error('SADP module is only available on Android');
    }

    return NativeSadpModule.modifyDeviceIp(mac, newIp, netmask, gateway, password || '');
  }

  /**
   * Activate an unactivated device (set initial password)
   *
   * @param mac Device MAC address
   * @param password Password to set (minimum 8 characters)
   */
  async activateDevice(mac: string, password: string): Promise<ActivateResult> {
    if (!this.isAvailable()) {
      throw new Error('SADP module is only available on Android');
    }

    if (password.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters',
      };
    }

    return NativeSadpModule.activateDevice(mac, password);
  }

  /**
   * Reset device password (requires security code or serial number verification)
   *
   * @param mac Device MAC address
   * @param serialNumber Device serial number for verification
   * @param newPassword New password to set (minimum 8 characters)
   * @param securityCode Optional security code from Hikvision
   */
  async resetDevicePassword(
    mac: string,
    serialNumber: string,
    newPassword: string,
    securityCode?: string
  ): Promise<ResetPasswordResult> {
    if (!this.isAvailable()) {
      throw new Error('SADP module is only available on Android');
    }

    if (newPassword.length < 8) {
      return {
        success: false,
        message: 'Password must be at least 8 characters',
      };
    }

    return NativeSadpModule.resetDevicePassword(mac, serialNumber, newPassword, securityCode || null);
  }

  /**
   * Restore device to factory settings
   *
   * @param mac Device MAC address
   * @param password Current device admin password
   */
  async restoreFactorySettings(mac: string, password: string): Promise<RestoreResult> {
    if (!this.isAvailable()) {
      throw new Error('SADP module is only available on Android');
    }

    return NativeSadpModule.restoreFactorySettings(mac, password);
  }

  /**
   * Add listener for device found events
   */
  onDeviceFound(callback: DeviceFoundCallback): () => void {
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
  onDiscoveryStatus(callback: DiscoveryStatusCallback): () => void {
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

    this.eventEmitter.addListener('onDeviceFound', (device: SadpDevice) => {
      this.deviceFoundListeners.forEach((callback) => callback(device));
    });

    this.eventEmitter.addListener('onDiscoveryStatus', (status: DiscoveryStatus) => {
      this.statusListeners.forEach((callback) => callback(status));
    });
  }

  private removeEventListeners() {
    if (!this.eventEmitter) return;

    this.eventEmitter.removeAllListeners('onDeviceFound');
    this.eventEmitter.removeAllListeners('onDiscoveryStatus');
  }
}

// Export singleton instance
export const SadpModule = new SadpModuleWrapper();

// Export types
export type { DeviceFoundCallback, DiscoveryStatusCallback };
