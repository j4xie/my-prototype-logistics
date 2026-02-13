/**
 * NFC 签到扫描 Modal
 *
 * 用于扫描员工 NFC 标签完成签到。
 * 如果设备不支持 NFC 或模块未安装，自动提示用户改用 QR 扫码。
 *
 * NFC 标签数据格式 (NDEF Text Record):
 *   "CRETAS:EMP:{employeeId}:{factoryId}"
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  isNfcModuleInstalled,
  checkNfcAvailability,
  startNfcScan,
  stopNfcScan,
  parseNfcTag,
  NfcAvailability,
  NfcTagData,
} from '../../utils/nfcUtils';

interface NfcCheckinModalProps {
  visible: boolean;
  onClose: () => void;
  onTagRead: (employeeId: string) => void;
  onFallbackToQR: () => void;
  factoryId: string;
}

type ScanState = 'checking' | 'scanning' | 'success' | 'error' | 'unsupported';

const NfcCheckinModal: React.FC<NfcCheckinModalProps> = ({
  visible,
  onClose,
  onTagRead,
  onFallbackToQR,
  factoryId,
}) => {
  const [scanState, setScanState] = useState<ScanState>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [scannedData, setScannedData] = useState<NfcTagData | null>(null);
  const [nfcStatus, setNfcStatus] = useState<NfcAvailability | null>(null);

  // Pulse animation for the NFC icon
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  // Start pulse animation
  const startPulse = useCallback(() => {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.current.start();
  }, [pulseAnim]);

  // Stop pulse animation
  const stopPulse = useCallback(() => {
    if (pulseLoop.current) {
      pulseLoop.current.stop();
      pulseLoop.current = null;
    }
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  // Check NFC availability when modal opens
  useEffect(() => {
    if (!visible) {
      setScanState('checking');
      setErrorMessage('');
      setScannedData(null);
      stopPulse();
      return;
    }

    let cancelled = false;

    const initNfc = async () => {
      const availability = await checkNfcAvailability();
      if (cancelled) return;

      setNfcStatus(availability);

      if (!availability.moduleInstalled) {
        setScanState('unsupported');
        setErrorMessage('NFC 模块未安装，请先安装 react-native-nfc-manager');
        return;
      }

      if (!availability.hardwareSupported) {
        setScanState('unsupported');
        setErrorMessage('当前设备不支持 NFC 功能');
        return;
      }

      if (!availability.enabled) {
        setScanState('unsupported');
        setErrorMessage('NFC 未开启，请在系统设置中启用 NFC');
        return;
      }

      // NFC is available, start scanning
      setScanState('scanning');
      startPulse();
      performScan();
    };

    initNfc();

    return () => {
      cancelled = true;
      stopNfcScan();
      stopPulse();
    };
  }, [visible, startPulse, stopPulse]);

  // Perform NFC scan
  const performScan = useCallback(async () => {
    try {
      const tag = await startNfcScan();
      const data = parseNfcTag(tag);

      if (!data) {
        setScanState('error');
        setErrorMessage('无法识别标签数据，请使用白垩纪标准 NFC 标签');
        stopPulse();
        return;
      }

      // Verify factoryId matches
      if (data.factoryId !== factoryId) {
        setScanState('error');
        setErrorMessage(`标签工厂编号不匹配 (标签: ${data.factoryId}, 当前: ${factoryId})`);
        stopPulse();
        return;
      }

      // Success
      setScanState('success');
      setScannedData(data);
      stopPulse();

      // Notify parent after a short delay for visual feedback
      setTimeout(() => {
        onTagRead(data.employeeId);
      }, 1000);
    } catch (error: unknown) {
      // Don't show error if modal was closed during scan
      const msg = error instanceof Error ? error.message : '扫描失败';
      if (msg.includes('cancelled') || msg.includes('cancel')) {
        // User cancelled or modal closed, ignore
        return;
      }
      setScanState('error');
      setErrorMessage(msg);
      stopPulse();
    }
  }, [factoryId, onTagRead, stopPulse]);

  // Retry scanning
  const handleRetry = useCallback(() => {
    setScanState('scanning');
    setErrorMessage('');
    setScannedData(null);
    startPulse();
    performScan();
  }, [performScan, startPulse]);

  // Handle close
  const handleClose = useCallback(() => {
    stopNfcScan();
    stopPulse();
    onClose();
  }, [onClose, stopPulse]);

  // Handle fallback to QR
  const handleFallbackToQR = useCallback(() => {
    stopNfcScan();
    stopPulse();
    onClose();
    onFallbackToQR();
  }, [onClose, onFallbackToQR, stopPulse]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>NFC 签到</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            {scanState === 'checking' && (
              <View style={styles.stateContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.stateText}>正在检测 NFC...</Text>
              </View>
            )}

            {scanState === 'scanning' && (
              <View style={styles.stateContainer}>
                <Animated.View
                  style={[
                    styles.nfcIconContainer,
                    { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  <View style={styles.nfcIconOuter}>
                    <View style={styles.nfcIconInner}>
                      <MaterialCommunityIcons name="nfc" size={56} color="#4F46E5" />
                    </View>
                  </View>
                </Animated.View>
                <Text style={styles.scanTitle}>请将 NFC 标签靠近手机背部</Text>
                <Text style={styles.scanHint}>
                  将员工 NFC 卡片贴近手机背面的 NFC 感应区域
                </Text>
              </View>
            )}

            {scanState === 'success' && (
              <View style={styles.stateContainer}>
                <View style={[styles.resultIcon, styles.successIcon]}>
                  <MaterialCommunityIcons name="check-circle" size={64} color="#10B981" />
                </View>
                <Text style={styles.successTitle}>识别成功</Text>
                {scannedData && (
                  <View style={styles.tagInfo}>
                    <View style={styles.tagInfoRow}>
                      <Text style={styles.tagInfoLabel}>员工编号</Text>
                      <Text style={styles.tagInfoValue}>#{scannedData.employeeId}</Text>
                    </View>
                    <View style={styles.tagInfoRow}>
                      <Text style={styles.tagInfoLabel}>工厂编号</Text>
                      <Text style={styles.tagInfoValue}>{scannedData.factoryId}</Text>
                    </View>
                  </View>
                )}
                <Text style={styles.successHint}>正在处理签到...</Text>
              </View>
            )}

            {scanState === 'error' && (
              <View style={styles.stateContainer}>
                <View style={[styles.resultIcon, styles.errorIcon]}>
                  <MaterialCommunityIcons name="close-circle" size={64} color="#EF4444" />
                </View>
                <Text style={styles.errorTitle}>识别失败</Text>
                <Text style={styles.errorMessage}>{errorMessage}</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                  <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
                  <Text style={styles.retryBtnText}>重试</Text>
                </TouchableOpacity>
              </View>
            )}

            {scanState === 'unsupported' && (
              <View style={styles.stateContainer}>
                <View style={[styles.resultIcon, styles.warningIcon]}>
                  <MaterialCommunityIcons name="nfc-off" size={64} color="#F59E0B" />
                </View>
                <Text style={styles.warningTitle}>NFC 不可用</Text>
                <Text style={styles.warningMessage}>{errorMessage}</Text>
              </View>
            )}
          </View>

          {/* Footer - QR Fallback */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.qrFallbackBtn} onPress={handleFallbackToQR}>
              <MaterialCommunityIcons name="qrcode-scan" size={20} color="#4F46E5" />
              <Text style={styles.qrFallbackText}>改用 QR 扫码签到</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 480,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  closeBtn: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    minHeight: 320,
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // NFC icon with pulse effect
  nfcIconContainer: {
    marginBottom: 24,
  },
  nfcIconOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nfcIconInner: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  scanHint: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  stateText: {
    marginTop: 16,
    fontSize: 15,
    color: '#6B7280',
  },
  // Success state
  resultIcon: {
    marginBottom: 16,
  },
  successIcon: {},
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#10B981',
    marginBottom: 16,
  },
  tagInfo: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 12,
  },
  tagInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  tagInfoLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  tagInfoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  successHint: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  // Error state
  errorIcon: {},
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Warning / unsupported state
  warningIcon: {},
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F59E0B',
    marginBottom: 8,
  },
  warningMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  qrFallbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    gap: 8,
  },
  qrFallbackText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4F46E5',
  },
});

export default NfcCheckinModal;
