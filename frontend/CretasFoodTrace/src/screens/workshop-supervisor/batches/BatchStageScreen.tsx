/**
 * 工艺环节数据录入页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSBatchesStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSBatchesStackParamList, 'BatchStage'>;

export function BatchStageScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('workshop');
  const { stageName } = route.params || {};

  // 自动采集数据 (模拟)
  const [autoData] = useState({
    duration: '45分钟',
    inputWeight: 95.0,
    outputWeight: 52.0,
    envTemperature: 18,
    productTemperature: 4,
    lastUpdate: '10:30:15',
    dataSource: '切片机A传感器',
  });

  // AI辅助数据
  const [aiData, setAiData] = useState({
    productCount: 48,
    confidence: 92,
    defectCount: 3,
    confirmedDefects: 2,
    colorGrade: 'A',
    colorConfidence: 85,
  });

  // 手动录入数据
  const [manualData, setManualData] = useState({
    reworkCount: '1',
    thicknessStd: '0.5',
    actualWorkers: '3',
    notes: '',
  });

  const handleSubmit = () => {
    Alert.alert(t('batchStage.alerts.submitSuccess'), t('batchStage.alerts.dataSaved'), [
      { text: t('common.confirm'), onPress: () => navigation.goBack() }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('batchStage.title', { stageName: stageName || '切片' })}</Text>
        <TouchableOpacity onPress={handleSubmit}>
          <Text style={styles.headerAction}>{t('batchStage.submit')}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* 自动采集数据 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon source="robot" size={20} color="#52c41a" />
            <Text style={styles.sectionTitle}>自动采集数据 (只读)</Text>
            <TouchableOpacity style={styles.refreshBtn}>
              <Icon source="refresh" size={18} color="#667eea" />
            </TouchableOpacity>
          </View>
          <View style={styles.autoDataCard}>
            <View style={styles.dataRow}>
              <View style={styles.dataItem}>
                <Icon source="clock-outline" size={18} color="#666" />
                <Text style={styles.dataLabel}>时长</Text>
                <Text style={styles.dataValue}>{autoData.duration}</Text>
              </View>
              <View style={styles.dataItem}>
                <Icon source="thermometer" size={18} color="#666" />
                <Text style={styles.dataLabel}>环境温度</Text>
                <Text style={styles.dataValue}>{autoData.envTemperature}°C</Text>
              </View>
            </View>
            <View style={styles.dataRow}>
              <View style={styles.dataItem}>
                <Icon source="scale" size={18} color="#666" />
                <Text style={styles.dataLabel}>投入重量</Text>
                <Text style={styles.dataValue}>{autoData.inputWeight} kg</Text>
              </View>
              <View style={styles.dataItem}>
                <Icon source="scale-balance" size={18} color="#666" />
                <Text style={styles.dataLabel}>产出重量</Text>
                <Text style={styles.dataValue}>{autoData.outputWeight} kg</Text>
              </View>
            </View>
            <View style={styles.dataSource}>
              <Icon source="chip" size={14} color="#52c41a" />
              <Text style={styles.dataSourceText}>
                数据来源: {autoData.dataSource} · 更新于 {autoData.lastUpdate}
              </Text>
            </View>
          </View>
        </View>

        {/* AI辅助识别 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon source="robot-outline" size={20} color="#1890ff" />
            <Text style={styles.sectionTitle}>AI辅助识别 (请确认/修正)</Text>
          </View>
          <View style={styles.aiDataCard}>
            <View style={styles.aiRow}>
              <View style={styles.aiItem}>
                <Text style={styles.aiLabel}>产品计数 (AI识别)</Text>
                <View style={styles.aiInputRow}>
                  <TextInput
                    style={styles.aiInput}
                    value={String(aiData.productCount)}
                    onChangeText={(v) => setAiData({ ...aiData, productCount: parseInt(v) || 0 })}
                    keyboardType="numeric"
                  />
                  <Text style={styles.aiUnit}>件</Text>
                </View>
                <Text style={styles.aiConfidence}>置信度: {aiData.confidence}%</Text>
              </View>
            </View>
            <View style={styles.aiRow}>
              <View style={styles.aiItem}>
                <Text style={styles.aiLabel}>确认不合格数</Text>
                <View style={styles.aiInputRow}>
                  <TextInput
                    style={styles.aiInput}
                    value={String(aiData.confirmedDefects)}
                    onChangeText={(v) => setAiData({ ...aiData, confirmedDefects: parseInt(v) || 0 })}
                    keyboardType="numeric"
                  />
                  <Text style={styles.aiUnit}>件</Text>
                </View>
                <TouchableOpacity style={styles.viewDefectsBtn}>
                  <Icon source="image-search" size={16} color="#667eea" />
                  <Text style={styles.viewDefectsText}>查看AI标记图片 ({aiData.defectCount})</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* 手动录入数据 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon source="pencil" size={20} color="#faad14" />
            <Text style={styles.sectionTitle}>手动录入数据</Text>
          </View>
          <View style={styles.manualDataCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>返工数量 (件)</Text>
              <TextInput
                style={styles.manualInput}
                value={manualData.reworkCount}
                onChangeText={(v) => setManualData({ ...manualData, reworkCount: v })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>切片厚度标准差 (mm)</Text>
              <TextInput
                style={styles.manualInput}
                value={manualData.thicknessStd}
                onChangeText={(v) => setManualData({ ...manualData, thicknessStd: v })}
                keyboardType="decimal-pad"
                placeholder="0.0"
              />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>实际参与人数</Text>
              <TextInput
                style={styles.manualInput}
                value={manualData.actualWorkers}
                onChangeText={(v) => setManualData({ ...manualData, actualWorkers: v })}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
          </View>
        </View>

        {/* 备注 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon source="note-text" size={20} color="#666" />
            <Text style={styles.sectionTitle}>备注与问题汇报</Text>
          </View>
          <TextInput
            style={styles.notesInput}
            value={manualData.notes}
            onChangeText={(v) => setManualData({ ...manualData, notes: v })}
            placeholder="输入备注或问题..."
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* AI对比数据 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon source="chart-line" size={20} color="#667eea" />
            <Text style={styles.sectionTitle}>AI对比分析</Text>
          </View>
          <View style={styles.comparisonCard}>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>当前损耗率</Text>
              <Text style={[styles.comparisonValue, { color: '#52c41a' }]}>5.3%</Text>
              <Text style={styles.comparisonAvg}>行业均值: 6.0% ✓</Text>
            </View>
            <View style={styles.comparisonItem}>
              <Text style={styles.comparisonLabel}>当前合格率</Text>
              <Text style={[styles.comparisonValue, { color: '#52c41a' }]}>96%</Text>
              <Text style={styles.comparisonAvg}>行业均值: 95% ✓</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
          <Icon source="check" size={20} color="#fff" />
          <Text style={styles.submitBtnText}>保存数据</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#fff',
  },
  headerAction: {
    fontSize: 15,
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
    flex: 1,
  },
  refreshBtn: {
    padding: 4,
  },
  autoDataCard: {
    backgroundColor: '#f6ffed',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#b7eb8f',
  },
  dataRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dataItem: {
    flex: 1,
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  dataValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  dataSource: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#b7eb8f',
  },
  dataSourceText: {
    fontSize: 11,
    color: '#52c41a',
    marginLeft: 4,
  },
  aiDataCard: {
    backgroundColor: '#e6f7ff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  aiRow: {
    marginBottom: 12,
  },
  aiItem: {},
  aiLabel: {
    fontSize: 13,
    color: '#333',
    marginBottom: 6,
  },
  aiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiInput: {
    backgroundColor: '#fff',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    width: 80,
    textAlign: 'center',
  },
  aiUnit: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  aiConfidence: {
    fontSize: 11,
    color: '#1890ff',
    marginTop: 4,
  },
  viewDefectsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  viewDefectsText: {
    fontSize: 12,
    color: '#667eea',
    marginLeft: 4,
  },
  manualDataCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    color: '#666',
    marginBottom: 6,
  },
  manualInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  notesInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#333',
    height: 80,
  },
  comparisonCard: {
    flexDirection: 'row',
    backgroundColor: '#f0f5ff',
    borderRadius: 12,
    padding: 14,
  },
  comparisonItem: {
    flex: 1,
    alignItems: 'center',
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#666',
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  comparisonAvg: {
    fontSize: 11,
    color: '#52c41a',
    marginTop: 2,
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 14,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default BatchStageScreen;
