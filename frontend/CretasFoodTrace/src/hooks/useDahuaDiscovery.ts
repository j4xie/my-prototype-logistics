/**
 * useDahuaDiscovery Hook
 *
 * React hook for Dahua DHDiscover device discovery functionality.
 * Provides an easy-to-use interface for discovering and managing
 * Dahua-compatible devices on the local network.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import {
  DahuaModule,
  DahuaDevice,
  DahuaDiscoveryStatus,
  DahuaModifyIpResult,
  DahuaInitResult,
  DahuaResetPasswordResult,
} from '../native/DahuaModule';
import * as dahuaApiClient from '../services/api/dahuaApiClient';

interface UseDahuaDiscoveryResult {
  /** List of discovered devices */
  devices: DahuaDevice[];
  /** Whether discovery is in progress */
  isDiscovering: boolean;
  /** Current discovery status */
  status: DahuaDiscoveryStatus | null;
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
  ) => Promise<DahuaModifyIpResult>;
  /** Initialize an uninitialized device */
  initializeDevice: (mac: string, password: string) => Promise<DahuaInitResult>;
  /** Reset device password */
  resetDevicePassword: (
    mac: string,
    serialNumber: string,
    newPassword: string,
    securityCode?: string
  ) => Promise<DahuaResetPasswordResult>;
  /** Clear discovered devices list */
  clearDevices: () => void;
  /** Check if Dahua discovery is available on this platform */
  isAvailable: boolean;
}

/**
 * Hook for Dahua DHDiscover device discovery
 *
 * @example
 * ```tsx
 * const {
 *   devices,
 *   isDiscovering,
 *   startDiscovery,
 *   stopDiscovery,
 *   initializeDevice
 * } = useDahuaDiscovery();
 *
 * // Start scanning
 * await startDiscovery();
 *
 * // Initialize uninitialized device
 * await initializeDevice('AA:BB:CC:DD:EE:FF', 'Admin123');
 * ```
 */
export function useDahuaDiscovery(): UseDahuaDiscoveryResult {
  const [devices, setDevices] = useState<DahuaDevice[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [status, setStatus] = useState<DahuaDiscoveryStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const deviceMapRef = useRef<Map<string, DahuaDevice>>(new Map());
  const cleanupRef = useRef<(() => void)[]>([]);

  const isAvailable = DahuaModule.isAvailable();

  // Handle device found event
  const handleDeviceFound = useCallback((device: DahuaDevice) => {
    // Use MAC address as unique key
    const key = device.mac.toLowerCase().replace(/[:-]/g, '');

    // Update device if already exists (refresh timestamp)
    deviceMapRef.current.set(key, device);

    // Convert map to array and update state
    setDevices(Array.from(deviceMapRef.current.values()));
  }, []);

  // Handle discovery status event
  const handleStatusChange = useCallback((newStatus: DahuaDiscoveryStatus) => {
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
          '平台不支持',
          '大华设备发现仅在 Android 设备上可用。'
        );
      }
      return;
    }

    try {
      setError(null);

      // Set up event listeners
      const unsubDevice = DahuaModule.onDeviceFound(handleDeviceFound);
      const unsubStatus = DahuaModule.onDiscoveryStatus(handleStatusChange);
      cleanupRef.current = [unsubDevice, unsubStatus];

      await DahuaModule.startDiscovery();
      setIsDiscovering(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '启动设备发现失败';
      setError(message);
      setIsDiscovering(false);
    }
  }, [isAvailable, handleDeviceFound, handleStatusChange]);

  // Stop discovery
  const stopDiscovery = useCallback(async () => {
    try {
      await DahuaModule.stopDiscovery();
      setIsDiscovering(false);

      // Clean up event listeners
      cleanupRef.current.forEach((cleanup) => cleanup());
      cleanupRef.current = [];
    } catch (err) {
      const message = err instanceof Error ? err.message : '停止设备发现失败';
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
    ): Promise<DahuaModifyIpResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: '此平台不支持大华设备模块',
        };
      }

      try {
        // If gateway not provided, derive from IP (e.g., 192.168.1.100 -> 192.168.1.1)
        const derivedGateway = gateway || newIp.replace(/\.\d+$/, '.1');

        const result = await DahuaModule.modifyDeviceIp(mac, newIp, netmask, derivedGateway, password);

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
            });
            setDevices(Array.from(deviceMapRef.current.values()));
          }
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '修改设备IP失败';
        return {
          success: false,
          message,
        };
      }
    },
    [isAvailable]
  );

  // Initialize device and auto-import to backend
  const initializeDevice = useCallback(
    async (mac: string, password: string): Promise<DahuaInitResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: '此平台不支持大华设备模块',
        };
      }

      try {
        const result = await DahuaModule.initializeDevice(mac, password);

        if (result.success) {
          // Update the device in our list to show initialized
          const key = mac.toLowerCase().replace(/[:-]/g, '');
          const existingDevice = deviceMapRef.current.get(key);
          if (existingDevice) {
            deviceMapRef.current.set(key, {
              ...existingDevice,
              initialized: true,
            });
            setDevices(Array.from(deviceMapRef.current.values()));

            // Auto-import device to backend
            try {
              const discoveredDevice: dahuaApiClient.DiscoveredDahuaDevice = {
                mac: existingDevice.mac,
                ipAddress: existingDevice.ip,
                port: parseInt(existingDevice.controlPort || '37777', 10),
                httpPort: parseInt(existingDevice.httpPort || '80', 10),
                deviceType: existingDevice.deviceType,
                serialNumber: existingDevice.serialNumber || result.serialNumber,
                model: existingDevice.model,
                firmwareVersion: existingDevice.firmwareVersion,
                activated: true,
                discoveredAt: existingDevice.discoveredAt,
              };

              // Get factoryId from auth store
              const factoryId = useAuthStore.getState().getFactoryId();
              if (!factoryId) {
                console.warn('[useDahuaDiscovery] 无法获取factoryId，跳过设备导入');
                return { ...result, autoImported: false };
              }
              const importedDevice = await dahuaApiClient.importDahuaDevice(
                factoryId,
                discoveredDevice,
                'admin',
                password,
                existingDevice.model || `大华设备_${existingDevice.ip}`
              );
              console.log('[useDahuaDiscovery] 设备已自动导入系统:', importedDevice.id);

              return {
                ...result,
                message: '设备初始化成功并已导入系统',
                deviceId: importedDevice.id,
              };
            } catch (importError) {
              // 初始化成功但导入失败，仍返回初始化成功，但提示导入失败
              console.warn('[useDahuaDiscovery] 设备初始化成功，但导入系统失败:', importError);
              return {
                ...result,
                message: '设备初始化成功，但自动导入失败，请手动添加设备',
              };
            }
          }
        }

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : '初始化设备失败';
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
    ): Promise<DahuaResetPasswordResult> => {
      if (!isAvailable) {
        return {
          success: false,
          message: '此平台不支持大华设备模块',
        };
      }

      try {
        return await DahuaModule.resetDevicePassword(mac, serialNumber, newPassword, securityCode);
      } catch (err) {
        const message = err instanceof Error ? err.message : '重置密码失败';
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((cleanup) => cleanup());
      DahuaModule.stopDiscovery().catch(() => {
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
    initializeDevice,
    resetDevicePassword,
    clearDevices,
    isAvailable,
  };
}

