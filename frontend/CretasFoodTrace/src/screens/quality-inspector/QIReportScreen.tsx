/**
 * 报告生成页面
 * Quality Inspector - Report Generation Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { QI_COLORS } from '../../types/qualityInspector';
import { qualityInspectorApi } from '../../services/api/qualityInspectorApi';
import { useAuthStore } from '../../store/authStore';

type ReportType = 'daily' | 'weekly' | 'monthly' | 'custom';
type ReportFormat = 'pdf' | 'excel';

interface ReportOption {
  id: string;
  label: string;
  checked: boolean;
}

export default function QIReportScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const factoryId = user?.factoryId;

  const [reportType, setReportType] = useState<ReportType>('daily');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('pdf');
  const [generating, setGenerating] = useState(false);
  const [options, setOptions] = useState<ReportOption[]>([
    { id: 'summary', label: '检验概况统计', checked: true },
    { id: 'gradeDistribution', label: '等级分布图表', checked: true },
    { id: 'categoryScores', label: '分类评分详情', checked: true },
    { id: 'issueAnalysis', label: '问题分析汇总', checked: true },
    { id: 'trendChart', label: '趋势走势图', checked: false },
    { id: 'batchList', label: '批次明细列表', checked: false },
  ]);

  const toggleOption = (id: string) => {
    setOptions((prev) =>
      prev.map((opt) =>
        opt.id === id ? { ...opt, checked: !opt.checked } : opt
      )
    );
  };

  const handleGenerate = async () => {
    const selectedOptions = options.filter((opt) => opt.checked);
    if (selectedOptions.length === 0) {
      Alert.alert('提示', '请至少选择一项报告内容');
      return;
    }

    try {
      setGenerating(true);

      // 调用 API 生成报告
      const result = await qualityInspectorApi.generateReport({
        type: reportType,
        format: reportFormat,
        options: selectedOptions.map((opt) => opt.id),
      });

      Alert.alert('成功', '报告生成成功，已保存到文件', [
        { text: '查看报告', onPress: () => console.log('Open report:', result) },
        { text: '确定', style: 'cancel' },
      ]);
    } catch (error) {
      console.error('生成报告失败:', error);
      Alert.alert('错误', '报告生成失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  const renderReportTypeOption = (type: ReportType, label: string, desc: string) => (
    <TouchableOpacity
      style={[styles.typeOption, reportType === type && styles.typeOptionActive]}
      onPress={() => setReportType(type)}
    >
      <View style={styles.typeRadio}>
        {reportType === type && <View style={styles.typeRadioInner} />}
      </View>
      <View style={styles.typeInfo}>
        <Text style={[styles.typeLabel, reportType === type && styles.typeLabelActive]}>
          {label}
        </Text>
        <Text style={styles.typeDesc}>{desc}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderFormatOption = (format: ReportFormat, icon: string, label: string) => (
    <TouchableOpacity
      style={[styles.formatOption, reportFormat === format && styles.formatOptionActive]}
      onPress={() => setReportFormat(format)}
    >
      <Ionicons
        name={icon as any}
        size={24}
        color={reportFormat === format ? QI_COLORS.primary : QI_COLORS.textSecondary}
      />
      <Text style={[styles.formatLabel, reportFormat === format && styles.formatLabelActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* 报告类型 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>报告类型</Text>
          <View style={styles.typeCard}>
            {renderReportTypeOption('daily', '日报', '今日检验数据汇总')}
            {renderReportTypeOption('weekly', '周报', '本周检验数据汇总')}
            {renderReportTypeOption('monthly', '月报', '本月检验数据汇总')}
            {renderReportTypeOption('custom', '自定义', '选择日期范围')}
          </View>
        </View>

        {/* 报告格式 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>导出格式</Text>
          <View style={styles.formatRow}>
            {renderFormatOption('pdf', 'document-text', 'PDF 文档')}
            {renderFormatOption('excel', 'grid', 'Excel 表格')}
          </View>
        </View>

        {/* 报告内容 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>报告内容</Text>
          <View style={styles.optionsCard}>
            {options.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.optionItem}
                onPress={() => toggleOption(option.id)}
              >
                <View style={[styles.checkbox, option.checked && styles.checkboxChecked]}>
                  {option.checked && (
                    <Ionicons name="checkmark" size={16} color="#fff" />
                  )}
                </View>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 预览 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>报告预览</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewHeader}>
              <Ionicons name="document-text" size={40} color={QI_COLORS.primary} />
              <View style={styles.previewInfo}>
                <Text style={styles.previewTitle}>
                  质检{reportType === 'daily' ? '日' : reportType === 'weekly' ? '周' : reportType === 'monthly' ? '月' : '自定义'}报
                </Text>
                <Text style={styles.previewDate}>
                  {new Date().toLocaleDateString('zh-CN')}
                </Text>
              </View>
            </View>
            <View style={styles.previewContent}>
              {options
                .filter((opt) => opt.checked)
                .map((opt) => (
                  <View key={opt.id} style={styles.previewItem}>
                    <Ionicons name="checkmark-circle" size={16} color={QI_COLORS.success} />
                    <Text style={styles.previewItemText}>{opt.label}</Text>
                  </View>
                ))}
            </View>
            <Text style={styles.previewFormat}>
              格式: {reportFormat === 'pdf' ? 'PDF 文档' : 'Excel 表格'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* 生成按钮 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
          onPress={handleGenerate}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#fff" />
          )}
          <Text style={styles.generateBtnText}>
            {generating ? '生成中...' : '生成报告'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },

  // 区块
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 12,
  },

  // 报告类型
  typeCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    overflow: 'hidden',
  },
  typeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  typeOptionActive: {
    backgroundColor: '#E8F5E9',
  },
  typeRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: QI_COLORS.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  typeRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: QI_COLORS.primary,
  },
  typeInfo: {
    flex: 1,
  },
  typeLabel: {
    fontSize: 15,
    color: QI_COLORS.text,
    fontWeight: '500',
  },
  typeLabelActive: {
    color: QI_COLORS.primary,
  },
  typeDesc: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginTop: 2,
  },

  // 导出格式
  formatRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formatOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  formatOptionActive: {
    borderColor: QI_COLORS.primary,
    backgroundColor: '#E8F5E9',
  },
  formatLabel: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  formatLabelActive: {
    color: QI_COLORS.primary,
    fontWeight: '500',
  },

  // 报告内容选项
  optionsCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 4,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: QI_COLORS.disabled,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: QI_COLORS.primary,
    borderColor: QI_COLORS.primary,
  },
  optionLabel: {
    fontSize: 15,
    color: QI_COLORS.text,
  },

  // 预览
  previewCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: QI_COLORS.border,
  },
  previewInfo: {
    marginLeft: 12,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
  },
  previewDate: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    marginTop: 2,
  },
  previewContent: {
    marginBottom: 12,
  },
  previewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewItemText: {
    fontSize: 14,
    color: QI_COLORS.text,
  },
  previewFormat: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
    textAlign: 'right',
  },

  // 底部栏
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: QI_COLORS.card,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  generateBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  generateBtnDisabled: {
    opacity: 0.7,
  },
  generateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
