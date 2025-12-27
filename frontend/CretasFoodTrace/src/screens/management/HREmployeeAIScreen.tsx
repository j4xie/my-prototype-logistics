import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import {
  Text,
  Card,
  Appbar,
  ActivityIndicator,
  Avatar,
  Chip,
  Button,
  Surface,
  Divider,
  ProgressBar,
  IconButton,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ManagementStackParamList } from '../../types/navigation';
import { useAuthStore } from '../../store/authStore';
import employeeAIApiClient, {
  EmployeeAnalysisResponse,
  AttendanceAnalysis,
  WorkHoursAnalysis,
  ProductionAnalysis,
  SkillDistribution,
  EmployeeSuggestion,
} from '../../services/api/employeeAIApiClient';
import { handleError } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// 创建专用 logger
const aiLogger = logger.createContextLogger('HREmployeeAI');

type HREmployeeAINavigationProp = NativeStackNavigationProp<
  ManagementStackParamList,
  'HREmployeeAI'
>;

type HREmployeeAIRouteProp = RouteProp<ManagementStackParamList, 'HREmployeeAI'>;

interface ErrorState {
  message: string;
  canRetry: boolean;
}

/**
 * HR员工AI分析页面
 *
 * 功能模块:
 * 1. 员工基本信息展示
 * 2. 综合评分雷达图
 * 3. 四维分析卡片 (考勤/工时/生产/技能)
 * 4. AI建议和洞察
 * 5. AI对话追问功能
 */
export default function HREmployeeAIScreen() {
  const navigation = useNavigation<HREmployeeAINavigationProp>();
  const route = useRoute<HREmployeeAIRouteProp>();
  const { user } = useAuthStore();

  // 从路由获取员工ID，默认为当前用户
  const employeeId = route.params?.employeeId ?? (user?.id ? Number(user.id) : undefined);

  // 状态管理
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [analysisData, setAnalysisData] = useState<EmployeeAnalysisResponse | null>(null);
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{
    role: 'user' | 'ai';
    content: string;
    timestamp: Date;
  }>>([]);

  // 动画
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);

  // 加载员工分析数据
  const loadAnalysisData = useCallback(async () => {
    if (!employeeId) {
      setError({ message: '未指定员工ID', canRetry: false });
      setLoading(false);
      return;
    }

    try {
      aiLogger.debug('开始加载员工AI分析', { employeeId });

      const result = await employeeAIApiClient.analyzeEmployee(employeeId, {
        days: 30,
        enableThinking: true,
        thinkingBudget: 60,
      });

      setAnalysisData(result);
      setError(null);

      // 添加初始AI分析到聊天记录
      if (result.aiInsight) {
        setChatHistory([{
          role: 'ai',
          content: result.aiInsight,
          timestamp: new Date(),
        }]);
      }

      // 淡入动画
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();

      aiLogger.info('员工AI分析加载成功', {
        employeeId: result.employeeId,
        score: result.overallScore,
      });
    } catch (err) {
      aiLogger.error('加载员工AI分析失败', err);
      handleError(err, { showAlert: false, logError: true });
      setError({
        message: err instanceof Error ? err.message : '加载分析失败，请稍后重试',
        canRetry: true,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employeeId, fadeAnim]);

  // 初始加载
  useEffect(() => {
    loadAnalysisData();
  }, [loadAnalysisData]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalysisData();
  }, [loadAnalysisData]);

  // 发送追问
  const handleAskQuestion = async () => {
    if (!question.trim() || !analysisData?.sessionId || isAsking) return;

    const userQuestion = question.trim();
    setQuestion('');
    setIsAsking(true);

    // 添加用户问题到聊天记录
    setChatHistory(prev => [...prev, {
      role: 'user',
      content: userQuestion,
      timestamp: new Date(),
    }]);

    try {
      aiLogger.debug('发送追问', { question: userQuestion });

      const result = await employeeAIApiClient.followupAnalysis(
        employeeId!,
        {
          sessionId: analysisData.sessionId,
          question: userQuestion,
        }
      );

      // 添加AI回复到聊天记录
      if (result.aiInsight) {
        setChatHistory(prev => [...prev, {
          role: 'ai',
          content: result.aiInsight,
          timestamp: new Date(),
        }]);
      }

      // 滚动到底部
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (err) {
      aiLogger.error('追问失败', err);
      handleError(err, { showAlert: true, logError: true });
    } finally {
      setIsAsking(false);
    }
  };

  // 获取等级颜色
  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return '#52c41a';
      case 'B': return '#1890ff';
      case 'C': return '#fa8c16';
      case 'D': return '#ff4d4f';
      default: return '#8c8c8c';
    }
  };

  // 获取洞察类型颜色
  const getInsightColor = (type: 'positive' | 'warning' | 'neutral'): string => {
    switch (type) {
      case 'positive': return '#52c41a';
      case 'warning': return '#fa8c16';
      case 'neutral': return '#1890ff';
    }
  };

  // 获取建议类型样式
  const getSuggestionStyle = (type: string): { color: string; bgColor: string; icon: string } => {
    switch (type) {
      case '优势':
        return { color: '#52c41a', bgColor: '#f6ffed', icon: 'star' };
      case '建议':
        return { color: '#1890ff', bgColor: '#e6f7ff', icon: 'lightbulb-on' };
      case '关注':
        return { color: '#fa8c16', bgColor: '#fff7e6', icon: 'alert-circle' };
      default:
        return { color: '#8c8c8c', bgColor: '#f5f5f5', icon: 'information' };
    }
  };

  // 渲染评分环
  const renderScoreRing = (score: number, label: string, color: string, size: number = 80) => {
    const progress = score / 100;
    return (
      <View style={[styles.scoreRing, { width: size, height: size }]}>
        <View style={[styles.scoreRingOuter, { borderColor: color + '30' }]}>
          <View
            style={[
              styles.scoreRingProgress,
              {
                borderColor: color,
                borderRightColor: 'transparent',
                borderBottomColor: progress > 0.5 ? color : 'transparent',
                transform: [{ rotate: `${progress * 360}deg` }],
              },
            ]}
          />
          <View style={styles.scoreRingInner}>
            <Text style={[styles.scoreRingValue, { color }]}>{score}</Text>
            <Text style={styles.scoreRingLabel}>{label}</Text>
          </View>
        </View>
      </View>
    );
  };

  // 渲染分析卡片
  const renderAnalysisCard = (
    title: string,
    icon: string,
    iconColor: string,
    score: number,
    insight: string,
    insightType: 'positive' | 'warning' | 'neutral',
    details: Array<{ label: string; value: string | number; unit?: string }>
  ) => (
    <Card style={styles.analysisCard}>
      <Card.Content>
        <View style={styles.cardHeader}>
          <View style={[styles.cardIcon, { backgroundColor: iconColor + '15' }]}>
            <MaterialCommunityIcons
              name={icon as keyof typeof MaterialCommunityIcons.glyphMap}
              size={20}
              color={iconColor}
            />
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
          <View style={[styles.scoreChip, { backgroundColor: getGradeColor(score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D') + '15' }]}>
            <Text style={[styles.scoreChipText, { color: getGradeColor(score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 60 ? 'C' : 'D') }]}>
              {score}分
            </Text>
          </View>
        </View>

        <View style={styles.detailsGrid}>
          {details.map((detail, index) => (
            <View key={index} style={styles.detailItem}>
              <Text style={styles.detailValue}>
                {detail.value}{detail.unit ?? ''}
              </Text>
              <Text style={styles.detailLabel}>{detail.label}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.insightBox, { backgroundColor: getInsightColor(insightType) + '10' }]}>
          <MaterialCommunityIcons
            name={insightType === 'positive' ? 'check-circle' : insightType === 'warning' ? 'alert' : 'information'}
            size={16}
            color={getInsightColor(insightType)}
          />
          <Text style={[styles.insightText, { color: getInsightColor(insightType) }]}>
            {insight}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );

  // 渲染技能分布
  const renderSkillItem = (skill: SkillDistribution) => (
    <View key={skill.skillName} style={styles.skillItem}>
      <View style={styles.skillHeader}>
        <Text style={styles.skillName}>{skill.skillName}</Text>
        <Chip
          mode="flat"
          textStyle={styles.proficiencyText}
          style={[
            styles.proficiencyChip,
            skill.proficiency === '精通' && styles.proficiencyMaster,
            skill.proficiency === '熟练' && styles.proficiencySkilled,
            skill.proficiency === '学习中' && styles.proficiencyLearning,
            skill.proficiency === '新手' && styles.proficiencyBeginner,
          ]}
        >
          {skill.proficiency}
        </Chip>
      </View>
      <View style={styles.skillProgress}>
        <ProgressBar
          progress={skill.percentage / 100}
          color="#667eea"
          style={styles.progressBar}
        />
        <Text style={styles.skillPercentage}>{skill.percentage}%</Text>
      </View>
      <Text style={styles.skillHours}>{skill.hours}小时</Text>
    </View>
  );

  // 渲染建议
  const renderSuggestion = (suggestion: EmployeeSuggestion, index: number) => {
    const style = getSuggestionStyle(suggestion.type);
    return (
      <View key={index} style={[styles.suggestionItem, { backgroundColor: style.bgColor }]}>
        <View style={[styles.suggestionIcon, { backgroundColor: style.color + '20' }]}>
          <MaterialCommunityIcons
            name={style.icon as keyof typeof MaterialCommunityIcons.glyphMap}
            size={18}
            color={style.color}
          />
        </View>
        <View style={styles.suggestionContent}>
          <View style={styles.suggestionHeader}>
            <Text style={[styles.suggestionType, { color: style.color }]}>{suggestion.type}</Text>
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
          </View>
          <Text style={styles.suggestionDesc}>{suggestion.description}</Text>
        </View>
      </View>
    );
  };

  // 渲染聊天消息
  const renderChatMessage = (message: { role: 'user' | 'ai'; content: string }, index: number) => (
    <View
      key={index}
      style={[
        styles.chatMessage,
        message.role === 'user' ? styles.userMessage : styles.aiMessage,
      ]}
    >
      {message.role === 'ai' && (
        <Avatar.Icon
          size={32}
          icon="robot"
          style={styles.aiAvatar}
        />
      )}
      <View style={[
        styles.messageBubble,
        message.role === 'user' ? styles.userBubble : styles.aiBubble,
      ]}>
        <Text style={[
          styles.messageText,
          message.role === 'user' && styles.userMessageText,
        ]}>
          {message.content}
        </Text>
      </View>
      {message.role === 'user' && (
        <Avatar.Icon
          size={32}
          icon="account"
          style={styles.userAvatar}
        />
      )}
    </View>
  );

  // 加载中状态
  if (loading) {
    return (
      <View style={styles.container}>
        <Appbar.Header style={styles.header} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
          <Appbar.Content title="员工AI分析" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>正在分析员工数据...</Text>
          <Text style={styles.loadingSubtext}>AI正在进行深度分析，请稍候</Text>
        </View>
      </View>
    );
  }

  // 错误状态
  if (error) {
    return (
      <View style={styles.container}>
        <Appbar.Header style={styles.header} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
          <Appbar.Content title="员工AI分析" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={64} color="#ff4d4f" />
          <Text style={styles.errorText}>{error.message}</Text>
          {error.canRetry && (
            <Button mode="outlined" onPress={loadAnalysisData} style={styles.retryButton}>
              重新加载
            </Button>
          )}
        </View>
      </View>
    );
  }

  // 无数据状态
  if (!analysisData) {
    return (
      <View style={styles.container}>
        <Appbar.Header style={styles.header} elevated>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
          <Appbar.Content title="员工AI分析" titleStyle={styles.headerTitle} />
        </Appbar.Header>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="account-off" size={64} color="#bfbfbf" />
          <Text style={styles.emptyText}>暂无分析数据</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.header} elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
        <Appbar.Content title="员工AI分析" titleStyle={styles.headerTitle} />
        <Appbar.Action icon="refresh" onPress={loadAnalysisData} color="#fff" />
      </Appbar.Header>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={88}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* 员工信息卡片 */}
            <Card style={styles.profileCard}>
              <Card.Content>
                <View style={styles.profileHeader}>
                  <Avatar.Text
                    size={56}
                    label={analysisData.employeeName?.charAt(0) ?? '?'}
                    style={[styles.profileAvatar, { backgroundColor: getGradeColor(analysisData.overallGrade) }]}
                  />
                  <View style={styles.profileInfo}>
                    <Text style={styles.profileName}>{analysisData.employeeName}</Text>
                    <Text style={styles.profileMeta}>
                      {analysisData.position ?? '操作员'} · {analysisData.department ?? '未分配部门'}
                    </Text>
                    <Text style={styles.profileTenure}>
                      入职 {analysisData.tenureMonths ?? 0} 个月
                    </Text>
                  </View>
                  <View style={styles.gradeContainer}>
                    <Text style={[styles.gradeText, { color: getGradeColor(analysisData.overallGrade) }]}>
                      {analysisData.overallGrade}
                    </Text>
                    <Text style={styles.gradeLabel}>综合等级</Text>
                  </View>
                </View>

                <Divider style={styles.divider} />

                {/* 综合评分 */}
                <View style={styles.scoreSection}>
                  <View style={styles.mainScore}>
                    {renderScoreRing(analysisData.overallScore, '综合分', getGradeColor(analysisData.overallGrade), 100)}
                  </View>
                  <View style={styles.subScores}>
                    {renderScoreRing(analysisData.attendance?.score ?? 0, '考勤', '#1890ff', 60)}
                    {renderScoreRing(analysisData.workHours?.score ?? 0, '工时', '#52c41a', 60)}
                    {renderScoreRing(analysisData.production?.score ?? 0, '生产', '#fa8c16', 60)}
                  </View>
                </View>

                {analysisData.scoreChange !== undefined && analysisData.scoreChange !== 0 && (
                  <View style={styles.changeIndicator}>
                    <MaterialCommunityIcons
                      name={analysisData.scoreChange > 0 ? 'trending-up' : 'trending-down'}
                      size={16}
                      color={analysisData.scoreChange > 0 ? '#52c41a' : '#ff4d4f'}
                    />
                    <Text style={[
                      styles.changeText,
                      { color: analysisData.scoreChange > 0 ? '#52c41a' : '#ff4d4f' }
                    ]}>
                      环比{analysisData.scoreChange > 0 ? '+' : ''}{analysisData.scoreChange}%
                    </Text>
                    {analysisData.departmentRankPercent !== undefined && (
                      <Text style={styles.rankText}>
                        · 部门前{analysisData.departmentRankPercent}%
                      </Text>
                    )}
                  </View>
                )}
              </Card.Content>
            </Card>

            {/* 考勤分析 */}
            {analysisData.attendance && renderAnalysisCard(
              '考勤表现',
              'calendar-check',
              '#1890ff',
              analysisData.attendance.score,
              analysisData.attendance.insight,
              analysisData.attendance.insightType,
              [
                { label: '出勤率', value: analysisData.attendance.attendanceRate, unit: '%' },
                { label: '出勤天数', value: analysisData.attendance.attendanceDays, unit: '天' },
                { label: '迟到', value: analysisData.attendance.lateCount, unit: '次' },
                { label: '缺勤', value: analysisData.attendance.absentDays, unit: '天' },
              ]
            )}

            {/* 工时分析 */}
            {analysisData.workHours && renderAnalysisCard(
              '工时效率',
              'clock-outline',
              '#52c41a',
              analysisData.workHours.score,
              analysisData.workHours.insight,
              analysisData.workHours.insightType,
              [
                { label: '日均工时', value: analysisData.workHours.avgDailyHours?.toFixed(1) ?? '0', unit: 'h' },
                { label: '加班时长', value: analysisData.workHours.overtimeHours?.toFixed(1) ?? '0', unit: 'h' },
                { label: '效率', value: analysisData.workHours.efficiency, unit: '%' },
                { label: '工作类型', value: analysisData.workHours.workTypeCount, unit: '种' },
              ]
            )}

            {/* 生产贡献 */}
            {analysisData.production && renderAnalysisCard(
              '生产贡献',
              'factory',
              '#fa8c16',
              analysisData.production.score,
              analysisData.production.insight,
              analysisData.production.insightType,
              [
                { label: '参与批次', value: analysisData.production.batchCount, unit: '个' },
                { label: '产量', value: analysisData.production.outputQuantity?.toFixed(1) ?? '0', unit: 'kg' },
                { label: '良品率', value: analysisData.production.qualityRate, unit: '%' },
                { label: '人效', value: analysisData.production.productivityRate?.toFixed(1) ?? '0', unit: 'kg/h' },
              ]
            )}

            {/* 技能分布 */}
            {analysisData.skills && analysisData.skills.length > 0 && (
              <Card style={styles.skillCard}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: '#722ed115' }]}>
                      <MaterialCommunityIcons name="chart-bar" size={20} color="#722ed1" />
                    </View>
                    <Text style={styles.cardTitle}>技能分布</Text>
                  </View>
                  {analysisData.skills.map(renderSkillItem)}
                </Card.Content>
              </Card>
            )}

            {/* AI建议 */}
            {analysisData.suggestions && analysisData.suggestions.length > 0 && (
              <Card style={styles.suggestionCard}>
                <Card.Content>
                  <View style={styles.cardHeader}>
                    <View style={[styles.cardIcon, { backgroundColor: '#eb2f9615' }]}>
                      <MaterialCommunityIcons name="lightbulb-on" size={20} color="#eb2f96" />
                    </View>
                    <Text style={styles.cardTitle}>AI建议</Text>
                  </View>
                  {analysisData.suggestions.map(renderSuggestion)}
                </Card.Content>
              </Card>
            )}

            {/* AI对话区域 */}
            <Card style={styles.chatCard}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: '#667eea15' }]}>
                    <MaterialCommunityIcons name="robot" size={20} color="#667eea" />
                  </View>
                  <Text style={styles.cardTitle}>AI助手</Text>
                </View>

                <View style={styles.chatContainer}>
                  {chatHistory.map(renderChatMessage)}

                  {isAsking && (
                    <View style={[styles.chatMessage, styles.aiMessage]}>
                      <Avatar.Icon size={32} icon="robot" style={styles.aiAvatar} />
                      <View style={[styles.messageBubble, styles.aiBubble]}>
                        <ActivityIndicator size="small" color="#667eea" />
                        <Text style={styles.thinkingText}>正在思考...</Text>
                      </View>
                    </View>
                  )}
                </View>
              </Card.Content>
            </Card>

            <View style={styles.bottomSpacing} />
          </Animated.View>
        </ScrollView>

        {/* 输入框 */}
        <Surface style={styles.inputContainer} elevation={4}>
          <TextInput
            style={styles.textInput}
            placeholder="输入问题，深入了解员工表现..."
            placeholderTextColor="#bfbfbf"
            value={question}
            onChangeText={setQuestion}
            multiline
            maxLength={500}
            editable={!isAsking}
          />
          <IconButton
            icon="send"
            iconColor="#fff"
            style={[
              styles.sendButton,
              (!question.trim() || isAsking) && styles.sendButtonDisabled,
            ]}
            onPress={handleAskQuestion}
            disabled={!question.trim() || isAsking}
          />
        </Surface>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#667eea',
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },

  // Loading & Error
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#424242',
    fontWeight: '500',
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#757575',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    marginTop: 16,
    fontSize: 15,
    color: '#ff4d4f',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 24,
    borderColor: '#667eea',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 15,
    color: '#8c8c8c',
  },

  // Profile Card
  profileCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileAvatar: {
    marginRight: 12,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#212121',
  },
  profileMeta: {
    fontSize: 13,
    color: '#757575',
    marginTop: 4,
  },
  profileTenure: {
    fontSize: 12,
    color: '#9e9e9e',
    marginTop: 2,
  },
  gradeContainer: {
    alignItems: 'center',
    padding: 8,
  },
  gradeText: {
    fontSize: 32,
    fontWeight: '700',
  },
  gradeLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  divider: {
    marginVertical: 16,
  },

  // Score Section
  scoreSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  mainScore: {
    alignItems: 'center',
  },
  subScores: {
    flexDirection: 'row',
    gap: 16,
  },
  scoreRing: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRingOuter: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scoreRingProgress: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 50,
    borderWidth: 4,
    borderLeftColor: 'transparent',
    borderTopColor: 'transparent',
  },
  scoreRingInner: {
    alignItems: 'center',
  },
  scoreRingValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  scoreRingLabel: {
    fontSize: 10,
    color: '#8c8c8c',
    marginTop: 2,
  },
  changeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '500',
    marginLeft: 4,
  },
  rankText: {
    fontSize: 13,
    color: '#8c8c8c',
    marginLeft: 4,
  },

  // Analysis Cards
  analysisCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#212121',
    marginLeft: 10,
  },
  scoreChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  detailItem: {
    width: '25%',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212121',
  },
  detailLabel: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 2,
  },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 10,
    borderRadius: 8,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
    lineHeight: 18,
  },

  // Skills
  skillCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  skillItem: {
    marginBottom: 12,
  },
  skillHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
  },
  proficiencyChip: {
    height: 24,
  },
  proficiencyText: {
    fontSize: 10,
  },
  proficiencyMaster: {
    backgroundColor: '#f6ffed',
  },
  proficiencySkilled: {
    backgroundColor: '#e6f7ff',
  },
  proficiencyLearning: {
    backgroundColor: '#fff7e6',
  },
  proficiencyBeginner: {
    backgroundColor: '#f5f5f5',
  },
  skillProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  skillPercentage: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
    marginLeft: 8,
    width: 36,
  },
  skillHours: {
    fontSize: 11,
    color: '#8c8c8c',
    marginTop: 4,
  },

  // Suggestions
  suggestionCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  suggestionContent: {
    flex: 1,
    marginLeft: 10,
  },
  suggestionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  suggestionType: {
    fontSize: 12,
    fontWeight: '600',
    marginRight: 6,
  },
  suggestionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#424242',
  },
  suggestionDesc: {
    fontSize: 13,
    color: '#757575',
    lineHeight: 18,
  },

  // Chat
  chatCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  chatContainer: {
    minHeight: 100,
  },
  chatMessage: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  aiMessage: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: SCREEN_WIDTH * 0.65,
    padding: 12,
    borderRadius: 12,
  },
  userBubble: {
    backgroundColor: '#667eea',
    borderTopRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#f5f5f5',
    borderTopLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  aiAvatar: {
    backgroundColor: '#667eea',
    marginRight: 8,
  },
  userAvatar: {
    backgroundColor: '#1890ff',
    marginLeft: 8,
  },
  thinkingText: {
    fontSize: 13,
    color: '#8c8c8c',
    marginLeft: 8,
  },

  // Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#212121',
  },
  sendButton: {
    backgroundColor: '#667eea',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: '#d9d9d9',
  },

  bottomSpacing: {
    height: 24,
  },
});
