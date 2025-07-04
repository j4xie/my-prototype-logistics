import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ViewStyle, Alert } from 'react-native';
import { Text, IconButton, Button } from 'react-native-paper';
import { Card } from '../base/Card';
import { Modal } from '../base/Modal';

export interface QRScannerProps {
  visible: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
  helpText?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  visible,
  onClose,
  onScan,
  title = '扫描二维码',
  helpText = '将二维码放在扫描框内',
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    // 请求相机权限
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      // 在真实的React Native环境中，这里应该使用expo-camera或react-native-camera
      // 这里只是模拟权限请求
      setHasPermission(true);
    } catch (error) {
      Alert.alert('权限错误', '无法获取相机权限');
      setHasPermission(false);
    }
  };

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    onScan(data);
  };

  const handleRetry = () => {
    setScanned(false);
  };

  // 模拟扫描界面
  const renderScannerContent = () => {
    if (hasPermission === null) {
      return (
        <View style={styles.permissionContainer}>
          <Text variant="bodyLarge">请求相机权限中...</Text>
        </View>
      );
    }

    if (hasPermission === false) {
      return (
        <View style={styles.permissionContainer}>
          <Text variant="bodyLarge" style={styles.errorText}>
            无法访问相机
          </Text>
          <Text variant="bodyMedium" style={styles.helpText}>
            请在设置中允许应用访问相机
          </Text>
          <Button mode="outlined" onPress={requestCameraPermission}>
            重新请求权限
          </Button>
        </View>
      );
    }

    return (
      <View style={styles.scannerContainer}>
        {/* 扫描框 */}
        <View style={styles.scannerFrame}>
          <View style={styles.scannerOverlay}>
            {/* 扫描框四个角 */}
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            
            {/* 扫描线 */}
            <View style={styles.scanLine} />
          </View>
        </View>

        {/* 帮助文本 */}
        <Text variant="bodyLarge" style={styles.helpTextCenter}>
          {helpText}
        </Text>

        {/* 手动输入按钮 */}
        <Button mode="outlined" onPress={() => handleManualInput()}>
          手动输入
        </Button>

        {scanned && (
          <Card style={styles.resultCard}>
            <Text variant="bodyMedium">扫描成功！</Text>
            <Button mode="text" onPress={handleRetry}>
              重新扫描
            </Button>
          </Card>
        )}
      </View>
    );
  };

  const handleManualInput = () => {
    // 这里可以打开一个输入框让用户手动输入
    Alert.prompt(
      '手动输入',
      '请输入二维码内容：',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: (text) => {
            if (text) {
              onScan(text);
            }
          }
        }
      ],
      'plain-text'
    );
  };

  return (
    <Modal
      visible={visible}
      onDismiss={onClose}
      title={title}
      size="fullscreen"
      style={styles.modal}
    >
      <View style={styles.container}>
        {renderScannerContent()}
        
        {/* 底部操作栏 */}
        <View style={styles.bottomBar}>
          <IconButton
            icon="flashlight"
            mode="contained"
            onPress={() => {
              // 切换闪光灯
              Alert.alert('功能提示', '闪光灯功能需要在真实设备上测试');
            }}
          />
          
          <IconButton
            icon="image"
            mode="contained"
            onPress={() => {
              // 从相册选择
              Alert.alert('功能提示', '从相册选择功能正在开发中');
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

// 快捷扫描按钮组件
export interface QuickScanButtonProps {
  onScan: (data: string) => void;
  buttonText?: string;
  icon?: string;
  style?: ViewStyle;
}

export const QuickScanButton: React.FC<QuickScanButtonProps> = ({
  onScan,
  buttonText = '扫码',
  icon = 'qrcode-scan',
  style,
}) => {
  const [scannerVisible, setScannerVisible] = useState(false);

  const handleScan = (data: string) => {
    setScannerVisible(false);
    onScan(data);
  };

  return (
    <>
      <Button
        mode="contained"
        icon={icon}
        onPress={() => setScannerVisible(true)}
        style={style}
      >
        {buttonText}
      </Button>
      
      <QRScanner
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />
    </>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 0,
  } as ViewStyle,
  
  container: {
    flex: 1,
    backgroundColor: '#000',
  } as ViewStyle,
  
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  } as ViewStyle,
  
  errorText: {
    color: '#f44336',
    marginBottom: 8,
  },
  
  helpText: {
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.7,
  },
  
  scannerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  } as ViewStyle,
  
  scannerFrame: {
    width: 250,
    height: 250,
    marginBottom: 40,
  } as ViewStyle,
  
  scannerOverlay: {
    flex: 1,
    position: 'relative',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 8,
  } as ViewStyle,
  
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#2196F3',
    borderWidth: 3,
  } as ViewStyle,
  
  topLeft: {
    top: -3,
    left: -3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  } as ViewStyle,
  
  topRight: {
    top: -3,
    right: -3,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  } as ViewStyle,
  
  bottomLeft: {
    bottom: -3,
    left: -3,
    borderRightWidth: 0,
    borderTopWidth: 0,
  } as ViewStyle,
  
  bottomRight: {
    bottom: -3,
    right: -3,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  } as ViewStyle,
  
  scanLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#2196F3',
    opacity: 0.8,
  } as ViewStyle,
  
  helpTextCenter: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  
  resultCard: {
    marginTop: 20,
    padding: 16,
    alignItems: 'center',
  } as ViewStyle,
  
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  } as ViewStyle,
});