/**
 * ClarificationDialog 集成示例
 *
 * 展示如何在界面中集成澄清问题对话框
 *
 * 使用场景：
 * - AI 意图执行界面
 * - 语音助手界面
 * - 智能表单填写界面
 *
 * @version 1.0.0
 * @since 2026-01-06
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton } from 'react-native-paper';
import { ClarificationDialog } from './ClarificationDialog';
import { aiApiClient } from '../../services/api/aiApiClient';
import { IntentExecuteResponse } from '../../types/intent';

/**
 * 集成示例组件
 */
export function ClarificationDialogIntegrationExample() {
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 澄清问题对话框状态
  const [showClarification, setShowClarification] = useState(false);
  const [clarificationData, setClarificationData] = useState<{
    questions: string[];
    missingParameters?: IntentExecuteResponse['missingParameters'];
    originalRequest: any;
  } | null>(null);

  /**
   * 执行意图
   */
  const executeIntent = async (request: { intentCode: string; parameters?: Record<string, any> }) => {
    try {
      setIsLoading(true);

      // 调用 AI 意图执行 API
      const response: IntentExecuteResponse = await aiApiClient.executeIntent(
        request.intentCode,
        request.parameters
      );

      // 检查是否需要澄清
      if (response.status === 'NEED_MORE_INFO' && response.clarificationQuestions) {
        // 保存澄清信息和原始请求
        setClarificationData({
          questions: response.clarificationQuestions,
          missingParameters: response.missingParameters,
          originalRequest: request,
        });
        // 显示澄清对话框
        setShowClarification(true);
        return;
      }

      // 成功执行
      if (response.success) {
        Alert.alert('成功', response.message || '操作已完成');
        // 处理执行结果...
        console.log('执行结果:', response.data);
      } else {
        Alert.alert('失败', response.message || '操作失败');
      }
    } catch (error) {
      console.error('意图执行失败:', error);
      Alert.alert('错误', error instanceof Error ? error.message : '未知错误');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 处理用户提交澄清答案
   */
  const handleClarificationSubmit = async (answers: Record<string, any>) => {
    setShowClarification(false);

    if (!clarificationData) return;

    // 将答案合并到原请求的参数中
    const newRequest = {
      ...clarificationData.originalRequest,
      parameters: {
        ...clarificationData.originalRequest.parameters,
        ...answers,
      },
    };

    // 重新执行意图
    await executeIntent(newRequest);
    setClarificationData(null);
  };

  /**
   * 处理用户取消澄清
   */
  const handleClarificationCancel = () => {
    setShowClarification(false);
    setClarificationData(null);
    Alert.alert('已取消', '操作已取消');
  };

  /**
   * 处理用户输入提交
   */
  const handleSubmit = async () => {
    if (!userInput.trim()) return;

    // 这里可以先调用意图识别API，获取intentCode
    // 简化起见，我们直接使用示例intentCode
    await executeIntent({
      intentCode: 'EXAMPLE_INTENT',
      parameters: {
        userInput: userInput.trim(),
      },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>AI 助手集成示例</Text>
      </View>

      {/* 主内容 */}
      <View style={styles.content}>
        <Text style={styles.label}>请输入您的请求：</Text>
        <TextInput
          style={styles.input}
          value={userInput}
          onChangeText={setUserInput}
          placeholder="例如：创建一个批次"
          placeholderTextColor="#999"
          multiline
        />

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isLoading || !userInput.trim()}
        >
          <LinearGradient
            colors={isLoading || !userInput.trim() ? ['#ccc', '#ccc'] : ['#667eea', '#764ba2']}
            style={styles.submitButtonGradient}
          >
            <Text style={styles.submitButtonText}>
              {isLoading ? '处理中...' : '提交'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* 示例说明 */}
        <View style={styles.exampleBox}>
          <Text style={styles.exampleTitle}>集成说明：</Text>
          <Text style={styles.exampleText}>1. 调用 executeIntent API</Text>
          <Text style={styles.exampleText}>
            2. 检查响应的 status 是否为 'NEED_MORE_INFO'
          </Text>
          <Text style={styles.exampleText}>3. 如果需要澄清，显示 ClarificationDialog</Text>
          <Text style={styles.exampleText}>4. 用户提交答案后，合并到原请求重新执行</Text>
        </View>
      </View>

      {/* 澄清问题对话框 */}
      {showClarification && clarificationData && (
        <ClarificationDialog
          visible={showClarification}
          questions={clarificationData.questions}
          missingParameters={clarificationData.missingParameters}
          onSubmit={handleClarificationSubmit}
          onCancel={handleClarificationCancel}
        />
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
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
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
    padding: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 24,
  },
  submitButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  exampleBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  exampleTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  exampleText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
