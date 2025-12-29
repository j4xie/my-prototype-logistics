/**
 * 扫码质检页面
 * Quality Inspector - Scan QR Code Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CameraView, Camera, useCameraPermissions } from 'expo-camera';

import { QI_COLORS, QualityInspectorStackParamList } from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;

export default function QIScanScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    if (scanned || loading) return;

    setScanned(true);
    setLoading(true);

    try {
      // 解析二维码数据
      let batchData: { batchId?: string; batchNumber?: string };

      try {
        batchData = JSON.parse(data);
      } catch {
        // 如果不是 JSON，假设整个字符串是批次号
        batchData = { batchNumber: data };
      }

      if (batchData.batchId) {
        // 有 batchId，直接获取详情
        const batch = await qualityInspectorApi.getBatchDetail(batchData.batchId);
        navigation.replace('QIForm', {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
        });
      } else if (batchData.batchNumber) {
        // 只有批次号，通过扫码API获取
        const batch = await qualityInspectorApi.getBatchByQRCode(data);
        navigation.replace('QIForm', {
          batchId: batch.id,
          batchNumber: batch.batchNumber,
        });
      } else {
        throw new Error('无效的二维码');
      }
    } catch (error) {
      console.error('扫码失败:', error);
      Alert.alert(
        '扫码失败',
        '无法识别该二维码，请确认是否为有效的批次二维码',
        [
          { text: '重新扫描', onPress: () => setScanned(false) },
          { text: '手动选择', onPress: () => navigation.navigate('QIInspectList') },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleFlash = () => {
    setFlashOn(!flashOn);
  };

  const handleManualInput = () => {
    // Alert.prompt is iOS only, navigate to list on Android
    if (typeof Alert.prompt === 'function') {
      Alert.prompt(
        '输入批次号',
        '请输入批次编号',
        async (text) => {
          if (text) {
            setLoading(true);
            try {
              const batch = await qualityInspectorApi.getBatchByQRCode(text);
              navigation.replace('QIForm', {
                batchId: batch.id,
                batchNumber: batch.batchNumber,
              });
            } catch (error) {
              Alert.alert('错误', '未找到该批次');
            } finally {
              setLoading(false);
            }
          }
        },
        'plain-text'
      );
    } else {
      // Android: navigate to batch list for selection
      navigation.navigate('QIInspectList');
    }
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={QI_COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={QI_COLORS.disabled} />
        <Text style={styles.permissionTitle}>需要相机权限</Text>
        <Text style={styles.permissionText}>
          请授权相机权限以扫描批次二维码
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>授权相机</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => navigation.navigate('QIInspectList')}
        >
          <Text style={styles.manualBtnText}>手动选择批次</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={flashOn}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* 扫描框 */}
        <View style={styles.overlay}>
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
              {loading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#fff" />
                  <Text style={styles.loadingText}>识别中...</Text>
                </View>
              )}
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>将二维码放入框内自动扫描</Text>
          </View>
        </View>

        {/* 控制按钮 */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlBtn} onPress={toggleFlash}>
            <Ionicons
              name={flashOn ? 'flash' : 'flash-outline'}
              size={24}
              color="#fff"
            />
            <Text style={styles.controlText}>闪光灯</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlBtn} onPress={handleManualInput}>
            <Ionicons name="keypad-outline" size={24} color="#fff" />
            <Text style={styles.controlText}>手动输入</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.controlBtn}
            onPress={() => navigation.navigate('QIInspectList')}
          >
            <Ionicons name="list-outline" size={24} color="#fff" />
            <Text style={styles.controlText}>批次列表</Text>
          </TouchableOpacity>
        </View>
      </CameraView>

      {/* 重新扫描按钮 */}
      {scanned && !loading && (
        <TouchableOpacity
          style={styles.rescanBtn}
          onPress={() => setScanned(false)}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
          <Text style={styles.rescanText}>重新扫描</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const SCAN_FRAME_SIZE = 250;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },

  // 权限页面
  permissionContainer: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginTop: 16,
    marginBottom: 8,
  },
  permissionText: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionBtn: {
    backgroundColor: QI_COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 16,
  },
  permissionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  manualBtn: {
    paddingVertical: 12,
  },
  manualBtnText: {
    color: QI_COLORS.primary,
    fontSize: 15,
  },

  // 遮罩层
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayMiddle: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 24,
  },
  scanHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },

  // 扫描框
  scanFrame: {
    width: SCAN_FRAME_SIZE,
    height: SCAN_FRAME_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: QI_COLORS.primary,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
  },

  // 控制按钮
  controls: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  controlBtn: {
    alignItems: 'center',
  },
  controlText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 6,
  },

  // 重新扫描
  rescanBtn: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: QI_COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    gap: 8,
  },
  rescanText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
});
