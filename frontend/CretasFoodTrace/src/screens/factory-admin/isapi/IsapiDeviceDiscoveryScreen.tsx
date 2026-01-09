/**
 * ISAPI 设备发现页面
 * 使用 SADP 协议 + HTTP 扫描双模式发现海康威视设备
 *
 * 工作流程：
 * 1. 优先使用 SADP (UDP 广播) 快速发现设备
 * 2. 如果 SADP 8秒内无结果，自动 fallback 到 HTTP 扫描
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
import isapiApiClient, {
  BatchImportRequest,
  getDeviceTypeName,
} from '../../../services/api/isapiApiClient';
import { useSadpDiscovery } from '../../../hooks/useSadpDiscovery';
import { SadpDevice } from '../../../native/SadpModule';
import LocalDeviceDiscovery, {
  DiscoveredDevice as HttpDiscoveredDevice,
  DiscoveryProgress,
} from '../../../services/network/LocalDeviceDiscoveryService';

// 导航类型
type IsapiStackParamList = {
  IsapiDeviceList: undefined;
  IsapiDeviceDiscovery: undefined;
};

type NavigationProp = NativeStackNavigationProp<IsapiStackParamList, 'IsapiDeviceDiscovery'>;

// 发现模式
type DiscoveryMode = 'idle' | 'sadp' | 'http' | 'completed';

// SADP 超时时间 (毫秒)
const SADP_TIMEOUT_MS = 8000;

// 统一设备显示格式
interface DisplayDevice {
  ipAddress: string;
  port: number;
  deviceType: string;
  deviceModel?: string;
  serialNumber?: string;
  deviceName?: string;
  firmwareVersion?: string;
  macAddress?: string;
  manufacturer: string;
  isapiSupported: boolean;
  authRequired: boolean;
  isActivated?: boolean;
  discoveryMethod?: 'sadp' | 'http';
}

// 适配 SADP 设备到显示格式
function adaptSadpDevice(device: SadpDevice): DisplayDevice {
  return {
    ipAddress: device.ip,
    port: parseInt(device.httpPort, 10) || 80,
    deviceType: device.deviceType || 'IPC',
    deviceModel: device.model,
    serialNumber: device.serialNumber,
    deviceName: device.model,
    firmwareVersion: device.firmwareVersion,
    macAddress: device.mac,
    manufacturer: 'HIKVISION',
    isapiSupported: true,
    authRequired: device.activated,
    isActivated: device.activated,
    discoveryMethod: 'sadp',
  };
}

// 适配 HTTP 扫描设备到显示格式
function adaptHttpDevice(device: HttpDiscoveredDevice): DisplayDevice {
  return {
    ipAddress: device.ipAddress,
    port: device.port,
    deviceType: device.deviceType,
    deviceModel: device.deviceModel,
    serialNumber: device.serialNumber,
    deviceName: device.deviceName,
    firmwareVersion: device.firmwareVersion,
    macAddress: device.macAddress,
    manufacturer: device.manufacturer,
    isapiSupported: device.isapiSupported,
    authRequired: device.authRequired,
    discoveryMethod: 'http',
  };
}

export function IsapiDeviceDiscoveryScreen() {
  const navigation = useNavigation<NavigationProp>();

  // SADP 发现 Hook
  const {
    devices: sadpDevices,
    isDiscovering: isSadpDiscovering,
    error: sadpError,
    startDiscovery,
    stopDiscovery,
    clearDevices: clearSadpDevices,
    isAvailable: isSadpAvailable,
    activateDevice,
    resetDevicePassword,
    restoreFactorySettings,
  } = useSadpDiscovery();

  // 激活弹窗状态
  const [activateModalVisible, setActivateModalVisible] = useState(false);
  const [activatingDevice, setActivatingDevice] = useState<DisplayDevice | null>(null);
  const [activatePassword, setActivatePassword] = useState('');
  const [activateConfirmPassword, setActivateConfirmPassword] = useState('');
  const [isActivating, setIsActivating] = useState(false);

  // 发现模式状态
  const [discoveryMode, setDiscoveryMode] = useState<DiscoveryMode>('idle');
  const [discoveredDevices, setDiscoveredDevices] = useState<DisplayDevice[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());

  // HTTP 扫描状态
  const [networkCIDR, setNetworkCIDR] = useState('');
  const [httpScanProgress, setHttpScanProgress] = useState<DiscoveryProgress | null>(null);
  const [showHttpFallback, setShowHttpFallback] = useState(false);

  // 用于跟踪 SADP 扫描期间发现的设备数量
  const sadpDevicesRef = useRef<SadpDevice[]>([]);

  // 当 SADP 发现设备时实时更新
  useEffect(() => {
    sadpDevicesRef.current = sadpDevices;
    if (discoveryMode === 'sadp' && sadpDevices.length > 0) {
      const devices = sadpDevices.map(adaptSadpDevice);
      setDiscoveredDevices(devices);

      // 自动选中已激活的设备
      const activatedKeys = devices
        .filter(d => d.isActivated)
        .map(d => `${d.ipAddress}:${d.port}`);
      setSelectedDevices(new Set(activatedKeys));
    }
  }, [sadpDevices, discoveryMode]);

  // 导入弹窗状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');

  // 开始扫描 - 双模式: SADP 优先，超时后 fallback 到 HTTP
  const handleScan = useCallback(async () => {
    // 清空之前的结果
    clearSadpDevices();
    setDiscoveredDevices([]);
    setSelectedDevices(new Set());
    setShowHttpFallback(false);
    setHttpScanProgress(null);

    // 阶段1: 尝试 SADP (仅 Android 可用)
    if (isSadpAvailable) {
      console.log('[Discovery] 开始 SADP 扫描...');
      setDiscoveryMode('sadp');

      try {
        await startDiscovery();

        // 等待 SADP 超时时间收集结果
        await new Promise(resolve => setTimeout(resolve, SADP_TIMEOUT_MS));

        await stopDiscovery();

        // 检查是否发现设备
        if (sadpDevicesRef.current.length > 0) {
          console.log(`[Discovery] SADP 发现 ${sadpDevicesRef.current.length} 个设备`);
          setDiscoveryMode('completed');
          return;
        }

        console.log('[Discovery] SADP 未发现设备，切换到 HTTP 扫描');
      } catch (err) {
        console.error('[Discovery] SADP 扫描失败:', err);
      }
    } else {
      console.log('[Discovery] SADP 不可用，直接使用 HTTP 扫描');
    }

    // 阶段2: SADP 无结果或不可用，显示 HTTP fallback
    setDiscoveryMode('idle');
    setShowHttpFallback(true);

    // 自动获取当前网段
    try {
      const currentCIDR = await LocalDeviceDiscovery.getCurrentNetworkCIDR();
      if (currentCIDR) {
        setNetworkCIDR(currentCIDR);
      } else {
        setNetworkCIDR('192.168.1.0/24');
      }
    } catch {
      setNetworkCIDR('192.168.1.0/24');
    }
  }, [isSadpAvailable, startDiscovery, stopDiscovery, clearSadpDevices]);

  // HTTP 扫描函数
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

    try {
      console.log(`[Discovery] 开始 HTTP 扫描: ${networkCIDR}`);
      setDiscoveryMode('http');
      setHttpScanProgress(null);

      const httpDevices = await LocalDeviceDiscovery.discoverDevices({
        networkCIDR: networkCIDR.trim(),
        timeout: 2000,
        ports: [80, 8000],
        maxConcurrent: 30,
        onProgress: setHttpScanProgress,
      });

      console.log(`[Discovery] HTTP 发现 ${httpDevices.length} 个设备`);

      // 转换并设置结果
      const adaptedDevices = httpDevices.map(adaptHttpDevice);
      setDiscoveredDevices(adaptedDevices);
      setDiscoveryMode('completed');

      // 自动选中支持 ISAPI 的设备
      const isapiDeviceKeys = adaptedDevices
        .filter(d => d.isapiSupported)
        .map(d => `${d.ipAddress}:${d.port}`);
      setSelectedDevices(new Set(isapiDeviceKeys));

      if (httpDevices.length === 0) {
        Alert.alert('扫描完成', '未发现任何设备\n\n请确认:\n1. 设备已通电并联网\n2. 设备与手机在同一局域网\n3. 网段地址正确');
      }
    } catch (err) {
      console.error('[Discovery] HTTP 扫描失败:', err);
      Alert.alert('扫描失败', '请检查网络连接');
      setDiscoveryMode('idle');
    }
  }, [networkCIDR]);

  // 切换设备选中状态
  const toggleDeviceSelection = (device: DisplayDevice) => {
    const key = `${device.ipAddress}:${device.port}`;
    const newSelected = new Set(selectedDevices);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedDevices(newSelected);
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedDevices.size === discoveredDevices.length) {
      setSelectedDevices(new Set());
    } else {
      const allKeys = discoveredDevices.map(d => `${d.ipAddress}:${d.port}`);
      setSelectedDevices(new Set(allKeys));
    }
  };

  // 打开导入弹窗
  const handleOpenImportModal = () => {
    if (selectedDevices.size === 0) {
      Alert.alert('提示', '请先选择要导入的设备');
      return;
    }
    setImportModalVisible(true);
  };

  // 执行批量导入
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

      const devicesToImport = discoveredDevices.filter(d =>
        selectedDevices.has(`${d.ipAddress}:${d.port}`)
      );

      const request: BatchImportRequest = {
        devices: devicesToImport.map(d => ({
          ipAddress: d.ipAddress,
          port: d.port,
          username: username.trim(),
          password: password.trim(),
          deviceName: d.deviceName || `设备_${d.ipAddress}`,
          deviceType: d.deviceType,
        })),
      };

      const result = await isapiApiClient.batchImportDevices(request);

      setImportModalVisible(false);

      if (result.failed > 0 && result.failedDevices) {
        const failedList = result.failedDevices
          .map(f => `${f.ipAddress}: ${f.error}`)
          .join('\n');
        Alert.alert(
          '导入完成',
          `成功导入 ${result.imported} 台设备\n失败 ${result.failed} 台设备\n\n失败详情:\n${failedList}`,
          [
            { text: '查看设备列表', onPress: () => navigation.navigate('IsapiDeviceList') },
            { text: '继续扫描', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          '导入成功',
          `已成功导入 ${result.imported} 台设备`,
          [{ text: '查看设备列表', onPress: () => navigation.navigate('IsapiDeviceList') }]
        );
      }
    } catch (err) {
      console.error('批量导入失败:', err);
      Alert.alert('导入失败', '批量导入设备失败，请检查用户名密码是否正确');
    } finally {
      setImporting(false);
    }
  };

  // 打开激活弹窗
  const handleOpenActivateModal = (device: DisplayDevice) => {
    setActivatingDevice(device);
    setActivatePassword('');
    setActivateConfirmPassword('');
    setActivateModalVisible(true);
  };

  // 执行设备激活
  const handleActivateDevice = async () => {
    if (!activatingDevice || !activatingDevice.macAddress) {
      Alert.alert('错误', '设备信息不完整');
      return;
    }

    if (activatePassword.length < 8) {
      Alert.alert('密码要求', '密码至少需要8个字符');
      return;
    }

    if (activatePassword !== activateConfirmPassword) {
      Alert.alert('密码不匹配', '两次输入的密码不一致');
      return;
    }

    try {
      setIsActivating(true);

      const result = await activateDevice(activatingDevice.macAddress, activatePassword);

      if (result.success) {
        Alert.alert('激活成功', '设备已激活，现在可以使用设置的密码登录', [
          {
            text: '确定',
            onPress: () => {
              // 更新设备列表中的激活状态
              setDiscoveredDevices(prev =>
                prev.map(d =>
                  d.macAddress === activatingDevice.macAddress
                    ? { ...d, isActivated: true, authRequired: true }
                    : d
                )
              );
              setActivateModalVisible(false);
            },
          },
        ]);
      } else {
        Alert.alert('激活失败', result.message);
      }
    } catch (err) {
      console.error('设备激活失败:', err);
      Alert.alert('激活失败', '请检查网络连接');
    } finally {
      setIsActivating(false);
    }
  };

  // 获取设备类型图标
  const getDeviceIcon = (type: string): string => {
    const icons: Record<string, string> = {
      IPC: 'cctv',
      NVR: 'server',
      DVR: 'harddisk',
      ENCODER: 'video-box',
    };
    return icons[type] || 'camera';
  };

  // 渲染设备项
  const renderDeviceItem = ({ item }: { item: DisplayDevice }) => {
    const key = `${item.ipAddress}:${item.port}`;
    const isSelected = selectedDevices.has(key);

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
            <Icon source={getDeviceIcon(item.deviceType)} size={28} color="#3182ce" />
            <View style={styles.deviceTextInfo}>
              <Text style={styles.deviceName}>
                {item.deviceName || `${item.manufacturer} 设备`}
              </Text>
              <Text style={styles.deviceType}>
                {getDeviceTypeName(item.deviceType as 'IPC' | 'NVR' | 'DVR' | 'ENCODER') || item.deviceType}
              </Text>
            </View>
          </View>

          {item.isapiSupported ? (
            <View style={styles.isapiSupportedBadge}>
              <Icon source="check-circle" size={14} color="#48bb78" />
              <Text style={styles.isapiSupportedText}>ISAPI</Text>
            </View>
          ) : (
            <View style={styles.isapiNotSupportedBadge}>
              <Icon source="close-circle" size={14} color="#e53e3e" />
              <Text style={styles.isapiNotSupportedText}>不支持</Text>
            </View>
          )}
        </View>

        <View style={styles.deviceDetails}>
          <View style={styles.detailRow}>
            <Icon source="ip-network" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.ipAddress}:{item.port}</Text>
          </View>

          <View style={styles.detailRow}>
            <Icon source="factory" size={16} color="#718096" />
            <Text style={styles.detailText}>{item.manufacturer}</Text>
          </View>

          {item.deviceModel && (
            <View style={styles.detailRow}>
              <Icon source="tag" size={16} color="#718096" />
              <Text style={styles.detailText}>{item.deviceModel}</Text>
            </View>
          )}

          {item.serialNumber && (
            <View style={styles.detailRow}>
              <Icon source="barcode" size={16} color="#718096" />
              <Text style={styles.detailText}>{item.serialNumber}</Text>
            </View>
          )}

          {/* 激活状态显示 */}
          {item.discoveryMethod === 'sadp' && (
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
          )}
        </View>

        {/* 未激活设备显示激活按钮 */}
        {item.discoveryMethod === 'sadp' && !item.isActivated && (
          <TouchableOpacity
            style={styles.activateButton}
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

  // 是否正在扫描
  const isScanning = discoveryMode === 'sadp' || discoveryMode === 'http';

  return (
    <SafeAreaView style={styles.container}>
      {/* 扫描区域 */}
      <View style={styles.scanSection}>
        <Text style={styles.sectionTitle}>扫描设备</Text>
        <Text style={styles.sectionDescription}>
          {isSadpAvailable
            ? '点击扫描自动发现局域网内的海康威视设备'
            : '输入网段地址扫描设备（当前平台不支持自动发现）'}
        </Text>

        {/* SADP 扫描按钮 (默认显示) */}
        {!showHttpFallback && (
          <TouchableOpacity
            style={[styles.scanButton, styles.fullWidthButton, isScanning && styles.scanButtonDisabled]}
            onPress={handleScan}
            disabled={isScanning}
          >
            {discoveryMode === 'sadp' ? (
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

        {/* SADP 扫描进度 */}
        {discoveryMode === 'sadp' && (
          <View style={styles.scanningIndicator}>
            <ActivityIndicator size="small" color="#3182ce" />
            <View style={styles.progressInfo}>
              <Text style={styles.scanningText}>
                正在通过广播搜索设备 ({Math.round((Date.now() % SADP_TIMEOUT_MS) / 1000)}s / {SADP_TIMEOUT_MS / 1000}s)
              </Text>
              {sadpDevices.length > 0 && (
                <Text style={styles.foundText}>已发现 {sadpDevices.length} 个设备</Text>
              )}
            </View>
          </View>
        )}

        {/* HTTP Fallback 区域 */}
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
                  editable={discoveryMode !== 'http'}
                />
              </View>

              <TouchableOpacity
                style={[styles.scanButton, discoveryMode === 'http' && styles.scanButtonDisabled]}
                onPress={handleHttpScan}
                disabled={discoveryMode === 'http'}
              >
                {discoveryMode === 'http' ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Icon source="magnify" size={20} color="#ffffff" />
                    <Text style={styles.scanButtonText}>扫描</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* 重新尝试 SADP 按钮 */}
            {isSadpAvailable && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setShowHttpFallback(false);
                  handleScan();
                }}
              >
                <Icon source="refresh" size={16} color="#3182ce" />
                <Text style={styles.retryButtonText}>重新自动搜索</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* HTTP 扫描进度 */}
        {discoveryMode === 'http' && httpScanProgress && (
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

      {/* 错误提示 */}
      {sadpError && (
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={20} color="#e53e3e" />
          <Text style={styles.errorText}>{sadpError}</Text>
          <TouchableOpacity onPress={handleScan}>
            <Text style={styles.retryText}>重试</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 结果统计栏 */}
      {discoveredDevices.length > 0 && (
        <View style={styles.resultBar}>
          <View style={styles.resultInfo}>
            <Text style={styles.resultText}>
              发现 {discoveredDevices.length} 台设备，已选择 {selectedDevices.size} 台
            </Text>
          </View>
          <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
            <Text style={styles.selectAllText}>
              {selectedDevices.size === discoveredDevices.length ? '取消全选' : '全选'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 设备列表 */}
      <FlatList
        data={discoveredDevices}
        renderItem={renderDeviceItem}
        keyExtractor={(item) => `${item.ipAddress}:${item.port}`}
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

      {/* 底部导入按钮 */}
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

      {/* 导入配置弹窗 */}
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

      {/* 设备激活弹窗 */}
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
                <Icon source="cctv" size={40} color="#3182ce" />
                <View style={styles.activateDeviceDetails}>
                  <Text style={styles.activateDeviceName}>
                    {activatingDevice?.deviceName || activatingDevice?.deviceModel || '海康设备'}
                  </Text>
                  <Text style={styles.activateDeviceIp}>
                    IP: {activatingDevice?.ipAddress}
                  </Text>
                  <Text style={styles.activateDeviceMac}>
                    MAC: {activatingDevice?.macAddress}
                  </Text>
                </View>
              </View>

              <Text style={styles.activateHint}>
                此设备尚未激活，请设置管理员密码以完成激活
              </Text>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>设置密码</Text>
                <View style={styles.formInputWrapper}>
                  <Icon source="lock" size={20} color="#718096" />
                  <TextInput
                    style={styles.formInput}
                    value={activatePassword}
                    onChangeText={setActivatePassword}
                    placeholder="请输入密码（至少8位）"
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

              <View style={styles.passwordRequirements}>
                <Text style={styles.passwordRequirementsTitle}>密码要求：</Text>
                <Text style={styles.passwordRequirementItem}>• 至少8个字符</Text>
                <Text style={styles.passwordRequirementItem}>• 建议包含大小写字母和数字</Text>
                <Text style={styles.passwordRequirementItem}>• 请妥善保管此密码</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scanSection: {
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 13,
    color: '#2b6cb0',
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
  isapiSupportedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c6f6d5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  isapiSupportedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#276749',
  },
  isapiNotSupportedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  isapiNotSupportedText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#c53030',
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
    marginBottom: 20,
    gap: 8,
  },
  selectedSummaryText: {
    fontSize: 14,
    color: '#276749',
    fontWeight: '500',
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
  // 激活按钮样式
  activateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ed8936',
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
  // 激活弹窗样式
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
  activateHint: {
    fontSize: 14,
    color: '#e53e3e',
    backgroundColor: '#fed7d7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    lineHeight: 20,
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

export default IsapiDeviceDiscoveryScreen;
