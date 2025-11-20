import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  RadioButton,
  Button,
  Chip,
  Divider,
  ActivityIndicator,
  SegmentedButtons,
  List,
  Portal,
  Dialog,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../store/authStore';
import { API_CONFIG } from '../../constants/config';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建EntityDataExport专用logger
const entityExportLogger = logger.createContextLogger('EntityDataExport');

type EntityType = 'customer' | 'supplier' | 'equipment' | 'user' | 'materialType';
type OperationMode = 'export' | 'template' | 'import';

interface ImportResult {
  totalCount: number;
  successCount: number;
  failureCount: number;
  isFullSuccess: boolean;
  failureDetails: Array<{
    rowNumber: number;
    reason: string;
    rawData: string;
  }>;
}

// FormData文件上传类型定义
interface FormDataFile {
  uri: string;
  name: string;
  type: string;
}

/**
 * 实体数据导出导入页面
 * 功能：
 * - 支持5种实体类型（客户/供应商/设备/用户/原材料）
 * - 支持导出数据、下载模板、批量导入
 * - 显示导入结果详情
 */
export default function EntityDataExportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 实体类型选择
  const [entityType, setEntityType] = useState<EntityType>('customer');
  // 操作模式选择
  const [operationMode, setOperationMode] = useState<OperationMode>('export');

  // UI状态
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showResultDialog, setShowResultDialog] = useState(false);

  // 实体类型定义
  const entityTypes = [
    {
      value: 'customer' as EntityType,
      label: '客户',
      icon: 'account-group',
      endpoint: 'customers',
      description: '客户信息：编码、名称、联系方式、付款条款等',
      color: '#2196F3',
    },
    {
      value: 'supplier' as EntityType,
      label: '供应商',
      icon: 'truck-delivery',
      endpoint: 'suppliers',
      description: '供应商信息：编码、名称、供应材料、交货天数等',
      color: '#FF9800',
    },
    {
      value: 'equipment' as EntityType,
      label: '设备',
      icon: 'factory',
      endpoint: 'equipment',
      description: '设备信息：编码、型号、制造商、维护状态等',
      color: '#4CAF50',
    },
    {
      value: 'user' as EntityType,
      label: '用户',
      icon: 'account',
      endpoint: 'users',
      description: '用户信息：用户名、角色、部门、工资等',
      color: '#9C27B0',
    },
    {
      value: 'materialType' as EntityType,
      label: '原材料类型',
      icon: 'package-variant',
      endpoint: 'materials/types',
      description: '原材料类型：编码、名称、类别、计量单位等',
      color: '#00BCD4',
    },
  ];

  // 操作模式定义
  const operationModes = [
    {
      value: 'export' as OperationMode,
      label: '导出数据',
      icon: 'download',
    },
    {
      value: 'template' as OperationMode,
      label: '下载模板',
      icon: 'file-download-outline',
    },
    {
      value: 'import' as OperationMode,
      label: '批量导入',
      icon: 'upload',
    },
  ];

  /**
   * 获取当前实体配置
   */
  const getCurrentEntity = () => {
    return entityTypes.find(e => e.value === entityType);
  };

  /**
   * 处理导出数据
   */
  const handleExportData = async () => {
    const factoryId = getFactoryId(user);
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息，请重新登录');
      return;
    }

    const currentEntity = getCurrentEntity();
    if (!currentEntity) return;

    setLoading(true);

    try {
      const apiUrl = `${API_CONFIG.BASE_URL}/api/mobile/${factoryId}/${currentEntity.endpoint}/export`;
      entityExportLogger.info('导出数据', { entityType, endpoint: currentEntity.endpoint });

      // 生成文件名
      const timestamp = new Date().getTime();
      const fileName = `${currentEntity.label}_${timestamp}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 下载文件
      const downloadResult = await FileSystem.downloadAsync(apiUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`下载失败，HTTP状态码: ${downloadResult.status}`);
      }

      entityExportLogger.info('文件下载成功', { fileName, fileUri: downloadResult.uri });

      // 获取文件信息
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);

      // 检查分享功能是否可用
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        Alert.alert(
          '导出成功',
          `${currentEntity.label}数据已导出\n\n文件大小：${((fileInfo.size || 0) / 1024).toFixed(2)} KB`,
          [
            {
              text: '稍后查看',
              style: 'cancel',
            },
            {
              text: '分享文件',
              onPress: async () => {
                try {
                  await Sharing.shareAsync(downloadResult.uri);
                } catch (shareError) {
                  entityExportLogger.error('分享文件失败', shareError);
                  Alert.alert('分享失败', '无法分享文件，请稍后重试');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          '导出成功',
          `${currentEntity.label}数据已导出\n\n文件已保存到：${downloadResult.uri}`,
          [{ text: '确定' }]
        );
      }
    } catch (error) {
      entityExportLogger.error('导出失败', error, { entityType });
      Alert.alert('导出失败', error.message || '导出数据时出现错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理下载模板
   */
  const handleDownloadTemplate = async () => {
    const factoryId = getFactoryId(user);
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息，请重新登录');
      return;
    }

    const currentEntity = getCurrentEntity();
    if (!currentEntity) return;

    setLoading(true);

    try {
      const apiUrl = `${API_CONFIG.BASE_URL}/api/mobile/${factoryId}/${currentEntity.endpoint}/export/template`;
      entityExportLogger.info('下载模板', { entityType, endpoint: currentEntity.endpoint });

      // 生成文件名
      const fileName = `${currentEntity.label}_导入模板.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 下载文件
      const downloadResult = await FileSystem.downloadAsync(apiUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`下载失败，HTTP状态码: ${downloadResult.status}`);
      }

      entityExportLogger.info('模板下载成功', { fileName, fileUri: downloadResult.uri });

      // 检查分享功能是否可用
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        Alert.alert(
          '下载成功',
          `${currentEntity.label}导入模板已下载`,
          [
            {
              text: '稍后查看',
              style: 'cancel',
            },
            {
              text: '分享模板',
              onPress: async () => {
                try {
                  await Sharing.shareAsync(downloadResult.uri);
                } catch (shareError) {
                  entityExportLogger.error('分享模板失败', shareError);
                  Alert.alert('分享失败', '无法分享文件，请稍后重试');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          '下载成功',
          `模板已保存到：${downloadResult.uri}`,
          [{ text: '确定' }]
        );
      }
    } catch (error) {
      entityExportLogger.error('下载模板失败', error, { entityType });
      Alert.alert('下载失败', error.message || '下载模板时出现错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 处理批量导入
   */
  const handleImport = async () => {
    const factoryId = getFactoryId(user);
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息，请重新登录');
      return;
    }

    const currentEntity = getCurrentEntity();
    if (!currentEntity) return;

    try {
      // 选择文件
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      entityExportLogger.info('选择导入文件', {
        fileName: file.name,
        fileSize: `${((file.size || 0) / 1024).toFixed(2)}KB`
      });

      // 验证文件大小（10MB限制）
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert('文件过大', '文件大小不能超过10MB，请分批导入');
        return;
      }

      setLoading(true);

      // 构建FormData
      const formData = new FormData();
      const fileData: FormDataFile = {
        uri: file.uri,
        name: file.name,
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      };
      formData.append('file', fileData as any as Blob);

      const apiUrl = `${API_CONFIG.BASE_URL}/api/mobile/${factoryId}/${currentEntity.endpoint}/import`;
      entityExportLogger.info('上传导入文件', { entityType, endpoint: currentEntity.endpoint });

      // 发送请求
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          // 不设置Content-Type，让浏览器自动设置boundary
        },
        body: formData,
      });

      const responseData = await response.json();
      entityExportLogger.info('导入响应', {
        success: response.ok,
        totalCount: responseData.data?.totalCount,
        successCount: responseData.data?.successCount
      });

      if (!response.ok) {
        throw new Error(responseData.message || '导入失败');
      }

      const result: ImportResult = responseData.data;
      setImportResult(result);

      if (result.isFullSuccess) {
        Alert.alert(
          '导入成功',
          `成功导入${result.successCount}条${currentEntity.label}记录`,
          [{ text: '确定' }]
        );
      } else {
        setShowResultDialog(true);
      }
    } catch (error) {
      entityExportLogger.error('导入失败', error, { entityType });
      Alert.alert('导入失败', error.message || '导入数据时出现错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 执行操作
   */
  const handleExecute = () => {
    switch (operationMode) {
      case 'export':
        handleExportData();
        break;
      case 'template':
        handleDownloadTemplate();
        break;
      case 'import':
        handleImport();
        break;
    }
  };

  const currentEntity = getCurrentEntity();
  const currentOperation = operationModes.find(m => m.value === operationMode);

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="数据导出导入" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 实体类型选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="选择数据类型" titleVariant="titleMedium" />
          <Card.Content>
            <RadioButton.Group
              onValueChange={(value) => setEntityType(value as EntityType)}
              value={entityType}
            >
              {entityTypes.map((type) => (
                <View key={type.value}>
                  <View style={styles.radioItem}>
                    <RadioButton.Item
                      label=""
                      value={type.value}
                      style={styles.radioButton}
                      labelStyle={styles.radioLabel}
                    />
                    <View style={styles.radioContent}>
                      <View style={styles.radioHeader}>
                        <Text variant="titleSmall" style={{ color: type.color }}>
                          {type.label}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={styles.radioDescription}>
                        {type.description}
                      </Text>
                    </View>
                  </View>
                  {type.value !== 'materialType' && <Divider style={styles.divider} />}
                </View>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* 操作模式选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="选择操作" titleVariant="titleMedium" />
          <Card.Content>
            <SegmentedButtons
              value={operationMode}
              onValueChange={(value) => setOperationMode(value as OperationMode)}
              buttons={operationModes.map((mode) => ({
                value: mode.value,
                label: mode.label,
                icon: mode.icon,
              }))}
            />

            {/* 操作说明 */}
            <View style={styles.operationInfo}>
              <Text variant="bodySmall" style={styles.operationInfoText}>
                {operationMode === 'export' && '• 导出当前所有数据到Excel文件'}
                {operationMode === 'template' && '• 下载空白导入模板，填写数据后可批量导入'}
                {operationMode === 'import' && '• 上传填好的Excel文件，批量导入数据'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* 操作预览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="操作预览" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                数据类型：
              </Text>
              <Chip style={{ backgroundColor: currentEntity?.color }}>
                {currentEntity?.label}
              </Chip>
            </View>

            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                操作类型：
              </Text>
              <Text variant="bodyMedium">{currentOperation?.label}</Text>
            </View>

            <Divider style={styles.divider} />

            <Text variant="bodySmall" style={styles.previewHint}>
              {currentEntity?.description}
            </Text>
          </Card.Content>
        </Card>

        {/* 执行按钮 */}
        <Button
          mode="contained"
          icon={currentOperation?.icon}
          onPress={handleExecute}
          loading={loading}
          disabled={loading}
          style={styles.executeButton}
          contentStyle={styles.executeButtonContent}
        >
          {loading ? '处理中...' : currentOperation?.label}
        </Button>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 导入结果对话框 */}
      <Portal>
        <Dialog visible={showResultDialog} onDismiss={() => setShowResultDialog(false)}>
          <Dialog.Title>导入结果</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {importResult && (
                <>
                  <View style={styles.resultSummary}>
                    <Text variant="bodyMedium">
                      总计：{importResult.totalCount} 条
                    </Text>
                    <Text variant="bodyMedium" style={{ color: '#4CAF50' }}>
                      成功：{importResult.successCount} 条
                    </Text>
                    <Text variant="bodyMedium" style={{ color: '#F44336' }}>
                      失败：{importResult.failureCount} 条
                    </Text>
                  </View>

                  {importResult.failureDetails && importResult.failureDetails.length > 0 && (
                    <>
                      <Divider style={styles.divider} />
                      <Text variant="titleSmall" style={styles.failureTitle}>
                        失败详情：
                      </Text>
                      {importResult.failureDetails.map((detail, index) => (
                        <List.Item
                          key={index}
                          title={`第 ${detail.rowNumber} 行`}
                          description={detail.reason}
                          left={(props) => <List.Icon {...props} icon="alert-circle" color="#F44336" />}
                          style={styles.failureItem}
                        />
                      ))}
                    </>
                  )}
                </>
              )}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setShowResultDialog(false)}>关闭</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 加载遮罩 */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>处理中，请稍候...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    marginBottom: 16,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButton: {
    paddingLeft: 0,
  },
  radioLabel: {
    fontSize: 0,
  },
  radioContent: {
    flex: 1,
    marginLeft: -8,
  },
  radioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioDescription: {
    color: '#666',
    marginTop: 2,
  },
  divider: {
    marginVertical: 8,
  },
  operationInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  operationInfoText: {
    color: '#666',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewLabel: {
    fontWeight: '500',
    marginRight: 8,
    minWidth: 80,
  },
  previewHint: {
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  executeButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  executeButtonContent: {
    height: 50,
  },
  bottomPadding: {
    height: 40,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
  dialogContent: {
    maxHeight: 400,
    paddingHorizontal: 24,
  },
  resultSummary: {
    paddingVertical: 12,
  },
  failureTitle: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  failureItem: {
    paddingVertical: 0,
  },
});
