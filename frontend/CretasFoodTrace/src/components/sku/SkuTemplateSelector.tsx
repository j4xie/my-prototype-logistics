/**
 * SKU 模板选择器组件
 *
 * 显示行业标准模板卡片，支持一键应用模板配置
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Card, Icon, Button, Chip, Divider, Portal } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import {
  SKU_TEMPLATES,
  getSkuTemplateById,
  getStageTypeLabel,
  type SkuTemplate,
} from '../../config/skuTemplates';
import type { ProcessingStep, SkillRequirement } from '../../services/api/productTypeApiClient';

// ==================== 类型定义 ====================

interface SkuTemplateSelectorProps {
  /** 当前选中的模板ID */
  selectedTemplateId?: string;
  /** 模板选择回调 */
  onSelectTemplate: (template: SkuTemplate) => void;
  /** 应用模板配置回调 */
  onApplyTemplate: (config: AppliedTemplateConfig) => void;
  /** 是否为编辑模式 */
  isEditMode?: boolean;
}

/**
 * 应用模板后的配置结构
 */
export interface AppliedTemplateConfig {
  workHours: number;
  complexityScore: number;
  processingSteps: ProcessingStep[];
  skillRequirements: SkillRequirement;
}

// ==================== 子组件 ====================

interface TemplateCardProps {
  template: SkuTemplate;
  isSelected: boolean;
  onPress: () => void;
}

function TemplateCard({ template, isSelected, onPress }: TemplateCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card
        style={[
          styles.templateCard,
          isSelected && styles.templateCardSelected,
          { borderColor: isSelected ? template.color : '#e0e0e0' },
        ]}
        mode="outlined"
      >
        <Card.Content style={styles.templateCardContent}>
          <View
            style={[
              styles.templateIcon,
              { backgroundColor: template.color + '15' },
            ]}
          >
            <Icon source={template.icon} size={28} color={template.color} />
          </View>
          <Text style={styles.templateName} numberOfLines={1}>
            {template.name}
          </Text>
          <View style={styles.complexityRow}>
            {[1, 2, 3, 4, 5].map((level) => (
              <Icon
                key={level}
                source={level <= template.complexityScore ? 'star' : 'star-outline'}
                size={12}
                color={level <= template.complexityScore ? '#faad14' : '#d9d9d9'}
              />
            ))}
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
}

interface TemplateDetailModalProps {
  visible: boolean;
  template: SkuTemplate | null;
  onClose: () => void;
  onApply: () => void;
  isEditMode?: boolean;
}

function TemplateDetailModal({
  visible,
  template,
  onClose,
  onApply,
  isEditMode,
}: TemplateDetailModalProps) {
  if (!template) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        animationType="slide"
        transparent
        onRequestClose={onClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View
                  style={[
                    styles.modalIcon,
                    { backgroundColor: template.color + '15' },
                  ]}
                >
                  <Icon source={template.icon} size={32} color={template.color} />
                </View>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.modalTitle}>{template.name}</Text>
                  <Text style={styles.modalSubtitle}>
                    {template.standardReference}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Icon source="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll}>
              {/* 基本信息 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>基本信息</Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>工时范围</Text>
                    <Text style={styles.infoValue}>
                      {template.workHoursRange.min}-{template.workHoursRange.max}h
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>默认工时</Text>
                    <Text style={styles.infoValue}>
                      {template.defaultWorkHours}h
                    </Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>复杂度</Text>
                    <View style={styles.complexityStars}>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <Icon
                          key={level}
                          source={
                            level <= template.complexityScore
                              ? 'star'
                              : 'star-outline'
                          }
                          size={16}
                          color={
                            level <= template.complexityScore
                              ? '#faad14'
                              : '#d9d9d9'
                          }
                        />
                      ))}
                    </View>
                  </View>
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* 适用产品示例 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>适用产品</Text>
                <View style={styles.examplesRow}>
                  {template.examples.map((example, idx) => (
                    <Chip key={idx} style={styles.exampleChip} textStyle={styles.exampleChipText}>
                      {example}
                    </Chip>
                  ))}
                </View>
              </View>

              <Divider style={styles.divider} />

              {/* 技能要求 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>技能要求</Text>
                <View style={styles.skillsRow}>
                  <Chip style={styles.skillChip} textStyle={styles.skillChipText}>
                    最低 Lv.{template.skillRequirements.minLevel}
                  </Chip>
                  <Chip style={styles.skillChip} textStyle={styles.skillChipText}>
                    推荐 Lv.{template.skillRequirements.preferredLevel}
                  </Chip>
                </View>
                {template.skillRequirements.specialSkills.length > 0 && (
                  <View style={styles.specialSkillsRow}>
                    {template.skillRequirements.specialSkills.map((skill, idx) => (
                      <Chip
                        key={idx}
                        style={styles.specialSkillChip}
                        textStyle={styles.specialSkillText}
                        icon="certificate"
                      >
                        {skill}
                      </Chip>
                    ))}
                  </View>
                )}
              </View>

              <Divider style={styles.divider} />

              {/* 加工流程 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  标准加工流程 ({template.processingSteps.length} 步)
                </Text>
                {template.processingSteps.length === 0 ? (
                  <Text style={styles.emptyText}>
                    OEM/代加工模板，用户可自定义流程
                  </Text>
                ) : (
                  <View style={styles.stepsContainer}>
                    {template.processingSteps.map((step, idx) => (
                      <View key={idx} style={styles.stepItem}>
                        <View style={styles.stepNumberBadge}>
                          <Text style={styles.stepNumber}>{step.orderIndex}</Text>
                        </View>
                        <View style={styles.stepContent}>
                          <Text style={styles.stepName}>
                            {getStageTypeLabel(step.stageType)}
                          </Text>
                          <Text style={styles.stepTime}>
                            ~{step.estimatedMinutes}分钟 | Lv.{step.requiredSkillLevel}
                          </Text>
                          {step.notes && (
                            <Text
                              style={[
                                styles.stepNotes,
                                step.notes.includes('CCP') && styles.ccpNotes,
                              ]}
                              numberOfLines={2}
                            >
                              {step.notes}
                            </Text>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* 关键控制点 */}
              {template.criticalControlPoints.length > 0 && (
                <>
                  <Divider style={styles.divider} />
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                      关键控制点 (CCP) - HACCP
                    </Text>
                    {template.criticalControlPoints.map((ccp, idx) => (
                      <View key={idx} style={styles.ccpItem}>
                        <View style={styles.ccpHeader}>
                          <Chip style={styles.ccpBadge} textStyle={styles.ccpBadgeText}>
                            {ccp.id}
                          </Chip>
                          <Text style={styles.ccpName}>{ccp.name}</Text>
                        </View>
                        <Text style={styles.ccpStandard}>
                          标准: {ccp.standard}
                        </Text>
                        <Text style={styles.ccpMethod}>
                          监控: {ccp.monitoringMethod}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.modalFooter}>
              <Button mode="outlined" onPress={onClose} style={styles.cancelBtn}>
                取消
              </Button>
              <Button
                mode="contained"
                onPress={onApply}
                style={[styles.applyBtn, { backgroundColor: template.color }]}
              >
                {isEditMode ? '覆盖当前配置' : '应用此模板'}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </Portal>
  );
}

// ==================== 主组件 ====================

export function SkuTemplateSelector({
  selectedTemplateId,
  onSelectTemplate,
  onApplyTemplate,
  isEditMode = false,
}: SkuTemplateSelectorProps) {
  const { t } = useTranslation('home');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SkuTemplate | null>(
    selectedTemplateId ? getSkuTemplateById(selectedTemplateId) || null : null
  );

  const handleTemplatePress = useCallback((template: SkuTemplate) => {
    setSelectedTemplate(template);
    setDetailModalVisible(true);
    onSelectTemplate(template);
  }, [onSelectTemplate]);

  const handleApplyTemplate = useCallback(() => {
    if (!selectedTemplate) return;

    const config: AppliedTemplateConfig = {
      workHours: selectedTemplate.defaultWorkHours,
      complexityScore: selectedTemplate.complexityScore,
      processingSteps: selectedTemplate.processingSteps,
      skillRequirements: selectedTemplate.skillRequirements,
    };

    onApplyTemplate(config);
    setDetailModalVisible(false);
  }, [selectedTemplate, onApplyTemplate]);

  return (
    <View style={styles.container}>
      {/* 标题 */}
      <View style={styles.header}>
        <Icon source="lightning-bolt" size={18} color="#1890ff" />
        <Text style={styles.headerTitle}>
          {t('sku.quickTemplate', '快速选择模板')}
        </Text>
        {isEditMode && (
          <Chip style={styles.editModeChip} textStyle={styles.editModeText}>
            编辑模式
          </Chip>
        )}
      </View>

      {/* 模板卡片滚动区 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.templateScroll}
        contentContainerStyle={styles.templateScrollContent}
      >
        {SKU_TEMPLATES.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            isSelected={selectedTemplateId === template.id}
            onPress={() => handleTemplatePress(template)}
          />
        ))}
      </ScrollView>

      {/* 模板详情弹窗 */}
      <TemplateDetailModal
        visible={detailModalVisible}
        template={selectedTemplate}
        onClose={() => setDetailModalVisible(false)}
        onApply={handleApplyTemplate}
        isEditMode={isEditMode}
      />
    </View>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  editModeChip: {
    marginLeft: 8,
    height: 24,
    backgroundColor: '#fff7e6',
  },
  editModeText: {
    fontSize: 11,
    color: '#fa8c16',
  },
  templateScroll: {
    flexGrow: 0,
  },
  templateScrollContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  templateCard: {
    width: 100,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  templateCardSelected: {
    borderWidth: 2,
  },
  templateCardContent: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  templateName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 4,
  },
  complexityRow: {
    flexDirection: 'row',
    gap: 2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleContainer: {
    marginLeft: 12,
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  modalScroll: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
  },
  divider: {
    backgroundColor: '#f0f0f0',
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  complexityStars: {
    flexDirection: 'row',
    gap: 2,
  },
  examplesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exampleChip: {
    backgroundColor: '#f0f0f0',
    height: 28,
  },
  exampleChipText: {
    fontSize: 12,
    color: '#666',
  },
  skillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  skillChip: {
    backgroundColor: '#e6f7ff',
    height: 28,
  },
  skillChipText: {
    fontSize: 12,
    color: '#1890ff',
  },
  specialSkillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specialSkillChip: {
    backgroundColor: '#f6ffed',
    height: 28,
  },
  specialSkillText: {
    fontSize: 11,
    color: '#52c41a',
  },
  stepsContainer: {
    gap: 12,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1890ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepContent: {
    flex: 1,
  },
  stepName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  stepTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  stepNotes: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    backgroundColor: '#fafafa',
    padding: 6,
    borderRadius: 4,
  },
  ccpNotes: {
    backgroundColor: '#fff7e6',
    color: '#fa8c16',
  },
  emptyText: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  ccpItem: {
    backgroundColor: '#fffbe6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#faad14',
  },
  ccpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ccpBadge: {
    backgroundColor: '#faad14',
    height: 24,
  },
  ccpBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  ccpName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  ccpStandard: {
    fontSize: 12,
    color: '#333',
    marginBottom: 2,
  },
  ccpMethod: {
    fontSize: 12,
    color: '#666',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1,
  },
  applyBtn: {
    flex: 2,
  },
});

export default SkuTemplateSelector;
