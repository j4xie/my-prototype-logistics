import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { 
  DeepSeekService, 
  DeepSeekAnalysisRequest, 
  DeepSeekAnalysisResponse 
} from '../../services/deepseek/deepseekService';

interface DeepSeekAnalysisScreenProps {
  navigation: any;
}

export const DeepSeekAnalysisScreen: React.FC<DeepSeekAnalysisScreenProps> = ({ navigation }) => {
  const [analysisType, setAnalysisType] = useState<DeepSeekAnalysisRequest['analysisType']>('general_query');
  const [description, setDescription] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<DeepSeekAnalysisResponse | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [detailLevel, setDetailLevel] = useState<'basic' | 'detailed' | 'comprehensive'>('detailed');
  const [costStats, setCostStats] = useState<any>(null);

  // 分析类型选项
  const analysisTypes = [
    { value: 'general_query', label: '通用分析', icon: 'search', color: '#64748b' },
    { value: 'quality_control', label: '质量控制', icon: 'shield-checkmark', color: '#10b981' },
    { value: 'production_optimization', label: '生产优化', icon: 'trending-up', color: '#3b82f6' },
    { value: 'safety_check', label: '安全检查', icon: 'warning', color: '#f59e0b' },
    { value: 'equipment_diagnosis', label: '设备诊断', icon: 'construct', color: '#8b5cf6' },
  ];

  // 详细程度选项
  const detailLevels = [
    { value: 'basic', label: '基础分析', description: '快速概览，成本最低' },
    { value: 'detailed', label: '详细分析', description: '深入分析，推荐使用' },
    { value: 'comprehensive', label: '全面分析', description: '最详细，成本最高' },
  ];

  // 加载成本统计
  useEffect(() => {
    loadCostStatistics();
  }, []);

  const loadCostStatistics = async () => {
    try {
      const stats = await DeepSeekService.getCostStatistics(7); // 最近7天
      setCostStats(stats);
    } catch (error) {
      console.error('加载成本统计失败:', error);
    }
  };

  // 选择图片
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要相册权限才能选择图片');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => [...prev, ...newImages].slice(0, 5)); // 最多5张图片
      }
    } catch (error) {
      Alert.alert('错误', '选择图片失败');
    }
  };

  // 删除图片
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // 开始分析
  const startAnalysis = async () => {
    if (!description.trim()) {
      Alert.alert('提示', '请输入要分析的内容');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);

    try {
      const request: DeepSeekAnalysisRequest = {
        analysisType,
        data: {
          description: description.trim(),
          images: selectedImages,
          metrics: {
            // 模拟一些指标数据
            temperature: 25 + Math.random() * 10,
            humidity: 60 + Math.random() * 20,
            pressure: 1010 + Math.random() * 20,
          },
          context: {
            factoryId: 'factory-001',
            department: '生产部',
            timestamp: new Date().toISOString(),
          },
        },
        options: {
          detailLevel,
          includeRecommendations: true,
          includeRiskAssessment: true,
          language: 'zh',
        },
      };

      const response = await DeepSeekService.submitAnalysis(request);
      
      if (response.success) {
        setAnalysisResult(response);
        setShowResult(true);
        
        // 更新成本统计
        await loadCostStatistics();
        
        Alert.alert(
          '分析完成',
          `分析已完成，置信度: ${(response.confidence * 100).toFixed(1)}%\n消耗tokens: ${response.cost?.tokens || 0}\n预估成本: ¥${((response.cost?.estimatedCost || 0) / 100).toFixed(3)}`,
          [{ text: '查看结果', onPress: () => setShowResult(true) }]
        );
      } else {
        Alert.alert('分析失败', response.error || '未知错误');
      }
    } catch (error) {
      console.error('分析失败:', error);
      Alert.alert('错误', '分析服务出现错误，请稍后重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 获取分析类型信息
  const getAnalysisTypeInfo = (type: string) => {
    return analysisTypes.find(t => t.value === type) || analysisTypes[0];
  };

  // 渲染分析结果
  const renderAnalysisResult = () => (
    <Modal
      visible={showResult}
      transparent
      animationType="slide"
      onRequestClose={() => setShowResult(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>分析结果</Text>
            <TouchableOpacity
              onPress={() => setShowResult(false)}
              style={styles.modalCloseButton}
            >
              <Ionicons name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>

          {analysisResult && (
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 分析概要 */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  <Ionicons name="document-text" size={16} color="#3b82f6" />
                  {' '}分析概要
                </Text>
                <Text style={styles.resultText}>{analysisResult.result.summary}</Text>
              </View>

              {/* 评分 */}
              {analysisResult.result.scores && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>
                    <Ionicons name="stats-chart" size={16} color="#10b981" />
                    {' '}评分指标
                  </Text>
                  <View style={styles.scoresGrid}>
                    {Object.entries(analysisResult.result.scores).map(([key, value]) => (
                      <View key={key} style={styles.scoreItem}>
                        <Text style={styles.scoreLabel}>{
                          { quality: '质量', safety: '安全', efficiency: '效率', overall: '总体' }[key] || key
                        }</Text>
                        <View style={styles.scoreBar}>
                          <View style={[styles.scoreBarFill, { width: `${value}%` }]} />
                        </View>
                        <Text style={styles.scoreValue}>{value}/100</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 主要发现 */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  <Ionicons name="eye" size={16} color="#f59e0b" />
                  {' '}主要发现
                </Text>
                {analysisResult.result.analysis.findings.map((finding, index) => (
                  <View key={index} style={styles.listItem}>
                    <Ionicons name="checkmark-circle" size={16} color="#10b981" />
                    <Text style={styles.listItemText}>{finding}</Text>
                  </View>
                ))}
              </View>

              {/* 深度洞察 */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  <Ionicons name="bulb" size={16} color="#8b5cf6" />
                  {' '}深度洞察
                </Text>
                {analysisResult.result.analysis.insights.map((insight, index) => (
                  <View key={index} style={styles.listItem}>
                    <Ionicons name="arrow-forward-circle" size={16} color="#3b82f6" />
                    <Text style={styles.listItemText}>{insight}</Text>
                  </View>
                ))}
              </View>

              {/* 风险评估 */}
              {analysisResult.result.riskAssessment && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>
                    <Ionicons name="shield" size={16} color="#ef4444" />
                    {' '}风险评估
                  </Text>
                  <View style={[
                    styles.riskLevel,
                    { backgroundColor: {
                        low: '#dcfce7',
                        medium: '#fef3c7',
                        high: '#fee2e2',
                        critical: '#fecaca'
                      }[analysisResult.result.riskAssessment.level]
                    }
                  ]}>
                    <Text style={[
                      styles.riskLevelText,
                      { color: {
                          low: '#166534',
                          medium: '#92400e',
                          high: '#dc2626',
                          critical: '#991b1b'
                        }[analysisResult.result.riskAssessment.level]
                      }
                    ]}>
                      风险等级: {
                        { low: '低', medium: '中等', high: '高', critical: '严重' }[analysisResult.result.riskAssessment.level]
                      }
                    </Text>
                  </View>
                  {analysisResult.result.riskAssessment.factors.map((factor, index) => (
                    <View key={index} style={styles.listItem}>
                      <Ionicons name="warning" size={16} color="#f59e0b" />
                      <Text style={styles.listItemText}>{factor}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* 建议措施 */}
              {analysisResult.result.recommendations && (
                <View style={styles.resultSection}>
                  <Text style={styles.resultSectionTitle}>
                    <Ionicons name="clipboard" size={16} color="#10b981" />
                    {' '}建议措施
                  </Text>
                  
                  <View style={styles.recommendationsGroup}>
                    <Text style={styles.recommendationsSubTitle}>立即执行:</Text>
                    {analysisResult.result.recommendations.immediate.map((rec, index) => (
                      <View key={index} style={styles.listItem}>
                        <Ionicons name="flash" size={16} color="#ef4444" />
                        <Text style={styles.listItemText}>{rec}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.recommendationsGroup}>
                    <Text style={styles.recommendationsSubTitle}>短期计划:</Text>
                    {analysisResult.result.recommendations.shortTerm.map((rec, index) => (
                      <View key={index} style={styles.listItem}>
                        <Ionicons name="time" size={16} color="#f59e0b" />
                        <Text style={styles.listItemText}>{rec}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.recommendationsGroup}>
                    <Text style={styles.recommendationsSubTitle}>长期规划:</Text>
                    {analysisResult.result.recommendations.longTerm.map((rec, index) => (
                      <View key={index} style={styles.listItem}>
                        <Ionicons name="calendar" size={16} color="#8b5cf6" />
                        <Text style={styles.listItemText}>{rec}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* 分析信息 */}
              <View style={styles.resultSection}>
                <Text style={styles.resultSectionTitle}>
                  <Ionicons name="information-circle" size={16} color="#64748b" />
                  {' '}分析信息
                </Text>
                <View style={styles.infoGrid}>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>分析ID</Text>
                    <Text style={styles.infoValue}>{analysisResult.analysisId}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>置信度</Text>
                    <Text style={styles.infoValue}>{(analysisResult.confidence * 100).toFixed(1)}%</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>Tokens</Text>
                    <Text style={styles.infoValue}>{analysisResult.cost?.tokens || 0}</Text>
                  </View>
                  <View style={styles.infoItem}>
                    <Text style={styles.infoLabel}>成本</Text>
                    <Text style={styles.infoValue}>¥{((analysisResult.cost?.estimatedCost || 0) / 100).toFixed(3)}</Text>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );

  return (
    <LinearGradient
      colors={['#1e293b', '#334155', '#475569']}
      style={styles.container}
    >
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DeepSeek AI 分析</Text>
        <TouchableOpacity style={styles.historyButton}>
          <Ionicons name="time" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 成本统计 */}
        {costStats && (
          <View style={styles.statsCard}>
            <Text style={styles.statsTitle}>
              <Ionicons name="stats-chart" size={16} color="#3b82f6" />
              {' '}本周使用统计
            </Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{costStats.analysisCount}</Text>
                <Text style={styles.statLabel}>分析次数</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>¥{(costStats.totalCost / 100).toFixed(2)}</Text>
                <Text style={styles.statLabel}>总成本</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{costStats.totalTokens}</Text>
                <Text style={styles.statLabel}>总Tokens</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>¥{(costStats.dailyAverage / 100).toFixed(3)}</Text>
                <Text style={styles.statLabel}>日均成本</Text>
              </View>
            </View>
          </View>
        )}

        {/* 分析类型选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择分析类型</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.typeSelector}>
              {analysisTypes.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.typeCard,
                    analysisType === type.value && styles.typeCardSelected
                  ]}
                  onPress={() => setAnalysisType(type.value as any)}
                >
                  <Ionicons
                    name={type.icon as any}
                    size={24}
                    color={analysisType === type.value ? '#fff' : type.color}
                  />
                  <Text style={[
                    styles.typeCardText,
                    analysisType === type.value && styles.typeCardTextSelected
                  ]}>
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* 详细程度选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>分析详细程度</Text>
          {detailLevels.map((level) => (
            <TouchableOpacity
              key={level.value}
              style={[
                styles.detailOption,
                detailLevel === level.value && styles.detailOptionSelected
              ]}
              onPress={() => setDetailLevel(level.value as any)}
            >
              <View style={styles.detailOptionContent}>
                <Text style={[
                  styles.detailOptionTitle,
                  detailLevel === level.value && styles.detailOptionTitleSelected
                ]}>
                  {level.label}
                </Text>
                <Text style={[
                  styles.detailOptionDescription,
                  detailLevel === level.value && styles.detailOptionDescriptionSelected
                ]}>
                  {level.description}
                </Text>
              </View>
              <View style={[
                styles.radioButton,
                detailLevel === level.value && styles.radioButtonSelected
              ]}>
                {detailLevel === level.value && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* 内容输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>描述要分析的问题或情况</Text>
          <TextInput
            style={styles.textInput}
            placeholder="详细描述您需要分析的内容，包括具体情况、遇到的问题、关注的指标等..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
          />
        </View>

        {/* 图片上传 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>上传相关图片 (可选)</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Ionicons name="camera" size={24} color="#3b82f6" />
            <Text style={styles.uploadButtonText}>选择图片 ({selectedImages.length}/5)</Text>
          </TouchableOpacity>
          
          {selectedImages.length > 0 && (
            <View style={styles.imageGrid}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.imageItem}>
                  <Image source={{ uri: image }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.deleteImage}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 开始分析按钮 */}
        <View style={styles.submitSection}>
          <TouchableOpacity
            style={[styles.submitButton, isAnalyzing && styles.submitButtonDisabled]}
            onPress={startAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? (
              <>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.submitButtonText}>AI分析中...</Text>
              </>
            ) : (
              <>
                <Ionicons name="flash" size={20} color="#fff" />
                <Text style={styles.submitButtonText}>开始AI分析</Text>
              </>
            )}
          </TouchableOpacity>
          
          <Text style={styles.costEstimate}>
            预估成本: ¥{((description.length / 10 + selectedImages.length * 2) * 0.0014).toFixed(4)}
          </Text>
        </View>
      </ScrollView>

      {/* 分析结果模态框 */}
      {renderAnalysisResult()}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  historyButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  statsCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    minWidth: 100,
  },
  typeCardSelected: {
    backgroundColor: '#3b82f6',
  },
  typeCardText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 8,
    textAlign: 'center',
  },
  typeCardTextSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  detailOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  detailOptionSelected: {
    backgroundColor: '#3b82f6',
  },
  detailOptionContent: {
    flex: 1,
  },
  detailOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
    marginBottom: 4,
  },
  detailOptionTitleSelected: {
    fontWeight: '600',
  },
  detailOptionDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  detailOptionDescriptionSelected: {
    color: 'rgba(255,255,255,0.9)',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    textAlignVertical: 'top',
    minHeight: 120,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: 'rgba(59,130,246,0.5)',
    borderStyle: 'dashed',
  },
  uploadButtonText: {
    fontSize: 16,
    color: '#3b82f6',
    marginLeft: 8,
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  imageItem: {
    position: 'relative',
  },
  image: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  deleteImage: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  submitSection: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
  },
  submitButtonDisabled: {
    backgroundColor: '#64748b',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  costEstimate: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBody: {
    padding: 20,
  },
  resultSection: {
    marginBottom: 24,
  },
  resultSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  scoresGrid: {
    gap: 12,
  },
  scoreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    width: 50,
  },
  scoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    width: 45,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  listItemText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    flex: 1,
  },
  riskLevel: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  riskLevelText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  recommendationsGroup: {
    marginBottom: 16,
  },
  recommendationsSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    minWidth: '45%',
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
});