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
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../store/authStore';
import { API_BASE_URL } from '../../constants/config';
import { getFactoryId } from '../../types/auth';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
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
  const { t } = useTranslation('management');
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
      label: t('entityDataExport.entityTypes.customer.label'),
      icon: 'account-group',
      endpoint: 'customers',
      description: t('entityDataExport.entityTypes.customer.description'),
      color: '#2196F3',
    },
    {
      value: 'supplier' as EntityType,
      label: t('entityDataExport.entityTypes.supplier.label'),
      icon: 'truck-delivery',
      endpoint: 'suppliers',
      description: t('entityDataExport.entityTypes.supplier.description'),
      color: '#FF9800',
    },
    {
      value: 'equipment' as EntityType,
      label: t('entityDataExport.entityTypes.equipment.label'),
      icon: 'factory',
      endpoint: 'equipment',
      description: t('entityDataExport.entityTypes.equipment.description'),
      color: '#4CAF50',
    },
    {
      value: 'user' as EntityType,
      label: t('entityDataExport.entityTypes.user.label'),
      icon: 'account',
      endpoint: 'users',
      description: t('entityDataExport.entityTypes.user.description'),
      color: '#9C27B0',
    },
    {
      value: 'materialType' as EntityType,
      label: t('entityDataExport.entityTypes.materialType.label'),
      icon: 'package-variant',
      endpoint: 'materials/types',
      description: t('entityDataExport.entityTypes.materialType.description'),
      color: '#00BCD4',
    },
  ];

  // 操作模式定义
  const operationModes = [
    {
      value: 'export' as OperationMode,
      label: t('entityDataExport.operations.export'),
      icon: 'download',
    },
    {
      value: 'template' as OperationMode,
      label: t('entityDataExport.operations.template'),
      icon: 'file-download-outline',
    },
    {
      value: 'import' as OperationMode,
      label: t('entityDataExport.operations.import'),
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
      Alert.alert(t('common.error'), t('entityDataExport.errors.noFactory'));
      return;
    }

    const currentEntity = getCurrentEntity();
    if (!currentEntity) return;

    setLoading(true);

    try {
      const apiUrl = `${API_BASE_URL}/api/mobile/${factoryId}/${currentEntity.endpoint}/export`;
      entityExportLogger.info('导出数据', { entityType, endpoint: currentEntity.endpoint });

      // 生成文件名
      const timestamp = new Date().getTime();
      const fileName = `${currentEntity.label}_${timestamp}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 下载文件
      const downloadResult = await FileSystem.downloadAsync(apiUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(t('entityDataExport.errors.downloadFailed', { status: downloadResult.status }));
      }

      entityExportLogger.info('文件下载成功', { fileName, fileUri: downloadResult.uri });

      // 获取文件信息
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);

      // 检查分享功能是否可用
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        const fileSize = (fileInfo.exists && 'size' in fileInfo) ? fileInfo.size : 0;
        Alert.alert(
          t('entityDataExport.messages.exportSuccess'),
          t('entityDataExport.messages.exportSuccessDetail', { entityType: currentEntity.label, fileSize: (fileSize / 1024).toFixed(2) }),
          [
            {
              text: t('common.viewLater'),
              style: 'cancel',
            },
            {
              text: t('entityDataExport.shareFile'),
              onPress: async () => {
                try {
                  await Sharing.shareAsync(downloadResult.uri);
                } catch (shareError) {
                  entityExportLogger.error('分享文件失败', shareError);
                  Alert.alert(t('entityDataExport.errors.shareFailed'), t('entityDataExport.errors.shareFailedRetry'));
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          t('entityDataExport.messages.exportSuccess'),
          t('entityDataExport.messages.fileSavedTo', { entityType: currentEntity.label, path: downloadResult.uri }),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      entityExportLogger.error('导出失败', error, { entityType });
      Alert.alert(t('entityDataExport.errors.exportFailed'), getErrorMsg(error) || t('entityDataExport.errors.exportError'));
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
      Alert.alert(t('common.error'), t('entityDataExport.errors.noFactory'));
      return;
    }

    const currentEntity = getCurrentEntity();
    if (!currentEntity) return;

    setLoading(true);

    try {
      const apiUrl = `${API_BASE_URL}/api/mobile/${factoryId}/${currentEntity.endpoint}/export/template`;
      entityExportLogger.info('下载模板', { entityType, endpoint: currentEntity.endpoint });

      // 生成文件名
      const fileName = `${currentEntity.label}_${t('entityDataExport.importTemplate')}.xlsx`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 下载文件
      const downloadResult = await FileSystem.downloadAsync(apiUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(t('entityDataExport.errors.downloadFailed', { status: downloadResult.status }));
      }

      entityExportLogger.info('模板下载成功', { fileName, fileUri: downloadResult.uri });

      // 检查分享功能是否可用
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        Alert.alert(
          t('entityDataExport.messages.downloadSuccess'),
          t('entityDataExport.messages.templateDownloaded', { entityType: currentEntity.label }),
          [
            {
              text: t('common.viewLater'),
              style: 'cancel',
            },
            {
              text: t('entityDataExport.shareTemplate'),
              onPress: async () => {
                try {
                  await Sharing.shareAsync(downloadResult.uri);
                } catch (shareError) {
                  entityExportLogger.error('分享模板失败', shareError);
                  Alert.alert(t('entityDataExport.errors.shareFailed'), t('entityDataExport.errors.shareFailedRetry'));
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          t('entityDataExport.messages.downloadSuccess'),
          t('entityDataExport.messages.templateSavedTo', { path: downloadResult.uri }),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error) {
      entityExportLogger.error('下载模板失败', error, { entityType });
      Alert.alert(t('entityDataExport.errors.downloadFailed'), getErrorMsg(error) || t('entityDataExport.errors.downloadError'));
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
      Alert.alert(t('common.error'), t('entityDataExport.errors.noFactory'));
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

      const file = result.assets?.[0];
      if (!file) {
        Alert.alert(t('common.error'), t('entityDataExport.errors.noFileSelected'));
        return;
      }

      entityExportLogger.info('选择导入文件', {
        fileName: file.name,
        fileSize: `${((file.size || 0) / 1024).toFixed(2)}KB`
      });

      // 验证文件大小（10MB限制）
      if (file.size && file.size > 10 * 1024 * 1024) {
        Alert.alert(t('entityDataExport.errors.fileTooLarge'), t('entityDataExport.errors.fileTooLargeDetail'));
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

      const apiUrl = `${API_BASE_URL}/api/mobile/${factoryId}/${currentEntity.endpoint}/import`;
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
        throw new Error(responseData.message || t('entityDataExport.errors.importFailed'));
      }

      const importResultData: ImportResult = responseData.data;
      setImportResult(importResultData);

      if (importResultData.isFullSuccess) {
        Alert.alert(
          t('entityDataExport.messages.importSuccess'),
          t('entityDataExport.messages.importSuccessDetail', { count: importResultData.successCount, entityType: currentEntity.label }),
          [{ text: t('common.ok') }]
        );
      } else {
        setShowResultDialog(true);
      }
    } catch (error) {
      entityExportLogger.error('导入失败', error, { entityType });
      Alert.alert(t('entityDataExport.errors.importFailed'), getErrorMsg(error) || t('entityDataExport.errors.importError'));
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
        <Appbar.Content title={t('entityDataExport.title')} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 实体类型选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('entityDataExport.selectDataType')} titleVariant="titleMedium" />
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
          <Card.Title title={t('entityDataExport.selectOperation')} titleVariant="titleMedium" />
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
                {operationMode === 'export' && t('entityDataExport.operationInfo.export')}
                {operationMode === 'template' && t('entityDataExport.operationInfo.template')}
                {operationMode === 'import' && t('entityDataExport.operationInfo.import')}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* 操作预览 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title={t('entityDataExport.operationPreview')} titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                {t('entityDataExport.dataType')}:
              </Text>
              <Chip style={{ backgroundColor: currentEntity?.color }}>
                {currentEntity?.label}
              </Chip>
            </View>

            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                {t('entityDataExport.operationType')}:
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
          {loading ? t('common.processing') : currentOperation?.label}
        </Button>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 导入结果对话框 */}
      <Portal>
        <Dialog visible={showResultDialog} onDismiss={() => setShowResultDialog(false)}>
          <Dialog.Title>{t('entityDataExport.importResult')}</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView style={styles.dialogContent}>
              {importResult && (
                <>
                  <View style={styles.resultSummary}>
                    <Text variant="bodyMedium">
                      {t('entityDataExport.result.total')}: {importResult.totalCount} {t('entityDataExport.result.records')}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: '#4CAF50' }}>
                      {t('entityDataExport.result.success')}: {importResult.successCount} {t('entityDataExport.result.records')}
                    </Text>
                    <Text variant="bodyMedium" style={{ color: '#F44336' }}>
                      {t('entityDataExport.result.failed')}: {importResult.failureCount} {t('entityDataExport.result.records')}
                    </Text>
                  </View>

                  {importResult.failureDetails && importResult.failureDetails.length > 0 && (
                    <>
                      <Divider style={styles.divider} />
                      <Text variant="titleSmall" style={styles.failureTitle}>
                        {t('entityDataExport.result.failureDetails')}:
                      </Text>
                      {importResult.failureDetails.map((detail, index) => (
                        <List.Item
                          key={index}
                          title={t('entityDataExport.result.rowNumber', { row: detail.rowNumber })}
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
            <Button onPress={() => setShowResultDialog(false)}>{t('common.close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* 加载遮罩 */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>{t('common.processingPleaseWait')}</Text>
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
