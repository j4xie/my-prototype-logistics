/**
 * 意图执行测试屏幕 - 展示 useIntentExecution Hook 的完整集成
 *
 * 功能:
 * 1. 演示如何使用 useIntentExecution Hook
 * 2. 自动处理 NEED_MORE_INFO 响应
 * 3. 显示澄清问题对话框
 * 4. 测试多种意图场景
 *
 * 使用场景:
 * - 批次查询 (需要批次号)
 * - 质检记录 (需要多个参数)
 * - 原料库存查询 (可能需要原料类型)
 * - 出货记录 (需要日期范围)
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useIntentExecution } from '../../hooks/useIntentExecution';

/**
 * 测试场景配置
 */
const TEST_SCENARIOS = [
  {
    id: '1',
    title: '批次溯源查询',
    userInput: '查询批次详情',
    description: '触发 NEED_MORE_INFO，需要补充批次号',
    expectedParams: ['批次号'],
  },
  {
    id: '2',
    title: '质检记录查询',
    userInput: '查看质检记录',
    description: '可能需要补充日期范围或批次号',
    expectedParams: ['开始日期', '结束日期'],
  },
  {
    id: '3',
    title: '原料库存查询',
    userInput: '查询原料库存',
    description: '可能需要指定原料类型',
    expectedParams: ['原料类型'],
  },
  {
    id: '4',
    title: '出货记录查询',
    userInput: '查看出货记录',
    description: '需要指定时间范围',
    expectedParams: ['开始日期', '结束日期'],
  },
  {
    id: '5',
    title: '设备状态查询',
    userInput: '查询设备状态',
    description: '可能需要指定设备ID',
    expectedParams: ['设备ID'],
  },
];

export default function IntentExecutionTestScreen() {
  const navigation = useNavigation();
  const [customInput, setCustomInput] = useState('');
  const [executionLog, setExecutionLog] = useState<string[]>([]);

  // 使用 useIntentExecution Hook
  const {
    executeIntent,
    isExecuting,
    lastResponse,
    ClarificationDialog,
    reset,
  } = useIntentExecution({
    autoHandleClarification: true,
    maxRetries: 3,
    onSuccess: (response) => {
      addLog(`✅ 执行成功: ${response.message}`);
      if (response.data) {
        addLog(`📊 返回数据: ${JSON.stringify(response.data, null, 2)}`);
      }
      Alert.alert('成功', response.message || '操作已完成', [
        {
          text: '确定',
          onPress: () => {
            if (response.data) {
              console.log('执行结果:', response.data);
            }
          },
        },
      ]);
    },
    onError: (error) => {
      addLog(`❌ 执行失败: ${error}`);
      Alert.alert('错误', error);
    },
    onClarificationNeeded: (questions, params) => {
      addLog(`❓ 需要澄清: ${questions.join(', ')}`);
      if (params && params.length > 0) {
        addLog(`📝 缺失参数: ${params.map(p => p.displayName).join(', ')}`);
      }
      return true; // 继续显示对话框
    },
  });

  /**
   * 添加日志
   */
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('zh-CN');
    setExecutionLog((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  /**
   * 执行测试场景
   */
  const handleTestScenario = async (scenario: typeof TEST_SCENARIOS[0]) => {
    addLog(`🚀 开始测试: ${scenario.title}`);
    addLog(`💬 用户输入: ${scenario.userInput}`);

    try {
      const result = await executeIntent({
        userInput: scenario.userInput,
        deviceId: 'test-device-001',
      });

      if (result) {
        addLog(`📡 收到响应: ${result.status}`);
      } else {
        addLog(`⏸️ 等待用户补充信息...`);
      }
    } catch (error) {
      addLog(`💥 异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  /**
   * 执行自定义输入
   */
  const handleCustomInput = async () => {
    if (!customInput.trim()) {
      Alert.alert('提示', '请输入测试指令');
      return;
    }

    addLog(`🎯 自定义测试: ${customInput}`);

    try {
      const result = await executeIntent({
        userInput: customInput.trim(),
        deviceId: 'test-device-001',
      });

      if (result) {
        addLog(`📡 收到响应: ${result.status}`);
      } else {
        addLog(`⏸️ 等待用户补充信息...`);
      }

      setCustomInput('');
    } catch (error) {
      addLog(`💥 异常: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  /**
   * 清空日志
   */
  const handleClearLog = () => {
    setExecutionLog([]);
    reset();
    addLog('🔄 日志已清空');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor="#333"
          onPress={() => navigation.goBack()}
        />
        <Text style={styles.headerTitle}>意图执行测试</Text>
        <IconButton
          icon="refresh"
          size={24}
          iconColor="#333"
          onPress={handleClearLog}
        />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 说明卡片 */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>💡 使用说明</Text>
            <Text style={styles.infoText}>
              1. 点击预设场景按钮测试不同意图{'\n'}
              2. 当需要更多信息时，会自动弹出澄清对话框{'\n'}
              3. 填写缺失参数后，自动重试执行{'\n'}
              4. 或输入自定义指令进行测试
            </Text>
          </View>

          {/* 预设测试场景 */}
          <Text style={styles.sectionTitle}>预设测试场景</Text>
          <View style={styles.scenariosContainer}>
            {TEST_SCENARIOS.map((scenario) => (
              <TouchableOpacity
                key={scenario.id}
                style={styles.scenarioCard}
                onPress={() => handleTestScenario(scenario)}
                disabled={isExecuting}
              >
                <View style={styles.scenarioHeader}>
                  <Text style={styles.scenarioTitle}>{scenario.title}</Text>
                  <Text style={styles.scenarioInput}>"{scenario.userInput}"</Text>
                </View>
                <Text style={styles.scenarioDescription}>{scenario.description}</Text>
                <View style={styles.scenarioParams}>
                  {scenario.expectedParams.map((param, index) => (
                    <View key={index} style={styles.paramChip}>
                      <Text style={styles.paramText}>{param}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* 自定义输入 */}
          <Text style={styles.sectionTitle}>自定义测试</Text>
          <View style={styles.customInputContainer}>
            <TextInput
              style={styles.customInput}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="输入自定义测试指令..."
              placeholderTextColor="#999"
              multiline
              editable={!isExecuting}
            />
            <TouchableOpacity
              style={styles.customButton}
              onPress={handleCustomInput}
              disabled={isExecuting || !customInput.trim()}
            >
              <LinearGradient
                colors={
                  isExecuting || !customInput.trim()
                    ? ['#ccc', '#ccc']
                    : ['#667eea', '#764ba2']
                }
                style={styles.customButtonGradient}
              >
                <Text style={styles.customButtonText}>
                  {isExecuting ? '执行中...' : '执行'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* 执行日志 */}
          <Text style={styles.sectionTitle}>执行日志</Text>
          <View style={styles.logContainer}>
            {executionLog.length === 0 ? (
              <Text style={styles.emptyLog}>暂无日志记录</Text>
            ) : (
              executionLog.map((log, index) => (
                <Text key={index} style={styles.logEntry}>
                  {log}
                </Text>
              ))
            )}
          </View>

          {/* 最后响应 */}
          {lastResponse && (
            <>
              <Text style={styles.sectionTitle}>最后响应</Text>
              <View style={styles.responseContainer}>
                <View style={styles.responseRow}>
                  <Text style={styles.responseLabel}>状态:</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          lastResponse.status === 'SUCCESS'
                            ? '#4CAF50'
                            : lastResponse.status === 'NEED_MORE_INFO'
                            ? '#FF9800'
                            : '#F44336',
                      },
                    ]}
                  >
                    <Text style={styles.statusText}>{lastResponse.status}</Text>
                  </View>
                </View>
                {lastResponse.message && (
                  <View style={styles.responseRow}>
                    <Text style={styles.responseLabel}>消息:</Text>
                    <Text style={styles.responseValue}>{lastResponse.message}</Text>
                  </View>
                )}
                {lastResponse.data && (
                  <View style={styles.responseRow}>
                    <Text style={styles.responseLabel}>数据:</Text>
                    <Text style={styles.responseValue}>
                      {JSON.stringify(lastResponse.data, null, 2)}
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 澄清问题对话框 (由 Hook 自动管理) */}
      <ClarificationDialog />

      {/* 加载遮罩 */}
      {isExecuting && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <Text style={styles.loadingText}>执行中...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#424242',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    marginTop: 8,
  },
  scenariosContainer: {
    marginBottom: 24,
  },
  scenarioCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  scenarioHeader: {
    marginBottom: 8,
  },
  scenarioTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  scenarioInput: {
    fontSize: 13,
    color: '#667eea',
    fontStyle: 'italic',
  },
  scenarioDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  scenarioParams: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  paramChip: {
    backgroundColor: '#F3E5F5',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  paramText: {
    fontSize: 11,
    color: '#7B1FA2',
    fontWeight: '500',
  },
  customInputContainer: {
    marginBottom: 24,
  },
  customInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  customButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  customButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  customButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  logContainer: {
    backgroundColor: '#263238',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
    maxHeight: 300,
  },
  emptyLog: {
    fontSize: 13,
    color: '#78909C',
    textAlign: 'center',
    paddingVertical: 20,
  },
  logEntry: {
    fontSize: 12,
    color: '#CFD8DC',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 4,
    lineHeight: 18,
  },
  responseContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 24,
  },
  responseRow: {
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  responseValue: {
    fontSize: 13,
    color: '#333',
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});
