import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  TextInput,
  Button,
  RadioButton,
  Chip,
  Divider,
  ActivityIndicator,
  HelperText,
  List,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { feedbackApiClient } from '../../services/api/feedbackApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建Feedback专用logger
const feedbackLogger = logger.createContextLogger('Feedback');

type FeedbackType = 'bug' | 'feature' | 'other';

interface FeedbackData {
  type: FeedbackType;
  title: string;
  content: string;
  contact?: string;
  screenshots: string[];
}

interface FeedbackHistory {
  id: string;
  type: FeedbackType;
  title: string;
  status: 'pending' | 'processing' | 'resolved';
  createdAt: Date;
}

/**
 * 用户反馈页面
 * 功能：
 * - 反馈类型选择（Bug/功能建议/其他）
 * - 反馈内容输入（多行文本）
 * - 截图上传（可选）
 * - 联系方式（可选）
 * - 提交和历史记录查看
 */
export default function FeedbackScreen() {
  const navigation = useNavigation();
  const factoryId = useAuthStore((state) => state.user?.factoryId);

  // 表单数据
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [contact, setContact] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);

  // UI状态
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // 错误状态
  const [titleError, setTitleError] = useState('');
  const [contentError, setContentError] = useState('');

  // 历史记录（mock数据）
  const [history] = useState<FeedbackHistory[]>([
    {
      id: '1',
      type: 'bug',
      title: '打卡页面加载慢',
      status: 'resolved',
      createdAt: new Date(2025, 10, 15),
    },
    {
      id: '2',
      type: 'feature',
      title: '希望添加数据导出功能',
      status: 'processing',
      createdAt: new Date(2025, 10, 10),
    },
  ]);

  /**
   * 反馈类型配置
   */
  const feedbackTypes = [
    {
      value: 'bug' as FeedbackType,
      label: 'Bug反馈',
      icon: 'bug',
      description: '功能异常、闪退、错误提示等',
      color: '#F44336',
    },
    {
      value: 'feature' as FeedbackType,
      label: '功能建议',
      icon: 'lightbulb-outline',
      description: '新功能建议、优化建议等',
      color: '#FF9800',
    },
    {
      value: 'other' as FeedbackType,
      label: '其他',
      icon: 'message-text-outline',
      description: '其他问题或建议',
      color: '#2196F3',
    },
  ];

  /**
   * 选择截图
   */
  const handlePickImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert('需要权限', '请授予相册访问权限');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 3 - screenshots.length,
      });

      if (!result.canceled && result.assets) {
        const newScreenshots = result.assets.map(asset => asset.uri);
        setScreenshots([...screenshots, ...newScreenshots].slice(0, 3));
        feedbackLogger.debug('截图已添加', { count: newScreenshots.length });
      }
    } catch (error) {
      feedbackLogger.error('选择图片失败', error as Error);
    }
  };

  /**
   * 删除截图
   */
  const handleRemoveScreenshot = (index: number) => {
    const newScreenshots = [...screenshots];
    newScreenshots.splice(index, 1);
    setScreenshots(newScreenshots);
  };

  /**
   * 验证表单
   */
  const validateForm = (): boolean => {
    let isValid = true;

    if (!title.trim()) {
      setTitleError('请输入反馈标题');
      isValid = false;
    } else {
      setTitleError('');
    }

    if (!content.trim()) {
      setContentError('请输入反馈内容');
      isValid = false;
    } else if (content.trim().length < 10) {
      setContentError('反馈内容至少10个字符');
      isValid = false;
    } else {
      setContentError('');
    }

    return isValid;
  };

  /**
   * 提交反馈
   */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const feedbackData: FeedbackData = {
        type: feedbackType,
        title: title.trim(),
        content: content.trim(),
        contact: contact.trim() || undefined,
        screenshots,
      };

      feedbackLogger.debug('提交用户反馈', {
        type: feedbackData.type,
        titleLength: feedbackData.title.length,
        contentLength: feedbackData.content.length,
        hasScreenshots: feedbackData.screenshots.length > 0,
      });

      const response = await feedbackApiClient.submitFeedback(feedbackData, factoryId);

      if (response.success) {
        feedbackLogger.info('反馈提交成功', {
          feedbackId: response.data.feedbackId,
          type: feedbackData.type,
          factoryId,
        });
        Alert.alert(
          '提交成功',
          response.message || '感谢您的反馈！我们会尽快处理。',
          [
            {
              text: '确定',
              onPress: () => {
                // 清空表单
                setTitle('');
                setContent('');
                setContact('');
                setScreenshots([]);
                setFeedbackType('bug');
              },
            },
          ]
        );
      }
    } catch (error) {
      feedbackLogger.error('提交反馈失败', error as Error, {
        type: feedbackType,
        factoryId,
      });
      Alert.alert(
        '提交失败',
        error.response?.data?.message || error.message || '提交反馈时出现错误，请重试'
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取状态标签
   */
  const getStatusChip = (status: FeedbackHistory['status']) => {
    const statusMap = {
      pending: { label: '待处理', color: '#FF9800' },
      processing: { label: '处理中', color: '#2196F3' },
      resolved: { label: '已解决', color: '#4CAF50' },
    };

    const config = statusMap[status];
    return (
      <Chip mode="flat" compact textStyle={{ color: config.color, fontSize: 11 }}>
        {config.label}
      </Chip>
    );
  };

  const currentTypeConfig = feedbackTypes.find(t => t.value === feedbackType)!;

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="意见反馈" />
        <Appbar.Action
          icon={showHistory ? 'pencil' : 'history'}
          onPress={() => setShowHistory(!showHistory)}
        />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {!showHistory ? (
          <>
            {/* 反馈类型选择 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="反馈类型" titleVariant="titleMedium" />
              <Card.Content>
                <RadioButton.Group
                  onValueChange={(value) => setFeedbackType(value as FeedbackType)}
                  value={feedbackType}
                >
                  {feedbackTypes.map((type) => (
                    <View key={type.value}>
                      <View style={styles.radioItem}>
                        <RadioButton.Item
                          label=""
                          value={type.value}
                          style={styles.radioButton}
                        />
                        <View style={styles.radioContent}>
                          <View style={styles.radioHeader}>
                            <Text variant="titleSmall" style={{ color: type.color }}>
                              {type.label}
                            </Text>
                          </View>
                          <Text variant="bodySmall" style={styles.radioDescription}>
                            {type.description}
                          </Text>
                        </View>
                      </View>
                      {type.value !== 'other' && <Divider style={styles.divider} />}
                    </View>
                  ))}
                </RadioButton.Group>
              </Card.Content>
            </Card>

            {/* 反馈内容 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="反馈内容" titleVariant="titleMedium" />
              <Card.Content>
                <TextInput
                  label="标题 *"
                  value={title}
                  onChangeText={(text) => {
                    setTitle(text);
                    setTitleError('');
                  }}
                  mode="outlined"
                  error={!!titleError}
                  maxLength={50}
                  style={styles.input}
                />
                <HelperText type="error" visible={!!titleError}>
                  {titleError}
                </HelperText>

                <TextInput
                  label="详细描述 *"
                  value={content}
                  onChangeText={(text) => {
                    setContent(text);
                    setContentError('');
                  }}
                  mode="outlined"
                  multiline
                  numberOfLines={6}
                  error={!!contentError}
                  maxLength={500}
                  style={styles.input}
                  placeholder={
                    feedbackType === 'bug'
                      ? '请详细描述问题发生的步骤、频率等...'
                      : '请详细描述您的建议...'
                  }
                />
                <HelperText type="error" visible={!!contentError}>
                  {contentError}
                </HelperText>
                <HelperText type="info">
                  {content.length}/500 字符
                </HelperText>

                <TextInput
                  label="联系方式（可选）"
                  value={contact}
                  onChangeText={setContact}
                  mode="outlined"
                  placeholder="手机号或邮箱"
                  keyboardType="email-address"
                  style={styles.input}
                />
                <HelperText type="info">
                  提供联系方式可以让我们更好地跟进处理
                </HelperText>
              </Card.Content>
            </Card>

            {/* 截图上传 */}
            <Card style={styles.card} mode="elevated">
              <Card.Title title="截图（可选）" titleVariant="titleMedium" />
              <Card.Content>
                <View style={styles.screenshotsContainer}>
                  {screenshots.map((uri, index) => (
                    <View key={index} style={styles.screenshotItem}>
                      <Chip
                        icon="close"
                        onPress={() => handleRemoveScreenshot(index)}
                        mode="flat"
                      >
                        图片 {index + 1}
                      </Chip>
                    </View>
                  ))}

                  {screenshots.length < 3 && (
                    <Button
                      mode="outlined"
                      icon="camera"
                      onPress={handlePickImage}
                      style={styles.addScreenshotButton}
                    >
                      添加截图
                    </Button>
                  )}
                </View>
                <HelperText type="info">
                  最多可上传3张截图 ({screenshots.length}/3)
                </HelperText>
              </Card.Content>
            </Card>

            {/* 提交按钮 */}
            <Button
              mode="contained"
              icon="send"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
            >
              {loading ? '提交中...' : '提交反馈'}
            </Button>
          </>
        ) : (
          /* 历史记录 */
          <Card style={styles.card} mode="elevated">
            <Card.Title title="反馈历史" titleVariant="titleMedium" />
            <Card.Content>
              {history.length === 0 ? (
                <Text variant="bodyMedium" style={styles.emptyText}>
                  暂无反馈记录
                </Text>
              ) : (
                history.map((item) => {
                  const typeConfig = feedbackTypes.find(t => t.value === item.type)!;
                  return (
                    <List.Item
                      key={item.id}
                      title={item.title}
                      description={`${typeConfig.label} • ${item.createdAt.toLocaleDateString()}`}
                      left={(props) => (
                        <List.Icon
                          {...props}
                          icon={typeConfig.icon}
                          color={typeConfig.color}
                        />
                      )}
                      right={() => getStatusChip(item.status)}
                      style={styles.historyItem}
                    />
                  );
                })
              )}
            </Card.Content>
          </Card>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>正在提交...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
  },
  card: {
    margin: 16,
    marginBottom: 0,
  },
  radioItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  radioButton: {
    paddingLeft: 0,
  },
  radioContent: {
    flex: 1,
    marginLeft: -8,
  },
  radioHeader: {
    marginBottom: 4,
  },
  radioDescription: {
    color: '#666',
  },
  divider: {
    marginVertical: 8,
  },
  input: {
    marginBottom: 8,
  },
  screenshotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  screenshotItem: {
    marginBottom: 8,
  },
  addScreenshotButton: {
    marginBottom: 8,
  },
  submitButton: {
    margin: 16,
  },
  submitButtonContent: {
    height: 50,
  },
  historyItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    padding: 20,
  },
  bottomPadding: {
    height: 40,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 16,
    fontSize: 16,
  },
});
