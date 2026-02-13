/**
 * Factory Admin 首页 Dashboard
 * 包含: 欢迎区 + AI洞察卡片 + 4个统计卡片 + 快捷操作
 * 支持 iPhone 风格的长按编辑模式
 */
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Vibration,
  Alert,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { FAHomeStackParamList } from '../../../types/navigation';
import { useAuthStore } from '../../../store/authStore';
import { dashboardAPI, DashboardOverviewData, AlertsDashboardData } from '../../../services/api/dashboardApiClient';
import { aiApiClient } from '../../../services/api/aiApiClient';
import { useHomeLayoutStore } from '../../../store/homeLayoutStore';
import { useFactoryFeatureStore } from '../../../store/factoryFeatureStore';
import type { HomeModule, StatCardConfig, QuickActionConfig } from '../../../types/decoration';
import { DEFAULT_HOME_LAYOUT } from '../../../types/decoration';
import { useShallow } from 'zustand/react/shallow';

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'FAHome'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * iPhone 风格抖动卡片组件
 */
interface ShakingCardProps {
  isShaking: boolean;
  children: React.ReactNode;
  style?: object;
  delay?: number;
}

function ShakingCard({ isShaking, children, style, delay = 0 }: ShakingCardProps) {
  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  useEffect(() => {
    if (isShaking) {
      // 随机延迟，让不同卡片抖动不同步
      const startShake = () => {
        rotation.value = withRepeat(
          withSequence(
            withTiming(-2, { duration: 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(2, { duration: 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(-1.5, { duration: 80, easing: Easing.inOut(Easing.ease) }),
            withTiming(1.5, { duration: 80, easing: Easing.inOut(Easing.ease) }),
          ),
          -1, // 无限重复
          false
        );
        scale.value = withTiming(0.98, { duration: 200 });
      };

      const timer = setTimeout(startShake, delay);
      return () => clearTimeout(timer);
    }

    cancelAnimation(rotation);
    rotation.value = withTiming(0, { duration: 150 });
    scale.value = withTiming(1, { duration: 150 });
    return undefined;
  }, [isShaking, delay, rotation, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${rotation.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

// 统计卡片数据类型
interface StatCardData {
  id: string;  // 卡片唯一标识
  value: string | number;
  label: string;
  icon: string;
  color: string;
  trend?: string;
  onPress: () => void;
}

// AI 洞察数据类型
interface AIInsight {
  status: 'loading' | 'success' | 'error';
  message: string;
  metrics: {
    qualityRate: number;
    unitCost: number;
    avgCycle: number;
  };
}

export function FAHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const { isScreenEnabled } = useFactoryFeatureStore();
  const { t } = useTranslation('home');

  // 状态
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 编辑模式状态 (iPhone 风格)
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showAddModuleSheet, setShowAddModuleSheet] = useState(false);

  // 子项编辑弹窗状态
  const [showAddStatCardSheet, setShowAddStatCardSheet] = useState(false);
  const [showAddQuickActionSheet, setShowAddQuickActionSheet] = useState(false);
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);

  // 从 Store 读取布局数据 - 使用 useShallow 避免不必要的重渲染
  const { layout, draftModules, storeIsLoading } = useHomeLayoutStore(
    useShallow((state) => ({
      layout: state.layout,
      draftModules: state.draftModules,
      storeIsLoading: state.isLoading,
    }))
  );

  // Store actions - 这些不会导致重渲染
  const fetchLayout = useHomeLayoutStore(state => state.fetchLayout);
  const toggleModuleVisibilityStore = useHomeLayoutStore(state => state.toggleModuleVisibility);
  const saveDraft = useHomeLayoutStore(state => state.saveDraft);
  const startEditing = useHomeLayoutStore(state => state.startEditing);
  const cancelEditing = useHomeLayoutStore(state => state.cancelEditing);

  // 子项编辑 Store actions
  const toggleStatCardVisibility = useHomeLayoutStore(state => state.toggleStatCardVisibility);
  const toggleQuickActionVisibility = useHomeLayoutStore(state => state.toggleQuickActionVisibility);
  const addStatCard = useHomeLayoutStore(state => state.addStatCard);
  const addQuickAction = useHomeLayoutStore(state => state.addQuickAction);

  // 使用 useMemo 计算可见模块，避免每次渲染都创建新数组
  const layoutModules = layout?.modules || DEFAULT_HOME_LAYOUT;

  const visibleModules = useMemo(() => {
    const modules = isEditMode ? draftModules : layoutModules;
    return modules
      .filter((m) => m.visible)
      .sort((a, b) => a.order - b.order);
  }, [isEditMode, draftModules, layoutModules]);

  // 当前使用的模块列表
  const currentModules = isEditMode ? draftModules : visibleModules;

  // Dashboard 数据
  const [overviewData, setOverviewData] = useState<DashboardOverviewData | null>(null);
  const [alertsData, setAlertsData] = useState<AlertsDashboardData | null>(null);

  // AI 洞察 (本地计算，简化显示)
  const [aiInsight, setAIInsight] = useState<AIInsight>({
    status: 'loading',
    message: t('ai.analyzing'),
    metrics: { qualityRate: 0, unitCost: 0, avgCycle: 0 },
  });

  // 获取当前日期
  const getFormattedDate = () => {
    const now = new Date();
    const weekDays = [
      t('date.weekdays.sun'), t('date.weekdays.mon'), t('date.weekdays.tue'),
      t('date.weekdays.wed'), t('date.weekdays.thu'), t('date.weekdays.fri'),
      t('date.weekdays.sat')
    ];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const weekDay = weekDays[now.getDay()];
    return `${month}${t('date.month')}${day}${t('date.day')} ${weekDay}`;
  };

  // 获取问候语
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('greetings.earlyMorning');
    if (hour < 9) return t('greetings.morning');
    if (hour < 12) return t('greetings.lateMorning');
    if (hour < 14) return t('greetings.noon');
    if (hour < 18) return t('greetings.afternoon');
    if (hour < 22) return t('greetings.evening');
    return t('greetings.lateNight');
  };

  // 加载 Dashboard 数据
  const loadDashboardData = useCallback(async () => {
    try {
      setError(null);

      // 并行获取数据，使用 Promise.allSettled 避免单个请求失败导致整体失败
      const [overviewResult, alertsResult] = await Promise.allSettled([
        dashboardAPI.getDashboardOverview('today'),
        dashboardAPI.getAlertsDashboard('week'),
      ]);

      // 处理 overview 数据
      if (overviewResult.status === 'fulfilled' && overviewResult.value.success && overviewResult.value.data) {
        setOverviewData(overviewResult.value.data);
      } else if (overviewResult.status === 'rejected') {
        console.warn('Dashboard overview 加载失败:', overviewResult.reason);
      }

      // 处理 alerts 数据（允许失败，不影响主面板显示）
      if (alertsResult.status === 'fulfilled' && alertsResult.value.success && alertsResult.value.data) {
        setAlertsData(alertsResult.value.data);
      } else if (alertsResult.status === 'rejected') {
        console.warn('Dashboard alerts 加载失败:', alertsResult.reason);
      }

      // AI 洞察：使用后端真实数据 + 获取AI报告摘要
      const resolvedOverview = overviewResult.status === 'fulfilled' ? overviewResult.value.data : null;
      if (resolvedOverview) {
        const kpi = resolvedOverview.kpi;
        const qualityRate = kpi?.qualityPassRate ?? 98.5;
        const efficiency = kpi?.productionEfficiency ?? 92;
        // 使用后端计算的真实数据
        const unitCost = kpi?.unitCost ?? 0;
        const avgCycle = kpi?.avgCycleHours ?? 0;

        // 尝试获取最新AI报告摘要作为洞察文字
        let insightMessage: string = t('ai.normalProduction');
        let useLocalRule = true;
        try {
          const reportsRes = await aiApiClient.getReports({ reportType: 'custom' });
          if (reportsRes?.reports && reportsRes.reports.length > 0) {
            // 获取最新报告的标题作为洞察摘要
            const latestReport = reportsRes.reports[0];
            const title = latestReport?.title;
            if (title && title.length > 10) {
              insightMessage = title;
              useLocalRule = false;
            }
          }
        } catch (aiError) {
          console.log('获取AI报告摘要失败，使用本地规则生成', aiError);
        }

        // 如果没有AI报告，使用本地规则生成洞察文字
        if (useLocalRule) {
          if (qualityRate < 95) {
            insightMessage = t('ai.lowQualityRate');
          } else if (efficiency < 85) {
            insightMessage = t('ai.lowEfficiency');
          } else if (qualityRate >= 98 && efficiency >= 95) {
            insightMessage = t('ai.excellentStatus');
          }
        }

        setAIInsight({
          status: 'success',
          message: insightMessage,
          metrics: {
            qualityRate,
            unitCost,
            avgCycle,
          },
        });
      } else {
        // overview 也失败时，显示错误
        setError(t('error.loadFailed'));
        setAIInsight({
          status: 'error',
          message: t('ai.noData'),
          metrics: { qualityRate: 0, unitCost: 0, avgCycle: 0 },
        });
      }
    } catch (err) {
      console.error('加载 Dashboard 数据失败:', err);
      setError(t('error.loadFailed'));
      setAIInsight({
        status: 'error',
        message: t('ai.noData'),
        metrics: { qualityRate: 0, unitCost: 0, avgCycle: 0 },
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 初始加载 - 同时加载 Dashboard 数据和布局配置
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // 加载首页布局配置
  useEffect(() => {
    const factoryId = user?.factoryId;
    if (factoryId && !layout) {
      console.log('[FAHomeScreen] 加载布局配置, factoryId:', factoryId);
      fetchLayout(factoryId);
    }
  }, [user?.factoryId, layout, fetchLayout]);

  // 下拉刷新
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadDashboardData();
  }, [loadDashboardData]);

  // 计算涨幅百分比
  const calculateTrendPercent = (today: number | undefined, yesterday: number | undefined): string | undefined => {
    if (today === undefined || yesterday === undefined || yesterday === 0) {
      return undefined;
    }
    const change = ((today - yesterday) / yesterday) * 100;
    if (change > 0) {
      return `+${change.toFixed(0)}%`;
    } else if (change < 0) {
      return `${change.toFixed(0)}%`;
    }
    return undefined;
  };

  // 计算涨幅差值
  const calculateTrendDiff = (today: number | undefined, yesterday: number | undefined): string | undefined => {
    if (today === undefined || yesterday === undefined) {
      return undefined;
    }
    const diff = today - yesterday;
    if (diff > 0) {
      return `+${diff}`;
    } else if (diff < 0) {
      return `${diff}`;
    }
    return undefined;
  };

  // 统计卡片数据
  const getStatCards = (): StatCardData[] => {
    const todayStats = overviewData?.todayStats;
    const yesterdayStats = overviewData?.yesterdayStats;
    const alertsSummary = alertsData?.summary;

    // 计算产量涨幅
    const outputTrend = calculateTrendPercent(
      todayStats?.todayOutputKg,
      yesterdayStats?.outputKg
    );

    // 计算批次涨幅
    const batchTrend = calculateTrendDiff(
      todayStats?.totalBatches,
      yesterdayStats?.totalBatches
    );

    // Screen guard mapping for stat cards
    const statCardScreenGuard: Record<string, string> = {
      todayAlerts: 'AIAlerts',
    };

    return [
      {
        id: 'todayProduction',
        value: todayStats?.todayOutputKg?.toFixed(0) ?? '--',
        label: t('stats.todayOutput'),
        icon: 'scale',
        color: '#667eea',
        trend: outputTrend,
        onPress: () => navigation.navigate('TodayProduction'),
      },
      {
        id: 'todayBatches',
        value: todayStats?.totalBatches ?? overviewData?.summary?.totalBatches ?? '--',
        label: t('stats.todayBatches'),
        icon: 'package-variant',
        color: '#48bb78',
        trend: batchTrend,
        onPress: () => navigation.navigate('TodayBatches'),
      },
      {
        id: 'materialBatches',
        value: todayStats?.totalMaterialBatches ?? todayStats?.materialReceived ?? '--',
        label: t('stats.materialBatches'),
        icon: 'truck-delivery',
        color: '#ed8936',
        onPress: () => navigation.navigate('MaterialBatch'),
      },
      {
        id: 'todayAlerts',
        value: alertsSummary?.activeAlerts ?? overviewData?.summary?.activeAlerts ?? '--',
        label: t('stats.todayAlerts'),
        icon: 'alert-circle',
        color: alertsSummary?.criticalAlerts && alertsSummary.criticalAlerts > 0 ? '#e53e3e' : '#a0aec0',
        onPress: () => navigation.navigate('AIAlerts'),
      },
    ].filter(card => {
      const screenName = statCardScreenGuard[card.id];
      return !screenName || isScreenEnabled(screenName);
    });
  };

  // 快捷操作数据已移至 renderQuickActionsModule 函数内部

  // 长按进入编辑模式 (iPhone 风格 - 直接进入)
  const handleLongPressEdit = useCallback(() => {
    if (isEditMode) return; // 已经在编辑模式

    // 震动反馈
    Vibration.vibrate(50);

    // 调用 store 的 startEditing，初始化 draftModules
    startEditing();

    // 直接进入编辑模式，模块开始抖动
    setIsEditMode(true);
    setHasChanges(false);
  }, [isEditMode, startEditing]);

  // 退出编辑模式
  const exitEditMode = useCallback(() => {
    if (hasChanges) {
      Alert.alert(
        t('layout.unsavedTitle', '未保存的更改'),
        t('layout.unsavedDesc', '您有未保存的更改，是否放弃？'),
        [
          { text: t('common.cancel', '取消'), style: 'cancel' },
          {
            text: t('layout.discard', '放弃更改'),
            style: 'destructive',
            onPress: () => {
              // 调用 store 的 cancelEditing，恢复到原始状态
              cancelEditing();
              setIsEditMode(false);
              setHasChanges(false);
            },
          },
        ]
      );
    } else {
      cancelEditing();
      setIsEditMode(false);
    }
  }, [hasChanges, t, cancelEditing]);

  // 保存布局更改 - 使用 store 的 saveDraft 方法
  const handleSaveLayout = useCallback(async () => {
    const factoryId = user?.factoryId;
    if (!factoryId) {
      Alert.alert(t('error.saveFailed', '保存失败'), '无法获取工厂ID');
      return;
    }

    try {
      await saveDraft(factoryId);
      Vibration.vibrate(30);
      setIsEditMode(false);
      setHasChanges(false);
      Alert.alert(t('layout.saveSuccess', '保存成功'), t('layout.saveSuccessDesc', '布局已保存'));
    } catch (err) {
      Alert.alert(t('error.saveFailed', '保存失败'), String(err));
    }
  }, [user?.factoryId, saveDraft, t]);

  // 跳转到高级编辑器
  const handleAdvancedEdit = useCallback(() => {
    setIsEditMode(false);
    navigation.navigate('HomeLayoutEditor');
  }, [navigation]);

  // 切换模块可见性 - 使用 store 的方法
  const toggleModuleVisibility = useCallback((moduleId: string) => {
    Vibration.vibrate(30);
    toggleModuleVisibilityStore(moduleId);
    setHasChanges(true);
  }, [toggleModuleVisibilityStore]);

  // 显示添加模块面板 - 使用 store 的模块数据
  const handleAddModule = useCallback(() => {
    // 从 draftModules 中找出隐藏的模块
    const hiddenModules = draftModules.filter(m => !m.visible);

    if (hiddenModules.length === 0) {
      Alert.alert(
        t('layout.addModule'),
        t('layout.noMoreModules')
      );
      return;
    }

    setShowAddModuleSheet(true);
  }, [draftModules, t]);

  // 获取模块显示名称
  const getModuleName = (moduleType: string) => {
    const names: Record<string, string> = {
      welcome: t('sections.welcome', '欢迎区'),
      ai_insight: t('ai.title'),
      stats_grid: t('sections.todayOverview'),
      quick_actions: t('sections.quickActions'),
      dev_tools: t('sections.devTools'),
    };
    return names[moduleType] || moduleType;
  };

  // ========================================
  // 动态模块渲染函数 - 根据模块类型渲染对应内容
  // ========================================

  // 渲染 AI 洞察模块
  const renderAIInsightModule = (module: HomeModule, index: number) => (
    <ShakingCard key={module.id} isShaking={isEditMode} delay={index * 50} style={{ margin: 16 }}>
      <TouchableOpacity
        style={styles.aiCard}
        onLongPress={handleLongPressEdit}
        delayLongPress={500}
        activeOpacity={isEditMode ? 1 : 0.95}
      >
        {isEditMode && (
          <TouchableOpacity
            style={styles.aiEditBadge}
            onPress={() => toggleModuleVisibility(module.id)}
          >
            <Icon source="minus-circle" size={22} color="#fff" />
          </TouchableOpacity>
        )}
        <View style={styles.aiHeader}>
          <View style={styles.aiTitleRow}>
            <Icon source="robot" size={20} color="#fff" />
            <Text style={styles.aiTitle}>{module.name || t('ai.title')}</Text>
          </View>
          <View style={[
            styles.aiStatusBadge,
            aiInsight.status === 'success' ? styles.aiStatusSuccess : styles.aiStatusLoading
          ]}>
            <Text style={styles.aiStatusText}>
              {aiInsight.status === 'success' ? t('ai.analyzed') : t('ai.analyzing_status')}
            </Text>
          </View>
        </View>

        <Text style={styles.aiMessage}>{aiInsight.message}</Text>

        {/* AI 指标 - 可从 module.config 配置 */}
        <View style={styles.aiMetrics}>
          {(!module.config?.metricsToShow || module.config.metricsToShow.includes('qualityRate')) && (
            <>
              <View style={styles.aiMetricItem}>
                <Text style={styles.aiMetricValue}>
                  {aiInsight.metrics.qualityRate.toFixed(1)}%
                </Text>
                <Text style={styles.aiMetricLabel}>{t('ai.metrics.qualityRate')}</Text>
              </View>
              <View style={styles.aiMetricDivider} />
            </>
          )}
          {(!module.config?.metricsToShow || module.config.metricsToShow.includes('unitCost')) && (
            <>
              <View style={styles.aiMetricItem}>
                <Text style={styles.aiMetricValue}>
                  ¥{aiInsight.metrics.unitCost.toFixed(1)}
                </Text>
                <Text style={styles.aiMetricLabel}>{t('ai.metrics.unitCost')}</Text>
              </View>
              <View style={styles.aiMetricDivider} />
            </>
          )}
          {(!module.config?.metricsToShow || module.config.metricsToShow.includes('avgCycle')) && (
            <View style={styles.aiMetricItem}>
              <Text style={styles.aiMetricValue}>
                {aiInsight.metrics.avgCycle.toFixed(1)}h
              </Text>
              <Text style={styles.aiMetricLabel}>{t('ai.metrics.avgCycle')}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </ShakingCard>
  );

  // 渲染统计网格模块 - 从 config.cards 读取卡片配置
  const renderStatsModule = (module: HomeModule, index: number) => {
    // 获取所有统计卡片
    const allStatCards = getStatCards();

    // 从配置中获取卡片可见性设置
    const cardsConfig = module.config?.cards || [];

    // 黑名单逻辑：显示所有卡片，除了明确标记为 visible: false 的
    const hiddenCardIds = cardsConfig
      .filter((c: StatCardConfig) => c.visible === false)
      .map((c: StatCardConfig) => c.id);

    // 显示的卡片 = 所有卡片 - 隐藏的卡片
    const displayCards = allStatCards.filter((card) => !hiddenCardIds.includes(card.id));

    // 隐藏的卡片（用于添加弹窗）
    const hiddenCards = allStatCards.filter((card) => hiddenCardIds.includes(card.id));

    return (
      <ShakingCard key={module.id} isShaking={isEditMode} delay={index * 50} style={styles.statsSection}>
        {/* 编辑模式：模块级删除按钮 */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.sectionEditBadge}
            onPress={() => toggleModuleVisibility(module.id)}
          >
            <Icon source="minus-circle" size={20} color="#e53e3e" />
          </TouchableOpacity>
        )}

        {/* 标题栏：编辑模式下显示添加按钮 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{module.name || t('sections.todayOverview')}</Text>
          {isEditMode && hiddenCards.length > 0 && (
            <TouchableOpacity
              style={styles.addItemBtn}
              onPress={() => {
                setEditingModuleId(module.id);
                setShowAddStatCardSheet(true);
              }}
            >
              <Icon source="plus" size={16} color="#667eea" />
              <Text style={styles.addItemBtnText}>添加</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 卡片网格 */}
        <View style={styles.statsGrid}>
          {displayCards.map((card) => renderStatCardWithEdit(card, module.id))}
        </View>
      </ShakingCard>
    );
  };

  // 渲染带编辑功能的统计卡片
  const renderStatCardWithEdit = (card: StatCardData, moduleId: string) => (
    <TouchableOpacity
      key={card.id}
      style={styles.statCard}
      onPress={isEditMode ? undefined : card.onPress}
      onLongPress={handleLongPressEdit}
      delayLongPress={500}
      activeOpacity={isEditMode ? 1 : 0.7}
    >
      {/* 编辑模式：卡片级删除按钮 */}
      {isEditMode && (
        <TouchableOpacity
          style={styles.cardDeleteBadge}
          onPress={() => toggleStatCardVisibility(moduleId, card.id)}
        >
          <Icon source="minus-circle" size={16} color="#e53e3e" />
        </TouchableOpacity>
      )}
      <View style={[styles.statIconWrapper, { backgroundColor: `${card.color}15` }]}>
        <Icon source={card.icon} size={24} color={card.color} />
      </View>
      <Text style={[styles.statValue, { color: card.color }]}>
        {card.value}
      </Text>
      <Text style={styles.statLabel}>{card.label}</Text>
      {card.trend && !isEditMode && (
        <View style={styles.trendBadge}>
          <Icon source="trending-up" size={12} color="#48bb78" />
          <Text style={styles.trendText}>{card.trend}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  // Screen guard mapping for quick actions
  const quickActionScreenGuard: Record<string, string> = {
    dataReport: 'AIReport',
    staffManagement: 'EmployeeList',
    inventory: 'InventoryList',
    qualityCheck: 'QualityCheck',
    systemConfig: 'SystemSettings',
  };

  // 所有可用的快捷操作（用于添加弹窗）
  const allQuickActions = [
    {
      id: 'newBatch',
      icon: 'plus-circle',
      label: t('quickActions.createPlan'),
      color: '#667eea',
      onPress: () => {
        navigation.getParent()?.navigate('FAAITab', { screen: 'CreatePlan' });
      },
    },
    {
      id: 'dataReport',
      icon: 'chart-line',
      label: t('quickActions.dataReport'),
      color: '#48bb78',
      onPress: () => {
        navigation.getParent()?.navigate('FAAITab', { screen: 'AIReport' });
      },
    },
    {
      id: 'staffManagement',
      icon: 'account-group',
      label: t('quickActions.staffManagement'),
      color: '#ed8936',
      onPress: () => {
        navigation.getParent()?.navigate('FAManagementTab', { screen: 'EmployeeList' });
      },
    },
    {
      id: 'systemConfig',
      icon: 'cog',
      label: t('quickActions.systemConfig'),
      color: '#805ad5',
      onPress: () => {
        navigation.getParent()?.navigate('FAProfileTab', { screen: 'SystemSettings' });
      },
    },
    {
      id: 'inventory',
      icon: 'warehouse',
      label: '库存查看',
      color: '#38b2ac',
      onPress: () => {
        navigation.getParent()?.navigate('FAManagementTab', { screen: 'InventoryList' });
      },
    },
    {
      id: 'qualityCheck',
      icon: 'clipboard-check',
      label: '质检管理',
      color: '#e53e3e',
      onPress: () => {
        navigation.getParent()?.navigate('FAManagementTab', { screen: 'QualityCheck' });
      },
    },
  ].filter(action => {
    const screenName = quickActionScreenGuard[action.id];
    return !screenName || isScreenEnabled(screenName);
  });

  // 渲染快捷操作模块 - 从 config.actions 读取操作配置
  const renderQuickActionsModule = (module: HomeModule, index: number) => {
    // 从配置中获取操作可见性设置
    const actionsConfig = module.config?.actions || [];

    // 黑名单逻辑：显示所有操作，除了明确标记为 visible: false 的
    const hiddenActionIds = actionsConfig
      .filter((a: QuickActionConfig) => a.visible === false)
      .map((a: QuickActionConfig) => a.id);

    // 显示的操作 = 默认前4个操作 - 隐藏的操作
    const defaultActions = allQuickActions.slice(0, 4);
    const displayActions = defaultActions.filter((action) => !hiddenActionIds.includes(action.id));

    // 隐藏的操作（用于添加弹窗）= 被隐藏的默认操作 + 额外的可添加操作
    const hiddenActions = allQuickActions.filter((action) => {
      // 被明确隐藏的
      if (hiddenActionIds.includes(action.id)) return true;
      // 不在默认4个中的额外操作（可以添加）
      if (!defaultActions.some(da => da.id === action.id)) return true;
      return false;
    });

    // 限制最大显示数量
    const maxItems = module.config?.maxItems || 4;
    const finalActions = displayActions.slice(0, maxItems);

    return (
      <ShakingCard key={module.id} isShaking={isEditMode} delay={index * 50} style={styles.quickActionsSection}>
        {/* 编辑模式：模块级删除按钮 */}
        {isEditMode && (
          <TouchableOpacity
            style={styles.sectionEditBadge}
            onPress={() => toggleModuleVisibility(module.id)}
          >
            <Icon source="minus-circle" size={20} color="#e53e3e" />
          </TouchableOpacity>
        )}

        {/* 标题栏：编辑模式下显示添加按钮 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{module.name || t('sections.quickActions')}</Text>
          {isEditMode && hiddenActions.length > 0 && (
            <TouchableOpacity
              style={styles.addItemBtn}
              onPress={() => {
                setEditingModuleId(module.id);
                setShowAddQuickActionSheet(true);
              }}
            >
              <Icon source="plus" size={16} color="#667eea" />
              <Text style={styles.addItemBtnText}>添加</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* 操作网格 */}
        <View style={styles.quickActionsGrid}>
          {finalActions.map((action) => renderQuickActionWithEdit(action, module.id))}
        </View>
      </ShakingCard>
    );
  };

  // 渲染带编辑功能的快捷操作
  const renderQuickActionWithEdit = (action: QuickActionItem, moduleId: string) => (
    <TouchableOpacity
      key={action.id}
      style={styles.quickAction}
      onPress={isEditMode ? undefined : action.onPress}
      onLongPress={handleLongPressEdit}
      delayLongPress={500}
      activeOpacity={isEditMode ? 1 : 0.7}
    >
      {/* 编辑模式：操作级删除按钮 */}
      {isEditMode && (
        <TouchableOpacity
          style={styles.actionDeleteBadge}
          onPress={() => toggleQuickActionVisibility(moduleId, action.id)}
        >
          <Icon source="minus-circle" size={16} color="#e53e3e" />
        </TouchableOpacity>
      )}
      <View style={[styles.quickActionIcon, { backgroundColor: `${action.color}15` }]}>
        <Icon source={action.icon} size={28} color={action.color} />
      </View>
      <Text style={styles.quickActionLabel}>{action.label}</Text>
    </TouchableOpacity>
  );

  // 渲染开发者工具模块
  const renderDevToolsModule = (module: HomeModule, index: number) => {
    if (!__DEV__) return null;

    return (
      <ShakingCard key={module.id} isShaking={isEditMode} delay={index * 50} style={styles.quickActionsSection}>
        {isEditMode && (
          <TouchableOpacity
            style={styles.sectionEditBadge}
            onPress={() => toggleModuleVisibility(module.id)}
          >
            <Icon source="minus-circle" size={20} color="#e53e3e" />
          </TouchableOpacity>
        )}
        <Text style={styles.sectionTitle}>{module.name || t('sections.devTools')}</Text>
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: '#8B5CF6' }]}
          onPress={() => navigation.navigate('FormilyDemo')}
          activeOpacity={0.8}
        >
          <Icon source="form-select" size={24} color="#fff" />
          <Text style={styles.quickActionLabel}>{t('quickActions.formilyDemo')}</Text>
        </TouchableOpacity>
      </ShakingCard>
    );
  };

  // 根据模块类型动态渲染
  const renderModuleByType = (module: HomeModule, index: number) => {
    switch (module.type) {
      case 'ai_insight':
        return renderAIInsightModule(module, index);
      case 'stats_grid':
        return renderStatsModule(module, index);
      case 'quick_actions':
        return renderQuickActionsModule(module, index);
      case 'dev_tools':
        return renderDevToolsModule(module, index);
      case 'welcome':
        // 欢迎区已经在顶部固定渲染，这里跳过
        return null;
      default:
        return null;
    }
  };

  // 快捷操作项类型
  type QuickActionItem = {
    id: string;
    icon: string;
    label: string;
    color: string;
    onPress: () => void;
  };

  // 加载状态
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // 错误状态
  if (error && !overviewData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="cloud-off-outline" size={48} color="#C0C4CC" />
          <Text style={[styles.loadingText, { color: '#606266', marginTop: 12 }]}>{error}</Text>
          <TouchableOpacity
            style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 8, backgroundColor: '#667eea', borderRadius: 6 }}
            onPress={() => loadData()}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '500' }}>重试</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
      >
        {/* 欢迎区 */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeLeft}>
            <Text style={styles.greeting}>
              {getGreeting()}，{user?.username ?? t('greetings.defaultUser')}
            </Text>
            <Text style={styles.dateText}>{getFormattedDate()}</Text>
          </View>
          <View style={styles.welcomeRight}>
            {/* 编辑布局按钮 */}
            <TouchableOpacity
              style={styles.editLayoutBtn}
              onPress={() => navigation.navigate('HomeLayoutEditor')}
            >
              <Icon source="view-dashboard-edit-outline" size={22} color="#667eea" />
            </TouchableOpacity>
            {/* 通知按钮 */}
            <TouchableOpacity style={styles.notificationBtn}>
              <Icon source="bell-outline" size={24} color="#666" />
              {(alertsData?.summary?.activeAlerts ?? 0) > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {alertsData?.summary?.activeAlerts}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 错误提示 */}
        {error && (
          <View style={styles.errorBanner}>
            <Icon source="alert-circle" size={20} color="#e53e3e" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* 动态渲染模块列表 - 从 Store 读取并按 order 排序 */}
        {currentModules
          .filter(m => m.visible)
          .sort((a, b) => a.order - b.order)
          .map((module, index) => renderModuleByType(module, index))}

        {/* 底部间距 - 编辑模式下需要更多空间给工具栏 */}
        <View style={{ height: isEditMode ? 100 : 32 }} />
      </ScrollView>

      {/* 编辑模式浮动工具栏 */}
      {isEditMode && (
        <View style={styles.editToolbar}>
          <View style={styles.editToolbarInner}>
            {/* 取消按钮 */}
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarBtnCancel]}
              onPress={exitEditMode}
            >
              <Icon source="close" size={20} color="#666" />
              <Text style={styles.toolbarBtnCancelText}>
                {t('common.cancel')}
              </Text>
            </TouchableOpacity>

            {/* 添加模块按钮 */}
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarBtnAdd]}
              onPress={handleAddModule}
            >
              <Icon source="plus" size={20} color="#48bb78" />
              <Text style={styles.toolbarBtnAddText}>
                {t('layout.addModule')}
              </Text>
            </TouchableOpacity>

            {/* 保存按钮 */}
            <TouchableOpacity
              style={[styles.toolbarBtn, styles.toolbarBtnSave]}
              onPress={handleSaveLayout}
            >
              <Icon source="check" size={20} color="#fff" />
              <Text style={styles.toolbarBtnSaveText}>
                {t('layout.done')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 高级编辑链接 */}
          <TouchableOpacity onPress={handleAdvancedEdit} style={styles.advancedLink}>
            <Text style={styles.advancedLinkText}>
              {t('layout.advancedEdit')} →
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 添加模块面板 - 显示隐藏的模块 */}
      {showAddModuleSheet && (
        <View style={styles.addModuleOverlay}>
          <TouchableOpacity
            style={styles.addModuleBackdrop}
            onPress={() => setShowAddModuleSheet(false)}
            activeOpacity={1}
          />
          <View style={styles.addModuleSheet}>
            <View style={styles.addModuleHeader}>
              <Text style={styles.addModuleTitle}>{t('layout.availableModules')}</Text>
              <TouchableOpacity onPress={() => setShowAddModuleSheet(false)}>
                <Icon source="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.addModuleList}>
              {draftModules
                .filter(m => !m.visible)
                .map((module) => (
                  <TouchableOpacity
                    key={module.id}
                    style={styles.addModuleItem}
                    onPress={() => {
                      toggleModuleVisibility(module.id);
                      setShowAddModuleSheet(false);
                    }}
                  >
                    <Icon source="plus-circle" size={24} color="#48bb78" />
                    <Text style={styles.addModuleItemText}>{module.name || getModuleName(module.type)}</Text>
                  </TouchableOpacity>
                ))}
            </View>
          </View>
        </View>
      )}

      {/* 添加统计卡片弹窗 */}
      {showAddStatCardSheet && editingModuleId && (
        <View style={styles.addModuleOverlay}>
          <TouchableOpacity
            style={styles.addModuleBackdrop}
            onPress={() => {
              setShowAddStatCardSheet(false);
              setEditingModuleId(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.addModuleSheet}>
            <View style={styles.addModuleHeader}>
              <Text style={styles.addModuleTitle}>添加统计卡片</Text>
              <TouchableOpacity onPress={() => {
                setShowAddStatCardSheet(false);
                setEditingModuleId(null);
              }}>
                <Icon source="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.addModuleList}>
              {(() => {
                const module = draftModules.find(m => m.id === editingModuleId);
                const cardsConfig = module?.config?.cards || [];
                const allCards = getStatCards();
                const hiddenCards = allCards.filter((card) => {
                  const config = cardsConfig.find((c: StatCardConfig) => c.id === card.id);
                  return config && config.visible === false;
                });

                return hiddenCards.map((card) => (
                  <TouchableOpacity
                    key={card.id}
                    style={styles.addModuleItem}
                    onPress={() => {
                      addStatCard(editingModuleId, card.id);
                      setShowAddStatCardSheet(false);
                      setEditingModuleId(null);
                    }}
                  >
                    <View style={[styles.addItemIcon, { backgroundColor: `${card.color}15` }]}>
                      <Icon source={card.icon} size={20} color={card.color} />
                    </View>
                    <Text style={styles.addModuleItemText}>{card.label}</Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>
        </View>
      )}

      {/* 添加快捷操作弹窗 */}
      {showAddQuickActionSheet && editingModuleId && (
        <View style={styles.addModuleOverlay}>
          <TouchableOpacity
            style={styles.addModuleBackdrop}
            onPress={() => {
              setShowAddQuickActionSheet(false);
              setEditingModuleId(null);
            }}
            activeOpacity={1}
          />
          <View style={styles.addModuleSheet}>
            <View style={styles.addModuleHeader}>
              <Text style={styles.addModuleTitle}>添加快捷操作</Text>
              <TouchableOpacity onPress={() => {
                setShowAddQuickActionSheet(false);
                setEditingModuleId(null);
              }}>
                <Icon source="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            <View style={styles.addModuleList}>
              {(() => {
                const module = draftModules.find(m => m.id === editingModuleId);
                const actionsConfig = module?.config?.actions || [];
                const visibleActionIds = actionsConfig
                  .filter((a: QuickActionConfig) => a.visible !== false)
                  .map((a: QuickActionConfig) => a.id);

                // 找出所有可添加的操作
                const addableActions = allQuickActions.filter((action) => {
                  const config = actionsConfig.find((a: QuickActionConfig) => a.id === action.id);
                  return (config && config.visible === false) ||
                         (visibleActionIds.length > 0 && !visibleActionIds.includes(action.id));
                });

                return addableActions.map((action) => (
                  <TouchableOpacity
                    key={action.id}
                    style={styles.addModuleItem}
                    onPress={() => {
                      addQuickAction(editingModuleId, action.id);
                      setShowAddQuickActionSheet(false);
                      setEditingModuleId(null);
                    }}
                  >
                    <View style={[styles.addItemIcon, { backgroundColor: `${action.color}15` }]}>
                      <Icon source={action.icon} size={20} color={action.color} />
                    </View>
                    <Text style={styles.addModuleItemText}>{action.label}</Text>
                  </TouchableOpacity>
                ));
              })()}
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  // 欢迎区
  welcomeSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  welcomeLeft: {
    flex: 1,
  },
  welcomeRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editLayoutBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f4ff',
  },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    color: '#1a202c',
  },
  dateText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f7fafc',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#e53e3e',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },

  // 错误提示
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fed7d7',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#c53030',
  },

  // AI 洞察卡片
  aiCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#667eea',
  },
  aiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  aiTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  aiStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  aiStatusSuccess: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  aiStatusLoading: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  aiStatusText: {
    fontSize: 12,
    color: '#fff',
  },
  aiMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    lineHeight: 22,
    marginBottom: 16,
  },
  aiMetrics: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  aiMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  aiMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  aiMetricLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  aiMetricDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // 统计卡片
  statsSection: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a202c',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#c6f6d5',
    borderRadius: 8,
  },
  trendText: {
    fontSize: 11,
    color: '#276749',
    marginLeft: 4,
    fontWeight: '500',
  },

  // 快捷操作
  quickActionsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '23%',
    alignItems: 'center',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    color: '#4a5568',
    textAlign: 'center',
  },
  quickActionInner: {
    alignItems: 'center',
  },

  // 编辑模式样式
  statCardInner: {
    flex: 1,
    width: '100%',
  },
  editBadge: {
    position: 'absolute',
    top: -8,
    left: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  aiEditBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // 编辑工具栏
  editToolbar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  editToolbarInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  toolbarBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  toolbarBtnCancel: {
    backgroundColor: '#f5f5f5',
  },
  toolbarBtnCancelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  toolbarBtnAdvanced: {
    backgroundColor: '#f0f4ff',
  },
  toolbarBtnAdvancedText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667eea',
  },
  toolbarBtnSave: {
    backgroundColor: '#667eea',
  },
  toolbarBtnSaveText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  editHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 10,
  },
  sectionEditBadge: {
    position: 'absolute',
    top: -8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  toolbarBtnAdd: {
    backgroundColor: '#e6ffed',
  },
  toolbarBtnAddText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#48bb78',
  },
  advancedLink: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 4,
  },
  advancedLinkText: {
    fontSize: 13,
    color: '#667eea',
  },

  // 添加模块面板
  addModuleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  addModuleBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  addModuleSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  addModuleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  addModuleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a202c',
  },
  addModuleList: {
    gap: 12,
  },
  addModuleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    gap: 12,
  },
  addModuleItemText: {
    fontSize: 16,
    color: '#2d3748',
  },

  // 模块标题栏（带添加按钮）
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  // 添加子项按钮
  addItemBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#667eea15',
    borderRadius: 16,
    gap: 4,
  },
  addItemBtnText: {
    fontSize: 13,
    color: '#667eea',
    fontWeight: '500',
  },

  // 卡片级删除按钮
  cardDeleteBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#fff',
    borderRadius: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  // 操作级删除按钮
  actionDeleteBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#fff',
    borderRadius: 10,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },

  // 添加弹窗中的图标
  addItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default FAHomeScreen;
