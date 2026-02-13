/**
 * SmartBI - 智能数据分析屏幕
 * 支持 Excel 批量上传、图表展示和 AI 分析
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Surface,
  Chip,
  SegmentedButtons,
  Divider,
  IconButton,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { useAuthStore } from '../../store/authStore';
import { apiClient } from '../../services/api/apiClient';
import { WebView } from 'react-native-webview';
import KPICardMobile from '../../components/smartbi/KPICardMobile';
import { formatCompactNumber } from '../../utils/formatters';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface SheetResult {
  sheetIndex: number;
  sheetName: string;
  success: boolean;
  message: string;
  detectedDataType?: string;
  savedRows?: number;
  uploadId?: number;
  flowResult?: {
    recommendedChartType?: string;
    chartConfig?: any;
    aiAnalysis?: string;
    charts?: any[];
    kpiSummary?: {
      metrics: Array<{
        label: string;
        value: number;
        unit?: string;
      }>;
    };
  };
}

interface BatchUploadResult {
  totalSheets: number;
  successCount: number;
  failedCount: number;
  totalSavedRows: number;
  message: string;
  results: SheetResult[];
}

export function SmartBIDataAnalysisScreen() {
  const factoryId = useAuthStore((state) => state.user?.factoryId);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<BatchUploadResult | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [refreshing, setRefreshing] = useState(false);
  const [aiAnalysisExpanded, setAiAnalysisExpanded] = useState(false);

  // 选择文件
  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        await uploadFile(file);
      }
    } catch (error: any) {
      Alert.alert('错误', `选择文件失败: ${error.message}`);
    }
  };

  // 上传文件
  const uploadFile = async (file: any) => {
    setUploading(true);
    setUploadProgress('正在预览 Sheet 列表...');

    try {
      // 1. 预览 Sheets
      const previewFormData = new FormData();
      previewFormData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);

      const previewResponse = await apiClient.post<{ success: boolean; data: any[]; message?: string }>(
        `/api/mobile/${factoryId}/smart-bi/sheets`,
        previewFormData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (!previewResponse.success || !previewResponse.data) {
        throw new Error(previewResponse.message || '预览失败');
      }

      const sheets = previewResponse.data;
      setUploadProgress('正在分析数据...');

      // 2. 构建配置
      const sheetConfigs = sheets
        .filter(s => s.rowCount > 0)
        .map(s => ({
          sheetIndex: s.index,
          headerRow: s.index === 0 ? 0 : s.name.includes('利润表') ? 3 : 2,
          autoConfirm: true,
        }));

      // 3. 批量上传
      const uploadFormData = new FormData();
      uploadFormData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      } as any);
      uploadFormData.append('sheetConfigs', JSON.stringify(sheetConfigs));

      setUploadProgress('正在处理和生成图表...');

      const uploadResponse = await apiClient.post<{ success: boolean; data: BatchUploadResult; message?: string }>(
        `/api/mobile/${factoryId}/smart-bi/upload-batch`,
        uploadFormData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 300000, // 5 分钟
        }
      );

      if (uploadResponse.success && uploadResponse.data) {
        setUploadResult(uploadResponse.data);
        setSelectedSheetIndex(0);
        Alert.alert('成功', uploadResponse.data.message || '数据分析完成');
      } else {
        throw new Error(uploadResponse.message || '上传失败');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      Alert.alert('上传失败', error.message || '未知错误');
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  // 重置
  const resetUpload = () => {
    setUploadResult(null);
    setSelectedSheetIndex(0);
    setAiAnalysisExpanded(false);
  };

  // 下拉刷新（重新加载当前上传结果）
  const handleRefresh = async () => {
    setRefreshing(true);
    // Simulate refresh delay
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  // 获取当前 Sheet
  const currentSheet = uploadResult?.results?.[selectedSheetIndex];

  // 生成图表 HTML（含 DataZoom 自适应 + 标签优化）
  const generateChartHTML = (chartConfig: any) => {
    if (!chartConfig || !chartConfig.options) {
      return '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;color:#999;font-family:sans-serif;"><h3>暂无图表数据</h3></body></html>';
    }

    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, system-ui, sans-serif; background: #fff; }
          #chart { width: 100vw; height: 380px; }
        </style>
      </head>
      <body>
        <div id="chart"></div>
        <script>
          var chart = echarts.init(document.getElementById('chart'));
          var option = ${JSON.stringify(chartConfig.options)};

          // Mobile optimization: DataZoom for large datasets
          if (option.xAxis && option.xAxis.type === 'category' && Array.isArray(option.xAxis.data) && option.xAxis.data.length > 15) {
            var dataLen = option.xAxis.data.length;
            var endPct = Math.min(100, Math.round((12 / dataLen) * 100));
            if (!option.dataZoom) {
              option.dataZoom = [
                { type: 'slider', show: true, xAxisIndex: 0, start: 0, end: endPct, height: 18, bottom: 5 },
                { type: 'inside', xAxisIndex: 0, start: 0, end: endPct }
              ];
              option.grid = option.grid || {};
              option.grid.bottom = Math.max(option.grid.bottom || 40, 55);
            }
            // Label rotation for mobile
            option.xAxis.axisLabel = option.xAxis.axisLabel || {};
            if (!option.xAxis.axisLabel.rotate) option.xAxis.axisLabel.rotate = 45;
            option.xAxis.axisLabel.hideOverlap = true;
            if (!option.xAxis.axisLabel.formatter) {
              option.xAxis.axisLabel.formatter = function(val) {
                var s = String(val);
                if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(5, 10);
                return s.length > 8 ? s.slice(0, 8) + '…' : s;
              };
            }
          }

          chart.setOption(option);
          window.addEventListener('resize', function() { chart.resize(); });
        </script>
      </body>
    </html>
    `;
  };

  // 渲染上传区域
  if (!uploadResult) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView style={styles.scrollView}>
          <Card style={styles.uploadCard}>
            <Card.Content>
              <View style={styles.uploadContent}>
                {uploading ? (
                  <View style={styles.progressContainer}>
                    <ActivityIndicator size="large" color="#2196F3" />
                    <Text style={styles.progressText}>{uploadProgress}</Text>
                  </View>
                ) : (
                  <>
                    <Surface style={styles.uploadIcon} elevation={0}>
                      <IconButton icon="file-excel" size={64} iconColor="#2196F3" />
                    </Surface>
                    <Text variant="headlineSmall" style={styles.uploadTitle}>
                      上传 Excel 文件
                    </Text>
                    <Text variant="bodyMedium" style={styles.uploadDescription}>
                      支持批量分析多个 Sheet，自动生成图表和 AI 分析
                    </Text>
                    <Button
                      mode="contained"
                      onPress={pickDocument}
                      style={styles.uploadButton}
                      icon="upload"
                    >
                      选择文件
                    </Button>

                    {/* Preview Skeleton */}
                    <View style={styles.previewSection}>
                      <Text variant="bodySmall" style={styles.previewTitle}>
                        预览效果：
                      </Text>
                      <LoadingSkeleton />
                    </View>
                  </>
                )}
              </View>
            </Card.Content>
          </Card>

          {/* 功能说明 */}
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.infoTitle}>
                功能特点
              </Text>
              <View style={styles.featureList}>
                <FeatureItem icon="check-circle" text="自动识别数据类型（销售、财务、库存等）" />
                <FeatureItem icon="check-circle" text="智能推荐最佳图表类型" />
                <FeatureItem icon="check-circle" text="AI 深度分析数据洞察" />
                <FeatureItem icon="check-circle" text="支持多 Sheet 批量处理" />
              </View>
            </Card.Content>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // 渲染结果区域
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#2196F3']}
          />
        }
      >
        {/* 总结卡片 */}
        <Card style={styles.summaryCard}>
          <Card.Content>
            <View style={styles.summaryHeader}>
              <Text variant="titleLarge">分析完成</Text>
              <IconButton icon="refresh" onPress={resetUpload} />
            </View>
            <Text variant="bodyMedium" style={styles.summaryText}>
              {uploadResult.message}
            </Text>
            <View style={styles.statsRow}>
              <StatItem label="总 Sheet" value={uploadResult.totalSheets} color="#2196F3" />
              <StatItem label="成功" value={uploadResult.successCount} color="#4CAF50" />
              <StatItem label="总行数" value={uploadResult.totalSavedRows} color="#FF9800" />
            </View>
          </Card.Content>
        </Card>

        {/* Sheet 选择器（水平滚动标签页） */}
        <View style={styles.sheetTabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.sheetTabsContainer}>
              {uploadResult.results.map((sheet, index) => (
                <TouchableOpacity
                  key={sheet.sheetIndex}
                  style={[
                    styles.sheetTab,
                    selectedSheetIndex === index && styles.sheetTabActive,
                  ]}
                  onPress={() => {
                    setSelectedSheetIndex(index);
                    setAiAnalysisExpanded(false);
                  }}
                >
                  <Text
                    style={[
                      styles.sheetTabText,
                      selectedSheetIndex === index && styles.sheetTabTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {sheet.sheetName}
                  </Text>
                  <Text
                    style={[
                      styles.sheetTabCount,
                      selectedSheetIndex === index && styles.sheetTabCountActive,
                    ]}
                  >
                    {sheet.savedRows}行
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 当前 Sheet 详情 */}
        {currentSheet && (
          <>
            {/* KPI Cards Section */}
            {currentSheet.flowResult?.kpiSummary?.metrics &&
             currentSheet.flowResult.kpiSummary.metrics.length > 0 && (
              <View style={styles.kpiSection}>
                <Text variant="titleMedium" style={styles.sectionTitleText}>
                  📊 关键指标
                </Text>
                <View style={styles.kpiGrid}>
                  {currentSheet.flowResult.kpiSummary.metrics.slice(0, 4).map((metric, idx) => (
                    <KPICardMobile
                      key={idx}
                      title={metric.label}
                      value={formatCompactNumber(metric.value)}
                      colorPreset={['purple', 'pink', 'blue', 'green'][idx % 4] as any}
                    />
                  ))}
                </View>
              </View>
            )}

            {/* Sheet 信息 */}
            <Card style={styles.sheetInfoCard}>
              <Card.Content>
                <View style={styles.infoRow}>
                  <InfoItem label="数据类型" value={currentSheet.detectedDataType || 'UNKNOWN'} />
                  <InfoItem
                    label="推荐图表"
                    value={currentSheet.flowResult?.recommendedChartType || 'N/A'}
                  />
                </View>
              </Card.Content>
            </Card>

            {/* 图表展示（支持多图表） */}
            {currentSheet.flowResult?.charts && currentSheet.flowResult.charts.length > 0 ? (
              <View style={styles.chartsSection}>
                <Text variant="titleMedium" style={styles.sectionTitleText}>
                  📈 数据可视化 ({currentSheet.flowResult.charts.length} 个图表)
                </Text>
                {currentSheet.flowResult.charts.map((chart, idx) => (
                  <Card key={idx} style={styles.chartCard}>
                    <Card.Content>
                      {chart.title && (
                        <Text variant="bodyMedium" style={styles.chartTitle}>
                          {chart.title}
                        </Text>
                      )}
                      <View style={styles.chartContainer}>
                        <WebView
                          source={{ html: generateChartHTML(chart.config || chart) }}
                          style={styles.webview}
                          scrollEnabled={false}
                          bounces={false}
                        />
                      </View>
                    </Card.Content>
                  </Card>
                ))}
              </View>
            ) : currentSheet.flowResult?.chartConfig ? (
              <Card style={styles.chartCard}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.sectionTitleText}>
                    📈 数据可视化
                  </Text>
                  <View style={styles.chartContainer}>
                    <WebView
                      source={{ html: generateChartHTML(currentSheet.flowResult.chartConfig) }}
                      style={styles.webview}
                      scrollEnabled={false}
                      bounces={false}
                    />
                  </View>
                </Card.Content>
              </Card>
            ) : null}

            {/* AI 分析（可展开/折叠） */}
            {(currentSheet.flowResult?.aiAnalysis ||
              currentSheet.flowResult?.chartConfig?.aiAnalysis) && (
              <Card style={styles.analysisCard}>
                <Card.Content>
                  <TouchableOpacity
                    style={styles.analysisHeader}
                    onPress={() => setAiAnalysisExpanded(!aiAnalysisExpanded)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.analysisHeaderLeft}>
                      <MaterialCommunityIcons
                        name="robot"
                        size={20}
                        color="#2196F3"
                      />
                      <Text variant="titleMedium" style={styles.analysisTitle}>
                        AI 智能分析
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={aiAnalysisExpanded ? 'chevron-up' : 'chevron-down'}
                      size={24}
                      color="#666"
                    />
                  </TouchableOpacity>
                  {aiAnalysisExpanded && (
                    <View style={styles.analysisContent}>
                      <Text style={styles.analysisText}>
                        {currentSheet.flowResult?.aiAnalysis ||
                          currentSheet.flowResult?.chartConfig?.aiAnalysis}
                      </Text>
                    </View>
                  )}
                </Card.Content>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// 特性项组件
function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.featureItem}>
      <IconButton icon={icon} size={20} iconColor="#4CAF50" style={styles.featureIcon} />
      <Text variant="bodyMedium" style={styles.featureText}>
        {text}
      </Text>
    </View>
  );
}

// 统计项组件
function StatItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.statItem}>
      <Text variant="headlineMedium" style={[styles.statValue, { color }]}>
        {value}
      </Text>
      <Text variant="bodySmall" style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

// 信息项组件
function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoItem}>
      <Text variant="bodySmall" style={styles.infoLabel}>
        {label}
      </Text>
      <Chip mode="outlined" compact>
        {value}
      </Chip>
    </View>
  );
}

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <View style={styles.skeletonKPIGrid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.skeletonKPI} />
        ))}
      </View>
      <View style={styles.skeletonChart} />
      <View style={styles.skeletonChart} />
      <View style={styles.skeletonText} />
      <View style={[styles.skeletonText, { width: '80%' }]} />
      <View style={[styles.skeletonText, { width: '90%' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  uploadCard: {
    margin: 16,
  },
  uploadContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  uploadIcon: {
    marginBottom: 16,
    borderRadius: 50,
    backgroundColor: '#E3F2FD',
  },
  uploadTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  uploadDescription: {
    marginBottom: 24,
    textAlign: 'center',
    color: '#666',
    paddingHorizontal: 20,
  },
  uploadButton: {
    minWidth: 200,
  },
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  progressText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
  },
  infoCard: {
    margin: 16,
    marginTop: 0,
  },
  infoTitle: {
    marginBottom: 16,
  },
  featureList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIcon: {
    margin: 0,
  },
  featureText: {
    flex: 1,
    color: '#666',
  },
  summaryCard: {
    margin: 16,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryText: {
    color: '#666',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#666',
    marginTop: 4,
  },
  sheetTabBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sheetTabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  sheetTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginHorizontal: 4,
    borderRadius: 6,
    backgroundColor: '#F5F5F5',
    minWidth: 100,
    alignItems: 'center',
  },
  sheetTabActive: {
    backgroundColor: '#2196F3',
  },
  sheetTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginBottom: 2,
  },
  sheetTabTextActive: {
    color: '#FFF',
  },
  sheetTabCount: {
    fontSize: 11,
    color: '#999',
  },
  sheetTabCountActive: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionTitleText: {
    marginBottom: 12,
    marginHorizontal: 16,
    fontWeight: '600',
    color: '#212121',
  },
  kpiSection: {
    marginBottom: 16,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  sheetInfoCard: {
    margin: 16,
    marginTop: 0,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  infoItem: {
    flex: 1,
    gap: 4,
  },
  infoLabel: {
    color: '#666',
  },
  chartsSection: {
    marginBottom: 16,
  },
  chartCard: {
    marginHorizontal: 16,
    marginBottom: 12,
  },
  chartTitle: {
    fontWeight: '600',
    color: '#424242',
    marginBottom: 8,
  },
  chartContainer: {
    height: 400,
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  analysisCard: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  analysisHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analysisTitle: {
    fontWeight: '600',
    color: '#212121',
  },
  analysisContent: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  analysisText: {
    lineHeight: 24,
    color: '#444',
  },
  previewSection: {
    marginTop: 32,
    width: '100%',
  },
  previewTitle: {
    color: '#999',
    marginBottom: 12,
    textAlign: 'center',
  },
  skeletonContainer: {
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderRadius: 8,
  },
  skeletonKPIGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  skeletonKPI: {
    width: '48%',
    height: 100,
    backgroundColor: '#E0E0E0',
    borderRadius: 12,
    marginBottom: 8,
  },
  skeletonChart: {
    width: '100%',
    height: 200,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 12,
  },
  skeletonText: {
    width: '100%',
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    marginBottom: 8,
  },
});
