import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import {
  Text,
  Button,
  Card,
  IconButton,
  Divider,
  TextInput,
  ActivityIndicator,
  Portal,
  Chip,
} from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import {
  productTypeApiClient,
  ProcessingStep,
  ProcessingStageOption,
} from '../../services/api/productTypeApiClient';
import { handleError, getErrorMsg } from '../../utils/errorHandler';

interface ProcessingStepsEditorProps {
  /** 当前加工步骤列表 */
  value: ProcessingStep[];
  /** 步骤变更回调 */
  onChange: (steps: ProcessingStep[]) => void;
  /** 是否禁用编辑 */
  disabled?: boolean;
  /** 标签 */
  label?: string;
}

/**
 * 加工步骤编辑器
 *
 * Phase 5: SKU 配置组件
 * 用于配置产品类型的加工步骤流程
 */
export const ProcessingStepsEditor: React.FC<ProcessingStepsEditorProps> = ({
  value = [],
  onChange,
  disabled = false,
  label = '加工步骤配置',
}) => {
  const { user } = useAuthStore();
  const factoryId = user?.factoryId || user?.factoryUser?.factoryId;

  // 加工环节类型选项
  const [stageOptions, setStageOptions] = useState<ProcessingStageOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  // 编辑弹窗状态
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStep, setEditingStep] = useState<ProcessingStep | null>(null);
  const [editingIndex, setEditingIndex] = useState<number>(-1);

  // 步骤选择弹窗
  const [stageSelectVisible, setStageSelectVisible] = useState(false);

  // 加载加工环节类型选项
  useEffect(() => {
    fetchStageOptions();
  }, []);

  const fetchStageOptions = async () => {
    try {
      setLoadingOptions(true);
      const options = await productTypeApiClient.getProcessingStages(factoryId);
      setStageOptions(options);
    } catch (error) {
      console.error('加载加工环节类型失败:', error);
      // 使用默认选项
      setStageOptions([
        { value: 'RECEIVING', label: '接收', description: '原料接收验收' },
        { value: 'SLICING', label: '切片', description: '机械切片' },
        { value: 'PACKAGING', label: '包装', description: '成品包装' },
      ]);
    } finally {
      setLoadingOptions(false);
    }
  };

  // 获取环节类型的显示名称
  const getStageLabel = useCallback(
    (stageType: string) => {
      const option = stageOptions.find((o) => o.value === stageType);
      return option?.label || stageType;
    },
    [stageOptions]
  );

  // 添加新步骤
  const handleAddStep = () => {
    const newStep: ProcessingStep = {
      stageType: 'RECEIVING',
      orderIndex: value.length + 1,
      requiredSkillLevel: 2,
      estimatedMinutes: 10,
      notes: '',
    };
    setEditingStep(newStep);
    setEditingIndex(-1);
    setEditModalVisible(true);
  };

  // 编辑步骤
  const handleEditStep = (step: ProcessingStep, index: number) => {
    setEditingStep({ ...step });
    setEditingIndex(index);
    setEditModalVisible(true);
  };

  // 删除步骤
  const handleDeleteStep = (index: number) => {
    Alert.alert('确认删除', '确定要删除这个加工步骤吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          const newSteps = value.filter((_, i) => i !== index);
          // 重新编号
          const renumbered = newSteps.map((step, i) => ({
            ...step,
            orderIndex: i + 1,
          }));
          onChange(renumbered);
        },
      },
    ]);
  };

  // 上移步骤
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newSteps = [...value];
    const temp = newSteps[index - 1];
    const current = newSteps[index];
    if (temp !== undefined && current !== undefined) {
      newSteps[index - 1] = current;
      newSteps[index] = temp;
    }
    // 更新 orderIndex
    const renumbered = newSteps.map((step, i) => ({
      ...step,
      orderIndex: i + 1,
    }));
    onChange(renumbered);
  };

  // 下移步骤
  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return;
    const newSteps = [...value];
    const current = newSteps[index];
    const next = newSteps[index + 1];
    if (current !== undefined && next !== undefined) {
      newSteps[index] = next;
      newSteps[index + 1] = current;
    }
    // 更新 orderIndex
    const renumbered = newSteps.map((step, i) => ({
      ...step,
      orderIndex: i + 1,
    }));
    onChange(renumbered);
  };

  // 保存编辑的步骤
  const handleSaveStep = () => {
    if (!editingStep) return;

    const newSteps = [...value];
    if (editingIndex >= 0) {
      // 编辑现有步骤
      newSteps[editingIndex] = editingStep;
    } else {
      // 添加新步骤
      newSteps.push(editingStep);
    }

    // 重新编号
    const renumbered = newSteps.map((step, i) => ({
      ...step,
      orderIndex: i + 1,
    }));

    onChange(renumbered);
    setEditModalVisible(false);
    setEditingStep(null);
  };

  // 渲染步骤卡片
  const renderStepCard = (step: ProcessingStep, index: number) => (
    <Card key={index} style={styles.stepCard} mode="outlined">
      <Card.Content style={styles.stepCardContent}>
        <View style={styles.stepHeader}>
          <View style={styles.stepOrderBadge}>
            <Text style={styles.stepOrderText}>{step.orderIndex}</Text>
          </View>
          <View style={styles.stepInfo}>
            <Text style={styles.stepTitle}>{getStageLabel(step.stageType)}</Text>
            <Text style={styles.stepSubtitle}>
              技能等级: {step.requiredSkillLevel} | 预估: {step.estimatedMinutes}分钟
            </Text>
          </View>
          {!disabled && (
            <View style={styles.stepActions}>
              <IconButton
                icon="arrow-up"
                size={20}
                onPress={() => handleMoveUp(index)}
                disabled={index === 0}
              />
              <IconButton
                icon="arrow-down"
                size={20}
                onPress={() => handleMoveDown(index)}
                disabled={index === value.length - 1}
              />
              <IconButton
                icon="pencil"
                size={20}
                onPress={() => handleEditStep(step, index)}
              />
              <IconButton
                icon="delete"
                size={20}
                iconColor="#ef4444"
                onPress={() => handleDeleteStep(index)}
              />
            </View>
          )}
        </View>
        {step.notes && <Text style={styles.stepNotes}>{step.notes}</Text>}
      </Card.Content>
    </Card>
  );

  // 渲染环节类型选择弹窗
  const renderStageSelectModal = () => (
    <Portal>
      <Modal
        visible={stageSelectVisible}
        onRequestClose={() => setStageSelectVisible(false)}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stageSelectModal}>
            <Text style={styles.stageSelectTitle}>选择加工环节</Text>
            <ScrollView style={styles.stageSelectList}>
              {stageOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.stageSelectItem,
                    editingStep?.stageType === option.value && styles.stageSelectItemActive,
                  ]}
                  onPress={() => {
                    if (editingStep) {
                      setEditingStep({ ...editingStep, stageType: option.value });
                    }
                    setStageSelectVisible(false);
                  }}
                >
                  <Text style={styles.stageSelectLabel}>{option.label}</Text>
                  <Text style={styles.stageSelectDesc}>{option.description}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <Button
              mode="text"
              onPress={() => setStageSelectVisible(false)}
              style={styles.stageSelectClose}
            >
              取消
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  // 渲染编辑弹窗
  const renderEditModal = () => (
    <Portal>
      <Modal
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
        animationType="slide"
        transparent
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <Text style={styles.editModalTitle}>
              {editingIndex >= 0 ? '编辑加工步骤' : '添加加工步骤'}
            </Text>

            {editingStep && (
              <ScrollView style={styles.editForm}>
                {/* 加工环节类型 */}
                <Text style={styles.fieldLabel}>加工环节</Text>
                <TouchableOpacity
                  style={styles.stageSelector}
                  onPress={() => setStageSelectVisible(true)}
                >
                  <Text style={styles.stageSelectorText}>
                    {getStageLabel(editingStep.stageType)}
                  </Text>
                  <IconButton icon="chevron-down" size={20} />
                </TouchableOpacity>

                {/* 技能等级 */}
                <Text style={styles.fieldLabel}>所需技能等级 (1-5)</Text>
                <View style={styles.skillLevelRow}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <TouchableOpacity
                      key={level}
                      style={[
                        styles.skillLevelButton,
                        editingStep.requiredSkillLevel === level &&
                          styles.skillLevelButtonActive,
                      ]}
                      onPress={() =>
                        setEditingStep({ ...editingStep, requiredSkillLevel: level })
                      }
                    >
                      <Text
                        style={[
                          styles.skillLevelText,
                          editingStep.requiredSkillLevel === level &&
                            styles.skillLevelTextActive,
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 预估时间 */}
                <Text style={styles.fieldLabel}>预估时间 (分钟)</Text>
                <TextInput
                  mode="outlined"
                  keyboardType="numeric"
                  value={String(editingStep.estimatedMinutes || '')}
                  onChangeText={(text) =>
                    setEditingStep({
                      ...editingStep,
                      estimatedMinutes: parseInt(text, 10) || 0,
                    })
                  }
                  style={styles.timeInput}
                />

                {/* 备注 */}
                <Text style={styles.fieldLabel}>备注 (可选)</Text>
                <TextInput
                  mode="outlined"
                  multiline
                  numberOfLines={2}
                  value={editingStep.notes || ''}
                  onChangeText={(text) =>
                    setEditingStep({ ...editingStep, notes: text })
                  }
                  style={styles.notesInput}
                />
              </ScrollView>
            )}

            <View style={styles.editModalActions}>
              <Button
                mode="outlined"
                onPress={() => setEditModalVisible(false)}
                style={styles.editModalButton}
              >
                取消
              </Button>
              <Button
                mode="contained"
                onPress={handleSaveStep}
                style={styles.editModalButton}
              >
                保存
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        {!disabled && (
          <Button
            mode="contained-tonal"
            icon="plus"
            onPress={handleAddStep}
            compact
          >
            添加步骤
          </Button>
        )}
      </View>

      {loadingOptions ? (
        <ActivityIndicator style={styles.loading} />
      ) : value.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>暂无加工步骤</Text>
          {!disabled && (
            <Text style={styles.emptyHint}>点击"添加步骤"开始配置</Text>
          )}
        </View>
      ) : (
        <View style={styles.stepsList}>
          {value.map((step, index) => renderStepCard(step, index))}
        </View>
      )}

      {/* 总时间统计 */}
      {value.length > 0 && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            共 {value.length} 个步骤，预估总时间:{' '}
            {value.reduce((sum, step) => sum + (step.estimatedMinutes || 0), 0)} 分钟
          </Text>
        </View>
      )}

      {renderEditModal()}
      {renderStageSelectModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  loading: {
    marginVertical: 24,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyHint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  stepsList: {
    gap: 8,
  },
  stepCard: {
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  stepCardContent: {
    paddingVertical: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepOrderBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepOrderText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  stepActions: {
    flexDirection: 'row',
  },
  stepNotes: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginLeft: 40,
    fontStyle: 'italic',
  },
  summary: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f0f9ff',
    borderRadius: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#0369a1',
    fontWeight: '500',
  },

  // Modal 样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  editModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '80%',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  editForm: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginTop: 12,
    marginBottom: 8,
  },
  stageSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stageSelectorText: {
    fontSize: 15,
    color: '#1f2937',
  },
  skillLevelRow: {
    flexDirection: 'row',
    gap: 8,
  },
  skillLevelButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  skillLevelButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  skillLevelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  skillLevelTextActive: {
    color: '#fff',
  },
  timeInput: {
    backgroundColor: '#fff',
  },
  notesInput: {
    backgroundColor: '#fff',
    minHeight: 60,
  },
  editModalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  editModalButton: {
    flex: 1,
  },

  // Stage Select Modal
  stageSelectModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '70%',
  },
  stageSelectTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  stageSelectList: {
    maxHeight: 400,
  },
  stageSelectItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f9fafb',
  },
  stageSelectItemActive: {
    backgroundColor: '#dbeafe',
  },
  stageSelectLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1f2937',
  },
  stageSelectDesc: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  stageSelectClose: {
    marginTop: 12,
  },
});

export default ProcessingStepsEditor;
