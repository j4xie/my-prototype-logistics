import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Appbar,
  Card,
  Button,
  ActivityIndicator,
  Divider,
  TextInput,
  Surface,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';
import { processingAPI } from '../../services/api/processingApiClient';
import * as Clipboard from 'expo-clipboard';

type FoodProcessingAnalysisProps = ProcessingScreenProps<'FoodProcessingAnalysis'>;

/**
 * 食品加工数据分析 - AI智能分析
 *
 * 功能：
 * - 左右双列布局：实际数据 vs 平均数据
 * - 9个加工环节参数输入
 * - AI分析生成报告
 * - 可复制分析结果
 */

// 定义所有加工环节和参数
interface SectionParam {
  label: string;
  key: string;
  unit: string;
  avgKey: string;
}

interface Section {
  id: string;
  name: string;
  params: SectionParam[];
}

const PROCESSING_SECTIONS: Section[] = [
  {
    id: 'thawing',
    name: '接收&半解冻',
    params: [
      { label: '解冻时间', key: 'thawing_time', unit: 'kg', avgKey: 'avg_thawing_time' },
      { label: '滴水损失率', key: 'drip_loss', unit: '%', avgKey: 'avg_drip_loss' },
      { label: '温度', key: 'temperature', unit: '°C', avgKey: 'avg_temperature' },
    ],
  },
  {
    id: 'peeling',
    name: '去尾',
    params: [
      { label: '尾段率', key: 'tail_rate', unit: '%', avgKey: 'avg_tail_rate' },
      { label: '修整率', key: 'trim_rate', unit: '%', avgKey: 'avg_trim_rate' },
      { label: '返工率', key: 'rework_rate', unit: '%', avgKey: 'avg_rework_rate' },
    ],
  },
  {
    id: 'cutting',
    name: '机械切片',
    params: [
      { label: '厚度偏差SD', key: 'thickness_sd', unit: 'mm', avgKey: 'avg_thickness_sd' },
      { label: '卡机率', key: 'jam_rate', unit: '%', avgKey: 'avg_jam_rate' },
      { label: 'OEE', key: 'oee', unit: '%', avgKey: 'avg_oee' },
    ],
  },
  {
    id: 'washing',
    name: '清洗(倍温)',
    params: [
      { label: '单位用水', key: 'water_usage', unit: 'L/kg', avgKey: 'avg_water_usage' },
      { label: '出口温度', key: 'outlet_temp', unit: '°C', avgKey: 'avg_outlet_temp' },
      { label: '微生物检测合格率', key: 'micro_pass_rate', unit: '%', avgKey: 'avg_micro_pass_rate' },
    ],
  },
  {
    id: 'drying',
    name: '沥干',
    params: [
      { label: '表面失水率', key: 'surface_loss', unit: '%', avgKey: 'avg_surface_loss' },
      { label: '停留时间', key: 'dwell_time', unit: 'min', avgKey: 'avg_dwell_time' },
    ],
  },
  {
    id: 'coating',
    name: '深辊上浆(半成品)',
    params: [
      { label: '腌料吸收率', key: 'marinade_absorption', unit: '%', avgKey: 'avg_marinade_absorption' },
      { label: 'pH/盐度', key: 'ph_salinity', unit: '', avgKey: 'avg_ph_salinity' },
      { label: '腌料消耗差异', key: 'marinade_variance', unit: '%', avgKey: 'avg_marinade_variance' },
    ],
  },
  {
    id: 'packing_iqf',
    name: '包装&IQF速冻',
    params: [
      { label: 'sEC', key: 'sec', unit: 'kWh/kg', avgKey: 'avg_sec' },
      { label: '包装合格率', key: 'pack_pass_rate', unit: '%', avgKey: 'avg_pack_pass_rate' },
      { label: '核心降温时间', key: 'cooling_time', unit: 'min', avgKey: 'avg_cooling_time' },
    ],
  },
  {
    id: 'product_safety',
    name: '品控&食品安全',
    params: [
      { label: 'CCP合格率', key: 'ccp_pass_rate', unit: '%', avgKey: 'avg_ccp_pass_rate' },
      { label: '审计问题数', key: 'audit_issues', unit: '个', avgKey: 'avg_audit_issues' },
    ],
  },
  {
    id: 'cleaning',
    name: '清洗&换线',
    params: [
      { label: '清洁时长', key: 'clean_duration', unit: 'min', avgKey: 'avg_clean_duration' },
      { label: 'ATP检测合格率', key: 'atp_pass_rate', unit: '%', avgKey: 'avg_atp_pass_rate' },
    ],
  },
];

export default function FoodProcessingAnalysisScreen() {
  const navigation = useNavigation<FoodProcessingAnalysisProps['navigation']>();

  // 存储所有参数数据
  const [sectionData, setSectionData] = useState<Record<string, string>>({});

  // AI分析状态
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [showResult, setShowResult] = useState(false);

  /**
   * 更新参数值
   */
  const updateParam = (key: string, value: string) => {
    setSectionData(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * 提交分析
   */
  const handleAnalyze = async () => {
    // 验证：至少填写一些数据
    const filledParams = Object.values(sectionData).filter(v => v.trim() !== '').length;

    if (filledParams === 0) {
      Alert.alert('提示', '请至少填写一些参数数据');
      return;
    }

    setAiLoading(true);
    setShowResult(true);

    try {
      const response = await processingAPI.analyzeFoodProcessing(sectionData);

      if (response.success) {
        const analysis = response.analysis || response.data?.analysis || '';
        setAiAnalysis(analysis);
      } else {
        Alert.alert('错误', response.message || '分析失败');
        setShowResult(false);
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || 'AI分析失败，请稍后重试');
      setShowResult(false);
    } finally {
      setAiLoading(false);
    }
  };

  /**
   * 复制结果到剪贴板
   */
  const handleCopyResult = async () => {
    if (aiAnalysis) {
      await Clipboard.setStringAsync(aiAnalysis);
      Alert.alert('成功', '分析结果已复制到剪贴板');
    }
  };

  /**
   * 重置所有数据
   */
  const handleReset = () => {
    Alert.alert(
      '确认重置',
      '确定要清空所有输入的数据吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: () => {
            setSectionData({});
            setAiAnalysis('');
            setShowResult(false);
          },
        },
      ]
    );
  };

  /**
   * 渲染单个参数输入框
   */
  const renderParamInput = (param: SectionParam, isAverage: boolean) => {
    const key = isAverage ? param.avgKey : param.key;
    const label = isAverage ? `平均${param.label}` : param.label;

    return (
      <View key={key} style={styles.paramInput}>
        <TextInput
          label={`${label} (${param.unit})`}
          value={sectionData[key] || ''}
          onChangeText={(text) => updateParam(key, text)}
          mode="outlined"
          keyboardType="decimal-pad"
          dense
          style={styles.input}
        />
      </View>
    );
  };

  /**
   * 渲染单个环节卡片
   */
  const renderSectionCard = (section: Section) => {
    return (
      <Card key={section.id} style={styles.sectionCard}>
        <Card.Title
          title={section.name}
          titleStyle={styles.sectionTitle}
        />
        <Card.Content>
          <View style={styles.twoColumnLayout}>
            {/* 左列：实际数据 */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>实际/收集数据</Text>
              <Divider style={styles.divider} />
              {section.params.map(param => renderParamInput(param, false))}
            </View>

            {/* 右列：平均数据 */}
            <View style={styles.column}>
              <Text style={styles.columnHeader}>平均数据</Text>
              <Divider style={styles.divider} />
              {section.params.map(param => renderParamInput(param, true))}
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="食品加工数据分析" />
        <Appbar.Action icon="refresh" onPress={handleReset} />
      </Appbar.Header>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* 说明卡片 */}
          <Card style={styles.infoCard}>
            <Card.Content>
              <Text style={styles.infoTitle}>📊 数据分析说明</Text>
              <Text style={styles.infoText}>
                请填写各加工环节的实际数据和平均数据，AI将为您分析生产效率、成本控制和质量管理，并提供优化建议。
              </Text>
            </Card.Content>
          </Card>

          {/* 各环节数据输入 */}
          {PROCESSING_SECTIONS.map(section => renderSectionCard(section))}

          {/* 分析按钮 */}
          <Button
            mode="contained"
            onPress={handleAnalyze}
            loading={aiLoading}
            disabled={aiLoading}
            style={styles.analyzeButton}
            icon="brain"
          >
            {aiLoading ? '正在分析...' : '开始AI分析'}
          </Button>

          {/* AI分析结果 */}
          {showResult && (
            <Card style={styles.resultCard}>
              <Card.Title
                title="AI分析结果"
                right={(props) => (
                  <Button
                    {...props}
                    icon="content-copy"
                    onPress={handleCopyResult}
                    disabled={!aiAnalysis}
                  >
                    复制
                  </Button>
                )}
              />
              <Card.Content>
                {aiLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" />
                    <Text style={styles.loadingText}>AI正在分析数据...</Text>
                  </View>
                ) : aiAnalysis ? (
                  <Surface style={styles.resultSurface}>
                    <ScrollView style={styles.resultScroll}>
                      <Text style={styles.resultText}>{aiAnalysis}</Text>
                    </ScrollView>
                  </Surface>
                ) : null}
              </Card.Content>
            </Card>
          )}

          <View style={styles.bottomSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  flex: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    marginBottom: 16,
    backgroundColor: '#e3f2fd',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1976d2',
  },
  infoText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#424242',
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1890ff',
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 12,
  },
  column: {
    flex: 1,
  },
  columnHeader: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#424242',
  },
  divider: {
    marginBottom: 12,
  },
  paramInput: {
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
  },
  analyzeButton: {
    marginVertical: 24,
    paddingVertical: 8,
  },
  resultCard: {
    marginBottom: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#757575',
  },
  resultSurface: {
    backgroundColor: '#fafafa',
    padding: 16,
    borderRadius: 8,
    maxHeight: 400,
  },
  resultScroll: {
    maxHeight: 380,
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#212121',
  },
  bottomSpace: {
    height: 32,
  },
});
