/**
 * useSadpDiscovery Hook
 *
 * React hook for SADP device discovery functionality.
 * Provides an easy-to-use interface for discovering and managing
 * Hikvision-compatible devices on the local network.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import {
  SadpModule,
  SadpDevice,
  DiscoveryStatus,
  ModifyIpResult,
  ActivateResult,
  ResetPasswordResult,
  RestoreResult,
} from '../native/SadpModule';
import { createIsapiDevice, CreateIsapiDeviceRequest } from '../services/api/isapiApiClient';

interface UseSadpDiscoveryResult {
  /** List of discovered devices */
  devices: SadpDevice[];
  /** Whether discovery is in progress */
  isDiscovering: boolean;
  /** Current discovery status */
  status: DiscoveryStatus | null;
  /** Error message if any */
  error: string | null;
  /** Start device discovery */
  startDiscovery: () => Promise<void>;
  /** Stop device discovery */
  stopDiscovery: () => Promise<void>;
  /** Modify device IP address */
  modifyDeviceIp: (
    mac: string,
    newIp: string,
    netmask?: string,
    gateway?: string,
    password?: string
  ) => Promise<ModifyIpResult>;
  /** Activate an unactivated device */
  activateDevice: (mac: string, password: string) => Promise<ActivateResult>;
  /** Reset device password */
  resetDevicePassword: (
    mac: string,
    serialNumber: string,
    newPassword: string,
    securityCode?: string
  ) => Promise<ResetPasswordResult>;
  /** Restore device to factory settings */
  restoreFactorySettings: (mac: string, password: string) => Promise<RestoreResult>;
  /** Clear discovered devices list */
  clearDevices: () => void;
  /** Check if SADP is available on this platform */
  isAvailable: boolean;
}

/**
 * Hook for SADP device discovery
 *
 * @example
 * ```tsx
 * const {
 *   devices,
 *   isDiscovering,
 *   startDiscovery,
 *   stopDiscovery,
 *   modifyDeviceIp
 * } = useSadpDiscovery();
 *
 * // Start scanning
 * await startDiscovery();
 *
 * // Modify device IP
 * await modifyDeviceIp('AA:BB:CC:DD:EE:FF', '192.168.1.100');
 * ```
 */
export function useSadpDiscovery(): UseSadpDiscoveryResult {
  const [devices, setDevices] = useState<SadpDevice[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [status, setStatus] = useState<DiscoveryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deviceMapRef = useRef<Map<string, SadpDevice>>(new Map());
  const cleanupRef = useRef<(() => void)[]>([]);

  const isAvailable = SadpModule.isAvailable();

  // Handle device found event
  const handleDeviceFound = useCallback((device: SadpDevice) => {
    // Use MAC address as unique key
    const key = device.mac.toLowerCase().replace(/[:-]/g, '');

    // Update device if already exists (refresh timestamp)
    deviceMapRef.current.set(key, device);

    // Convert map to array and update state
    setDevices(Array.from(deviceMapRef.current.values()));
  }, []);

  // Handle discovery status event
  const handleStatusChange = useCallback((newStatus: DiscoveryStatus) => {
    setStatus(newStatus);

    if (newStatus.status === 'error') {
      setError(newStatus.message || 'Unknown error');
      setIsDiscovering(false);
    } else if (newStatus.status === 'stopped') {
      setIsDiscovering(false);
    } else if (newStatus.status === 'started') {
      setIsDiscovering(true);
      setError(null);
    }
  }, []);

  // Start discovery
  const startDiscovery = useCallback(async () => {
    if (!isAvailable) {
      if (Platform.OS !== 'android') {
        Alert.alert(
          'Platform Not Supported',
          'SADP device discovery is only available on Android devices.'
        );
      }
      return;
    }

    try {
      setError(null);

      // Set up event listeners
      const unsubDevice = SadpModule.onDeviceFound(handleDeviceFound);
      const unsubStatus = SadpModule.onDiscoveryStatus(handleStatusChange);
      cleanupRef.current = [unsubDevice, unsubStatus];

      await SadpModule.startDiscovery();
      setIsDiscovering(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start discovery';
      setError(message);
      setIsDiscovering(false);
    }
  }, [isAvailable, handleDeviceFound, handleStatusChange]);

  // Stop discovery
  const stopDiscovery = useCallback(async () => {
    try {
      await SadpModule.stopDiscovery();
      setIsDiscovering(false);

      // Clean up event listeners
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop discovery';
      setError(message);
    }
  }, []);

  // Modify device IP
  const modifyDeviceIp = useCallback(
    async (
      mac: string,
      newIp: string,
      netmask: string = '255.255.255.0',
      gateway?: string,
      password?: string
    ): Promise<ModifyIpResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: 'SADP module is not available on this platform',
        };
      }

      try {
        // If gateway not provided, derive from IP (e.g., 192.168.1.100 -> 192.168.1.1)
        const derivedGateway = gateway || newIp.replace(/\.\d+$/, '.1');

        const result = await SadpModule.modifyDeviceIp(mac, newIp, netmask, derivedGateway, password);

        if (result.success) {
          // Update the device in our list with new IP
          const key = mac.toLowerCase().replace(/[:-]/g, '');
          const existingDevice = deviceMapRef.current.get(key);
          if (existingDevice) {
            deviceMapRef.current.set(key, {
              ...existingDevice,
              ip: newIp,
              netmask,
              gateway: derivedGateway,
              dhcp: false,
            });
            setDevices(Array.from(deviceMapRef.current.values()));
          }
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to modify device IP';
        return {
          success: false,
          message,
        };
      }
    },
    [isAvailable]
  );

  // Activate device and auto-import to backend
  const activateDevice = useCallback(
    async (mac: string, password: string): Promise<ActivateResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: 'SADP module is not available on this platform',
        };
      }

      try {
        const result = await SadpModule.activateDevice(mac, password);

        if (result.success) {
          // Update the device in our list to show activated
          const key = mac.toLowerCase().replace(/[:-]/g, '');
          const existingDevice = deviceMapRef.current.get(key);
          if (existingDevice) {
            deviceMapRef.current.set(key, {
              ...existingDevice,
              activated: true,
            });
            setDevices(Array.from(deviceMapRef.current.values()));

            // Auto-import device to backend (save device + password)
            try {
              const importRequest: CreateIsapiDeviceRequest = {
                deviceName: existingDevice.model || `海康设备_${existingDevice.ip}`,
                deviceType: (existingDevice.deviceType?.toUpperCase() as 'IPC' | 'NVR' | 'DVR') || 'IPC',
                deviceModel: existingDevice.model,
                serialNumber: existingDevice.serialNumber || result.serialNumber,
                macAddress: existingDevice.mac,
                firmwareVersion: existingDevice.firmwareVersion,
                ipAddress: existingDevice.ip,
                port: parseInt(existingDevice.httpPort || '80', 10),
                username: 'admin',
                password: password,
              };

              const importedDevice = await createIsapiDevice(importRequest);
              console.log('[useSadpDiscovery] 设备已自动导入系统:', importedDevice.id);

              return {
                ...result,
                message: '设备激活成功并已导入系统',
                deviceId: importedDevice.id,
              };
            } catch (importError) {
              // 激活成功但导入失败，仍返回激活成功，但提示导入失败
              console.warn('[useSadpDiscovery] 设备激活成功，但导入系统失败:', importError);
              return {
                ...result,
                message: '设备激活成功，但自动导入失败，请手动添加设备',
              };
            }
          }
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to activate device';
        return {
          success: false,
          message,
        };
      }
    },
    [isAvailable]
  );

  // Reset device password
  const resetDevicePassword = useCallback(
    async (
      mac: string,
      serialNumber: string,
      newPassword: string,
      securityCode?: string
    ): Promise<ResetPasswordResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: 'SADP module is not available on this platform',
        };
      }

      try {
        return await SadpModule.resetDevicePassword(mac, serialNumber, newPassword, securityCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to reset password';
        return {
          success: false,
          message,
        };
      }
    },
    [isAvailable]
  );

  // Restore factory settings
  const restoreFactorySettings = useCallback(
    async (mac: string, password: string): Promise<RestoreResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: 'SADP module is not available on this platform',
        };
      }

      try {
        const result = await SadpModule.restoreFactorySettings(mac, password);

        if (result.success) {
          // Update the device in our list to show unactivated (factory reset)
          const key = mac.toLowerCase().replace(/[:-]/g, '');
          const existingDevice = deviceMapRef.current.get(key);
          if (existingDevice) {
            deviceMapRef.current.set(key, {
              ...existingDevice,
              activated: false,
            });
            setDevices(Array.from(deviceMapRef.current.values()));
          }
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to restore factory settings';
        return {
          success: false,
          message,
        };
      }
    },
    [isAvailable]
  );

  // Clear devices
  const clearDevices = useCallback(() => {
    deviceMapRef.current.clear();
    setDevices([]);
  }, []);

  // Cleanup on unmount only (empty dependency array)
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      SadpModule.stopDiscovery().catch(() => {
        // Ignore cleanup errors
      });
    };
  }, []);

  return {
    devices,
    isDiscovering,
    status,
    error,
    startDiscovery,
    stopDiscovery,
    modifyDeviceIp,
    activateDevice,
    resetDevicePassword,
    restoreFactorySettings,
    clearDevices,
    isAvailable,
  };
}
