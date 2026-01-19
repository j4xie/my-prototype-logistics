/**
 * SmartBI - Excel Upload Screen
 *
 * Allows users to upload Excel files for data import.
 *
 * Features:
 * - File selection (using expo-document-picker)
 * - Data type selection (sales/finance/department)
 * - Upload progress indicator
 * - Field mapping preview
 * - Import confirmation
 *
 * @version 1.0.0
 * @since 2026-01-18
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Card, Surface, ActivityIndicator, Button, ProgressBar, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';

import { smartBIApiClient } from '../../services/api/smartbi';
import { useAuthStore } from '../../store/authStore';
import { SmartBIStackParamList } from '../../types/smartbi';

// Theme colors for SmartBI
const SMARTBI_THEME = {
  primary: '#4F46E5',
  secondary: '#7C3AED',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  background: '#F5F7FA',
  cardBackground: '#FFFFFF',
  textPrimary: '#1F2937',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
};

// Data types for upload
type DataType = 'sales' | 'finance' | 'department';

interface DataTypeOption {
  key: DataType;
  label: string;
  description: string;
  icon: string;
  color: string;
}

// Upload state
type UploadState = 'idle' | 'selected' | 'mapping' | 'uploading' | 'success' | 'error';

// Field mapping
interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  sampleData: string;
}

// Upload result
interface UploadResult {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  errors?: Array<{ row: number; message: string }>;
}

// Data Type Card Component
interface DataTypeCardProps {
  option: DataTypeOption;
  selected: boolean;
  onSelect: () => void;
}

const DataTypeCard: React.FC<DataTypeCardProps> = ({ option, selected, onSelect }) => (
  <TouchableOpacity onPress={onSelect} activeOpacity={0.7}>
    <Surface
      style={[
        styles.dataTypeCard,
        selected && { borderColor: option.color, borderWidth: 2 },
      ]}
      elevation={selected ? 3 : 1}
    >
      <View style={[styles.dataTypeIcon, { backgroundColor: option.color + '20' }]}>
        <MaterialCommunityIcons name={option.icon as any} size={28} color={option.color} />
      </View>
      <Text style={styles.dataTypeLabel}>{option.label}</Text>
      <Text style={styles.dataTypeDescription}>{option.description}</Text>
      {selected && (
        <View style={[styles.checkmark, { backgroundColor: option.color }]}>
          <MaterialCommunityIcons name="check" size={16} color="#fff" />
        </View>
      )}
    </Surface>
  </TouchableOpacity>
);

// Field Mapping Item Component
interface FieldMappingItemProps {
  mapping: FieldMapping;
  index: number;
}

const FieldMappingItem: React.FC<FieldMappingItemProps> = ({ mapping, index }) => (
  <View style={styles.mappingItem}>
    <View style={styles.mappingLeft}>
      <Text style={styles.mappingLabel}>源列</Text>
      <Text style={styles.mappingValue}>{mapping.sourceColumn}</Text>
    </View>
    <MaterialCommunityIcons
      name="arrow-right"
      size={20}
      color={SMARTBI_THEME.textMuted}
    />
    <View style={styles.mappingRight}>
      <Text style={styles.mappingLabel}>目标字段</Text>
      <Text style={styles.mappingValue}>{mapping.targetField}</Text>
    </View>
    <View style={styles.mappingSample}>
      <Text style={styles.mappingLabel}>示例</Text>
      <Text style={styles.mappingSampleValue} numberOfLines={1}>
        {mapping.sampleData}
      </Text>
    </View>
  </View>
);

export function ExcelUploadScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<SmartBIStackParamList>>();
  const { getFactoryId } = useAuthStore();
  const { t } = useTranslation();

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [selectedDataType, setSelectedDataType] = useState<DataType | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const DATA_TYPES: DataTypeOption[] = [
    {
      key: 'sales',
      label: t('excel.salesData', { defaultValue: '销售数据' }),
      description: t('excel.salesDesc', { defaultValue: '订单、客户、产品销售记录' }),
      icon: 'chart-bar',
      color: SMARTBI_THEME.primary,
    },
    {
      key: 'finance',
      label: t('excel.financeData', { defaultValue: '财务数据' }),
      description: t('excel.financeDesc', { defaultValue: '收入、支出、成本明细' }),
      icon: 'currency-usd',
      color: SMARTBI_THEME.success,
    },
    {
      key: 'department',
      label: t('excel.departmentData', { defaultValue: '部门数据' }),
      description: t('excel.departmentDesc', { defaultValue: '部门绩效、人员统计' }),
      icon: 'account-group',
      color: SMARTBI_THEME.secondary,
    },
  ];

  const handleSelectFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      if (!file) {
        return;
      }
      setSelectedFile(file);
      setUploadState('selected');
      setError(null);

      // Generate sample field mappings (in real app, this would come from backend analysis)
      const sampleMappings: FieldMapping[] = [
        { sourceColumn: 'A', targetField: '日期', sampleData: '2026-01-15' },
        { sourceColumn: 'B', targetField: '金额', sampleData: '12,500.00' },
        { sourceColumn: 'C', targetField: '客户', sampleData: '示例客户' },
        { sourceColumn: 'D', targetField: '产品', sampleData: '产品A' },
      ];
      setFieldMappings(sampleMappings);
    } catch (err) {
      console.error('File selection failed:', err);
      setError(t('excel.selectError', { defaultValue: '文件选择失败' }));
    }
  }, [t]);

  const handlePreviewMapping = useCallback(() => {
    if (!selectedFile || !selectedDataType) {
      Alert.alert(
        t('common.tip', { defaultValue: '提示' }),
        t('excel.selectFirst', { defaultValue: '请先选择数据类型和文件' })
      );
      return;
    }
    setUploadState('mapping');
  }, [selectedFile, selectedDataType, t]);

  const handleStartUpload = useCallback(async () => {
    if (!selectedFile || !selectedDataType) {
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setError(null);

    try {
      const factoryId = getFactoryId();

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 0.9) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 0.1;
        });
      }, 300);

      const response = await smartBIApiClient.uploadExcel({
        file: {
          uri: selectedFile.uri,
          name: selectedFile.name,
          size: selectedFile.size,
          mimeType: selectedFile.mimeType,
        },
        dataType: selectedDataType,
        factoryId: factoryId || undefined,
      });

      clearInterval(progressInterval);
      setUploadProgress(1);

      if (response.success) {
        setUploadResult(response.data);
        setUploadState('success');
      } else {
        setError(response.message || t('excel.uploadFailed', { defaultValue: '上传失败' }));
        setUploadState('error');
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setError(t('excel.uploadFailed', { defaultValue: '上传失败，请重试' }));
      setUploadState('error');
    }
  }, [selectedFile, selectedDataType, getFactoryId, t]);

  const handleReset = useCallback(() => {
    setUploadState('idle');
    setSelectedDataType(null);
    setSelectedFile(null);
    setUploadProgress(0);
    setFieldMappings([]);
    setUploadResult(null);
    setError(null);
  }, []);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('excel.title', { defaultValue: 'Excel 上传' })}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Step 1: Select Data Type */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={[styles.stepBadge, uploadState !== 'idle' && styles.stepBadgeCompleted]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <Text style={styles.stepTitle}>
              {t('excel.step1', { defaultValue: '选择数据类型' })}
            </Text>
          </View>
          <View style={styles.dataTypeGrid}>
            {DATA_TYPES.map((option) => (
              <DataTypeCard
                key={option.key}
                option={option}
                selected={selectedDataType === option.key}
                onSelect={() => setSelectedDataType(option.key)}
              />
            ))}
          </View>
        </View>

        {/* Step 2: Select File */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={[
              styles.stepBadge,
              selectedFile && styles.stepBadgeCompleted
            ]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <Text style={styles.stepTitle}>
              {t('excel.step2', { defaultValue: '选择文件' })}
            </Text>
          </View>

          {!selectedFile ? (
            <TouchableOpacity style={styles.uploadArea} onPress={handleSelectFile}>
              <MaterialCommunityIcons
                name="file-excel"
                size={48}
                color={SMARTBI_THEME.primary}
              />
              <Text style={styles.uploadText}>
                {t('excel.clickToSelect', { defaultValue: '点击选择 Excel 文件' })}
              </Text>
              <Text style={styles.uploadHint}>
                {t('excel.supportedFormats', { defaultValue: '支持 .xlsx, .xls, .csv 格式' })}
              </Text>
            </TouchableOpacity>
          ) : (
            <Card style={styles.fileCard}>
              <Card.Content style={styles.fileCardContent}>
                <MaterialCommunityIcons
                  name="file-excel"
                  size={40}
                  color={SMARTBI_THEME.success}
                />
                <View style={styles.fileInfo}>
                  <Text style={styles.fileName} numberOfLines={1}>
                    {selectedFile.name}
                  </Text>
                  <Text style={styles.fileSize}>
                    {formatFileSize(selectedFile.size || 0)}
                  </Text>
                </View>
                <TouchableOpacity onPress={handleSelectFile}>
                  <MaterialCommunityIcons
                    name="refresh"
                    size={24}
                    color={SMARTBI_THEME.primary}
                  />
                </TouchableOpacity>
              </Card.Content>
            </Card>
          )}
        </View>

        {/* Step 3: Field Mapping Preview */}
        {uploadState === 'mapping' && (
          <View style={styles.section}>
            <View style={styles.stepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepNumber}>3</Text>
              </View>
              <Text style={styles.stepTitle}>
                {t('excel.step3', { defaultValue: '字段映射' })}
              </Text>
            </View>
            <Card style={styles.mappingCard}>
              <Card.Content>
                <Text style={styles.mappingTitle}>
                  {t('excel.mappingPreview', { defaultValue: '字段映射预览' })}
                </Text>
                {fieldMappings.map((mapping, index) => (
                  <React.Fragment key={index}>
                    <FieldMappingItem mapping={mapping} index={index} />
                    {index < fieldMappings.length - 1 && <Divider style={styles.mappingDivider} />}
                  </React.Fragment>
                ))}
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Upload Progress */}
        {uploadState === 'uploading' && (
          <View style={styles.section}>
            <Card style={styles.progressCard}>
              <Card.Content>
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color={SMARTBI_THEME.primary} />
                  <Text style={styles.progressText}>
                    {t('excel.uploading', { defaultValue: '正在上传...' })}
                  </Text>
                </View>
                <ProgressBar
                  progress={uploadProgress}
                  color={SMARTBI_THEME.primary}
                  style={styles.progressBar}
                />
                <Text style={styles.progressPercent}>
                  {Math.round(uploadProgress * 100)}%
                </Text>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Upload Success */}
        {uploadState === 'success' && uploadResult && (
          <View style={styles.section}>
            <Card style={styles.resultCard}>
              <Card.Content style={styles.resultContent}>
                <View style={styles.resultIcon}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={64}
                    color={SMARTBI_THEME.success}
                  />
                </View>
                <Text style={styles.resultTitle}>
                  {t('excel.uploadSuccess', { defaultValue: '上传成功' })}
                </Text>
                <View style={styles.resultStats}>
                  <View style={styles.resultStatItem}>
                    <Text style={styles.resultStatValue}>{uploadResult.recordsProcessed}</Text>
                    <Text style={styles.resultStatLabel}>
                      {t('excel.processedRecords', { defaultValue: '处理记录' })}
                    </Text>
                  </View>
                  {uploadResult.recordsFailed > 0 && (
                    <View style={styles.resultStatItem}>
                      <Text style={[styles.resultStatValue, { color: SMARTBI_THEME.danger }]}>
                        {uploadResult.recordsFailed}
                      </Text>
                      <Text style={styles.resultStatLabel}>
                        {t('excel.failedRecords', { defaultValue: '失败记录' })}
                      </Text>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>
          </View>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={20}
              color={SMARTBI_THEME.danger}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actions}>
          {uploadState === 'idle' || uploadState === 'selected' ? (
            <Button
              mode="contained"
              onPress={handlePreviewMapping}
              disabled={!selectedDataType || !selectedFile}
              style={styles.actionButton}
              buttonColor={SMARTBI_THEME.primary}
            >
              {t('excel.preview', { defaultValue: '预览映射' })}
            </Button>
          ) : uploadState === 'mapping' ? (
            <>
              <Button
                mode="outlined"
                onPress={() => setUploadState('selected')}
                style={styles.actionButtonOutlined}
              >
                {t('common.back', { defaultValue: '返回' })}
              </Button>
              <Button
                mode="contained"
                onPress={handleStartUpload}
                style={styles.actionButton}
                buttonColor={SMARTBI_THEME.primary}
              >
                {t('excel.confirmImport', { defaultValue: '确认导入' })}
              </Button>
            </>
          ) : uploadState === 'success' || uploadState === 'error' ? (
            <Button
              mode="contained"
              onPress={handleReset}
              style={styles.actionButton}
              buttonColor={SMARTBI_THEME.primary}
            >
              {t('excel.uploadAnother', { defaultValue: '继续上传' })}
            </Button>
          ) : null}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SMARTBI_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: SMARTBI_THEME.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: SMARTBI_THEME.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepBadgeCompleted: {
    backgroundColor: SMARTBI_THEME.success,
  },
  stepNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
  },
  dataTypeGrid: {
    gap: 12,
  },
  dataTypeCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderWidth: 1,
    borderColor: SMARTBI_THEME.border,
    position: 'relative',
  },
  dataTypeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  dataTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 4,
  },
  dataTypeDescription: {
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
  },
  checkmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadArea: {
    backgroundColor: SMARTBI_THEME.cardBackground,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: SMARTBI_THEME.border,
    padding: 32,
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 13,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 8,
  },
  fileCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  fileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '500',
    color: SMARTBI_THEME.textPrimary,
  },
  fileSize: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 2,
  },
  mappingCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  mappingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 16,
  },
  mappingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  mappingLeft: {
    width: 60,
  },
  mappingRight: {
    width: 80,
    marginLeft: 8,
  },
  mappingSample: {
    flex: 1,
    marginLeft: 8,
  },
  mappingLabel: {
    fontSize: 10,
    color: SMARTBI_THEME.textMuted,
    marginBottom: 4,
  },
  mappingValue: {
    fontSize: 14,
    color: SMARTBI_THEME.textPrimary,
    fontWeight: '500',
  },
  mappingSampleValue: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
  },
  mappingDivider: {
    marginVertical: 0,
  },
  progressCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressText: {
    fontSize: 14,
    color: SMARTBI_THEME.textPrimary,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  resultCard: {
    borderRadius: 12,
    backgroundColor: SMARTBI_THEME.cardBackground,
  },
  resultContent: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  resultIcon: {
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: SMARTBI_THEME.textPrimary,
    marginBottom: 16,
  },
  resultStats: {
    flexDirection: 'row',
    gap: 32,
  },
  resultStatItem: {
    alignItems: 'center',
  },
  resultStatValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: SMARTBI_THEME.success,
  },
  resultStatLabel: {
    fontSize: 12,
    color: SMARTBI_THEME.textSecondary,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: SMARTBI_THEME.danger,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 8,
  },
  actionButtonOutlined: {
    flex: 1,
    borderRadius: 8,
    borderColor: SMARTBI_THEME.primary,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default ExcelUploadScreen;
