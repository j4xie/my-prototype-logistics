/**
 * HomeLayoutEditorScreen - 首页布局编辑器
 * 整合 BentoGridEditor 和 AILayoutAssistant 组件
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { BentoGridEditor } from './components/BentoGridEditor';
import { AILayoutAssistant } from './components/AILayoutAssistant';
import useHomeLayoutStore, {
  useLayoutEditState,
  useUndoRedo,
  useLayoutActions,
} from '../../../store/homeLayoutStore';
import { useAuthStore } from '../../../store/authStore';
import type { FAHomeStackParamList } from '../../../types/navigation';
import type { HomeModule, ThemeConfig, TimeSlot } from '../../../types/decoration';

// ============================================
// 类型定义
// ============================================

type NavigationProp = NativeStackNavigationProp<FAHomeStackParamList, 'HomeLayoutEditor'>;
type RouteProps = RouteProp<FAHomeStackParamList, 'HomeLayoutEditor'>;

interface TimeSlotTab {
  id: TimeSlot;
  label: string;
  timeRange?: string;
}

// ============================================
// 常量
// ============================================

const TIME_SLOT_TABS: TimeSlotTab[] = [
  { id: 'default', label: '默认' },
  { id: 'morning', label: '早间', timeRange: '6-12点' },
  { id: 'afternoon', label: '午间', timeRange: '12-18点' },
  { id: 'evening', label: '晚间', timeRange: '18-24点' },
];

// ============================================
// 主组件
// ============================================

export function HomeLayoutEditorScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { user } = useAuthStore();

  // Store状态
  const {
    draftModules,
    draftTheme,
    currentTimeSlot,
    layout,
    switchTimeSlot,
    fetchLayout,
  } = useHomeLayoutStore();

  const { isEditing, hasUnsavedChanges, isLoading, error } = useLayoutEditState();
  const { canUndo, canRedo, undo, redo } = useUndoRedo();
  const {
    startEditing,
    cancelEditing,
    saveDraft,
    publishLayout,
    resetToDefault,
    applyAILayout,
  } = useLayoutActions();

  // 本地状态
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // 获取工厂ID
  const factoryId = user?.factoryId || '';

  // 初始化
  useEffect(() => {
    if (factoryId) {
      fetchLayout(factoryId).catch(console.error);
    }
    startEditing();

    return () => {
      // 清理时如果有未保存的更改，提示用户
      // (由导航监听器处理)
    };
  }, [factoryId]);

  // 处理返回
  const handleClose = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        '放弃更改？',
        '你有未保存的更改，确定要离开吗？',
        [
          { text: '继续编辑', style: 'cancel' },
          {
            text: '放弃更改',
            style: 'destructive',
            onPress: () => {
              cancelEditing();
              navigation.goBack();
            },
          },
        ]
      );
    } else {
      cancelEditing();
      navigation.goBack();
    }
  }, [hasUnsavedChanges, cancelEditing, navigation]);

  // 处理布局变更
  const handleLayoutChange = useCallback((modules: HomeModule[]) => {
    // 直接更新store中的draftModules
    useHomeLayoutStore.setState({
      draftModules: modules,
      hasUnsavedChanges: true,
    });
  }, []);

  // 处理时段切换
  const handleTimeSlotChange = useCallback((slot: TimeSlot) => {
    switchTimeSlot(slot);
  }, [switchTimeSlot]);

  // 处理AI布局应用
  const handleApplyAILayout = useCallback((modules: HomeModule[], theme?: ThemeConfig) => {
    applyAILayout(modules, theme);
    setShowAIAssistant(false);
    Alert.alert('应用成功', 'AI生成的布局已应用，记得保存哦！');
  }, [applyAILayout]);

  // 处理撤销
  const handleUndo = useCallback(() => {
    if (canUndo) {
      undo();
    }
  }, [canUndo, undo]);

  // 处理重做
  const handleRedo = useCallback(() => {
    if (canRedo) {
      redo();
    }
  }, [canRedo, redo]);

  // 处理重置
  const handleReset = useCallback(() => {
    Alert.alert(
      '重置布局',
      '确定要重置为默认布局吗？这将丢失所有自定义更改。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '重置',
          style: 'destructive',
          onPress: () => {
            resetToDefault();
          },
        },
      ]
    );
  }, [resetToDefault]);

  // 处理保存草稿
  const handleSaveDraft = useCallback(async () => {
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息');
      return;
    }

    setIsSaving(true);
    try {
      await saveDraft(factoryId);
      Alert.alert('保存成功', '布局已保存为草稿');
    } catch (err) {
      const message = err instanceof Error ? err.message : '保存失败';
      Alert.alert('保存失败', message);
    } finally {
      setIsSaving(false);
    }
  }, [factoryId, saveDraft]);

  // 处理发布
  const handlePublish = useCallback(async () => {
    if (!factoryId) {
      Alert.alert('错误', '无法获取工厂信息');
      return;
    }

    // 先保存
    if (hasUnsavedChanges) {
      Alert.alert(
        '需要先保存',
        '发布前需要先保存当前更改，是否继续？',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '保存并发布',
            onPress: async () => {
              try {
                setIsSaving(true);
                await saveDraft(factoryId);
                setIsSaving(false);
                setIsPublishing(true);
                await publishLayout(factoryId);
                Alert.alert('发布成功', '布局已发布，用户现在可以看到新布局了！');
                navigation.goBack();
              } catch (err) {
                const message = err instanceof Error ? err.message : '操作失败';
                Alert.alert('操作失败', message);
              } finally {
                setIsSaving(false);
                setIsPublishing(false);
              }
            },
          },
        ]
      );
      return;
    }

    setIsPublishing(true);
    try {
      await publishLayout(factoryId);
      Alert.alert('发布成功', '布局已发布，用户现在可以看到新布局了！');
      navigation.goBack();
    } catch (err) {
      const message = err instanceof Error ? err.message : '发布失败';
      Alert.alert('发布失败', message);
    } finally {
      setIsPublishing(false);
    }
  }, [factoryId, hasUnsavedChanges, saveDraft, publishLayout, navigation]);

  // 检查时段布局是否启用
  const isTimeSlotEnabled = layout?.timeBasedEnabled || false;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon source="close" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>首页布局编辑</Text>
            {hasUnsavedChanges && (
              <View style={styles.unsavedBadge}>
                <Text style={styles.unsavedText}>未保存</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {layout?.status === 'published' && (
            <View style={styles.publishedBadge}>
              <Icon source="check-circle" size={14} color="#10B981" />
              <Text style={styles.publishedText}>已发布</Text>
            </View>
          )}
        </View>
      </View>

      {/* 时段切换Tab */}
      <View style={styles.timeSlotContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.timeSlotScroll}
        >
          {TIME_SLOT_TABS.map((tab) => {
            const isActive = currentTimeSlot === tab.id;
            const isDisabled = tab.id !== 'default' && !isTimeSlotEnabled;

            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.timeSlotTab,
                  isActive && styles.timeSlotTabActive,
                  isDisabled && styles.timeSlotTabDisabled,
                ]}
                onPress={() => !isDisabled && handleTimeSlotChange(tab.id)}
                disabled={isDisabled}
              >
                <Text
                  style={[
                    styles.timeSlotLabel,
                    isActive && styles.timeSlotLabelActive,
                    isDisabled && styles.timeSlotLabelDisabled,
                  ]}
                >
                  {tab.label}
                </Text>
                {tab.timeRange && (
                  <Text
                    style={[
                      styles.timeSlotRange,
                      isActive && styles.timeSlotRangeActive,
                      isDisabled && styles.timeSlotRangeDisabled,
                    ]}
                  >
                    {tab.timeRange}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* 时段布局提示 */}
        {!isTimeSlotEnabled && currentTimeSlot !== 'default' && (
          <View style={styles.timeSlotHint}>
            <Icon source="information" size={16} color="#F59E0B" />
            <Text style={styles.timeSlotHintText}>
              时段布局未启用，请在设置中开启
            </Text>
          </View>
        )}
      </View>

      {/* 预览区 */}
      <ScrollView
        style={styles.previewContainer}
        contentContainerStyle={styles.previewContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.loadingText}>加载布局中...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Icon source="alert-circle" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => fetchLayout(factoryId)}
            >
              <Text style={styles.retryButtonText}>重试</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <BentoGridEditor
            modules={draftModules}
            isEditing={true}
            onLayoutChange={handleLayoutChange}
          />
        )}
      </ScrollView>

      {/* 工具栏 */}
      <View style={styles.toolbar}>
        <TouchableOpacity
          style={styles.toolButton}
          onPress={() => setShowAIAssistant(true)}
        >
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.aiButtonGradient}
          >
            <Icon source="robot" size={20} color="#fff" />
          </LinearGradient>
          <Text style={styles.toolButtonText}>AI助手</Text>
        </TouchableOpacity>

        <View style={styles.toolDivider} />

        <TouchableOpacity
          style={[styles.toolButton, !canUndo && styles.toolButtonDisabled]}
          onPress={handleUndo}
          disabled={!canUndo}
        >
          <Icon source="undo" size={22} color={canUndo ? '#374151' : '#D1D5DB'} />
          <Text style={[styles.toolButtonText, !canUndo && styles.toolButtonTextDisabled]}>
            撤销
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.toolButton, !canRedo && styles.toolButtonDisabled]}
          onPress={handleRedo}
          disabled={!canRedo}
        >
          <Icon source="redo" size={22} color={canRedo ? '#374151' : '#D1D5DB'} />
          <Text style={[styles.toolButtonText, !canRedo && styles.toolButtonTextDisabled]}>
            重做
          </Text>
        </TouchableOpacity>

        <View style={styles.toolDivider} />

        <TouchableOpacity style={styles.toolButton} onPress={handleReset}>
          <Icon source="refresh" size={22} color="#374151" />
          <Text style={styles.toolButtonText}>重置</Text>
        </TouchableOpacity>
      </View>

      {/* 操作按钮 */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.draftButton, isSaving && styles.buttonDisabled]}
          onPress={handleSaveDraft}
          disabled={isSaving || isPublishing}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#667eea" />
          ) : (
            <>
              <Icon source="content-save-outline" size={20} color="#667eea" />
              <Text style={styles.draftButtonText}>保存草稿</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.publishButton, isPublishing && styles.buttonDisabled]}
          onPress={handlePublish}
          disabled={isSaving || isPublishing}
        >
          <LinearGradient
            colors={isPublishing ? ['#9CA3AF', '#9CA3AF'] : ['#667eea', '#764ba2']}
            style={styles.publishButtonGradient}
          >
            {isPublishing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon source="rocket-launch" size={20} color="#fff" />
                <Text style={styles.publishButtonText}>发布布局</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* AI布局助手Modal */}
      <AILayoutAssistant
        factoryId={factoryId}
        visible={showAIAssistant}
        onClose={() => setShowAIAssistant(false)}
        onApplyLayout={handleApplyAILayout}
      />
    </SafeAreaView>
  );
}

// ============================================
// 样式
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  unsavedBadge: {
    marginLeft: 8,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unsavedText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  publishedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    gap: 4,
  },
  publishedText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },

  // 时段Tab
  timeSlotContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  timeSlotScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  timeSlotTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    minWidth: 70,
  },
  timeSlotTabActive: {
    backgroundColor: '#667eea',
  },
  timeSlotTabDisabled: {
    backgroundColor: '#F9FAFB',
    opacity: 0.6,
  },
  timeSlotLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  timeSlotLabelActive: {
    color: '#fff',
  },
  timeSlotLabelDisabled: {
    color: '#9CA3AF',
  },
  timeSlotRange: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  timeSlotRangeActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  timeSlotRangeDisabled: {
    color: '#D1D5DB',
  },
  timeSlotHint: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
  },
  timeSlotHintText: {
    fontSize: 12,
    color: '#F59E0B',
  },

  // 预览区
  previewContainer: {
    flex: 1,
  },
  previewContent: {
    padding: 16,
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#667eea',
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },

  // 工具栏
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
  },
  toolButton: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  toolButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toolButtonText: {
    fontSize: 11,
    color: '#374151',
    marginTop: 4,
  },
  toolButtonTextDisabled: {
    color: '#D1D5DB',
  },
  toolDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 4,
  },

  // 操作按钮
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 12,
  },
  draftButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#667eea',
    backgroundColor: '#fff',
    gap: 8,
  },
  draftButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },
  publishButton: {
    flex: 1.5,
    borderRadius: 12,
    overflow: 'hidden',
  },
  publishButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  publishButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default HomeLayoutEditorScreen;
