/**
 * 数据导出界面
 * 用于导出成本分析报告（Excel/PDF格式）
 * Phase 2 占位符实现，Phase 3 完整功能
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BigButton } from '../../components/processing';
import HapticManager from '../../utils/haptics';

export interface DataExportScreenProps {
  navigation: any;
  route?: any;
}

type ExportFormat = 'excel' | 'pdf';
type ExportDateRange = 'today' | 'week' | 'month' | 'custom';

/**
 * 数据导出界面
 */
export const DataExportScreen: React.FC<DataExportScreenProps> = ({
  navigation,
  route,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('excel');
  const [selectedRange, setSelectedRange] = useState<ExportDateRange>('week');
  const [includeCostBreakdown, setIncludeCostBreakdown] = useState(true);
  const [includeLaborDetails, setIncludeLaborDetails] = useState(true);
  const [includeEquipmentDetails, setIncludeEquipmentDetails] = useState(true);

  /**
   * 导出数据
   */
  const handleExport = async () => {
    await HapticManager.submitData();

    // TODO: Phase 3 实现实际导出功能
    Alert.alert(
      '功能开发中',
      `导出功能正在开发中\n\n格式: ${selectedFormat.toUpperCase()}\n时间范围: ${getRangeLabel()}\n\n将在 Phase 3 完成`,
      [{ text: '知道了', onPress: async () => await HapticManager.buttonPress() }]
    );
  };

  /**
   * 获取时间范围标签
   */
  const getRangeLabel = (): string => {
    switch (selectedRange) {
      case 'today': return '今天';
      case 'week': return '最近7天';
      case 'month': return '最近30天';
      case 'custom': return '自定义';
      default: return '';
    }
  };

  /**
   * 切换格式
   */
  const toggleFormat = async (format: ExportFormat) => {
    await HapticManager.selection();
    setSelectedFormat(format);
  };

  /**
   * 切换时间范围
   */
  const toggleRange = async (range: ExportDateRange) => {
    await HapticManager.selection();
    setSelectedRange(range);
  };

  /**
   * 切换选项
   */
  const toggleOption = async (option: 'cost' | 'labor' | 'equipment') => {
    await HapticManager.selection();

    switch (option) {
      case 'cost':
        setIncludeCostBreakdown(!includeCostBreakdown);
        break;
      case 'labor':
        setIncludeLaborDetails(!includeLaborDetails);
        break;
      case 'equipment':
        setIncludeEquipmentDetails(!includeEquipmentDetails);
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={async () => {
            await HapticManager.buttonPress();
            navigation.goBack();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据导出</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>

        {/* 开发中提示 */}
        <View style={styles.devNotice}>
          <Ionicons name="information-circle" size={24} color="#3B82F6" />
          <Text style={styles.devNoticeText}>
            此功能正在开发中，将在 Phase 3 完成{'\n'}
            当前为界面预览版本
          </Text>
        </View>

        {/* 导出格式选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>导出格式</Text>
          <View style={styles.formatGrid}>
            <TouchableOpacity
              style={[
                styles.formatCard,
                selectedFormat === 'excel' && styles.formatCardSelected,
              ]}
              onPress={() => toggleFormat('excel')}
            >
              <Ionicons
                name="document-text"
                size={40}
                color={selectedFormat === 'excel' ? '#10B981' : '#6B7280'}
              />
              <Text
                style={[
                  styles.formatLabel,
                  selectedFormat === 'excel' && styles.formatLabelSelected,
                ]}
              >
                Excel
              </Text>
              <Text style={styles.formatDescription}>
                适合数据分析
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.formatCard,
                selectedFormat === 'pdf' && styles.formatCardSelected,
              ]}
              onPress={() => toggleFormat('pdf')}
            >
              <Ionicons
                name="document"
                size={40}
                color={selectedFormat === 'pdf' ? '#10B981' : '#6B7280'}
              />
              <Text
                style={[
                  styles.formatLabel,
                  selectedFormat === 'pdf' && styles.formatLabelSelected,
                ]}
              >
                PDF
              </Text>
              <Text style={styles.formatDescription}>
                适合打印报告
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 时间范围选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>时间范围</Text>
          <View style={styles.rangeGrid}>
            {[
              { value: 'today', label: '今天' },
              { value: 'week', label: '最近7天' },
              { value: 'month', label: '最近30天' },
              { value: 'custom', label: '自定义' },
            ].map((range) => (
              <TouchableOpacity
                key={range.value}
                style={[
                  styles.rangeButton,
                  selectedRange === range.value && styles.rangeButtonSelected,
                ]}
                onPress={() => toggleRange(range.value as ExportDateRange)}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    selectedRange === range.value && styles.rangeButtonTextSelected,
                  ]}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 导出内容选项 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>包含内容</Text>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => toggleOption('cost')}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="analytics" size={24} color="#3B82F6" />
              <Text style={styles.optionLabel}>成本结构分析</Text>
            </View>
            <View style={[styles.checkbox, includeCostBreakdown && styles.checkboxChecked]}>
              {includeCostBreakdown && (
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => toggleOption('labor')}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="people" size={24} color="#10B981" />
              <Text style={styles.optionLabel}>人工成本明细</Text>
            </View>
            <View style={[styles.checkbox, includeLaborDetails && styles.checkboxChecked]}>
              {includeLaborDetails && (
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => toggleOption('equipment')}
          >
            <View style={styles.optionLeft}>
              <Ionicons name="hardware-chip" size={24} color="#F59E0B" />
              <Text style={styles.optionLabel}>设备成本明细</Text>
            </View>
            <View style={[styles.checkbox, includeEquipmentDetails && styles.checkboxChecked]}>
              {includeEquipmentDetails && (
                <Ionicons name="checkmark" size={20} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* 预览信息 */}
        <View style={styles.previewSection}>
          <Text style={styles.previewTitle}>导出预览</Text>
          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>格式:</Text>
              <Text style={styles.previewValue}>{selectedFormat.toUpperCase()}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>时间:</Text>
              <Text style={styles.previewValue}>{getRangeLabel()}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>包含:</Text>
              <Text style={styles.previewValue}>
                {[
                  includeCostBreakdown && '成本分析',
                  includeLaborDetails && '人工明细',
                  includeEquipmentDetails && '设备明细',
                ].filter(Boolean).join(', ')}
              </Text>
            </View>
          </View>
        </View>

        {/* 导出按钮 */}
        <View style={styles.actionSection}>
          <BigButton
            title="开始导出"
            icon="download"
            variant="primary"
            size="xlarge"
            onPress={handleExport}
          />
        </View>

        {/* 底部说明 */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>
            导出的数据将保存到设备，可通过分享功能发送给其他人
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  devNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  devNoticeText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  formatGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  formatCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  formatCardSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  formatLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6B7280',
    marginTop: 12,
  },
  formatLabelSelected: {
    color: '#10B981',
  },
  formatDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  rangeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rangeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  rangeButtonSelected: {
    borderColor: '#10B981',
    backgroundColor: '#F0FDF4',
  },
  rangeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  rangeButtonTextSelected: {
    color: '#10B981',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginLeft: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  previewSection: {
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 16,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  previewLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'right',
  },
  actionSection: {
    marginBottom: 24,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
});
