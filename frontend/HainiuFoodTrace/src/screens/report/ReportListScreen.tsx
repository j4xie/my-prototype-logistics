import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { ReportService } from '../../services/report/reportService';
import { ReportFile, ReportGenerateRequest, ReportTemplate } from '../../services/api/reportApiClient';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';

export const ReportListScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  // 状态管理
  const [reports, setReports] = useState<ReportFile[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 分页状态
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    hasMore: true
  });

  // 报表生成表单状态
  const [generateForm, setGenerateForm] = useState<ReportGenerateRequest>({
    type: 'excel',
    name: '',
    description: '',
    dataSource: 'batches',
    filters: {},
    columns: [],
    includeCharts: false
  });

  // 日期选择状态
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
  const [endDate, setEndDate] = useState<Date>(new Date());

  // 权限检查
  const canGenerateReports = hasPermission('reports:generate') || hasPermission('admin:all');
  const canManageReports = hasPermission('reports:manage') || hasPermission('admin:all');

  // 加载报表列表
  const loadReports = async (page: number = 1, clearPrevious: boolean = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      setError(null);

      const response = await ReportService.getReportHistory({
        page,
        limit: pagination.limit,
        useCache: page === 1
      });

      if (response.success && response.data) {
        const newReports = response.data.reports;

        if (clearPrevious || page === 1) {
          setReports(newReports);
        } else {
          setReports(prev => [...prev, ...newReports]);
        }

        setPagination({
          page: response.data.page,
          limit: response.data.limit,
          total: response.data.total,
          hasMore: newReports.length === pagination.limit
        });

        console.log('报表列表加载成功:', {
          page,
          count: newReports.length,
          total: response.data.total
        });
      } else {
        throw new Error(response.message || '加载报表列表失败');
      }
    } catch (error) {
      console.error('加载报表列表失败:', error);
      setError(error.message || '加载失败');
      
      if (page === 1) {
        Alert.alert('加载失败', error.message || '无法获取报表列表，请检查网络连接后重试');
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  // 加载报表模板
  const loadTemplates = async () => {
    try {
      const response = await ReportService.getReportTemplates({
        useCache: true
      });

      if (response.success && response.data) {
        setTemplates(response.data.templates);
        console.log('报表模板加载成功:', response.data.templates.length);
      }
    } catch (error) {
      console.error('加载报表模板失败:', error);
    }
  };

  // 初始加载
  useEffect(() => {
    loadReports(1, true);
    loadTemplates();
  }, []);

  // 页面聚焦时刷新
  useFocusEffect(
    useCallback(() => {
      loadReports(1, true);
    }, [])
  );

  // 刷新列表
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadReports(1, true);
  }, []);

  // 加载更多
  const loadMore = useCallback(() => {
    if (pagination.hasMore && !loadingMore && !loading) {
      loadReports(pagination.page + 1, false);
    }
  }, [pagination, loadingMore, loading]);

  // 生成报表
  const handleGenerateReport = async () => {
    if (!generateForm.name.trim()) {
      Alert.alert('提示', '请输入报表名称');
      return;
    }

    try {
      setGenerating(true);

      const reportData: ReportGenerateRequest = {
        ...generateForm,
        filters: {
          ...generateForm.filters,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          factoryId: user?.factoryId
        }
      };

      const response = await ReportService.generateReport(reportData);

      if (response.success && response.reportFile) {
        Alert.alert('成功', '报表生成已开始，请稍后在列表中查看');
        setShowGenerateModal(false);
        resetGenerateForm();
        
        // 刷新列表
        setTimeout(() => {
          loadReports(1, true);
        }, 1000);
      } else {
        Alert.alert('生成失败', response.message || '报表生成失败');
      }
    } catch (error) {
      Alert.alert('生成失败', '网络错误，请重试');
    } finally {
      setGenerating(false);
    }
  };

  // 重置生成表单
  const resetGenerateForm = () => {
    setGenerateForm({
      type: 'excel',
      name: '',
      description: '',
      dataSource: 'batches',
      filters: {},
      columns: [],
      includeCharts: false
    });
    setStartDate(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    setEndDate(new Date());
  };

  // 下载报表
  const handleDownloadReport = async (reportFile: ReportFile) => {
    if (reportFile.status !== 'completed') {
      Alert.alert('提示', '报表尚未生成完成');
      return;
    }

    try {
      Alert.alert(
        '下载报表',
        `确定要下载报表"${reportFile.originalName}"吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '下载',
            onPress: async () => {
              const response = await ReportService.downloadReport(reportFile, true);
              
              if (response.success && response.localPath) {
                Alert.alert(
                  '下载成功',
                  '报表已保存到本地，是否立即分享？',
                  [
                    { text: '稍后', style: 'cancel' },
                    {
                      text: '分享',
                      onPress: async () => {
                        const shareResponse = await ReportService.shareReport(response.localPath!);
                        if (!shareResponse.success) {
                          Alert.alert('分享失败', shareResponse.message);
                        }
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('下载失败', response.message || '下载失败');
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('下载失败', '操作失败，请重试');
    }
  };

  // 渲染报表项
  const renderReportItem = ({ item }: { item: ReportFile }) => {
    const typeInfo = ReportService.getTypeDisplayInfo(item.type);
    const statusInfo = ReportService.getStatusDisplayInfo(item.status);

    return (
      <TouchableOpacity
        style={styles.reportItem}
        onPress={() => handleDownloadReport(item)}
        disabled={item.status !== 'completed'}
      >
        <View style={styles.reportIcon}>
          <Ionicons name={typeInfo.icon as any} size={32} color={typeInfo.color} />
        </View>
        
        <View style={styles.reportContent}>
          <Text style={styles.reportTitle} numberOfLines={2}>
            {item.originalName}
          </Text>
          
          <View style={styles.reportMeta}>
            <View style={styles.typeTag}>
              <Text style={[styles.typeText, { color: typeInfo.color }]}>
                {typeInfo.label}
              </Text>
            </View>
            
            <Text style={styles.sizeText}>
              {ReportService.formatFileSize(item.size)}
            </Text>
          </View>
          
          <Text style={styles.timeText}>
            {ReportService.formatTime(item.generatedAt)}
          </Text>
        </View>

        <View style={styles.reportActions}>
          <View style={[styles.statusTag, { backgroundColor: statusInfo.color }]}>
            <Ionicons name={statusInfo.icon as any} size={16} color="white" />
            <Text style={styles.statusText}>{statusInfo.label}</Text>
          </View>
          
          {item.status === 'completed' && (
            <TouchableOpacity
              style={styles.downloadButton}
              onPress={(e) => {
                e.stopPropagation();
                handleDownloadReport(item);
              }}
            >
              <Ionicons name="download" size={20} color="#007AFF" />
            </TouchableOpacity>
          )}
          
          {item.status === 'generating' && (
            <ActivityIndicator size="small" color="#007AFF" style={styles.loadingIndicator} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染生成报表模态框
  const renderGenerateModal = () => (
    <Modal
      visible={showGenerateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowGenerateModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowGenerateModal(false)}
          >
            <Text style={styles.modalCancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>生成报表</Text>
          <TouchableOpacity
            onPress={handleGenerateReport}
            disabled={generating || !generateForm.name.trim()}
          >
            <Text style={[
              styles.modalSaveText,
              (!generateForm.name.trim() || generating) && styles.modalSaveDisabled
            ]}>
              {generating ? '生成中...' : '生成'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {/* 基本信息 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>基本信息</Text>
            
            <Text style={styles.inputLabel}>报表名称 *</Text>
            <TextInput
              style={styles.textInput}
              value={generateForm.name}
              onChangeText={(text) => setGenerateForm(prev => ({ ...prev, name: text }))}
              placeholder="请输入报表名称"
              maxLength={100}
            />
            
            <Text style={styles.inputLabel}>报表描述</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={generateForm.description}
              onChangeText={(text) => setGenerateForm(prev => ({ ...prev, description: text }))}
              placeholder="请输入报表描述（可选）"
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* 报表配置 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>报表配置</Text>
            
            <Text style={styles.inputLabel}>报表格式</Text>
            <Picker
              selectedValue={generateForm.type}
              style={styles.picker}
              onValueChange={(value) => setGenerateForm(prev => ({ ...prev, type: value }))}
            >
              <Picker.Item label="Excel (.xlsx)" value="excel" />
              <Picker.Item label="PDF (.pdf)" value="pdf" />
            </Picker>
            
            <Text style={styles.inputLabel}>数据源</Text>
            <Picker
              selectedValue={generateForm.dataSource}
              style={styles.picker}
              onValueChange={(value) => setGenerateForm(prev => ({ ...prev, dataSource: value }))}
            >
              <Picker.Item label="生产批次" value="batches" />
              <Picker.Item label="质量检验" value="quality" />
              <Picker.Item label="设备监控" value="equipment" />
              <Picker.Item label="系统告警" value="alerts" />
              <Picker.Item label="用户管理" value="users" />
            </Picker>
          </View>

          {/* 时间范围 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>时间范围</Text>
            
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowStartDatePicker(true)}
            >
              <Text style={styles.inputLabel}>开始日期</Text>
              <Text style={styles.dateText}>
                {startDate.toLocaleDateString('zh-CN')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowEndDatePicker(true)}
            >
              <Text style={styles.inputLabel}>结束日期</Text>
              <Text style={styles.dateText}>
                {endDate.toLocaleDateString('zh-CN')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 高级选项 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>高级选项</Text>
            
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setGenerateForm(prev => ({ 
                ...prev, 
                includeCharts: !prev.includeCharts 
              }))}
            >
              <Ionicons 
                name={generateForm.includeCharts ? "checkbox" : "square-outline"} 
                size={24} 
                color="#007AFF" 
              />
              <Text style={styles.checkboxLabel}>包含图表分析</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 日期选择器 */}
        {showStartDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowStartDatePicker(false);
              if (date) setStartDate(date);
            }}
          />
        )}
        
        {showEndDatePicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            onChange={(event, date) => {
              setShowEndDatePicker(false);
              if (date) setEndDate(date);
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>报表中心</Text>
        <View style={styles.headerActions}>
          {canGenerateReports && (
            <TouchableOpacity
              style={styles.generateButton}
              onPress={() => setShowGenerateModal(true)}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.generateButtonText}>生成</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* 报表列表 */}
      {loading && reports.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载报表列表...</Text>
        </View>
      ) : error && reports.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : reports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text" size={48} color="#CCCCCC" />
          <Text style={styles.emptyText}>暂无报表</Text>
          <Text style={styles.emptySubtext}>点击右上角"生成"按钮创建报表</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReportItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.1}
          ListFooterComponent={() => 
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadMoreText}>加载更多...</Text>
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* 生成报表模态框 */}
      {renderGenerateModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  refreshButton: {
    padding: 8,
  },
  listContainer: {
    paddingVertical: 8,
  },
  reportItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  reportIcon: {
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportContent: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  sizeText: {
    fontSize: 12,
    color: '#666666',
  },
  timeText: {
    fontSize: 12,
    color: '#999999',
  },
  reportActions: {
    alignItems: 'flex-end',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    color: 'white',
    marginLeft: 4,
    fontWeight: '500',
  },
  downloadButton: {
    padding: 4,
  },
  loadingIndicator: {
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#666666',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  modalSaveDisabled: {
    color: '#CCCCCC',
  },
  modalContent: {
    flex: 1,
  },
  formSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333333',
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  picker: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 16,
  },
  dateButton: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    color: '#007AFF',
    marginTop: 4,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333333',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#FF4444',
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    marginTop: 4,
    textAlign: 'center',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadMoreText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666666',
  },
});

export default ReportListScreen;