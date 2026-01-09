/**
 * ISAPI 设备配置向导页面
 * 完整的设备配置流程：扫描 -> 选择 -> 激活 -> 网络配置 -> 推送配置 -> 完成
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  TextInput,
  Alert,
  ScrollView,
  Platform,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon, Switch } from 'react-native-paper';
import isapiApiClient, {
  CreateIsapiDeviceRequest,
  getDeviceTypeName,
} from '../../../services/api/isapiApiClient';
import LocalDeviceDiscovery, {
  DiscoveredDevice,
  DiscoveryProgress,
} from '../../../services/network/LocalDeviceDiscoveryService';

// Navigation types
type IsapiStackParamList = {
  IsapiDeviceList: undefined;
  DeviceSetupWizard: undefined;
};

type NavigationProp = NativeStackNavigationProp<IsapiStackParamList, 'DeviceSetupWizard'>;

// Wizard step definitions
type WizardStep = 'scan' | 'activate' | 'network' | 'push' | 'complete';

const WIZARD_STEPS: { key: WizardStep; title: string; icon: string }[] = [
  { key: 'scan', title: '扫描设备', icon: 'radar' },
  { key: 'activate', title: '激活设备', icon: 'key' },
  { key: 'network', title: '网络配置', icon: 'lan' },
  { key: 'push', title: '推送配置', icon: 'bell' },
  { key: 'complete', title: '完成', icon: 'check-circle' },
];

// Extended device type with activation status
interface WizardDevice extends DiscoveredDevice {
  activated?: boolean;
  password?: string;
  networkConfig?: {
    ipAddress: string;
    subnetMask: string;
    gateway: string;
    dhcp: boolean;
  };
  pushConfig?: {
    motionDetection: boolean;
    lineCrossing: boolean;
    fieldDetection: boolean;
  };
}

export function DeviceSetupWizardScreen() {
  const navigation = useNavigation<NavigationProp>();

  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('scan');
  const [stepAnimation] = useState(new Animated.Value(0));

  // Step 1: Scan state
  const [scanning, setScanning] = useState(false);
  const [networkCIDR, setNetworkCIDR] = useState('');
  const [discoveredDevices, setDiscoveredDevices] = useState<WizardDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<WizardDevice | null>(null);
  const [scanProgress, setScanProgress] = useState<DiscoveryProgress | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  // Step 2: Activation state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [activating, setActivating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Step 3: Network state
  const [useDhcp, setUseDhcp] = useState(true);
  const [ipAddress, setIpAddress] = useState('');
  const [subnetMask, setSubnetMask] = useState('255.255.255.0');
  const [gateway, setGateway] = useState('');
  const [configuringNetwork, setConfiguringNetwork] = useState(false);

  // Step 4: Push state
  const [enableMotionDetection, setEnableMotionDetection] = useState(true);
  const [enableLineCrossing, setEnableLineCrossing] = useState(false);
  const [enableFieldDetection, setEnableFieldDetection] = useState(false);
  const [configuringPush, setConfiguringPush] = useState(false);

  // Step 5: Complete state
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [registerSuccess, setRegisterSuccess] = useState(false);

  // Initialize network CIDR
  useEffect(() => {
    LocalDeviceDiscovery.getCurrentNetworkCIDR().then((cidr) => {
      if (cidr) {
        setNetworkCIDR(cidr);
      } else {
        setNetworkCIDR('192.168.1.0/24');
      }
    });
  }, []);

  // Animate step transition
  const animateStepTransition = useCallback(() => {
    stepAnimation.setValue(0);
    Animated.timing(stepAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [stepAnimation]);

  // Navigate to next step
  const goToNextStep = useCallback(() => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);
    const nextStep = WIZARD_STEPS[currentIndex + 1];
    if (currentIndex < WIZARD_STEPS.length - 1 && nextStep) {
      setCurrentStep(nextStep.key);
      animateStepTransition();
    }
  }, [currentStep, animateStepTransition]);

  // Navigate to previous step
  const goToPreviousStep = useCallback(() => {
    const currentIndex = WIZARD_STEPS.findIndex(s => s.key === currentStep);
    const prevStep = WIZARD_STEPS[currentIndex - 1];
    if (currentIndex > 0 && prevStep) {
      setCurrentStep(prevStep.key);
      animateStepTransition();
    }
  }, [currentStep, animateStepTransition]);

  // Get current step index
  const getCurrentStepIndex = () => WIZARD_STEPS.findIndex(s => s.key === currentStep);

  // ==================== Step 1: Scan Devices ====================

  const handleScan = useCallback(async () => {
    if (!networkCIDR.trim()) {
      Alert.alert('提示', '请输入网段地址');
      return;
    }

    const validation = LocalDeviceDiscovery.validateCIDR(networkCIDR);
    if (!validation.valid) {
      Alert.alert('格式错误', validation.error || '请输入有效的 CIDR 格式');
      return;
    }

    try {
      setScanning(true);
      setScanError(null);
      setDiscoveredDevices([]);
      setSelectedDevice(null);
      setScanProgress(null);

      const devices = await LocalDeviceDiscovery.discoverDevices({
        networkCIDR: networkCIDR.trim(),
        timeout: 3000,
        ports: [80, 443, 8000, 8080],
        maxConcurrent: 25,
        onProgress: (progress) => {
          setScanProgress(progress);
        },
      });

      // Convert to WizardDevice with mock activation status
      const wizardDevices: WizardDevice[] = devices.map(d => ({
        ...d,
        // In real implementation, this would be determined by the device
        activated: d.authRequired,
      }));

      setDiscoveredDevices(wizardDevices);

      if (devices.length === 0) {
        Alert.alert(
          '扫描完成',
          '未发现任何设备\n\n请确认:\n1. 设备已通电并联网\n2. 设备与手机在同一局域网\n3. 网段地址正确'
        );
      }
    } catch (err) {
      console.error('设备扫描失败:', err);
      setScanError('设备扫描失败，请检查网络连接');
    } finally {
      setScanning(false);
      setScanProgress(null);
    }
  }, [networkCIDR]);

  const handleSelectDevice = (device: WizardDevice) => {
    setSelectedDevice(device);
    // Pre-fill IP address for network config
    setIpAddress(device.ipAddress);
    // Extract gateway from IP (assume .1)
    const ipParts = device.ipAddress.split('.');
    if (ipParts.length === 4) {
      setGateway(`${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.1`);
    }
  };

  const handleConfirmDeviceSelection = () => {
    if (!selectedDevice) {
      Alert.alert('提示', '请选择要配置的设备');
      return;
    }

    // If device is not activated, go to activation step
    // Otherwise, skip to network config
    if (!selectedDevice.activated) {
      goToNextStep(); // Go to activate
    } else {
      // Skip activation, go to network
      setCurrentStep('network');
      animateStepTransition();
    }
  };

  // ==================== Step 2: Activate Device ====================

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('密码长度至少8位');
    }
    if (password.length > 16) {
      errors.push('密码长度不能超过16位');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('需要包含大写字母');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('需要包含小写字母');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('需要包含数字');
    }

    return { valid: errors.length === 0, errors };
  };

  const handleActivateDevice = async () => {
    if (!newPassword) {
      Alert.alert('提示', '请输入新密码');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('提示', '两次输入的密码不一致');
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      Alert.alert('密码不符合要求', validation.errors.join('\n'));
      return;
    }

    try {
      setActivating(true);

      // In real implementation, this would call SADP activation API
      // For now, simulate activation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update selected device
      if (selectedDevice) {
        setSelectedDevice({
          ...selectedDevice,
          activated: true,
          password: newPassword,
        });
      }

      Alert.alert('激活成功', '设备已成功激活', [
        { text: '继续配置', onPress: goToNextStep },
      ]);
    } catch (err) {
      console.error('激活设备失败:', err);
      Alert.alert('激活失败', '设备激活失败，请重试');
    } finally {
      setActivating(false);
    }
  };

  const handleSkipActivation = () => {
    Alert.alert(
      '跳过激活',
      '如果设备已激活，可以跳过此步骤。如果设备未激活，将无法完成配置。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '跳过',
          onPress: () => {
            if (selectedDevice) {
              setSelectedDevice({ ...selectedDevice, activated: true });
            }
            goToNextStep();
          },
        },
      ]
    );
  };

  // ==================== Step 3: Network Configuration ====================

  const validateIpAddress = (ip: string): boolean => {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  };

  const handleConfigureNetwork = async () => {
    if (!useDhcp) {
      if (!validateIpAddress(ipAddress)) {
        Alert.alert('提示', '请输入有效的 IP 地址');
        return;
      }
      if (!validateIpAddress(subnetMask)) {
        Alert.alert('提示', '请输入有效的子网掩码');
        return;
      }
      if (!validateIpAddress(gateway)) {
        Alert.alert('提示', '请输入有效的网关地址');
        return;
      }
    }

    try {
      setConfiguringNetwork(true);

      // In real implementation, this would configure device network via ISAPI
      // For now, simulate configuration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update selected device
      if (selectedDevice) {
        setSelectedDevice({
          ...selectedDevice,
          networkConfig: {
            ipAddress: useDhcp ? selectedDevice.ipAddress : ipAddress,
            subnetMask,
            gateway,
            dhcp: useDhcp,
          },
        });
      }

      goToNextStep();
    } catch (err) {
      console.error('网络配置失败:', err);
      Alert.alert('配置失败', '网络配置失败，请重试');
    } finally {
      setConfiguringNetwork(false);
    }
  };

  const handleSkipNetworkConfig = () => {
    // Update with current values
    if (selectedDevice) {
      setSelectedDevice({
        ...selectedDevice,
        networkConfig: {
          ipAddress: selectedDevice.ipAddress,
          subnetMask: '255.255.255.0',
          gateway: '',
          dhcp: true,
        },
      });
    }
    goToNextStep();
  };

  // ==================== Step 4: Push Configuration ====================

  const handleConfigurePush = async () => {
    try {
      setConfiguringPush(true);

      // In real implementation, this would configure push settings via ISAPI
      // For now, simulate configuration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Update selected device
      if (selectedDevice) {
        setSelectedDevice({
          ...selectedDevice,
          pushConfig: {
            motionDetection: enableMotionDetection,
            lineCrossing: enableLineCrossing,
            fieldDetection: enableFieldDetection,
          },
        });
      }

      goToNextStep();
    } catch (err) {
      console.error('推送配置失败:', err);
      Alert.alert('配置失败', '推送配置失败，请重试');
    } finally {
      setConfiguringPush(false);
    }
  };

  const handleSkipPushConfig = () => {
    if (selectedDevice) {
      setSelectedDevice({
        ...selectedDevice,
        pushConfig: {
          motionDetection: false,
          lineCrossing: false,
          fieldDetection: false,
        },
      });
    }
    goToNextStep();
  };

  // ==================== Step 5: Register Device ====================

  const handleRegisterDevice = async () => {
    if (!selectedDevice) {
      Alert.alert('错误', '未选择设备');
      return;
    }

    try {
      setRegistering(true);
      setRegisterError(null);

      const request: CreateIsapiDeviceRequest = {
        deviceName: selectedDevice.deviceName || `${selectedDevice.manufacturer}_${selectedDevice.ipAddress}`,
        deviceType: (selectedDevice.deviceType as 'IPC' | 'NVR' | 'DVR' | 'ENCODER') || 'IPC',
        deviceModel: selectedDevice.deviceModel,
        serialNumber: selectedDevice.serialNumber,
        ipAddress: selectedDevice.networkConfig?.ipAddress || selectedDevice.ipAddress,
        port: selectedDevice.port,
        protocol: 'HTTP',
        username: 'admin',
        password: selectedDevice.password || newPassword || 'admin123',
        locationDescription: '',
      };

      await isapiApiClient.createIsapiDevice(request);
      setRegisterSuccess(true);
    } catch (err) {
      console.error('注册设备失败:', err);
      setRegisterError('注册设备失败，请检查网络连接或设备配置');
    } finally {
      setRegistering(false);
    }
  };

  const handleFinish = () => {
    navigation.navigate('IsapiDeviceList');
  };

  // ==================== Render Functions ====================

  const renderStepIndicator = () => {
    const currentIndex = getCurrentStepIndex();

    return (
      <View style={styles.stepIndicator}>
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;

          return (
            <React.Fragment key={step.key}>
              <View style={styles.stepItem}>
                <View
                  style={[
                    styles.stepCircle,
                    isCompleted && styles.stepCircleCompleted,
                    isCurrent && styles.stepCircleCurrent,
                  ]}
                >
                  {isCompleted ? (
                    <Icon source="check" size={16} color="#ffffff" />
                  ) : (
                    <Icon
                      source={step.icon}
                      size={16}
                      color={isCurrent ? '#ffffff' : '#a0aec0'}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    (isCompleted || isCurrent) && styles.stepLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {step.title}
                </Text>
              </View>
              {index < WIZARD_STEPS.length - 1 && (
                <View
                  style={[
                    styles.stepConnector,
                    isCompleted && styles.stepConnectorCompleted,
                  ]}
                />
              )}
            </React.Fragment>
          );
        })}
      </View>
    );
  };

  const renderScanStep = () => {
    const getDeviceIcon = (type: string): string => {
      const icons: Record<string, string> = {
        IPC: 'cctv',
        NVR: 'server',
        DVR: 'harddisk',
        ENCODER: 'video-box',
      };
      return icons[type] || 'camera';
    };

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>扫描网络设备</Text>
        <Text style={styles.stepDescription}>
          输入网段地址，扫描发现局域网内的海康威视设备
        </Text>

        {/* Scan input */}
        <View style={styles.scanInputContainer}>
          <View style={styles.inputWrapper}>
            <Icon source="lan" size={20} color="#718096" />
            <TextInput
              style={styles.input}
              value={networkCIDR}
              onChangeText={setNetworkCIDR}
              placeholder="例如: 192.168.1.0/24"
              keyboardType="default"
              autoCapitalize="none"
              editable={!scanning}
            />
          </View>
          <TouchableOpacity
            style={[styles.scanButton, scanning && styles.scanButtonDisabled]}
            onPress={handleScan}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Icon source="radar" size={18} color="#ffffff" />
                <Text style={styles.scanButtonText}>扫描</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Scan progress */}
        {scanning && scanProgress && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${scanProgress.percentage}%` }]}
              />
            </View>
            <Text style={styles.progressText}>
              正在扫描: {scanProgress.scannedCount}/{scanProgress.totalCount}
              {scanProgress.foundCount > 0 && ` (发现 ${scanProgress.foundCount} 个设备)`}
            </Text>
          </View>
        )}

        {/* Error */}
        {scanError && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle" size={18} color="#e53e3e" />
            <Text style={styles.errorBannerText}>{scanError}</Text>
          </View>
        )}

        {/* Device list */}
        <FlatList
          data={discoveredDevices}
          keyExtractor={(item) => `${item.ipAddress}:${item.port}`}
          style={styles.deviceList}
          renderItem={({ item }) => {
            const isSelected = selectedDevice?.ipAddress === item.ipAddress;
            return (
              <TouchableOpacity
                style={[styles.deviceCard, isSelected && styles.deviceCardSelected]}
                onPress={() => handleSelectDevice(item)}
              >
                <View style={styles.deviceCardHeader}>
                  <View style={styles.radioContainer}>
                    <View style={[styles.radio, isSelected && styles.radioSelected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </View>
                  <Icon source={getDeviceIcon(item.deviceType)} size={24} color="#3182ce" />
                  <View style={styles.deviceCardInfo}>
                    <Text style={styles.deviceCardName}>
                      {item.deviceName || `${item.manufacturer} 设备`}
                    </Text>
                    <Text style={styles.deviceCardIp}>{item.ipAddress}</Text>
                  </View>
                  <View
                    style={[
                      styles.activationBadge,
                      item.activated ? styles.activatedBadge : styles.inactiveBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.activationBadgeText,
                        item.activated ? styles.activatedText : styles.inactiveText,
                      ]}
                    >
                      {item.activated ? '已激活' : '未激活'}
                    </Text>
                  </View>
                </View>
                <View style={styles.deviceCardDetails}>
                  <Text style={styles.deviceCardDetail}>
                    MAC: {item.serialNumber || '-'}
                  </Text>
                  <Text style={styles.deviceCardDetail}>
                    型号: {item.deviceModel || item.deviceType}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            !scanning ? (
              <View style={styles.emptyContainer}>
                <Icon source="radar" size={48} color="#a0aec0" />
                <Text style={styles.emptyText}>
                  {discoveredDevices.length === 0 ? '点击扫描按钮发现设备' : '未发现设备'}
                </Text>
              </View>
            ) : null
          }
        />

        {/* Continue button */}
        {discoveredDevices.length > 0 && (
          <TouchableOpacity
            style={[styles.primaryButton, !selectedDevice && styles.primaryButtonDisabled]}
            onPress={handleConfirmDeviceSelection}
            disabled={!selectedDevice}
          >
            <Text style={styles.primaryButtonText}>
              {selectedDevice ? '下一步：配置设备' : '请选择设备'}
            </Text>
            <Icon source="arrow-right" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderActivateStep = () => {
    const passwordValidation = validatePassword(newPassword);
    const passwordsMatch = newPassword === confirmPassword;

    return (
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>激活设备</Text>
        <Text style={styles.stepDescription}>
          设备首次使用需要激活。请设置设备管理员密码。
        </Text>

        {selectedDevice && (
          <View style={styles.deviceInfoCard}>
            <Icon source="cctv" size={24} color="#3182ce" />
            <View style={styles.deviceInfoText}>
              <Text style={styles.deviceInfoName}>
                {selectedDevice.deviceName || selectedDevice.ipAddress}
              </Text>
              <Text style={styles.deviceInfoIp}>{selectedDevice.ipAddress}</Text>
            </View>
          </View>
        )}

        {/* Password requirements */}
        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>密码要求</Text>
          <View style={styles.requirementsList}>
            {[
              { text: '8-16位字符', valid: newPassword.length >= 8 && newPassword.length <= 16 },
              { text: '包含大写字母', valid: /[A-Z]/.test(newPassword) },
              { text: '包含小写字母', valid: /[a-z]/.test(newPassword) },
              { text: '包含数字', valid: /[0-9]/.test(newPassword) },
            ].map((req, index) => (
              <View key={index} style={styles.requirementItem}>
                <Icon
                  source={req.valid ? 'check-circle' : 'circle-outline'}
                  size={16}
                  color={req.valid ? '#48bb78' : '#a0aec0'}
                />
                <Text
                  style={[styles.requirementText, req.valid && styles.requirementTextValid]}
                >
                  {req.text}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Password input */}
        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>新密码</Text>
          <View style={styles.passwordInputWrapper}>
            <Icon source="lock" size={20} color="#718096" />
            <TextInput
              style={styles.formInput}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="请输入新密码"
              secureTextEntry={!showPassword}
              editable={!activating}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Icon
                source={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color="#718096"
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.formLabel}>确认密码</Text>
          <View style={styles.passwordInputWrapper}>
            <Icon source="lock-check" size={20} color="#718096" />
            <TextInput
              style={styles.formInput}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="请再次输入密码"
              secureTextEntry={!showPassword}
              editable={!activating}
            />
            {confirmPassword.length > 0 && (
              <Icon
                source={passwordsMatch ? 'check-circle' : 'close-circle'}
                size={20}
                color={passwordsMatch ? '#48bb78' : '#e53e3e'}
              />
            )}
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.secondaryButton} onPress={goToPreviousStep}>
            <Icon source="arrow-left" size={18} color="#3182ce" />
            <Text style={styles.secondaryButtonText}>返回</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!passwordValidation.valid || !passwordsMatch || activating) &&
                styles.primaryButtonDisabled,
            ]}
            onPress={handleActivateDevice}
            disabled={!passwordValidation.valid || !passwordsMatch || activating}
          >
            {activating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>激活设备</Text>
                <Icon source="key" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipActivation}>
          <Text style={styles.skipButtonText}>设备已激活？跳过此步骤</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderNetworkStep = () => {
    return (
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>网络配置</Text>
        <Text style={styles.stepDescription}>
          配置设备的网络参数。如果不确定，可以保持默认设置。
        </Text>

        {selectedDevice && (
          <View style={styles.currentIpCard}>
            <Icon source="ip-network" size={20} color="#3182ce" />
            <Text style={styles.currentIpText}>
              当前 IP: {selectedDevice.ipAddress}
            </Text>
          </View>
        )}

        {/* DHCP toggle */}
        <View style={styles.switchRow}>
          <View style={styles.switchInfo}>
            <Text style={styles.switchLabel}>自动获取 IP (DHCP)</Text>
            <Text style={styles.switchDescription}>推荐启用，由路由器自动分配 IP</Text>
          </View>
          <Switch value={useDhcp} onValueChange={setUseDhcp} />
        </View>

        {/* Static IP config */}
        {!useDhcp && (
          <View style={styles.staticIpConfig}>
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>IP 地址</Text>
              <View style={styles.formInputWrapper}>
                <TextInput
                  style={styles.formInput}
                  value={ipAddress}
                  onChangeText={setIpAddress}
                  placeholder="例如: 192.168.1.100"
                  keyboardType="numeric"
                  editable={!configuringNetwork}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>子网掩码</Text>
              <View style={styles.formInputWrapper}>
                <TextInput
                  style={styles.formInput}
                  value={subnetMask}
                  onChangeText={setSubnetMask}
                  placeholder="例如: 255.255.255.0"
                  keyboardType="numeric"
                  editable={!configuringNetwork}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>默认网关</Text>
              <View style={styles.formInputWrapper}>
                <TextInput
                  style={styles.formInput}
                  value={gateway}
                  onChangeText={setGateway}
                  placeholder="例如: 192.168.1.1"
                  keyboardType="numeric"
                  editable={!configuringNetwork}
                />
              </View>
            </View>
          </View>
        )}

        {/* Action buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.secondaryButton} onPress={goToPreviousStep}>
            <Icon source="arrow-left" size={18} color="#3182ce" />
            <Text style={styles.secondaryButtonText}>返回</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, configuringNetwork && styles.primaryButtonDisabled]}
            onPress={handleConfigureNetwork}
            disabled={configuringNetwork}
          >
            {configuringNetwork ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>保存并继续</Text>
                <Icon source="arrow-right" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipNetworkConfig}>
          <Text style={styles.skipButtonText}>跳过此步骤</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderPushStep = () => {
    return (
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>云端推送配置</Text>
        <Text style={styles.stepDescription}>
          配置设备事件推送到云端。启用后，设备检测到事件会自动通知管理平台。
        </Text>

        {/* Server info */}
        <View style={styles.serverInfoCard}>
          <Icon source="cloud-check" size={20} color="#48bb78" />
          <Text style={styles.serverInfoText}>
            推送服务器: cretas-alarm.example.com:8080
          </Text>
        </View>

        {/* Push options */}
        <View style={styles.pushOptionsContainer}>
          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <View style={styles.switchTitleRow}>
                <Icon source="motion-sensor" size={20} color="#ed8936" />
                <Text style={styles.switchLabel}>移动侦测推送</Text>
              </View>
              <Text style={styles.switchDescription}>
                检测到画面中有物体移动时推送告警
              </Text>
            </View>
            <Switch
              value={enableMotionDetection}
              onValueChange={setEnableMotionDetection}
            />
          </View>

          <View style={styles.optionDivider} />

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <View style={styles.switchTitleRow}>
                <Icon source="border-horizontal" size={20} color="#3182ce" />
                <Text style={styles.switchLabel}>越界检测推送</Text>
              </View>
              <Text style={styles.switchDescription}>
                检测到人员/物体越过设定边界时推送告警
              </Text>
            </View>
            <Switch value={enableLineCrossing} onValueChange={setEnableLineCrossing} />
          </View>

          <View style={styles.optionDivider} />

          <View style={styles.switchRow}>
            <View style={styles.switchInfo}>
              <View style={styles.switchTitleRow}>
                <Icon source="shape-polygon-plus" size={20} color="#805ad5" />
                <Text style={styles.switchLabel}>区域入侵推送</Text>
              </View>
              <Text style={styles.switchDescription}>
                检测到人员/物体进入设定区域时推送告警
              </Text>
            </View>
            <Switch
              value={enableFieldDetection}
              onValueChange={setEnableFieldDetection}
            />
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonGroup}>
          <TouchableOpacity style={styles.secondaryButton} onPress={goToPreviousStep}>
            <Icon source="arrow-left" size={18} color="#3182ce" />
            <Text style={styles.secondaryButtonText}>返回</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, configuringPush && styles.primaryButtonDisabled]}
            onPress={handleConfigurePush}
            disabled={configuringPush}
          >
            {configuringPush ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Text style={styles.primaryButtonText}>保存并继续</Text>
                <Icon source="arrow-right" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipPushConfig}>
          <Text style={styles.skipButtonText}>跳过此步骤</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  const renderCompleteStep = () => {
    return (
      <ScrollView style={styles.stepContent}>
        <Text style={styles.stepTitle}>配置完成</Text>
        <Text style={styles.stepDescription}>
          请确认以下配置信息，点击注册将设备添加到管理平台。
        </Text>

        {/* Configuration summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>设备信息</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>设备名称</Text>
            <Text style={styles.summaryValue}>
              {selectedDevice?.deviceName || selectedDevice?.manufacturer || '-'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>设备类型</Text>
            <Text style={styles.summaryValue}>
              {getDeviceTypeName((selectedDevice?.deviceType as 'IPC' | 'NVR') || 'IPC')}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>IP 地址</Text>
            <Text style={styles.summaryValue}>
              {selectedDevice?.networkConfig?.ipAddress || selectedDevice?.ipAddress || '-'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>网络模式</Text>
            <Text style={styles.summaryValue}>
              {selectedDevice?.networkConfig?.dhcp ? '自动获取 (DHCP)' : '静态 IP'}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>推送配置</Text>
          <View style={styles.pushSummaryRow}>
            <Icon
              source={enableMotionDetection ? 'check-circle' : 'close-circle'}
              size={18}
              color={enableMotionDetection ? '#48bb78' : '#a0aec0'}
            />
            <Text style={styles.pushSummaryText}>移动侦测推送</Text>
          </View>
          <View style={styles.pushSummaryRow}>
            <Icon
              source={enableLineCrossing ? 'check-circle' : 'close-circle'}
              size={18}
              color={enableLineCrossing ? '#48bb78' : '#a0aec0'}
            />
            <Text style={styles.pushSummaryText}>越界检测推送</Text>
          </View>
          <View style={styles.pushSummaryRow}>
            <Icon
              source={enableFieldDetection ? 'check-circle' : 'close-circle'}
              size={18}
              color={enableFieldDetection ? '#48bb78' : '#a0aec0'}
            />
            <Text style={styles.pushSummaryText}>区域入侵推送</Text>
          </View>
        </View>

        {/* Success/Error state */}
        {registerSuccess && (
          <View style={styles.successBanner}>
            <Icon source="check-circle" size={24} color="#48bb78" />
            <Text style={styles.successText}>设备注册成功!</Text>
          </View>
        )}

        {registerError && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorBannerText}>{registerError}</Text>
          </View>
        )}

        {/* Action buttons */}
        {!registerSuccess ? (
          <View style={styles.buttonGroup}>
            <TouchableOpacity style={styles.secondaryButton} onPress={goToPreviousStep}>
              <Icon source="arrow-left" size={18} color="#3182ce" />
              <Text style={styles.secondaryButtonText}>返回</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, registering && styles.primaryButtonDisabled]}
              onPress={handleRegisterDevice}
              disabled={registering}
            >
              {registering ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Icon source="check" size={18} color="#ffffff" />
                  <Text style={styles.primaryButtonText}>注册设备</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
            <Icon source="check-all" size={20} color="#ffffff" />
            <Text style={styles.finishButtonText}>完成，返回设备列表</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 'scan':
        return renderScanStep();
      case 'activate':
        return renderActivateStep();
      case 'network':
        return renderNetworkStep();
      case 'push':
        return renderPushStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Step indicator */}
      {renderStepIndicator()}

      {/* Current step content */}
      <Animated.View
        style={[
          styles.contentContainer,
          {
            opacity: stepAnimation.interpolate({
              inputRange: [0, 1],
              outputRange: [0.5, 1],
            }),
            transform: [
              {
                translateX: stepAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        {renderCurrentStep()}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  stepItem: {
    alignItems: 'center',
    width: 56,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleCompleted: {
    backgroundColor: '#48bb78',
  },
  stepCircleCurrent: {
    backgroundColor: '#3182ce',
  },
  stepLabel: {
    fontSize: 10,
    color: '#a0aec0',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#2d3748',
    fontWeight: '500',
  },
  stepConnector: {
    width: 20,
    height: 2,
    backgroundColor: '#e2e8f0',
    marginBottom: 16,
  },
  stepConnectorCompleted: {
    backgroundColor: '#48bb78',
  },
  contentContainer: {
    flex: 1,
  },
  stepContent: {
    flex: 1,
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 8,
  },
  stepDescription: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 20,
  },

  // Scan step styles
  scanInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
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
    backgroundColor: '#3182ce',
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 8,
    gap: 6,
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
    backgroundColor: '#ebf8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#bee3f8',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3182ce',
  },
  progressText: {
    fontSize: 13,
    color: '#2b6cb0',
    textAlign: 'center',
  },
  deviceList: {
    flex: 1,
    marginBottom: 16,
  },
  deviceCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  deviceCardSelected: {
    borderColor: '#3182ce',
    backgroundColor: '#f7fafc',
  },
  deviceCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioContainer: {
    marginRight: 10,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#cbd5e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: '#3182ce',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3182ce',
  },
  deviceCardInfo: {
    flex: 1,
    marginLeft: 10,
  },
  deviceCardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
  },
  deviceCardIp: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  activationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  activatedBadge: {
    backgroundColor: '#c6f6d5',
  },
  inactiveBadge: {
    backgroundColor: '#fed7d7',
  },
  activationBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  activatedText: {
    color: '#276749',
  },
  inactiveText: {
    color: '#c53030',
  },
  deviceCardDetails: {
    flexDirection: 'row',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 16,
  },
  deviceCardDetail: {
    fontSize: 12,
    color: '#a0aec0',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#a0aec0',
  },

  // Activation step styles
  deviceInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
    gap: 12,
  },
  deviceInfoText: {
    flex: 1,
  },
  deviceInfoName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
  },
  deviceInfoIp: {
    fontSize: 13,
    color: '#718096',
    marginTop: 2,
  },
  requirementsCard: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4a5568',
    marginBottom: 12,
  },
  requirementsList: {
    gap: 8,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requirementText: {
    fontSize: 13,
    color: '#a0aec0',
  },
  requirementTextValid: {
    color: '#48bb78',
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
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  passwordInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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

  // Network step styles
  currentIpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ebf8ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  currentIpText: {
    fontSize: 14,
    color: '#2b6cb0',
    fontWeight: '500',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
  },
  switchInfo: {
    flex: 1,
    marginRight: 12,
  },
  switchTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2d3748',
  },
  switchDescription: {
    fontSize: 12,
    color: '#a0aec0',
    marginTop: 2,
  },
  staticIpConfig: {
    backgroundColor: '#ffffff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 20,
  },

  // Push step styles
  serverInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#c6f6d5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    gap: 8,
  },
  serverInfoText: {
    fontSize: 13,
    color: '#276749',
  },
  pushOptionsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginBottom: 20,
  },
  optionDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 14,
  },

  // Complete step styles
  summaryCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 10,
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#718096',
  },
  summaryValue: {
    fontSize: 14,
    color: '#2d3748',
    fontWeight: '500',
  },
  pushSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  pushSummaryText: {
    fontSize: 14,
    color: '#4a5568',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#c6f6d5',
    padding: 16,
    borderRadius: 10,
    marginBottom: 20,
    gap: 10,
  },
  successText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#276749',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#c53030',
  },

  // Button styles
  buttonGroup: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  primaryButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  secondaryButton: {
    flex: 0.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3182ce',
    gap: 6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#3182ce',
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  skipButtonText: {
    fontSize: 14,
    color: '#718096',
    textDecorationLine: 'underline',
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#48bb78',
    paddingVertical: 16,
    borderRadius: 10,
    gap: 10,
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default DeviceSetupWizardScreen;
