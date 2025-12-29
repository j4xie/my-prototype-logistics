/**
 * FormilyDemoScreen - Formily 动态表单演示页面
 *
 * 用于验证 Formily 适配层功能:
 * 1. DynamicForm + SchemaField 渲染
 * 2. 字段联动 (x-reactions)
 * 3. 表单验证
 * 4. 表单提交
 * 5. AI 表单助手 (语音/文本/OCR)
 */

import React, { useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Card,
  Button,
  Divider,
  useTheme,
  Chip,
  Surface,
  Banner,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  DynamicForm,
  DynamicFormRef,
  qualityCheckSchema,
  createQualityCheckEffects,
} from '../../formily';
import type { EntityType } from '../../services/api/formTemplateApiClient';
import type { QualityCheckFormData } from '../../formily/schemas/qualityCheck.schema';

export const FormilyDemoScreen: React.FC = () => {
  const theme = useTheme();
  const formRef = useRef<DynamicFormRef>(null);
  const [submittedData, setSubmittedData] = useState<Record<string, any> | null>(null);
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [aiEnabled, setAiEnabled] = useState(true);
  const [aiFillResult, setAiFillResult] = useState<{
    values: Record<string, unknown>;
    confidence: number;
  } | null>(null);

  // 初始值
  const initialValues: Partial<QualityCheckFormData> = {
    batchNumber: '',
    temperature: -18,
    result: undefined,
    inspectorConfirm: false,
  };

  // 提交处理
  const handleSubmit = async (values: Record<string, any>) => {
    console.log('表单提交:', values);
    setSubmittedData(values);
    Alert.alert('提交成功', JSON.stringify(values, null, 2));
  };

  // 值变化处理
  const handleValuesChange = (values: Record<string, any>) => {
    setFormValues(values);
  };

  // 手动验证
  const handleValidate = async () => {
    try {
      await formRef.current?.validate();
      Alert.alert('验证通过', '表单数据有效');
    } catch (errors) {
      console.error('验证失败:', errors);
      Alert.alert('验证失败', '请检查表单数据');
    }
  };

  // 重置表单
  const handleReset = () => {
    formRef.current?.reset();
    setSubmittedData(null);
    setFormValues({});
  };

  // 获取当前值
  const handleGetValues = () => {
    const values = formRef.current?.getValues();
    Alert.alert('当前表单值', JSON.stringify(values, null, 2));
  };

  // 设置示例值
  const handleSetExampleValues = () => {
    formRef.current?.setValues({
      batchNumber: 'BATCH-2025-001',
      temperature: -20,
      humidity: 65,
      result: 'PASS',
      notes: '质检正常',
      inspectorConfirm: true,
    });
  };

  // AI 填充成功回调
  const handleAIFillSuccess = (values: Record<string, unknown>, confidence: number) => {
    console.log('AI 填充成功:', values, '置信度:', confidence);
    setAiFillResult({ values, confidence });
    Alert.alert(
      'AI 填充成功',
      `置信度: ${(confidence * 100).toFixed(0)}%\n\n已填充 ${Object.keys(values).length} 个字段`
    );
  };

  // AI 填充失败回调
  const handleAIFillError = (error: string) => {
    console.error('AI 填充失败:', error);
    Alert.alert('AI 填充失败', error);
  };

  // 切换 AI 助手
  const toggleAI = () => {
    setAiEnabled(!aiEnabled);
    setAiFillResult(null);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView}>
        {/* 标题 */}
        <Surface style={styles.header} elevation={1}>
          <Text variant="headlineSmall" style={styles.title}>
            Formily 动态表单演示
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            验证 React Native Paper 适配层功能
          </Text>
        </Surface>

        {/* AI 助手提示 */}
        {aiEnabled && (
          <Banner
            visible={true}
            icon="robot"
            actions={[
              { label: '关闭 AI', onPress: toggleAI },
            ]}
            style={styles.aiBanner}
          >
            AI 表单助手已启用！点击右下角悬浮按钮，使用语音、文本或拍照自动填充表单。
          </Banner>
        )}

        {/* 功能说明 */}
        <Card style={styles.card}>
          <Card.Title title="功能特性" />
          <Card.Content>
            <View style={styles.chipContainer}>
              <Chip icon="check" style={styles.chip}>Schema 驱动渲染</Chip>
              <Chip icon="check" style={styles.chip}>字段联动</Chip>
              <Chip icon="check" style={styles.chip}>实时验证</Chip>
              <Chip icon="check" style={styles.chip}>条件显隐</Chip>
              <Chip
                icon={aiEnabled ? "robot" : "robot-off"}
                style={[styles.chip, aiEnabled && styles.aiChip]}
                onPress={toggleAI}
              >
                AI 助手 {aiEnabled ? '开' : '关'}
              </Chip>
            </View>
          </Card.Content>
        </Card>

        {/* 动态表单 */}
        <Card style={styles.card}>
          <Card.Title
            title="质检表单 (qualityCheckSchema)"
            subtitle={aiEnabled ? "AI 助手已启用 - 点击右下角按钮" : undefined}
          />
          <Card.Content>
            <DynamicForm
              ref={formRef}
              schema={qualityCheckSchema}
              initialValues={initialValues}
              onSubmit={handleSubmit}
              onValuesChange={handleValuesChange}
              effects={createQualityCheckEffects}
              submitText="提交质检记录"
              scrollable={false}
              // AI 助手配置
              enableAIAssistant={aiEnabled}
              entityType={'QUALITY_CHECK' as EntityType}
              aiContext={{ formType: 'demo', source: 'FormilyDemoScreen' }}
              onAIFillSuccess={handleAIFillSuccess}
              onAIFillError={handleAIFillError}
            />
          </Card.Content>
        </Card>

        {/* 操作按钮 */}
        <Card style={styles.card}>
          <Card.Title title="表单操作" />
          <Card.Content>
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={handleValidate}
                style={styles.button}
              >
                验证
              </Button>
              <Button
                mode="outlined"
                onPress={handleGetValues}
                style={styles.button}
              >
                获取值
              </Button>
            </View>
            <View style={styles.buttonRow}>
              <Button
                mode="outlined"
                onPress={handleSetExampleValues}
                style={styles.button}
              >
                填充示例
              </Button>
              <Button
                mode="outlined"
                onPress={handleReset}
                style={styles.button}
              >
                重置
              </Button>
            </View>
          </Card.Content>
        </Card>

        {/* 实时值预览 */}
        <Card style={styles.card}>
          <Card.Title title="实时表单值" />
          <Card.Content>
            <View style={styles.codeBlock}>
              <Text variant="bodySmall" style={styles.codeText}>
                {JSON.stringify(formValues, null, 2) || '{}'}
              </Text>
            </View>
          </Card.Content>
        </Card>

        {/* 提交结果 */}
        {submittedData && (
          <Card style={styles.card}>
            <Card.Title title="提交结果" />
            <Card.Content>
              <View style={[styles.codeBlock, { backgroundColor: '#e8f5e9' }]}>
                <Text variant="bodySmall" style={styles.codeText}>
                  {JSON.stringify(submittedData, null, 2)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* AI 填充结果 */}
        {aiFillResult && (
          <Card style={[styles.card, styles.aiResultCard]}>
            <Card.Title
              title="AI 填充结果"
              subtitle={`置信度: ${(aiFillResult.confidence * 100).toFixed(0)}%`}
              left={(props) => <Chip icon="robot" {...props}>AI</Chip>}
            />
            <Card.Content>
              <View style={styles.codeBlock}>
                <Text variant="bodySmall" style={styles.codeText}>
                  {JSON.stringify(aiFillResult.values, null, 2)}
                </Text>
              </View>
            </Card.Content>
          </Card>
        )}

        {/* AI 助手使用说明 */}
        <Card style={styles.card}>
          <Card.Title title="AI 表单助手使用说明" />
          <Card.Content>
            <Text variant="bodyMedium" style={styles.guideItem}>
              1. 点击右下角 AI 悬浮按钮
            </Text>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium" style={styles.guideItem}>
              2. 选择输入方式：
            </Text>
            <Text variant="bodySmall" style={styles.guideSubItem}>
              • 文本输入：描述需要填写的内容，如"带鱼批次，温度-20度，合格"
            </Text>
            <Text variant="bodySmall" style={styles.guideSubItem}>
              • 语音输入：按住说话，松开发送
            </Text>
            <Text variant="bodySmall" style={styles.guideSubItem}>
              • 拍照/相册：拍摄质检单据，AI自动识别并填充
            </Text>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium" style={styles.guideItem}>
              3. AI 将自动解析并填充表单字段
            </Text>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium" style={styles.guideItem}>
              4. 检查填充结果，手动修正后提交
            </Text>
          </Card.Content>
        </Card>

        {/* 联动说明 */}
        <Card style={styles.card}>
          <Card.Title title="联动规则说明" />
          <Card.Content>
            <Text variant="bodyMedium">
              1. 当"检测结果"选择"不合格"时，"不合格原因"字段显示且必填
            </Text>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium">
              2. 当"检测结果"切换为其他值时，"不合格原因"自动清空并隐藏
            </Text>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium">
              3. 温度输入支持范围验证: -50°C ~ 100°C
            </Text>
            <Divider style={styles.divider} />
            <Text variant="bodyMedium">
              4. 提交前必须勾选"质检员确认"
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    marginBottom: 8,
  },
  title: {
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#666',
    marginTop: 4,
  },
  card: {
    margin: 8,
    marginBottom: 8,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginRight: 4,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  button: {
    flex: 1,
    marginHorizontal: 4,
  },
  codeBlock: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
  },
  codeText: {
    fontFamily: 'monospace',
  },
  divider: {
    marginVertical: 8,
  },
  bottomPadding: {
    height: 24,
  },
  aiBanner: {
    marginHorizontal: 8,
    marginBottom: 8,
    backgroundColor: '#e3f2fd',
  },
  aiChip: {
    backgroundColor: '#e3f2fd',
  },
  aiResultCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  guideItem: {
    marginVertical: 2,
  },
  guideSubItem: {
    marginLeft: 16,
    color: '#666',
    marginTop: 4,
  },
});

export default FormilyDemoScreen;
