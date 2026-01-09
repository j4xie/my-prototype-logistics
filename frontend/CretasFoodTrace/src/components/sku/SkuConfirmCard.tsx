/**
 * SKU 配置确认卡片组件
 *
 * 显示 AI 识别的 SKU 配置，供用户确认或修改
 *
 * @version 1.0.0
 * @since 2026-01-08
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Card, Button, Chip, Icon, Divider } from 'react-native-paper';
import { getStageTypeLabel, getSkuTemplateById } from '../../config/skuTemplates';
import type { ExtractedSkuConfig } from '../../services/ai/SkuConfigAIPrompt';

// ==================== 类型定义 ====================

interface SkuConfirmCardProps {
  /** 提取的配置 */
  config: ExtractedSkuConfig;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
  /** 重新录入回调 */
  onRetry: () => void;
  /** 置信度 (0-1) */
  confidence?: number;
  /** 是否正在加载 */
  loading?: boolean;
}

// ==================== 子组件 ====================

interface ConfigItemProps {
  label: string;
  value: string | number | undefined;
  icon: string;
  color?: string;
}

function ConfigItem({ label, value, icon, color = '#1890ff' }: ConfigItemProps) {
  if (value === undefined || value === null) return null;

  return (
    <View style={styles.configItem}>
      <Icon source={icon} size={16} color={color} />
      <Text style={styles.configLabel}>{label}:</Text>
      <Text style={styles.configValue}>{value}</Text>
    </View>
  );
}

// ==================== 主组件 ====================

export function SkuConfirmCard({
  config,
  onConfirm,
  onCancel,
  onRetry,
  confidence,
  loading = false,
}: SkuConfirmCardProps) {
  const suggestedTemplate = config.suggestedTemplateId
    ? getSkuTemplateById(config.suggestedTemplateId)
    : null;

  // 置信度颜色
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return '#52c41a';
    if (conf >= 0.5) return '#faad14';
    return '#f5222d';
  };

  return (
    <Card style={styles.card} mode="outlined">
      <Card.Content>
        {/* 标题行 */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Icon source="robot" size={24} color="#1890ff" />
            <Text style={styles.headerTitle}>AI 识别结果</Text>
          </View>
          {confidence !== undefined && (
            <Chip
              style={[
                styles.confidenceChip,
                { backgroundColor: getConfidenceColor(confidence) + '15' },
              ]}
              textStyle={[
                styles.confidenceText,
                { color: getConfidenceColor(confidence) },
              ]}
            >
              置信度 {Math.round(confidence * 100)}%
            </Chip>
          )}
        </View>

        {/* 推荐模板提示 */}
        {suggestedTemplate && (
          <View style={styles.templateSuggestion}>
            <Icon source="lightbulb-on" size={16} color="#fa8c16" />
            <Text style={styles.templateSuggestionText}>
              推荐使用「{suggestedTemplate.name}」模板
            </Text>
          </View>
        )}

        <Divider style={styles.divider} />

        {/* 基本配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本配置</Text>
          <View style={styles.configGrid}>
            <ConfigItem
              label="工时"
              value={config.workHours ? `${config.workHours}小时` : undefined}
              icon="clock-outline"
            />
            <ConfigItem
              label="复杂度"
              value={config.complexityScore ? `Lv.${config.complexityScore}` : undefined}
              icon="star"
              color="#faad14"
            />
            {config.detectedProductType && (
              <ConfigItem
                label="产品类型"
                value={config.detectedProductType}
                icon="tag-outline"
                color="#52c41a"
              />
            )}
          </View>
        </View>

        {/* 技能要求 */}
        {config.skillRequirements && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>技能要求</Text>
              <View style={styles.skillsRow}>
                {config.skillRequirements.minLevel && (
                  <Chip style={styles.skillChip} textStyle={styles.skillChipText}>
                    最低 Lv.{config.skillRequirements.minLevel}
                  </Chip>
                )}
                {config.skillRequirements.preferredLevel && (
                  <Chip style={styles.skillChip} textStyle={styles.skillChipText}>
                    推荐 Lv.{config.skillRequirements.preferredLevel}
                  </Chip>
                )}
              </View>
              {config.skillRequirements.specialSkills &&
                config.skillRequirements.specialSkills.length > 0 && (
                  <View style={styles.specialSkillsRow}>
                    {config.skillRequirements.specialSkills.map((skill, idx) => (
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
          </>
        )}

        {/* 加工步骤 */}
        {config.processingSteps && config.processingSteps.length > 0 && (
          <>
            <Divider style={styles.divider} />
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                加工流程 ({config.processingSteps.length} 步)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.stepsScroll}
              >
                {config.processingSteps.map((step, idx) => (
                  <View key={idx} style={styles.stepCard}>
                    <View style={styles.stepNumber}>
                      <Text style={styles.stepNumberText}>{step.orderIndex}</Text>
                    </View>
                    <Text style={styles.stepName} numberOfLines={1}>
                      {getStageTypeLabel(step.stageType)}
                    </Text>
                    <Text style={styles.stepTime}>
                      ~{step.estimatedMinutes}分钟
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </>
        )}

        {/* 操作按钮 */}
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={onCancel}
            style={styles.cancelBtn}
            disabled={loading}
          >
            取消
          </Button>
          <Button
            mode="outlined"
            onPress={onRetry}
            style={styles.retryBtn}
            icon="microphone"
            disabled={loading}
          >
            重新说
          </Button>
          <Button
            mode="contained"
            onPress={onConfirm}
            style={styles.confirmBtn}
            loading={loading}
            disabled={loading}
          >
            确认应用
          </Button>
        </View>
      </Card.Content>
    </Card>
  );
}

// ==================== 样式 ====================

const styles = StyleSheet.create({
  card: {
    marginVertical: 8,
    backgroundColor: '#fff',
    borderColor: '#1890ff',
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  confidenceChip: {
    height: 26,
  },
  confidenceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  templateSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff7e6',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
  },
  templateSuggestionText: {
    fontSize: 13,
    color: '#fa8c16',
    marginLeft: 8,
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#f0f0f0',
  },
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 10,
  },
  configGrid: {
    gap: 8,
  },
  configItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  configLabel: {
    fontSize: 13,
    color: '#666',
  },
  configValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
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
  stepsScroll: {
    marginHorizontal: -4,
  },
  stepCard: {
    width: 80,
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 4,
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1890ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepNumberText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 2,
  },
  stepTime: {
    fontSize: 10,
    color: '#999',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  cancelBtn: {
    flex: 1,
    borderColor: '#d9d9d9',
  },
  retryBtn: {
    flex: 1,
    borderColor: '#1890ff',
  },
  confirmBtn: {
    flex: 1.5,
    backgroundColor: '#1890ff',
  },
});

export default SkuConfirmCard;
