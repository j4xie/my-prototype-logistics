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
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';
import { ReportService } from '../../services/report/reportService';
import { ReportTemplate } from '../../services/api/reportApiClient';
import { reportApiClient } from '../../services/api/reportApiClient';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { NetworkManager } from '../../services/networkManager';

export const ReportTemplateScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  // 状态管理
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [activeCategory, setActiveCategory] = useState<ReportTemplate['category'] | 'all'>('all');

  // 表单状态
  const [templateForm, setTemplateForm] = useState<{
    name: string;
    description: string;
    type: ReportTemplate['type'];
    category: ReportTemplate['category'];
    columns: string[];
    dateRange: boolean;
    groupBy: string[];
  }>({
    name: '',
    description: '',
    type: 'excel',
    category: 'production',
    columns: [],
    dateRange: true,
    groupBy: []
  });

  // 可用字段配置
  const [availableFields, setAvailableFields] = useState<{
    [key: string]: Array<{
      key: string;
      label: string;
      type: string;
      selectable: boolean;
    }>;
  }>({
    production: [
      { key: 'batchNumber', label: '批次号', type: 'string', selectable: true },
      { key: 'productName', label: '产品名称', type: 'string', selectable: true },
      { key: 'quantity', label: '数量', type: 'number', selectable: true },
      { key: 'startTime', label: '开始时间', type: 'date', selectable: true },
      { key: 'endTime', label: '结束时间', type: 'date', selectable: true },
      { key: 'status', label: '状态', type: 'string', selectable: true },
      { key: 'operator', label: '操作员', type: 'string', selectable: true },
    ],
    quality: [
      { key: 'inspectionId', label: '检验ID', type: 'string', selectable: true },
      { key: 'batchNumber', label: '批次号', type: 'string', selectable: true },
      { key: 'inspectionType', label: '检验类型', type: 'string', selectable: true },
      { key: 'result', label: '检验结果', type: 'string', selectable: true },
      { key: 'inspectionDate', label: '检验日期', type: 'date', selectable: true },
      { key: 'inspector', label: '检验员', type: 'string', selectable: true },
      { key: 'remarks', label: '备注', type: 'string', selectable: true },
    ],
    equipment: [
      { key: 'equipmentId', label: '设备ID', type: 'string', selectable: true },
      { key: 'equipmentName', label: '设备名称', type: 'string', selectable: true },
      { key: 'status', label: '状态', type: 'string', selectable: true },
      { key: 'temperature', label: '温度', type: 'number', selectable: true },
      { key: 'pressure', label: '压力', type: 'number', selectable: true },
      { key: 'runtime', label: '运行时长', type: 'number', selectable: true },
      { key: 'lastMaintenance', label: '最后维护', type: 'date', selectable: true },
    ],
    alerts: [
      { key: 'alertId', label: '告警ID', type: 'string', selectable: true },
      { key: 'alertType', label: '告警类型', type: 'string', selectable: true },
      { key: 'severity', label: '严重程度', type: 'string', selectable: true },
      { key: 'title', label: '标题', type: 'string', selectable: true },
      { key: 'message', label: '消息', type: 'string', selectable: true },
      { key: 'status', label: '状态', type: 'string', selectable: true },
      { key: 'createdAt', label: '创建时间', type: 'date', selectable: true },
      { key: 'resolvedAt', label: '解决时间', type: 'date', selectable: true },
    ],
    custom: []
  });

  // 权限检查
  const canManageTemplates = hasPermission('reports:templates') || hasPermission('admin:all');

  // 加载模板列表
  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await ReportService.getReportTemplates({
        category: activeCategory === 'all' ? undefined : activeCategory,
        useCache: false
      });

      if (response.success && response.data) {
        setTemplates(response.data.templates);
        console.log('模板列表加载成功:', {
          count: response.data.templates.length,
          total: response.data.total
        });
      } else {
        throw new Error(response.message || '加载模板列表失败');
      }
    } catch (error) {
      console.error('加载模板列表失败:', error);
      setError(error.message || '加载失败');
      Alert.alert('加载失败', error.message || '无法获取模板列表，请检查网络连接后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadTemplates();
  }, [activeCategory]);

  // 刷新列表
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTemplates();
  }, [activeCategory]);

  // 创建模板
  const handleCreateTemplate = async () => {
    if (!templateForm.name.trim()) {
      Alert.alert('提示', '请输入模板名称');
      return;
    }

    if (templateForm.columns.length === 0) {
      Alert.alert('提示', '请至少选择一个字段');
      return;
    }

    try {
      setSaving(true);

      const templateData = {
        name: templateForm.name.trim(),
        description: templateForm.description.trim(),
        type: templateForm.type,
        category: templateForm.category,
        templateConfig: {
          columns: templateForm.columns,
          dateRange: templateForm.dateRange,
          groupBy: templateForm.groupBy,
          filters: [],
          aggregations: []
        }
      };

      const response = await NetworkManager.executeWithRetry(
        () => reportApiClient.createReportTemplate(templateData),
        { maxRetries: 2, baseDelay: 1000 }
      );

      if (response.success) {
        Alert.alert('成功', '报表模板创建成功');
        setShowCreateModal(false);
        resetTemplateForm();
        loadTemplates();
      } else {
        Alert.alert('创建失败', response.message || '创建失败');
      }
    } catch (error) {
      Alert.alert('创建失败', '网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  // 重置表单
  const resetTemplateForm = () => {
    setTemplateForm({
      name: '',
      description: '',
      type: 'excel',
      category: 'production',
      columns: [],
      dateRange: true,
      groupBy: []
    });
  };

  // 选择/取消选择字段
  const toggleFieldSelection = (fieldKey: string) => {
    setTemplateForm(prev => ({
      ...prev,
      columns: prev.columns.includes(fieldKey)
        ? prev.columns.filter(key => key !== fieldKey)
        : [...prev.columns, fieldKey]
    }));
  };

  // 选择/取消选择分组字段
  const toggleGroupByField = (fieldKey: string) => {
    setTemplateForm(prev => ({
      ...prev,
      groupBy: prev.groupBy.includes(fieldKey)
        ? prev.groupBy.filter(key => key !== fieldKey)
        : [...prev.groupBy, fieldKey]
    }));
  };

  // 使用模板生成报表
  const handleUseTemplate = (template: ReportTemplate) => {
    Alert.alert(
      '使用模板',
      `确定要使用"${template.name}"模板生成报表吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: () => {
            // 导航到报表生成页面，并传递模板信息
            navigation.navigate('ReportList' as never, { 
              templateId: template.id,
              templateConfig: template.templateConfig 
            } as never);
          }
        }
      ]
    );
  };

  // 渲染模板项
  const renderTemplateItem = ({ item }: { item: ReportTemplate }) => {
    const typeInfo = item.type === 'excel' 
      ? { label: 'Excel', color: '#00AA66', icon: 'document-text' }
      : { label: 'PDF', color: '#FF4444', icon: 'document' };

    const categoryInfo = {
      production: { label: '生产', color: '#007AFF', icon: 'construct' },
      quality: { label: '质检', color: '#00AA88', icon: 'shield-checkmark' },
      equipment: { label: '设备', color: '#FF8800', icon: 'settings' },
      alerts: { label: '告警', color: '#FF4444', icon: 'warning' },
      custom: { label: '自定义', color: '#8B4513', icon: 'create' }
    }[item.category];

    return (
      <TouchableOpacity
        style={styles.templateItem}
        onPress={() => handleUseTemplate(item)}
      >
        <View style={styles.templateHeader}>
          <View style={styles.templateMeta}>
            <View style={[styles.categoryTag, { backgroundColor: categoryInfo.color + '20' }]}>
              <Ionicons name={categoryInfo.icon as any} size={14} color={categoryInfo.color} />
              <Text style={[styles.categoryText, { color: categoryInfo.color }]}>
                {categoryInfo.label}
              </Text>
            </View>
            
            <View style={[styles.typeTag, { backgroundColor: typeInfo.color + '20' }]}>
              <Text style={[styles.typeText, { color: typeInfo.color }]}>
                {typeInfo.label}
              </Text>
            </View>
          </View>
          
          {item.isActive && (
            <View style={styles.activeIndicator}>
              <Text style={styles.activeText}>启用</Text>
            </View>
          )}
        </View>

        <Text style={styles.templateName}>{item.name}</Text>
        
        {item.description && (
          <Text style={styles.templateDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.templateFooter}>
          <Text style={styles.columnsInfo}>
            {item.templateConfig.columns?.length || 0} 个字段
          </Text>
          
          <View style={styles.templateActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleUseTemplate(item)}
            >
              <Ionicons name="play" size={18} color="#007AFF" />
            </TouchableOpacity>
            
            {canManageTemplates && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setSelectedTemplate(item);
                  setShowEditModal(true);
                }}
              >
                <Ionicons name="create" size={18} color="#666666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // 渲染分类过滤器
  const renderCategoryFilter = () => {
    const categories = [
      { key: 'all', label: '全部', icon: 'apps' },
      { key: 'production', label: '生产', icon: 'construct' },
      { key: 'quality', label: '质检', icon: 'shield-checkmark' },
      { key: 'equipment', label: '设备', icon: 'settings' },
      { key: 'alerts', label: '告警', icon: 'warning' },
      { key: 'custom', label: '自定义', icon: 'create' }
    ];

    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFilter}
      >
        {categories.map(category => (
          <TouchableOpacity
            key={category.key}
            style={[
              styles.categoryButton,
              activeCategory === category.key && styles.categoryButtonActive
            ]}
            onPress={() => setActiveCategory(category.key as any)}
          >
            <Ionicons 
              name={category.icon as any} 
              size={16} 
              color={activeCategory === category.key ? '#007AFF' : '#666666'} 
            />
            <Text style={[
              styles.categoryButtonText,
              activeCategory === category.key && styles.categoryButtonTextActive
            ]}>
              {category.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // 渲染创建模板模态框
  const renderCreateModal = () => (
    <Modal
      visible={showCreateModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateModal(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            onPress={() => setShowCreateModal(false)}
          >
            <Text style={styles.modalCancelText}>取消</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>创建模板</Text>
          <TouchableOpacity
            onPress={handleCreateTemplate}
            disabled={saving || !templateForm.name.trim() || templateForm.columns.length === 0}
          >
            <Text style={[
              styles.modalSaveText,
              (!templateForm.name.trim() || templateForm.columns.length === 0 || saving) && styles.modalSaveDisabled
            ]}>
              {saving ? '保存中...' : '保存'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          {/* 基本信息 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>基本信息</Text>
            
            <Text style={styles.inputLabel}>模板名称 *</Text>
            <TextInput
              style={styles.textInput}
              value={templateForm.name}
              onChangeText={(text) => setTemplateForm(prev => ({ ...prev, name: text }))}
              placeholder="请输入模板名称"
              maxLength={100}
            />
            
            <Text style={styles.inputLabel}>模板描述</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={templateForm.description}
              onChangeText={(text) => setTemplateForm(prev => ({ ...prev, description: text }))}
              placeholder="请输入模板描述（可选）"
              multiline
              numberOfLines={3}
              maxLength={200}
            />
          </View>

          {/* 模板配置 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>模板配置</Text>
            
            <Text style={styles.inputLabel}>报表格式</Text>
            <Picker
              selectedValue={templateForm.type}
              style={styles.picker}
              onValueChange={(value) => setTemplateForm(prev => ({ ...prev, type: value }))}
            >
              <Picker.Item label="Excel (.xlsx)" value="excel" />
              <Picker.Item label="PDF (.pdf)" value="pdf" />
            </Picker>
            
            <Text style={styles.inputLabel}>数据类别</Text>
            <Picker
              selectedValue={templateForm.category}
              style={styles.picker}
              onValueChange={(value) => setTemplateForm(prev => ({ ...prev, category: value }))}
            >
              <Picker.Item label="生产批次" value="production" />
              <Picker.Item label="质量检验" value="quality" />
              <Picker.Item label="设备监控" value="equipment" />
              <Picker.Item label="系统告警" value="alerts" />
              <Picker.Item label="自定义" value="custom" />
            </Picker>
            
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>包含时间范围筛选</Text>
              <Switch
                value={templateForm.dateRange}
                onValueChange={(value) => setTemplateForm(prev => ({ ...prev, dateRange: value }))}
                trackColor={{ false: '#767577', true: '#81b0ff' }}
                thumbColor={templateForm.dateRange ? '#007AFF' : '#f4f3f4'}
              />
            </View>
          </View>

          {/* 字段选择 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              选择字段 ({templateForm.columns.length} 已选)
            </Text>
            
            {availableFields[templateForm.category]?.map(field => (
              <TouchableOpacity
                key={field.key}
                style={styles.fieldRow}
                onPress={() => toggleFieldSelection(field.key)}
              >
                <Ionicons 
                  name={templateForm.columns.includes(field.key) ? "checkbox" : "square-outline"} 
                  size={24} 
                  color="#007AFF" 
                />
                <View style={styles.fieldInfo}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <Text style={styles.fieldType}>{field.type}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 分组设置 */}
          <View style={styles.formSection}>
            <Text style={styles.sectionTitle}>
              分组字段 ({templateForm.groupBy.length} 已选)
            </Text>
            
            {templateForm.columns.map(columnKey => {
              const field = availableFields[templateForm.category]?.find(f => f.key === columnKey);
              if (!field) return null;
              
              return (
                <TouchableOpacity
                  key={field.key}
                  style={styles.fieldRow}
                  onPress={() => toggleGroupByField(field.key)}
                >
                  <Ionicons 
                    name={templateForm.groupBy.includes(field.key) ? "checkbox" : "square-outline"} 
                    size={24} 
                    color="#00AA88" 
                  />
                  <View style={styles.fieldInfo}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <Text style={styles.fieldType}>用于数据分组</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            
            {templateForm.columns.length === 0 && (
              <Text style={styles.emptyFieldsText}>请先选择报表字段</Text>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>报表模板</Text>
        <View style={styles.headerActions}>
          {canManageTemplates && (
            <TouchableOpacity
              style={styles.createButton}
              onPress={() => setShowCreateModal(true)}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.createButtonText}>创建</Text>
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

      {/* 分类过滤器 */}
      {renderCategoryFilter()}

      {/* 模板列表 */}
      {loading && templates.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>加载模板列表...</Text>
        </View>
      ) : error && templates.length === 0 ? (
        <View style={styles.errorContainer}>
          <Ionicons name="warning" size={48} color="#FF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={onRefresh}>
            <Text style={styles.retryButtonText}>重试</Text>
          </TouchableOpacity>
        </View>
      ) : templates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text" size={48} color="#CCCCCC" />
          <Text style={styles.emptyText}>暂无模板</Text>
          <Text style={styles.emptySubtext}>
            {canManageTemplates ? '点击右上角"创建"按钮创建模板' : '暂无可用的报表模板'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={templates}
          keyExtractor={(item) => item.id}
          renderItem={renderTemplateItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
        />
      )}

      {/* 创建模板模态框 */}
      {renderCreateModal()}
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
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007AFF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  createButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  refreshButton: {
    padding: 8,
  },
  categoryFilter: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  categoryButtonActive: {
    backgroundColor: '#E3F2FD',
  },
  categoryButtonText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 4,
  },
  categoryButtonTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  listContainer: {
    paddingVertical: 8,
  },
  templateItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  templateMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  typeTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#00AA88',
  },
  activeText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  templateName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 12,
  },
  templateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  columnsInfo: {
    fontSize: 12,
    color: '#999999',
  },
  templateActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 6,
    marginLeft: 8,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 16,
    color: '#333333',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  fieldInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fieldLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,
  },
  fieldType: {
    fontSize: 12,
    color: '#999999',
  },
  emptyFieldsText: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    paddingVertical: 16,
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
});

export default ReportTemplateScreen;