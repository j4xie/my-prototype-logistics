import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
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
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '../../store/authStore';
import { API_CONFIG } from '../../constants/config';
import { getFactoryId } from '../../types/auth';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建DataExport专用logger
const dataExportLogger = logger.createContextLogger('DataExport');

type ReportType = 'production' | 'cost' | 'attendance';
type ExportFormat = 'excel' | 'pdf' | 'csv';

interface ExportConfig {
  reportType: ReportType;
  startDate: Date;
  endDate: Date;
  format: ExportFormat;
}

/**
 * 数据报表导出页面
 * 功能：
 * - 支持多种报表类型（生产/成本/工时）
 * - 支持多种导出格式（Excel/PDF/CSV）
 * - 日期范围选择
 * - 报表预览
 */
export default function DataExportScreen() {
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // 报表配置
  const [reportType, setReportType] = useState<ReportType>('production');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)); // 30天前
  const [endDate, setEndDate] = useState(new Date());

  // UI状态
  const [loading, setLoading] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // 报表类型定义
  const reportTypes = [
    {
      value: 'production',
      label: '生产报表',
      icon: 'factory',
      description: '批次号、产品、消耗、产出、转换率、状态',
      color: '#2196F3',
    },
    {
      value: 'cost',
      label: '成本报表',
      icon: 'currency-cny',
      description: '批次号、成本明细、单位成本、偏差、超支金额',
      color: '#FF9800',
    },
    {
      value: 'attendance',
      label: '工时报表',
      icon: 'clock-outline',
      description: '员工、部门、工作类型、工时、加班时间',
      color: '#4CAF50',
    },
  ];

  // 导出格式定义
  const exportFormats = [
    {
      value: 'excel',
      label: 'Excel',
      icon: 'microsoft-excel',
      extension: '.xlsx',
    },
    {
      value: 'pdf',
      label: 'PDF',
      icon: 'file-pdf-box',
      extension: '.pdf',
    },
    {
      value: 'csv',
      label: 'CSV',
      icon: 'file-delimited',
      extension: '.csv',
    },
  ];

  /**
   * 处理导出
   */
  const handleExport = async () => {
    // 验证日期范围
    if (startDate > endDate) {
      Alert.alert('日期错误', '开始日期不能晚于结束日期');
      return;
    }

    // 计算日期差（天数）
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
      Alert.alert('日期范围过大', '建议导出时间范围不超过一年');
      return;
    }

    // 获取工厂ID
    const factoryId = getFactoryId(user);
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息，请重新登录');
      return;
    }

    setLoading(true);

    try {
      // 格式化日期为YYYY-MM-DD
      const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      // 构建API URL - 调用后端的Excel或PDF导出接口
      const exportType = exportFormat === 'excel' ? 'excel' : exportFormat === 'pdf' ? 'pdf' : 'excel';
      const apiUrl = `${API_CONFIG.BASE_URL}/api/mobile/${factoryId}/reports/export/${exportType}?reportType=${reportType}&startDate=${startDateStr}&endDate=${endDateStr}`;

      dataExportLogger.debug('开始导出报表', {
        reportType,
        exportFormat,
        dateRange: `${startDateStr} ~ ${endDateStr}`,
        daysDiff,
        factoryId,
      });

      // 生成文件名
      const timestamp = new Date().getTime();
      const fileExtension = exportType === 'excel' ? 'xlsx' : 'pdf';
      const fileName = `report_${reportType}_${timestamp}.${fileExtension}`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // 下载文件
      const downloadResult = await FileSystem.downloadAsync(apiUrl, fileUri);

      if (downloadResult.status !== 200) {
        throw new Error(`下载失败，HTTP状态码: ${downloadResult.status}`);
      }

      // 获取文件信息
      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);

      dataExportLogger.info('报表导出成功', {
        reportType,
        exportFormat,
        fileName,
        fileSizeKB: ((fileInfo.size || 0) / 1024).toFixed(2),
        fileUri: downloadResult.uri,
      });

      // 检查分享功能是否可用
      const isAvailable = await Sharing.isAvailableAsync();

      const reportTypeLabel = reportTypes.find(r => r.value === reportType)?.label;
      const formatLabel = exportFormats.find(f => f.value === exportFormat)?.label;

      if (isAvailable) {
        // 显示成功消息并提供分享选项
        Alert.alert(
          '导出成功',
          `${reportTypeLabel} (${formatLabel}) 已生成\n\n日期范围：${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n\n文件大小：${((fileInfo.size || 0) / 1024).toFixed(2)} KB`,
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
                  dataExportLogger.info('报表已分享', { fileName });
                } catch (shareError) {
                  dataExportLogger.error('分享报表失败', shareError as Error, { fileName });
                  Alert.alert('分享失败', '无法分享文件，请稍后重试');
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          '导出成功',
          `${reportTypeLabel} (${formatLabel}) 已生成\n\n日期范围：${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}\n\n文件已保存到：${downloadResult.uri}`,
          [{ text: '确定' }]
        );
      }
    } catch (error) {
      dataExportLogger.error('导出报表失败', error as Error, {
        reportType,
        exportFormat,
        dateRange: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        errorType: error.message?.includes('Network') ? 'NETWORK' : error.message?.includes('401') || error.message?.includes('403') ? 'AUTH' : 'UNKNOWN',
      });

      let errorMessage = '生成报表时出现错误，请重试';

      if (error.message?.includes('Network request failed')) {
        errorMessage = '网络连接失败，请检查网络设置';
      } else if (error.message?.includes('401') || error.message?.includes('403')) {
        errorMessage = '权限不足，请重新登录';
      } else if (error.message?.includes('404')) {
        errorMessage = '报表服务暂时不可用';
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('导出失败', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取当前报表的详细信息
   */
  const getCurrentReportInfo = () => {
    return reportTypes.find(r => r.value === reportType);
  };

  const currentReport = getCurrentReportInfo();
  const currentFormat = exportFormats.find(f => f.value === exportFormat);

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="数据报表导出" />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* 报表类型选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="报表类型" titleVariant="titleMedium" />
          <Card.Content>
            <RadioButton.Group
              onValueChange={(value) => setReportType(value as ReportType)}
              value={reportType}
            >
              {reportTypes.map((type) => (
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
                  {type.value !== 'attendance' && <Divider style={styles.divider} />}
                </View>
              ))}
            </RadioButton.Group>
          </Card.Content>
        </Card>

        {/* 日期范围选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="日期范围" titleVariant="titleMedium" />
          <Card.Content>
            {/* 开始日期 */}
            <View style={styles.dateRow}>
              <Text variant="bodyMedium" style={styles.dateLabel}>
                开始日期
              </Text>
              <Chip
                icon="calendar"
                onPress={() => setShowStartPicker(true)}
                style={styles.dateChip}
              >
                {startDate.toLocaleDateString('zh-CN')}
              </Chip>
            </View>

            {/* 结束日期 */}
            <View style={styles.dateRow}>
              <Text variant="bodyMedium" style={styles.dateLabel}>
                结束日期
              </Text>
              <Chip
                icon="calendar"
                onPress={() => setShowEndPicker(true)}
                style={styles.dateChip}
              >
                {endDate.toLocaleDateString('zh-CN')}
              </Chip>
            </View>

            {/* 快捷日期选择 */}
            <View style={styles.quickDates}>
              <Text variant="bodySmall" style={styles.quickDatesLabel}>
                快捷选择：
              </Text>
              <View style={styles.quickDateButtons}>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => {
                    setStartDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
                    setEndDate(new Date());
                  }}
                  style={styles.quickDateButton}
                >
                  最近7天
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => {
                    setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
                    setEndDate(new Date());
                  }}
                  style={styles.quickDateButton}
                >
                  最近30天
                </Button>
                <Button
                  mode="outlined"
                  compact
                  onPress={() => {
                    setStartDate(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000));
                    setEndDate(new Date());
                  }}
                  style={styles.quickDateButton}
                >
                  最近90天
                </Button>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 导出格式选择 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="导出格式" titleVariant="titleMedium" />
          <Card.Content>
            <SegmentedButtons
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as ExportFormat)}
              buttons={exportFormats.map((format) => ({
                value: format.value,
                label: format.label,
                icon: format.icon,
              }))}
            />

            {/* 格式说明 */}
            <View style={styles.formatInfo}>
              <Text variant="bodySmall" style={styles.formatInfoText}>
                {currentFormat?.value === 'excel' && '• Excel格式支持数据筛选和图表'}
                {currentFormat?.value === 'pdf' && '• PDF格式适合打印和存档'}
                {currentFormat?.value === 'csv' && '• CSV格式兼容性最好，适合导入其他系统'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* 报表预览信息 */}
        <Card style={styles.card} mode="elevated">
          <Card.Title title="导出预览" titleVariant="titleMedium" />
          <Card.Content>
            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                报表类型：
              </Text>
              <Chip style={{ backgroundColor: currentReport?.color }}>
                {currentReport?.label}
              </Chip>
            </View>

            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                时间范围：
              </Text>
              <Text variant="bodyMedium">
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                ({Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} 天)
              </Text>
            </View>

            <View style={styles.previewRow}>
              <Text variant="bodyMedium" style={styles.previewLabel}>
                导出格式：
              </Text>
              <Text variant="bodyMedium">
                {currentFormat?.label} ({currentFormat?.extension})
              </Text>
            </View>

            <Divider style={styles.divider} />

            <Text variant="bodySmall" style={styles.previewHint}>
              包含内容：{currentReport?.description}
            </Text>
          </Card.Content>
        </Card>

        {/* 导出按钮 */}
        <Button
          mode="contained"
          icon="download"
          onPress={handleExport}
          loading={loading}
          disabled={loading}
          style={styles.exportButton}
          contentStyle={styles.exportButtonContent}
        >
          {loading ? '正在生成报表...' : '导出报表'}
        </Button>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* 日期选择器 */}
      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowStartPicker(false);
            if (selectedDate) {
              setStartDate(selectedDate);
            }
          }}
        />
      )}

      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEndPicker(false);
            if (selectedDate) {
              setEndDate(selectedDate);
            }
          }}
        />
      )}

      {/* 加载遮罩 */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#2196F3" />
          <Text style={styles.loadingText}>正在生成报表，请稍候...</Text>
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
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dateLabel: {
    fontWeight: '500',
  },
  dateChip: {
    backgroundColor: '#E3F2FD',
  },
  quickDates: {
    marginTop: 8,
  },
  quickDatesLabel: {
    color: '#666',
    marginBottom: 8,
  },
  quickDateButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  quickDateButton: {
    marginBottom: 8,
  },
  formatInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  formatInfoText: {
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
  exportButton: {
    marginTop: 8,
    marginBottom: 16,
  },
  exportButtonContent: {
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
});
