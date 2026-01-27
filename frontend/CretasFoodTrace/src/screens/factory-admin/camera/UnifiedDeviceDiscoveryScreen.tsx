/**
 * Unified Multi-Brand Camera Device Discovery Screen
 * Supports both Hikvision (ISAPI/SADP) and Dahua (DHDiscover) devices with parallel discovery
 *
 * Features:
 * 1. Brand Selection: Allow user to select which brands to discover (海康威视, 大华, 全部)
 * 2. Parallel Discovery: When "全部" is selected, discover both brands simultaneously
 * 3. Unified Display: Show all discovered devices in a single list with brand badge
 * 4. Brand-specific Import: Import devices to the correct backend (ISAPI vs Dahua API)
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';

// API Clients
import isapiApiClient, {
  BatchImportRequest,
  CreateIsapiDeviceRequest,
  getDeviceTypeName as getIsapiDeviceTypeName,
  IsapiDeviceType,
} from '../../../services/api/isapiApiClient';
import * as dahuaApiClient from '../../../services/api/dahuaApiClient';

// Utilities
import {
  generateHikvisionPassword,
  validateHikvisionPassword,
} from '../../../utils/passwordGenerator';
import { useSadpDiscovery } from '../../../hooks/useSadpDiscovery';
import { useDahuaDiscovery } from '../../../hooks/useDahuaDiscovery';
import { SadpDevice } from '../../../native/SadpModule';
import { DahuaDevice } from '../../../native/DahuaModule';
import LocalDeviceDiscovery, {
  DiscoveredDevice as HttpDiscoveredDevice,
  DiscoveryProgress,
} from '../../../services/network/LocalDeviceDiscoveryService';
import { getCurrentFactoryId } from '../../../utils/factoryIdHelper';

// Navigation type
type UnifiedDiscoveryStackParamList = {
  UnifiedDeviceDiscovery: undefined;
  IsapiDeviceList: undefined;
};

type NavigationProp = NativeStackNavigationProp<UnifiedDiscoveryStackParamList, 'UnifiedDeviceDiscovery'>;

// ========== Type Definitions ==========

/**
 * Unified device interface that combines both brands
 */
export interface UnifiedDiscoveredDevice {
  id: string;  // Generated from MAC or IP
  manufacturer: 'HIKVISION' | 'DAHUA' | 'UNKNOWN';
  ipAddress: string;
  port: number;
  macAddress?: string;
  deviceType: string;
  deviceModel?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  isActivated: boolean;
  discoveryMethod: 'sadp' | 'dhdiscover' | 'http';
  // Original device data for import
  originalData?: SadpDevice | HttpDiscoveredDevice | dahuaApiClient.DiscoveredDahuaDevice;
}

/**
 * Brand filter options
 */
type BrandFilter = 'ALL' | 'HIKVISION' | 'DAHUA';

/**
 * Discovery mode
 */
type DiscoveryMode = 'idle' | 'discovering' | 'completed';

/**
 * Discovery progress per brand
 */
interface BrandDiscoveryProgress {
  hikvision: {
    status: 'idle' | 'discovering' | 'completed' | 'error';
    deviceCount: number;
    error?: string;
  };
  dahua: {
    status: 'idle' | 'discovering' | 'completed' | 'error';
    deviceCount: number;
    error?: string;
  };
}

// Constants
const SADP_TIMEOUT_MS = 8000;
const DAHUA_DISCOVERY_TIMEOUT_MS = 10000;

// Brand colors
const BRAND_COLORS = {
  HIKVISION: '#3182ce',  // Blue
  DAHUA: '#e53e3e',      // Red
  UNKNOWN: '#718096',    // Gray
};

// ========== Adapter Functions ==========

/**
 * Adapt SADP device to unified format
 */
function adaptSadpDevice(device: SadpDevice): UnifiedDiscoveredDevice {
  return {
    id: device.mac || `${device.ip}:${device.httpPort}`,
    manufacturer: 'HIKVISION',
    ipAddress: device.ip,
    port: parseInt(device.httpPort, 10) || 80,
    macAddress: device.mac,
    deviceType: device.deviceType || 'IPC',
    deviceModel: device.model,
    serialNumber: device.serialNumber,
    firmwareVersion: device.firmwareVersion,
    isActivated: device.activated,
    discoveryMethod: 'sadp',
    originalData: device,
  };
}

/**
 * Adapt HTTP discovered device to unified format
 */
function adaptHttpDevice(device: HttpDiscoveredDevice): UnifiedDiscoveredDevice {
  // Determine manufacturer based on device info
  let manufacturer: 'HIKVISION' | 'DAHUA' | 'UNKNOWN' = 'UNKNOWN';
  if (device.manufacturer?.toUpperCase().includes('HIKVISION') ||
      device.manufacturer?.toUpperCase().includes('HIK')) {
    manufacturer = 'HIKVISION';
  } else if (device.manufacturer?.toUpperCase().includes('DAHUA') ||
             device.manufacturer?.toUpperCase().includes('DH')) {
    manufacturer = 'DAHUA';
  }

  return {
    id: device.macAddress || `${device.ipAddress}:${device.port}`,
    manufacturer,
    ipAddress: device.ipAddress,
    port: device.port,
    macAddress: device.macAddress,
    deviceType: device.deviceType,
    deviceModel: device.deviceModel,
    serialNumber: device.serialNumber,
    firmwareVersion: device.firmwareVersion,
    isActivated: !device.authRequired,
    discoveryMethod: 'http',
    originalData: device,
  };
}

/**
 * Adapt Dahua discovered device from native module to unified format
 */
function adaptDahuaDevice(device: DahuaDevice): UnifiedDiscoveredDevice {
  return {
    id: device.mac || `${device.ip}:${device.httpPort}`,
    manufacturer: 'DAHUA',
    ipAddress: device.ip,
    port: parseInt(device.httpPort, 10) || 80,
    macAddress: device.mac,
    deviceType: device.deviceType || 'IPC',
    deviceModel: device.model,
    serialNumber: device.serialNumber,
    firmwareVersion: device.firmwareVersion,
    isActivated: device.initialized,
    discoveryMethod: 'dhdiscover',
    originalData: device as unknown as dahuaApiClient.DiscoveredDahuaDevice,
  };
}

/**
 * Deduplicate devices by MAC address or IP
 */
function deduplicateDevices(devices: UnifiedDiscoveredDevice[]): UnifiedDiscoveredDevice[] {
  const seen = new Map<string, UnifiedDiscoveredDevice>();

  for (const device of devices) {
    const key = device.macAddress || `${device.ipAddress}:${device.port}`;

    // If already seen, prefer the one with more info or from native discovery
    if (seen.has(key)) {
      const existing = seen.get(key)!;
      // Prefer SADP/DHDiscover over HTTP discovery
      if (device.discoveryMethod !== 'http' && existing.discoveryMethod === 'http') {
        seen.set(key, device);
      }
    } else {
      seen.set(key, device);
    }
  }

  return Array.from(seen.values());
}

// ========== Main Component ==========

export function UnifiedDeviceDiscoveryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const factoryId = getCurrentFactoryId();

  // SADP Discovery Hook (for Hikvision)
  const {
    devices: sadpDevices,
    isDiscovering: isSadpDiscovering,
    error: sadpError,
    startDiscovery: startSadpDiscovery,
    stopDiscovery: stopSadpDiscovery,
    clearDevices: clearSadpDevices,
    isAvailable: isSadpAvailable,
    activateDevice: activateSadpDevice,
  } = useSadpDiscovery();

  // Dahua Discovery Hook (for Dahua via native DHDiscover)
  const {
    devices: dahuaDevices,
    isDiscovering: isDahuaDiscovering,
    error: dahuaError,
    startDiscovery: startDahuaDiscovery,
    stopDiscovery: stopDahuaDiscovery,
    clearDevices: clearDahuaDevices,
    isAvailable: isDahuaAvailable,
    initializeDevice: initializeDahuaDevice,
  } = useDahuaDiscovery();

  // Brand filter state
  const [brandFilter, setBrandFilter] = useState<BrandFilter>('ALL');

  // Discovery state
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('idle');
  const [discoveredDevices, setDiscoveredDevices] = useState<UnifiedDiscoveredDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  // Progress tracking per brand
  const [brandProgress, setBrandProgress] = useState<BrandDiscoveryProgress>({
    hikvision: { status: 'idle', deviceCount: 0 },
    dahua: { status: 'idle', deviceCount: 0 },
  });

  // HTTP scan state (fallback)
  const [networkCIDR, setNetworkCIDR] = useState('');
  const [httpScanProgress, setHttpScanProgress] = useState<DiscoveryProgress | null>(null);
  const [showHttpFallback, setShowHttpFallback] = useState(false);

  // SADP devices ref for timeout check
  const sadpDevicesRef = useRef<SadpDevice[]>([]);
  // Dahua devices ref for timeout check
  const dahuaDevicesRef = useRef<DahuaDevice[]>([]);

  // Import modal state
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  // Activation modal state
  const [activateModalVisible, setActivateModalVisible] = useState(false);
  const [activatingDevice, setActivatingDevice] = useState<UnifiedDiscoveredDevice | null>(null);
  const [activatePassword, setActivatePassword] = useState('');
  const [activateConfirmPassword, setActivateConfirmPassword] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [passwordMode, setPasswordMode] = useState<'auto' | 'manual'>('auto');
  const [generatedPassword, setGeneratedPassword] = useState('');

  // Update SADP devices ref
  useEffect(() => {
    sadpDevicesRef.current = sadpDevices;
  }, [sadpDevices]);

  // Update Dahua devices ref
  useEffect(() => {
    dahuaDevicesRef.current = dahuaDevices;
  }, [dahuaDevices]);

  // ========== Discovery Functions ==========

  /**
   * Discover Hikvision devices via SADP
   */
  const discoverHikvision = useCallback(async (): Promise<UnifiedDiscoveredDevice[]> => {
    if (!isSadpAvailable) {
      return [];
    }

    setBrandProgress(prev => ({
      ...prev,
      hikvision: { status: 'discovering', deviceCount: 0 },
    }));

    try {
      await startSadpDiscovery();

      // Wait for SADP timeout
      await new Promise(resolve => setTimeout(resolve, SADP_TIMEOUT_MS));

      await stopSadpDiscovery();

      const devices = sadpDevicesRef.current.map(adaptSadpDevice);

      setBrandProgress(prev => ({
        ...prev,
        hikvision: { status: 'completed', deviceCount: devices.length },
      }));

      return devices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBrandProgress(prev => ({
        ...prev,
        hikvision: { status: 'error', deviceCount: 0, error: errorMessage },
      }));
      return [];
    }
  }, [isSadpAvailable, startSadpDiscovery, stopSadpDiscovery]);

  /**
   * Discover Dahua devices via native DHDiscover protocol
   */
  const discoverDahua = useCallback(async (): Promise<UnifiedDiscoveredDevice[]> => {
    if (!isDahuaAvailable) {
      setBrandProgress(prev => ({
        ...prev,
        dahua: { status: 'error', deviceCount: 0, error: '大华发现模块不可用' },
      }));
      return [];
    }

    setBrandProgress(prev => ({
      ...prev,
      dahua: { status: 'discovering', deviceCount: 0 },
    }));

    try {
      await startDahuaDiscovery();

      // Wait for Dahua discovery timeout
      await new Promise(resolve => setTimeout(resolve, DAHUA_DISCOVERY_TIMEOUT_MS));

      await stopDahuaDiscovery();

      const devices = dahuaDevicesRef.current.map(adaptDahuaDevice);

      setBrandProgress(prev => ({
        ...prev,
        dahua: { status: 'completed', deviceCount: devices.length },
      }));

      return devices;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setBrandProgress(prev => ({
        ...prev,
        dahua: { status: 'error', deviceCount: 0, error: errorMessage },
      }));
      return [];
    }
  }, [isDahuaAvailable, startDahuaDiscovery, stopDahuaDiscovery]);

  /**
   * Parallel discovery handler
   */
  const handleParallelDiscovery = useCallback(async () => {
    // Clear previous state
    clearSadpDevices();
    clearDahuaDevices();
    setDiscoveredDevices([]);
    setSelectedDevices(new Set());
    setShowHttpFallback(false);
    setHttpScanProgress(null);
    setBrandProgress({
      hikvision: { status: 'idle', deviceCount: 0 },
      dahua: { status: 'idle', deviceCount: 0 },
    });

    setDiscoveryMode('discovering');

    const promises: Promise<UnifiedDiscoveredDevice[]>[] = [];

    // Add discovery tasks based on filter
    if (brandFilter === 'ALL' || brandFilter === 'HIKVISION') {
      promises.push(discoverHikvision());
    }
    if (brandFilter === 'ALL' || brandFilter === 'DAHUA') {
      promises.push(discoverDahua());
    }

    // Execute all discoveries in parallel
    const results = await Promise.allSettled(promises);

    // Merge results
    const allDevices: UnifiedDiscoveredDevice[] = [];
    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        allDevices.push(...result.value);
      }
    });

    // Deduplicate by MAC address
    const uniqueDevices = deduplicateDevices(allDevices);

    setDiscoveredDevices(uniqueDevices);
    setDiscoveryMode('completed');

    // Auto-select activated devices
    const activatedKeys = uniqueDevices
      .filter(d => d.isActivated)
      .map(d => d.id);
    setSelectedDevices(new Set(activatedKeys));

    // Show HTTP fallback if no devices found
    if (uniqueDevices.length === 0) {
      setShowHttpFallback(true);
      // Auto-detect network CIDR
      try {
        const currentCIDR = await LocalDeviceDiscovery.getCurrentNetworkCIDR();
        setNetworkCIDR(currentCIDR || '192.168.1.0/24');
      } catch {
        setNetworkCIDR('192.168.1.0/24');
      }
    }
  }, [brandFilter, clearSadpDevices, clearDahuaDevices, discoverHikvision, discoverDahua]);

  /**
   * HTTP scan fallback
   */
  const handleHttpScan = useCallback(async () => {
    if (!networkCIDR.trim()) {
      Alert.alert('提示', '请输入网段地址');
      return;
    }

    const validation = LocalDeviceDiscovery.validateCIDR(networkCIDR);
    if (!validation.valid) {
      Alert.alert('格式错误', validation.error || '请输入有效的 CIDR 格式网段，如 192.168.1.0/24');
      return;
    }

    setDiscoveryMode('discovering');
    setHttpScanProgress(null);

    try {
      const httpDevices = await LocalDeviceDiscovery.discoverDevices({
        networkCIDR: networkCIDR.trim(),
        timeout: 2000,
        ports: [80, 8000, 37777], // Include Dahua TCP port
        maxConcurrent: 30,
        onProgress: setHttpScanProgress,
      });

      const adaptedDevices = httpDevices.map(adaptHttpDevice);

      // Merge with existing devices
      const allDevices = [...discoveredDevices, ...adaptedDevices];
      const uniqueDevices = deduplicateDevices(allDevices);

      setDiscoveredDevices(uniqueDevices);
      setDiscoveryMode('completed');

      // Auto-select supported devices
      const supportedKeys = adaptedDevices
        .filter(d => d.manufacturer !== 'UNKNOWN')
        .map(d => d.id);
      setSelectedDevices(prev => new Set([...prev, ...supportedKeys]));

      if (httpDevices.length === 0) {
        Alert.alert('扫描完成', '未发现任何设备\n\n请确认:\n1. 设备已通电并联网\n2. 设备与手机在同一局域网\n3. 网段地址正确');
      }
    } catch (error) {
      console.error('[Discovery] HTTP scan failed:', error);
      Alert.alert('扫描失败', '请检查网络连接');
      setDiscoveryMode('idle');
    }
  }, [networkCIDR, discoveredDevices]);

  // ========== Selection Handlers ==========

  const toggleDeviceSelection = (device: UnifiedDiscoveredDevice) => {
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(device.id)) {
      newSelected.delete(device.id);
    } else {
      newSelected.add(device.id);
    }
    setSelectedDevices(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedDevices.size === discoveredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      const allKeys = discoveredDevices.map(d => d.id);
      setSelectedDevices(new Set(allKeys));
    }
  };

  // ========== Import Handlers ==========

  const handleOpenImportModal = () => {
    if (selectedDevices.size === 0) {
      Alert.alert('提示', '请先选择要导入的设备');
      return;
    }
    setImportModalVisible(true);
  };

  /**
   * Import Hikvision devices to ISAPI backend
   */
  const importHikvisionDevices = async (
    devices: UnifiedDiscoveredDevice[],
    credentials: { username: string; password: string }
  ): Promise<{ imported: number; failed: number; errors: string[] }> => {
    if (devices.length === 0) {
      return { imported: 0, failed: 0, errors: [] };
    }

    const request: BatchImportRequest = {
      devices: devices.map(d => ({
        ipAddress: d.ipAddress,
        port: d.port,
        username: credentials.username,
        password: credentials.password,
        deviceName: d.deviceModel || `海康设备_${d.ipAddress}`,
        deviceType: d.deviceType,
      })),
    };

    try {
      const result = await isapiApiClient.batchImportDevices(request);
      return {
        imported: result.imported,
        failed: result.failed,
        errors: result.failedDevices?.map(f => `${f.ipAddress}: ${f.error}`) || [],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        imported: 0,
        failed: devices.length,
        errors: [`批量导入失败: ${errorMessage}`],
      };
    }
  };

  /**
   * Import Dahua devices to Dahua backend
   */
  const importDahuaDevices = async (
    devices: UnifiedDiscoveredDevice[],
    credentials: { username: string; password: string }
  ): Promise<{ imported: number; failed: number; errors: string[] }> => {
    if (devices.length === 0) {
      return { imported: 0, failed: 0, errors: [] };
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const device of devices) {
      try {
        const originalDevice = device.originalData as dahuaApiClient.DiscoveredDahuaDevice;

        await dahuaApiClient.importDahuaDevice(
          factoryId,
          originalDevice || {
            mac: device.macAddress || '',
            ipAddress: device.ipAddress,
            httpPort: device.port,
            port: 37777,
            activated: device.isActivated,
            discoveredAt: Date.now(),
          },
          credentials.username,
          credentials.password,
          device.deviceModel || `大华设备_${device.ipAddress}`
        );
        imported++;
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${device.ipAddress}: ${errorMessage}`);
      }
    }

    return { imported, failed, errors };
  };

  /**
   * Batch import handler
   */
  const handleBatchImport = async () => {
    if (!username.trim()) {
      Alert.alert('提示', '请输入用户名');
      return;
    }
    if (!password.trim()) {
      Alert.alert('提示', '请输入密码');
      return;
    }

    try {
      setImporting(true);

      const devicesToImport = discoveredDevices.filter(d => selectedDevices.has(d.id));

      // Separate by manufacturer
      const hikvisionDevices = devicesToImport.filter(d => d.manufacturer === 'HIKVISION');
      const dahuaDevices = devicesToImport.filter(d => d.manufacturer === 'DAHUA');
      const unknownDevices = devicesToImport.filter(d => d.manufacturer === 'UNKNOWN');

      const credentials = { username: username.trim(), password: password.trim() };

      // Import in parallel
      const [hikResult, dahuaResult] = await Promise.all([
        importHikvisionDevices(hikvisionDevices, credentials),
        importDahuaDevices(dahuaDevices, credentials),
      ]);

      // Handle unknown devices (try both protocols)
      let unknownImported = 0;
      let unknownFailed = 0;
      const unknownErrors: string[] = [];

      for (const device of unknownDevices) {
        try {
          // Try Hikvision first
          await isapiApiClient.createIsapiDevice({
            ipAddress: device.ipAddress,
            port: device.port,
            username: credentials.username,
            password: credentials.password,
            deviceName: device.deviceModel || `设备_${device.ipAddress}`,
            deviceType: (device.deviceType as IsapiDeviceType) || 'IPC',
          });
          unknownImported++;
        } catch {
          unknownFailed++;
          unknownErrors.push(`${device.ipAddress}: 未知品牌，导入失败`);
        }
      }

      setImportModalVisible(false);

      // Show results
      const totalImported = hikResult.imported + dahuaResult.imported + unknownImported;
      const totalFailed = hikResult.failed + dahuaResult.failed + unknownFailed;
      const allErrors = [...hikResult.errors, ...dahuaResult.errors, ...unknownErrors];

      if (totalFailed > 0 && allErrors.length > 0) {
        const failedList = allErrors.slice(0, 5).join('\n');
        const moreText = allErrors.length > 5 ? `\n...及其他 ${allErrors.length - 5} 个错误` : '';
        Alert.alert(
          '导入完成',
          `成功导入 ${totalImported} 台设备\n失败 ${totalFailed} 台设备\n\n失败详情:\n${failedList}${moreText}`,
          [
            { text: '查看设备列表', onPress: () => navigation.navigate('IsapiDeviceList') },
            { text: '继续扫描', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          '导入成功',
          `已成功导入 ${totalImported} 台设备\n• 海康威视: ${hikResult.imported} 台\n• 大华: ${dahuaResult.imported} 台${unknownImported > 0 ? `\n• 其他: ${unknownImported} 台` : ''}`,
          [{ text: '查看设备列表', onPress: () => navigation.navigate('IsapiDeviceList') }]
        );
      }
    } catch (error) {
      console.error('Batch import failed:', error);
      Alert.alert('导入失败', '批量导入设备失败，请检查用户名密码是否正确');
    } finally {
      setImporting(false);
    }
  };

  // ========== Activation Handlers ==========

  const handleOpenActivateModal = (device: UnifiedDiscoveredDevice) => {
    setActivatingDevice(device);
    setPasswordMode('auto');
    setGeneratedPassword(generateHikvisionPassword());
    setActivatePassword('');
    setActivateConfirmPassword('');
    setActivateModalVisible(true);
  };

  const handleActivateDevice = async () => {
    if (!activatingDevice || !activatingDevice.macAddress) {
      Alert.alert('错误', '设备信息不完整');
      return;
    }

    const finalPassword = passwordMode === 'auto' ? generatedPassword : activatePassword;

    if (passwordMode === 'manual') {
      const validation = validateHikvisionPassword(activatePassword);
      if (!validation.valid) {
        Alert.alert('密码不符合要求', validation.error);
        return;
      }
      if (activatePassword !== activateConfirmPassword) {
        Alert.alert('密码不匹配', '两次输入的密码不一致');
        return;
      }
    }

    try {
      setIsActivating(true);

      let result: { success: boolean; message?: string };

      if (activatingDevice.manufacturer === 'HIKVISION') {
        result = await activateSadpDevice(activatingDevice.macAddress, finalPassword);
      } else if (activatingDevice.manufacturer === 'DAHUA') {
        // Use native Dahua module for initialization
        const dahuaResult = await initializeDahuaDevice(activatingDevice.macAddress, finalPassword);
        result = { success: dahuaResult.success, message: dahuaResult.message };
      } else {
        Alert.alert('错误', '不支持激活此品牌的设备');
        return;
      }

      if (result.success) {
        // Update device status
        setDiscoveredDevices(prev =>
          prev.map(d =>
            d.id === activatingDevice.id
              ? { ...d, isActivated: true }
              : d
          )
        );

        Alert.alert(
          '激活成功',
          passwordMode === 'auto'
            ? `设备已激活\n\n自动生成的密码：${finalPassword}\n\n请妥善保存此密码`
            : '设备已激活',
          [
            {
              text: '复制密码',
              onPress: async () => {
                await Clipboard.setStringAsync(finalPassword);
                Alert.alert('已复制', '密码已复制到剪贴板');
              },
            },
            {
              text: '确定',
              onPress: () => setActivateModalVisible(false),
            },
          ]
        );
      } else {
        Alert.alert('激活失败', result.message || '激活失败');
      }
    } catch (error) {
      console.error('Device activation failed:', error);
      Alert.alert('激活失败', '请检查网络连接');
    } finally {
      setIsActivating(false);
    }
  };

  // ========== Render Helpers ==========

  const getDeviceIcon = (type: string): string => {
    const icons: Record<string, string> = {
      IPC: 'cctv',
      NVR: 'server',
      DVR: 'harddisk',
      XVR: 'video-switch',
      ENCODER: 'video-box',
    };
    return icons[type] || 'camera';
  };

  const getBrandDisplayName = (manufacturer: UnifiedDiscoveredDevice['manufacturer']): string => {
    const names = {
      HIKVISION: '海康威视',
      DAHUA: '大华',
      UNKNOWN: '未知',
    };
    return names[manufacturer];
  };

  const isScanning = discoveryMode === 'discovering';

  // ========== Render Device Item ==========

  const renderDeviceItem = ({ item }: { item: UnifiedDiscoveredDevice }) => {
    const isSelected = selectedDevices.has(item.id);
    const brandColor = BRAND_COLORS[item.manufacturer];

    return (
      <TouchableOpacity
        style={[styles.deviceCard, isSelected && styles.deviceCardSelected]}
        onPress={() => toggleDeviceSelection(item)}
        activeOpacity={0.7}
      >
        <View style={styles.deviceHeader}>
          <View style={styles.checkboxContainer}>
            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
              {isSelected && <Icon source="check" size={16} color="#ffffff" />}
            </View>
          </View>

          <View style={styles.deviceInfo}>
            <Icon source={getDeviceIcon(item.deviceType)} size={28} color={brandColor} />
            <View style={styles.deviceTextInfo}>
              <Text style={styles.deviceName}>
                {item.deviceModel || `${getBrandDisplayName(item.manufacturer)} 设备`}
              </Text>
              <Text style={styles.deviceType}>
                {getIsapiDeviceTypeName(item.deviceType as IsapiDeviceType) || item.deviceType}
              </Text>
            </View>
          </View>

          {/* Brand Badge */}
          <View style={[styles.brandBadge, { backgroundColor: brandColor }]}>
            <Text style={styles.brandBadgeText}>{getBrandDisplayName(item.manufacturer)}</Text>
          </View>
        </View>

        <View style={styles.deviceDetails}>
          <View style={styles.detailRow}>
            <Icon source="ip-network" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.ipAddress}:{item.port}</Text>
          </View>

          {item.macAddress && (
            <View style={styles.detailRow}>
              <Icon source="ethernet" size={16} color="#718096" />
              <Text style={styles.detailText}>{item.macAddress}</Text>
            </View>
          )}

          {item.serialNumber && (
            <View style={styles.detailRow}>
              <Icon source="barcode" size={16} color="#718096" />
              <Text style={styles.detailText}>{item.serialNumber}</Text>
            </View>
          )}

          {/* Activation Status */}
          <View style={styles.detailRow}>
            {item.isActivated ? (
              <>
                <Icon source="check-circle" size={16} color="#48bb78" />
                <Text style={[styles.detailText, { color: '#48bb78' }]}>已激活</Text>
              </>
            ) : (
              <>
                <Icon source="alert-circle" size={16} color="#e53e3e" />
                <Text style={[styles.detailText, { color: '#e53e3e' }]}>未激活</Text>
              </>
            )}
          </View>

          {/* Discovery Method Badge */}
          <View style={styles.discoveryMethodBadge}>
            <Icon
              source={item.discoveryMethod === 'http' ? 'web' : 'broadcast'}
              size={12}
              color="#718096"
            />
            <Text style={styles.discoveryMethodText}>
              {item.discoveryMethod === 'sadp' ? 'SADP' :
               item.discoveryMethod === 'dhdiscover' ? 'DHDiscover' : 'HTTP'}
            </Text>
          </View>
        </View>

        {/* Activate Button for unactivated devices */}
        {!item.isActivated && item.manufacturer !== 'UNKNOWN' && (
          <TouchableOpacity
            style={[styles.activateButton, { backgroundColor: brandColor }]}
            onPress={(e) => {
              e.stopPropagation();
              handleOpenActivateModal(item);
            }}
          >
            <Icon source="key" size={16} color="#ffffff" />
            <Text style={styles.activateButtonText}>激活设备</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  // ========== Main Render ==========

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Brand Filter */}
      <View style={styles.filterSection}>
        <Text style={styles.sectionTitle}>设备发现</Text>
        <Text style={styles.sectionDescription}>
          同时发现海康威视和大华摄像头设备
        </Text>

        {/* Brand Filter Chips */}
        <View style={styles.filterChips}>
          <TouchableOpacity
            style={[
              styles.filterChip,
              brandFilter === 'ALL' && styles.filterChipActive,
            ]}
            onPress={() => setBrandFilter('ALL')}
            disabled={isScanning}
          >
            <Icon source="all-inclusive" size={16} color={brandFilter === 'ALL' ? '#ffffff' : '#3182ce'} />
            <Text style={[
              styles.filterChipText,
              brandFilter === 'ALL' && styles.filterChipTextActive,
            ]}>全部</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              brandFilter === 'HIKVISION' && styles.filterChipActiveHik,
            ]}
            onPress={() => setBrandFilter('HIKVISION')}
            disabled={isScanning}
          >
            <Icon source="cctv" size={16} color={brandFilter === 'HIKVISION' ? '#ffffff' : BRAND_COLORS.HIKVISION} />
            <Text style={[
              styles.filterChipText,
              { color: brandFilter === 'HIKVISION' ? '#ffffff' : BRAND_COLORS.HIKVISION },
            ]}>海康威视</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              brandFilter === 'DAHUA' && styles.filterChipActiveDahua,
            ]}
            onPress={() => setBrandFilter('DAHUA')}
            disabled={isScanning}
          >
            <Icon source="camera" size={16} color={brandFilter === 'DAHUA' ? '#ffffff' : BRAND_COLORS.DAHUA} />
            <Text style={[
              styles.filterChipText,
              { color: brandFilter === 'DAHUA' ? '#ffffff' : BRAND_COLORS.DAHUA },
            ]}>大华</Text>
          </TouchableOpacity>
        </View>

        {/* Scan Button */}
        {!showHttpFallback && (
          <TouchableOpacity
            style={[styles.scanButton, styles.fullWidthButton, isScanning && styles.scanButtonDisabled]}
            onPress={handleParallelDiscovery}
            disabled={isScanning}
          >
            {isScanning ? (
              <>
                <ActivityIndicator size="small" color="#ffffff" />
                <Text style={styles.scanButtonText}>正在搜索设备...</Text>
              </>
            ) : (
              <>
                <Icon source="radar" size={20} color="#ffffff" />
                <Text style={styles.scanButtonText}>开始扫描</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Discovery Progress Indicators */}
        {isScanning && (
          <View style={styles.progressContainer}>
            {(brandFilter === 'ALL' || brandFilter === 'HIKVISION') && (
              <View style={styles.brandProgressRow}>
                <View style={[styles.brandProgressIndicator, { backgroundColor: BRAND_COLORS.HIKVISION }]}>
                  {brandProgress.hikvision.status === 'discovering' ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : brandProgress.hikvision.status === 'completed' ? (
                    <Icon source="check" size={14} color="#ffffff" />
                  ) : brandProgress.hikvision.status === 'error' ? (
                    <Icon source="alert" size={14} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.brandProgressText}>
                  海康威视: {brandProgress.hikvision.status === 'discovering' ? '搜索中...' :
                            brandProgress.hikvision.status === 'completed' ? `发现 ${brandProgress.hikvision.deviceCount} 台` :
                            brandProgress.hikvision.status === 'error' ? '搜索失败' : '待搜索'}
                </Text>
              </View>
            )}
            {(brandFilter === 'ALL' || brandFilter === 'DAHUA') && (
              <View style={styles.brandProgressRow}>
                <View style={[styles.brandProgressIndicator, { backgroundColor: BRAND_COLORS.DAHUA }]}>
                  {brandProgress.dahua.status === 'discovering' ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : brandProgress.dahua.status === 'completed' ? (
                    <Icon source="check" size={14} color="#ffffff" />
                  ) : brandProgress.dahua.status === 'error' ? (
                    <Icon source="alert" size={14} color="#ffffff" />
                  ) : null}
                </View>
                <Text style={styles.brandProgressText}>
                  大华: {brandProgress.dahua.status === 'discovering' ? '搜索中...' :
                        brandProgress.dahua.status === 'completed' ? `发现 ${brandProgress.dahua.deviceCount} 台` :
                        brandProgress.dahua.status === 'error' ? '搜索失败' : '待搜索'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* HTTP Fallback Section */}
        {showHttpFallback && (
          <View style={styles.fallbackSection}>
            <View style={styles.fallbackHintContainer}>
              <Icon source="information" size={18} color="#ed8936" />
              <Text style={styles.fallbackHint}>
                未通过广播发现设备，请手动输入网段地址进行扫描
              </Text>
            </View>

            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <Icon source="lan" size={20} color="#718096" />
                <TextInput
                  style={styles.input}
                  value={networkCIDR}
                  onChangeText={setNetworkCIDR}
                  placeholder="例如: 192.168.1.0/24"
                  keyboardType="default"
                  autoCapitalize="none"
                  editable={!isScanning}
                />
              </View>

              <TouchableOpacity
                style={[styles.scanButton, isScanning && styles.scanButtonDisabled]}
                onPress={handleHttpScan}
                disabled={isScanning}
              >
                {isScanning ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon source="magnify" size={20} color="#ffffff" />
                    <Text style={styles.scanButtonText}>扫描</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Retry broadcast button */}
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => {
                setShowHttpFallback(false);
                handleParallelDiscovery();
              }}
            >
              <Icon source="refresh" size={16} color="#3182ce" />
              <Text style={styles.retryButtonText}>重新自动搜索</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* HTTP Scan Progress */}
        {isScanning && httpScanProgress && (
          <View style={styles.scanningIndicator}>
            <ActivityIndicator size="small" color="#3182ce" />
            <View style={styles.progressInfo}>
              <Text style={styles.scanningText}>
                正在扫描: {httpScanProgress.scannedCount}/{httpScanProgress.totalCount} ({httpScanProgress.percentage}%)
              </Text>
              {httpScanProgress.foundCount > 0 && (
                <Text style={styles.foundText}>已发现 {httpScanProgress.foundCount} 个设备</Text>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Error display */}
      {(sadpError || dahuaError) && (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>
            {sadpError && `海康: ${sadpError}`}
            {sadpError && dahuaError && '\n'}
            {dahuaError && `大华: ${dahuaError}`}
          </Text>
          <TouchableOpacity onPress={handleParallelDiscovery}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result Summary Bar */}
      {discoveredDevices.length > 0 && (
        <View style={styles.resultBar}>
          <View style={styles.resultInfo}>
            <Text style={styles.resultText}>
              发现 {discoveredDevices.length} 台设备，已选择 {selectedDevices.size} 台
            </Text>
            <View style={styles.resultBrandSummary}>
              <Text style={[styles.resultBrandText, { color: BRAND_COLORS.HIKVISION }]}>
                海康: {discoveredDevices.filter(d => d.manufacturer === 'HIKVISION').length}
              </Text>
              <Text style={[styles.resultBrandText, { color: BRAND_COLORS.DAHUA }]}>
                大华: {discoveredDevices.filter(d => d.manufacturer === 'DAHUA').length}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedDevices.size === discoveredDevices.length ? '取消全选' : '全选'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Device List */}
      <FlatList
        data={discoveredDevices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !isScanning ? (
            <View style={styles.emptyContainer}>
              <Icon source="radar" size={60} color="#a0aec0" />
              <Text style={styles.emptyText}>暂无发现设备</Text>
              <Text style={styles.emptySubText}>
                {showHttpFallback ? '请输入网段地址后点击扫描' : '点击开始扫描按钮'}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Bottom Import Button */}
      {discoveredDevices.length > 0 && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.importButton, selectedDevices.size === 0 && styles.importButtonDisabled]}
            onPress={handleOpenImportModal}
            disabled={selectedDevices.size === 0}
          >
            <Icon source="import" size={22} color="#ffffff" />
            <Text style={styles.importButtonText}>
              批量导入 ({selectedDevices.size})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Import Modal */}
      <Modal
        visible={importModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !importing && setImportModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>导入设备配置</Text>
              <TouchableOpacity
                onPress={() => !importing && setImportModalVisible(false)}
                disabled={importing}
              >
                <Icon source="close" size={24} color="#718096" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <Text style={styles.modalDescription}>
                请输入设备的统一登录凭证，将应用于所有选中的设备
              </Text>

              <View style={styles.selectedSummary}>
                <Icon source="check-circle" size={18} color="#48bb78" />
                <Text style={styles.selectedSummaryText}>
                  已选择 {selectedDevices.size} 台设备
                </Text>
              </View>

              {/* Brand breakdown */}
              <View style={styles.brandBreakdown}>
                {discoveredDevices.filter(d => selectedDevices.has(d.id) && d.manufacturer === 'HIKVISION').length > 0 && (
                  <View style={[styles.brandBreakdownItem, { borderLeftColor: BRAND_COLORS.HIKVISION }]}>
                    <Text style={styles.brandBreakdownText}>
                      海康威视: {discoveredDevices.filter(d => selectedDevices.has(d.id) && d.manufacturer === 'HIKVISION').length} 台
                    </Text>
                  </View>
                )}
                {discoveredDevices.filter(d => selectedDevices.has(d.id) && d.manufacturer === 'DAHUA').length > 0 && (
                  <View style={[styles.brandBreakdownItem, { borderLeftColor: BRAND_COLORS.DAHUA }]}>
                    <Text style={styles.brandBreakdownText}>
                      大华: {discoveredDevices.filter(d => selectedDevices.has(d.id) && d.manufacturer === 'DAHUA').length} 台
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>用户名</Text>
                <View style={styles.formInputWrapper}>
                  <Icon source="account" size={20} color="#718096" />
                  <TextInput
                    style={styles.formInput}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="请输入用户名"
                    autoCapitalize="none"
                    editable={!importing}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>密码</Text>
                <View style={styles.formInputWrapper}>
                  <Icon source="lock" size={20} color="#718096" />
                  <TextInput
                    style={styles.formInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="请输入密码"
                    secureTextEntry
                    editable={!importing}
                  />
                </View>
              </View>

              <Text style={styles.formHint}>
                提示：如果设备使用不同的登录凭证，导入后可单独修改
              </Text>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setImportModalVisible(false)}
                disabled={importing}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, importing && styles.confirmButtonDisabled]}
                onPress={handleBatchImport}
                disabled={importing}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon source="check" size={20} color="#ffffff" />
                    <Text style={styles.confirmButtonText}>确认导入</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Activation Modal */}
      <Modal
        visible={activateModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !isActivating && setActivateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>激活设备</Text>
              <TouchableOpacity
                onPress={() => !isActivating && setActivateModalVisible(false)}
                disabled={isActivating}
              >
                <Icon source="close" size={24} color="#718096" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.activateDeviceInfo}>
                <Icon
                  source={getDeviceIcon(activatingDevice?.deviceType || 'IPC')}
                  size={40}
                  color={BRAND_COLORS[activatingDevice?.manufacturer || 'UNKNOWN']}
                />
                <View style={styles.activateDeviceDetails}>
                  <Text style={styles.activateDeviceName}>
                    {activatingDevice?.deviceModel || getBrandDisplayName(activatingDevice?.manufacturer || 'UNKNOWN') + ' 设备'}
                  </Text>
                  <Text style={styles.activateDeviceIp}>
                    IP: {activatingDevice?.ipAddress}
                  </Text>
                  <Text style={styles.activateDeviceMac}>
                    MAC: {activatingDevice?.macAddress}
                  </Text>
                  <View style={[styles.activateBrandBadge, { backgroundColor: BRAND_COLORS[activatingDevice?.manufacturer || 'UNKNOWN'] }]}>
                    <Text style={styles.activateBrandBadgeText}>
                      {getBrandDisplayName(activatingDevice?.manufacturer || 'UNKNOWN')}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.activateHint}>
                此设备尚未激活，请选择密码设置方式
              </Text>

              {/* Password Mode Toggle */}
              <View style={styles.passwordModeContainer}>
                <Text style={styles.formLabel}>选择密码方式：</Text>
                <View style={styles.passwordModeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.passwordModeButton,
                      passwordMode === 'auto' && styles.passwordModeButtonActive,
                    ]}
                    onPress={() => setPasswordMode('auto')}
                    disabled={isActivating}
                  >
                    <Icon
                      source="lock-smart"
                      size={20}
                      color={passwordMode === 'auto' ? '#ffffff' : '#3182ce'}
                    />
                    <Text
                      style={[
                        styles.passwordModeButtonText,
                        passwordMode === 'auto' && styles.passwordModeButtonTextActive,
                      ]}
                    >
                      自动生成（推荐）
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.passwordModeButton,
                      passwordMode === 'manual' && styles.passwordModeButtonActive,
                    ]}
                    onPress={() => setPasswordMode('manual')}
                    disabled={isActivating}
                  >
                    <Icon
                      source="pencil"
                      size={20}
                      color={passwordMode === 'manual' ? '#ffffff' : '#3182ce'}
                    />
                    <Text
                      style={[
                        styles.passwordModeButtonText,
                        passwordMode === 'manual' && styles.passwordModeButtonTextActive,
                      ]}
                    >
                      手动输入
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Auto-generated Password Display */}
              {passwordMode === 'auto' && (
                <View style={styles.generatedPasswordContainer}>
                  <Text style={styles.generatedPasswordLabel}>生成的密码：</Text>
                  <View style={styles.generatedPasswordRow}>
                    <Text style={styles.generatedPasswordText}>{generatedPassword}</Text>
                    <TouchableOpacity
                      style={styles.copyPasswordButton}
                      onPress={async () => {
                        await Clipboard.setStringAsync(generatedPassword);
                        Alert.alert('已复制', '密码已复制到剪贴板');
                      }}
                    >
                      <Icon source="content-copy" size={18} color="#3182ce" />
                      <Text style={styles.copyPasswordText}>复制</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={styles.regenerateButton}
                    onPress={() => setGeneratedPassword(generateHikvisionPassword())}
                    disabled={isActivating}
                  >
                    <Icon source="refresh" size={16} color="#3182ce" />
                    <Text style={styles.regenerateButtonText}>重新生成</Text>
                  </TouchableOpacity>
                  <View style={styles.autoPasswordWarning}>
                    <Icon source="alert-circle-outline" size={18} color="#c05621" />
                    <Text style={styles.autoPasswordWarningText}>
                      请保存此密码，激活后系统将自动记录，后续操作可自动填入
                    </Text>
                  </View>
                </View>
              )}

              {/* Manual Password Input */}
              {passwordMode === 'manual' && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>设置密码</Text>
                    <View style={styles.formInputWrapper}>
                      <Icon source="lock" size={20} color="#718096" />
                      <TextInput
                        style={styles.formInput}
                        value={activatePassword}
                        onChangeText={setActivatePassword}
                        placeholder="请输入密码（8-16位）"
                        secureTextEntry
                        editable={!isActivating}
                      />
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>确认密码</Text>
                    <View style={styles.formInputWrapper}>
                      <Icon source="lock-check" size={20} color="#718096" />
                      <TextInput
                        style={styles.formInput}
                        value={activateConfirmPassword}
                        onChangeText={setActivateConfirmPassword}
                        placeholder="请再次输入密码"
                        secureTextEntry
                        editable={!isActivating}
                      />
                    </View>
                  </View>
                </>
              )}

              <View style={styles.passwordRequirements}>
                <Text style={styles.passwordRequirementsTitle}>密码要求：</Text>
                <Text style={styles.passwordRequirementItem}>- 长度 8-16 位</Text>
                <Text style={styles.passwordRequirementItem}>- 至少包含大写字母、小写字母、数字中的两种</Text>
                <Text style={styles.passwordRequirementItem}>- 不能包含用户名 admin</Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setActivateModalVisible(false)}
                disabled={isActivating}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, isActivating && styles.confirmButtonDisabled]}
                onPress={handleActivateDevice}
                disabled={isActivating}
              >
                {isActivating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon source="check" size={20} color="#ffffff" />
                    <Text style={styles.confirmButtonText}>确认激活</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ========== Styles ==========

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  filterSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 16,
    lineHeight: 18,
  },
  filterChips: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  filterChipActiveHik: {
    backgroundColor: BRAND_COLORS.HIKVISION,
    borderColor: BRAND_COLORS.HIKVISION,
  },
  filterChipActiveDahua: {
    backgroundColor: BRAND_COLORS.DAHUA,
    borderColor: BRAND_COLORS.DAHUA,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3182ce',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 8,
    gap: 6,
  },
  fullWidthButton: {
    width: '100%',
  },
  scanButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  scanButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#ffffff',
  },
  progressContainer: {
    marginTop: 16,
    gap: 8,
  },
  brandProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandProgressIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandProgressText: {
    fontSize: 13,
    color: '#4a5568',
  },
  fallbackSection: {
    marginTop: 8,
  },
  fallbackHintContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fffaf0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  fallbackHint: {
    flex: 1,
    fontSize: 13,
    color: '#c05621',
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d3748',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 8,
    gap: 6,
  },
  retryButtonText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
    backgroundColor: '#ebf8ff',
    borderRadius: 8,
    gap: 8,
  },
  scanningText: {
    fontSize: 14,
    color: '#2b6cb0',
  },
  progressInfo: {
    flex: 1,
  },
  foundText: {
    fontSize: 12,
    color: '#48bb78',
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },
  retryText: {
    fontSize: 14,
    color: '#3182ce',
    fontWeight: '500',
  },
  resultBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  resultInfo: {
    flex: 1,
  },
  resultText: {
    fontSize: 13,
    color: '#2b6cb0',
  },
  resultBrandSummary: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  resultBrandText: {
    fontSize: 12,
    fontWeight: '500',
  },
  selectAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#3182ce',
    borderRadius: 4,
  },
  selectAllText: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deviceCardSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#f7fafc',
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  deviceTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
  },
  deviceType: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  brandBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  brandBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  deviceDetails: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailText: {
    marginLeft: 8,
    fontSize: 13,
    color: '#4a5568',
  },
  discoveryMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f7fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    gap: 4,
  },
  discoveryMethodText: {
    fontSize: 11,
    color: '#718096',
  },
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 12,
    gap: 6,
  },
  activateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#718096',
    fontWeight: '500',
  },
  emptySubText: {
    marginTop: 8,
    fontSize: 14,
    color: '#a0aec0',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#48bb78',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  importButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  importButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
  },
  modalContent: {
    padding: 16,
  },
  modalDescription: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 16,
  },
  selectedSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c6f6d5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  selectedSummaryText: {
    fontSize: 14,
    color: '#276749',
    fontWeight: '500',
  },
  brandBreakdown: {
    marginBottom: 16,
    gap: 8,
  },
  brandBreakdownItem: {
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 4,
  },
  brandBreakdownText: {
    fontSize: 13,
    color: '#4a5568',
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 8,
  },
  formInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  formInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: '#2d3748',
  },
  formHint: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 8,
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#f5f7fa',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#718096',
  },
  confirmButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#48bb78',
    gap: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Activation modal styles
  activateDeviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  activateDeviceDetails: {
    marginLeft: 16,
    flex: 1,
  },
  activateDeviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  activateDeviceIp: {
    fontSize: 13,
    color: '#718096',
  },
  activateDeviceMac: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  activateBrandBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 8,
  },
  activateBrandBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  activateHint: {
    fontSize: 14,
    color: '#e53e3e',
    backgroundColor: '#fed7d7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    lineHeight: 20,
  },
  passwordModeContainer: {
    marginBottom: 16,
  },
  passwordModeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  passwordModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#3182ce',
    backgroundColor: '#ffffff',
    gap: 6,
  },
  passwordModeButtonActive: {
    backgroundColor: '#3182ce',
    borderColor: '#3182ce',
  },
  passwordModeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#3182ce',
  },
  passwordModeButtonTextActive: {
    color: '#ffffff',
  },
  generatedPasswordContainer: {
    backgroundColor: '#ebf8ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  generatedPasswordLabel: {
    fontSize: 13,
    color: '#2b6cb0',
    marginBottom: 8,
  },
  generatedPasswordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  generatedPasswordText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyPasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    gap: 4,
  },
  copyPasswordText: {
    fontSize: 13,
    color: '#3182ce',
    fontWeight: '500',
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  regenerateButtonText: {
    fontSize: 13,
    color: '#3182ce',
    fontWeight: '500',
  },
  autoPasswordWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fffaf0',
    padding: 10,
    borderRadius: 8,
    marginTop: 8,
    gap: 8,
  },
  autoPasswordWarningText: {
    flex: 1,
    fontSize: 12,
    color: '#c05621',
    lineHeight: 18,
  },
  passwordRequirements: {
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  passwordRequirementsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 8,
  },
  passwordRequirementItem: {
    fontSize: 12,
    color: '#718096',
    lineHeight: 20,
  },
});

export default UnifiedDeviceDiscoveryScreen;
