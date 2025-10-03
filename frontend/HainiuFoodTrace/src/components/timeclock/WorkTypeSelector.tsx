import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workTypesApiClient } from '../../services/api/workTypesApiClient';

interface WorkType {
  id: string;
  typeCode: string;
  typeName: string;
  department: string;
  description?: string;
  colorCode?: string;
  isActive: boolean;
}

interface WorkTypeSelectorProps {
  visible: boolean;
  selectedWorkTypeId: string | null;
  onSelect: (workTypeId: string) => void;
  onClose: () => void;
}

export const WorkTypeSelector: React.FC<WorkTypeSelectorProps> = ({
  visible,
  selectedWorkTypeId,
  onSelect,
  onClose,
}) => {
  const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);

  const departments = [
    { key: null, label: '全部', icon: 'apps' },
    { key: 'farming', label: '种植部', icon: 'leaf' },
    { key: 'processing', label: '加工部', icon: 'construct' },
    { key: 'logistics', label: '物流部', icon: 'car' },
    { key: 'quality', label: '质检部', icon: 'checkmark-circle' },
    { key: 'management', label: '管理部', icon: 'people' },
  ];

  useEffect(() => {
    if (visible) {
      loadWorkTypes();
    }
  }, [visible, selectedDepartment]);

  const loadWorkTypes = async () => {
    try {
      setLoading(true);
      const params: any = { isActive: 'true' };
      if (selectedDepartment) {
        params.department = selectedDepartment;
      }

      const response = await workTypesApiClient.getWorkTypes(params);
      if (response.success) {
        setWorkTypes(response.data);
      } else {
        Alert.alert('错误', '获取工作类型失败');
      }
    } catch (error) {
      console.error('获取工作类型失败:', error);
      Alert.alert('错误', '获取工作类型失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorkType = (workTypeId: string) => {
    onSelect(workTypeId);
    onClose();
  };

  const getDepartmentLabel = (department: string) => {
    const dept = departments.find(d => d.key === department);
    return dept?.label || department;
  };

  const renderDepartmentTab = ({ item }: { item: typeof departments[0] }) => (
    <TouchableOpacity
      style={[
        styles.departmentTab,
        selectedDepartment === item.key && styles.departmentTabActive
      ]}
      onPress={() => setSelectedDepartment(item.key)}
    >
      <Ionicons
        name={item.icon as any}
        size={20}
        color={selectedDepartment === item.key ? '#007AFF' : '#666666'}
      />
      <Text style={[
        styles.departmentTabText,
        selectedDepartment === item.key && styles.departmentTabTextActive
      ]}>
        {item.label}
      </Text>
    </TouchableOpacity>
  );

  const renderWorkType = ({ item }: { item: WorkType }) => (
    <TouchableOpacity
      style={[
        styles.workTypeItem,
        selectedWorkTypeId === item.id && styles.workTypeItemSelected
      ]}
      onPress={() => handleSelectWorkType(item.id)}
    >
      <View style={styles.workTypeMain}>
        <View style={styles.workTypeHeader}>
          <View
            style={[
              styles.workTypeColor,
              { backgroundColor: item.colorCode || '#007AFF' }
            ]}
          />
          <Text style={styles.workTypeName}>{item.typeName}</Text>
          {selectedWorkTypeId === item.id && (
            <Ionicons name="checkmark-circle" size={20} color="#007AFF" />
          )}
        </View>
        
        <Text style={styles.workTypeCode}>{item.typeCode}</Text>
        
        {item.description && (
          <Text style={styles.workTypeDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.workTypeDepartment}>
          <Ionicons name="business" size={14} color="#666666" />
          <Text style={styles.workTypeDepartmentText}>
            {getDepartmentLabel(item.department)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* 头部 */}
        <View style={styles.header}>
          <Text style={styles.title}>选择工作类型</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#666666" />
          </TouchableOpacity>
        </View>

        {/* 部门筛选 */}
        <View style={styles.departmentTabs}>
          <FlatList
            data={departments}
            renderItem={renderDepartmentTab}
            keyExtractor={(item) => item.key || 'all'}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.departmentTabsContent}
          />
        </View>

        {/* 工作类型列表 */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : workTypes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="briefcase-outline" size={48} color="#CCCCCC" />
              <Text style={styles.emptyText}>暂无工作类型</Text>
              <Text style={styles.emptySubtext}>
                {selectedDepartment ? '当前部门暂无可用工作类型' : '系统中暂无工作类型'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={workTypes}
              renderItem={renderWorkType}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>

        {/* 底部操作区 */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
            <Text style={styles.cancelButtonText}>取消</Text>
          </TouchableOpacity>
          
          {selectedWorkTypeId && (
            <TouchableOpacity
              style={styles.confirmButton}
              onPress={() => {
                if (selectedWorkTypeId) {
                  handleSelectWorkType(selectedWorkTypeId);
                }
              }}
            >
              <Text style={styles.confirmButtonText}>确认选择</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  departmentTabs: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E1E5E9',
  },
  departmentTabsContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  departmentTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E1E5E9',
  },
  departmentTabActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#007AFF',
  },
  departmentTabText: {
    fontSize: 14,
    color: '#666666',
    marginLeft: 6,
  },
  departmentTabTextActive: {
    color: '#007AFF',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    padding: 16,
  },
  workTypeItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E5E9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  workTypeItemSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  workTypeMain: {
    flex: 1,
  },
  workTypeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  workTypeColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 12,
  },
  workTypeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  workTypeCode: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  workTypeDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 8,
  },
  workTypeDepartment: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workTypeDepartmentText: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E1E5E9',
  },
  cancelButton: {
    flex: 1,
    marginRight: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F8F9FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '500',
  },
  confirmButton: {
    flex: 1,
    marginLeft: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});