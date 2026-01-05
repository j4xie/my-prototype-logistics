/**
 * ISAPI 智能分析配置页面
 * 越界检测、区域入侵、人脸检测配置管理
 */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import isapiApiClient, {
  SmartCapabilities,
  SmartAnalysisConfig,
  SmartDetectionRule,
  SmartDetectionType,
  getDetectionTypeName,
  getDetectionTypeIcon,
  getDetectionTypeColor,
  createDefaultRule,
} from '../../../services/api/isapiApiClient';

type RouteParams = {
  IsapiSmartConfig: {
    deviceId: string;
    channelId?: number;
  };
};

type RouteType = RouteProp<RouteParams, 'IsapiSmartConfig'>;

type TabType = 'LINE_DETECTION' | 'FIELD_DETECTION' | 'FACE_DETECTION';

export function IsapiSmartConfigScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation();
  const { deviceId, channelId = 1 } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('LINE_DETECTION');

  // Capabilities
  const [capabilities, setCapabilities] = useState<SmartCapabilities | null>(null);

  // Configurations
  const [lineConfig, setLineConfig] = useState<SmartAnalysisConfig | null>(null);
  const [fieldConfig, setFieldConfig] = useState<SmartAnalysisConfig | null>(null);
  const [faceConfig, setFaceConfig] = useState<SmartAnalysisConfig | null>(null);

  // Error states
  const [lineError, setLineError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [faceError, setFaceError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const allConfig = await isapiApiClient.getAllSmartConfig(deviceId, channelId);

      setCapabilities(allConfig.capabilities);
      setLineConfig(allConfig.lineDetection || null);
      setFieldConfig(allConfig.fieldDetection || null);
      setFaceConfig(allConfig.faceDetection || null);
      setLineError(allConfig.lineDetectionError || null);
      setFieldError(allConfig.fieldDetectionError || null);
      setFaceError(allConfig.faceDetectionError || null);

      // Auto-select first supported tab
      if (!allConfig.capabilities.lineDetectionSupported && allConfig.capabilities.fieldDetectionSupported) {
        setActiveTab('FIELD_DETECTION');
      } else if (!allConfig.capabilities.lineDetectionSupported && !allConfig.capabilities.fieldDetectionSupported && allConfig.capabilities.faceDetectionSupported) {
        setActiveTab('FACE_DETECTION');
      }
    } catch (err) {
      console.error('加载智能分析配置失败:', err);
      Alert.alert('错误', '加载智能分析配置失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [deviceId, channelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleEnabled = async (type: TabType, enabled: boolean) => {
    setSaving(true);
    try {
      if (type === 'LINE_DETECTION' && lineConfig) {
        const newConfig = { ...lineConfig, enabled };
        await isapiApiClient.saveLineDetectionConfig(deviceId, channelId, newConfig);
        setLineConfig(newConfig);
      } else if (type === 'FIELD_DETECTION' && fieldConfig) {
        const newConfig = { ...fieldConfig, enabled };
        await isapiApiClient.saveFieldDetectionConfig(deviceId, channelId, newConfig);
        setFieldConfig(newConfig);
      } else if (type === 'FACE_DETECTION' && faceConfig) {
        const newConfig = { ...faceConfig, enabled };
        await isapiApiClient.saveFaceDetectionConfig(deviceId, channelId, newConfig);
        setFaceConfig(newConfig);
      }
      Alert.alert('成功', `${getDetectionTypeName(type)}已${enabled ? '启用' : '禁用'}`);
    } catch (err) {
      console.error('保存配置失败:', err);
      Alert.alert('错误', '保存配置失败');
      // Reload to restore original state
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleSensitivityChange = async (type: TabType, sensitivity: number) => {
    setSaving(true);
    try {
      if (type === 'LINE_DETECTION' && lineConfig) {
        const newConfig = { ...lineConfig, sensitivity };
        await isapiApiClient.saveLineDetectionConfig(deviceId, channelId, newConfig);
        setLineConfig(newConfig);
      } else if (type === 'FIELD_DETECTION' && fieldConfig) {
        const newConfig = { ...fieldConfig, sensitivity };
        await isapiApiClient.saveFieldDetectionConfig(deviceId, channelId, newConfig);
        setFieldConfig(newConfig);
      } else if (type === 'FACE_DETECTION' && faceConfig) {
        const newConfig = { ...faceConfig, sensitivity };
        await isapiApiClient.saveFaceDetectionConfig(deviceId, channelId, newConfig);
        setFaceConfig(newConfig);
      }
    } catch (err) {
      console.error('保存灵敏度失败:', err);
      Alert.alert('错误', '保存灵敏度失败');
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (type: TabType, ruleId: string, enabled: boolean) => {
    setSaving(true);
    try {
      if (type === 'LINE_DETECTION' && lineConfig) {
        const newRules = lineConfig.rules?.map(r =>
          r.id === ruleId ? { ...r, enabled } : r
        );
        const newConfig = { ...lineConfig, rules: newRules };
        await isapiApiClient.saveLineDetectionConfig(deviceId, channelId, newConfig);
        setLineConfig(newConfig);
      } else if (type === 'FIELD_DETECTION' && fieldConfig) {
        const newRules = fieldConfig.rules?.map(r =>
          r.id === ruleId ? { ...r, enabled } : r
        );
        const newConfig = { ...fieldConfig, rules: newRules };
        await isapiApiClient.saveFieldDetectionConfig(deviceId, channelId, newConfig);
        setFieldConfig(newConfig);
      }
    } catch (err) {
      console.error('保存规则失败:', err);
      Alert.alert('错误', '保存规则失败');
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleAddRule = async (type: TabType) => {
    if (type === 'FACE_DETECTION') {
      Alert.alert('提示', '人脸检测不支持添加规则');
      return;
    }

    const maxRules = type === 'LINE_DETECTION'
      ? capabilities?.maxLineDetectionRules || 4
      : capabilities?.maxFieldDetectionRules || 4;

    const currentRules = type === 'LINE_DETECTION'
      ? lineConfig?.rules?.length || 0
      : fieldConfig?.rules?.length || 0;

    if (currentRules >= maxRules) {
      Alert.alert('提示', `最多支持 ${maxRules} 条规则`);
      return;
    }

    const newRule = createDefaultRule(type);
    newRule.ruleName = `规则 ${currentRules + 1}`;

    setSaving(true);
    try {
      if (type === 'LINE_DETECTION' && lineConfig) {
        const newRules = [...(lineConfig.rules || []), newRule];
        const newConfig = { ...lineConfig, rules: newRules };
        await isapiApiClient.saveLineDetectionConfig(deviceId, channelId, newConfig);
        setLineConfig(newConfig);
        Alert.alert('成功', '新规则已添加');
      } else if (type === 'FIELD_DETECTION' && fieldConfig) {
        const newRules = [...(fieldConfig.rules || []), newRule];
        const newConfig = { ...fieldConfig, rules: newRules };
        await isapiApiClient.saveFieldDetectionConfig(deviceId, channelId, newConfig);
        setFieldConfig(newConfig);
        Alert.alert('成功', '新规则已添加');
      }
    } catch (err) {
      console.error('添加规则失败:', err);
      Alert.alert('错误', '添加规则失败');
      loadData();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRule = (type: TabType, ruleId: string, ruleName: string) => {
    Alert.alert(
      '确认删除',
      `确定要删除规则 "${ruleName}" 吗?`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              if (type === 'LINE_DETECTION' && lineConfig) {
                const newRules = lineConfig.rules?.filter(r => r.id !== ruleId);
                const newConfig = { ...lineConfig, rules: newRules };
                await isapiApiClient.saveLineDetectionConfig(deviceId, channelId, newConfig);
                setLineConfig(newConfig);
              } else if (type === 'FIELD_DETECTION' && fieldConfig) {
                const newRules = fieldConfig.rules?.filter(r => r.id !== ruleId);
                const newConfig = { ...fieldConfig, rules: newRules };
                await isapiApiClient.saveFieldDetectionConfig(deviceId, channelId, newConfig);
                setFieldConfig(newConfig);
              }
              Alert.alert('成功', '规则已删除');
            } catch (err) {
              console.error('删除规则失败:', err);
              Alert.alert('错误', '删除规则失败');
              loadData();
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const getDirectionText = (direction?: string): string => {
    switch (direction) {
      case 'LEFT_TO_RIGHT': return '从左到右';
      case 'RIGHT_TO_LEFT': return '从右到左';
      case 'BOTH': return '双向';
      default: return '-';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3182ce" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!capabilities) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon source="alert-circle" size={48} color="#e53e3e" />
          <Text style={styles.errorText}>无法加载设备能力</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!capabilities.smartSupported) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon source="brain" size={48} color="#a0aec0" />
          <Text style={styles.errorText}>此设备不支持智能分析</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderTab = (type: TabType) => {
    const isSupported = type === 'LINE_DETECTION'
      ? capabilities.lineDetectionSupported
      : type === 'FIELD_DETECTION'
        ? capabilities.fieldDetectionSupported
        : capabilities.faceDetectionSupported;

    const isActive = activeTab === type;
    const color = getDetectionTypeColor(type);

    return (
      <TouchableOpacity
        key={type}
        style={[
          styles.tab,
          isActive && styles.tabActive,
          isActive && { borderBottomColor: color },
          !isSupported && styles.tabDisabled,
        ]}
        onPress={() => isSupported && setActiveTab(type)}
        disabled={!isSupported}
      >
        <Icon
          source={getDetectionTypeIcon(type)}
          size={20}
          color={!isSupported ? '#a0aec0' : isActive ? color : '#718096'}
        />
        <Text
          style={[
            styles.tabText,
            isActive && { color },
            !isSupported && styles.tabTextDisabled,
          ]}
        >
          {getDetectionTypeName(type)}
        </Text>
        {!isSupported && (
          <Text style={styles.tabUnsupported}>不支持</Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderLineDetection = () => {
    if (lineError) {
      return (
        <View style={styles.errorSection}>
          <Icon source="alert-circle" size={24} color="#e53e3e" />
          <Text style={styles.errorSectionText}>{lineError}</Text>
        </View>
      );
    }

    if (!lineConfig) {
      return (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>无配置数据</Text>
        </View>
      );
    }

    return (
      <View style={styles.configSection}>
        {/* 启用开关 */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Icon source="toggle-switch" size={20} color="#3182ce" />
            <Text style={styles.switchLabelText}>启用越界检测</Text>
          </View>
          <Switch
            value={lineConfig.enabled}
            onValueChange={(value) => handleToggleEnabled('LINE_DETECTION', value)}
            trackColor={{ false: '#e2e8f0', true: '#bee3f8' }}
            thumbColor={lineConfig.enabled ? '#3182ce' : '#a0aec0'}
            disabled={saving}
          />
        </View>

        {/* 灵敏度 */}
        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>灵敏度</Text>
            <Text style={styles.sliderValue}>{lineConfig.sensitivity || 50}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={lineConfig.sensitivity || 50}
            onSlidingComplete={(value) => handleSensitivityChange('LINE_DETECTION', value)}
            minimumTrackTintColor="#3182ce"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#3182ce"
            disabled={saving || !lineConfig.enabled}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderMinMax}>低</Text>
            <Text style={styles.sliderMinMax}>高</Text>
          </View>
        </View>

        {/* 规则列表 */}
        <View style={styles.rulesSection}>
          <View style={styles.rulesSectionHeader}>
            <Text style={styles.rulesSectionTitle}>检测规则</Text>
            <TouchableOpacity
              style={[styles.addRuleBtn, saving && styles.addRuleBtnDisabled]}
              onPress={() => handleAddRule('LINE_DETECTION')}
              disabled={saving}
            >
              <Icon source="plus" size={16} color="#ffffff" />
              <Text style={styles.addRuleBtnText}>添加规则</Text>
            </TouchableOpacity>
          </View>

          {lineConfig.rules && lineConfig.rules.length > 0 ? (
            lineConfig.rules.map((rule) => (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <Switch
                    value={rule.enabled}
                    onValueChange={(value) => handleToggleRule('LINE_DETECTION', rule.id, value)}
                    trackColor={{ false: '#e2e8f0', true: '#bee3f8' }}
                    thumbColor={rule.enabled ? '#3182ce' : '#a0aec0'}
                    disabled={saving || !lineConfig.enabled}
                  />
                  <Text style={[styles.ruleName, !rule.enabled && styles.ruleNameDisabled]}>
                    {rule.ruleName}
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteRuleBtn}
                    onPress={() => handleDeleteRule('LINE_DETECTION', rule.id, rule.ruleName)}
                    disabled={saving}
                  >
                    <Icon source="delete-outline" size={20} color="#e53e3e" />
                  </TouchableOpacity>
                </View>
                <View style={styles.ruleDetails}>
                  <View style={styles.ruleDetailItem}>
                    <Text style={styles.ruleDetailLabel}>方向:</Text>
                    <Text style={styles.ruleDetailValue}>{getDirectionText(rule.direction)}</Text>
                  </View>
                  <View style={styles.ruleDetailItem}>
                    <Text style={styles.ruleDetailLabel}>灵敏度:</Text>
                    <Text style={styles.ruleDetailValue}>{rule.sensitivity}</Text>
                  </View>
                  <View style={styles.ruleDetailItem}>
                    <Text style={styles.ruleDetailLabel}>坐标点:</Text>
                    <Text style={styles.ruleDetailValue}>{rule.coordinates?.length || 0} 个</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noRules}>
              <Icon source="border-horizontal" size={32} color="#a0aec0" />
              <Text style={styles.noRulesText}>暂无检测规则</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderFieldDetection = () => {
    if (fieldError) {
      return (
        <View style={styles.errorSection}>
          <Icon source="alert-circle" size={24} color="#e53e3e" />
          <Text style={styles.errorSectionText}>{fieldError}</Text>
        </View>
      );
    }

    if (!fieldConfig) {
      return (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>无配置数据</Text>
        </View>
      );
    }

    return (
      <View style={styles.configSection}>
        {/* 启用开关 */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Icon source="toggle-switch" size={20} color="#38a169" />
            <Text style={styles.switchLabelText}>启用区域入侵检测</Text>
          </View>
          <Switch
            value={fieldConfig.enabled}
            onValueChange={(value) => handleToggleEnabled('FIELD_DETECTION', value)}
            trackColor={{ false: '#e2e8f0', true: '#c6f6d5' }}
            thumbColor={fieldConfig.enabled ? '#38a169' : '#a0aec0'}
            disabled={saving}
          />
        </View>

        {/* 灵敏度 */}
        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>灵敏度</Text>
            <Text style={styles.sliderValue}>{fieldConfig.sensitivity || 50}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={fieldConfig.sensitivity || 50}
            onSlidingComplete={(value) => handleSensitivityChange('FIELD_DETECTION', value)}
            minimumTrackTintColor="#38a169"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#38a169"
            disabled={saving || !fieldConfig.enabled}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderMinMax}>低</Text>
            <Text style={styles.sliderMinMax}>高</Text>
          </View>
        </View>

        {/* 规则列表 */}
        <View style={styles.rulesSection}>
          <View style={styles.rulesSectionHeader}>
            <Text style={styles.rulesSectionTitle}>检测规则</Text>
            <TouchableOpacity
              style={[styles.addRuleBtn, styles.addRuleBtnGreen, saving && styles.addRuleBtnDisabled]}
              onPress={() => handleAddRule('FIELD_DETECTION')}
              disabled={saving}
            >
              <Icon source="plus" size={16} color="#ffffff" />
              <Text style={styles.addRuleBtnText}>添加规则</Text>
            </TouchableOpacity>
          </View>

          {fieldConfig.rules && fieldConfig.rules.length > 0 ? (
            fieldConfig.rules.map((rule) => (
              <View key={rule.id} style={styles.ruleCard}>
                <View style={styles.ruleHeader}>
                  <Switch
                    value={rule.enabled}
                    onValueChange={(value) => handleToggleRule('FIELD_DETECTION', rule.id, value)}
                    trackColor={{ false: '#e2e8f0', true: '#c6f6d5' }}
                    thumbColor={rule.enabled ? '#38a169' : '#a0aec0'}
                    disabled={saving || !fieldConfig.enabled}
                  />
                  <Text style={[styles.ruleName, !rule.enabled && styles.ruleNameDisabled]}>
                    {rule.ruleName}
                  </Text>
                  <TouchableOpacity
                    style={styles.deleteRuleBtn}
                    onPress={() => handleDeleteRule('FIELD_DETECTION', rule.id, rule.ruleName)}
                    disabled={saving}
                  >
                    <Icon source="delete-outline" size={20} color="#e53e3e" />
                  </TouchableOpacity>
                </View>
                <View style={styles.ruleDetails}>
                  <View style={styles.ruleDetailItem}>
                    <Text style={styles.ruleDetailLabel}>灵敏度:</Text>
                    <Text style={styles.ruleDetailValue}>{rule.sensitivity}</Text>
                  </View>
                  <View style={styles.ruleDetailItem}>
                    <Text style={styles.ruleDetailLabel}>停留时间:</Text>
                    <Text style={styles.ruleDetailValue}>{rule.timeThresholdSeconds || 0} 秒</Text>
                  </View>
                  <View style={styles.ruleDetailItem}>
                    <Text style={styles.ruleDetailLabel}>区域顶点:</Text>
                    <Text style={styles.ruleDetailValue}>{rule.coordinates?.length || 0} 个</Text>
                  </View>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.noRules}>
              <Icon source="shape-polygon-plus" size={32} color="#a0aec0" />
              <Text style={styles.noRulesText}>暂无检测规则</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderFaceDetection = () => {
    if (faceError) {
      return (
        <View style={styles.errorSection}>
          <Icon source="alert-circle" size={24} color="#e53e3e" />
          <Text style={styles.errorSectionText}>{faceError}</Text>
        </View>
      );
    }

    if (!faceConfig) {
      return (
        <View style={styles.emptySection}>
          <Text style={styles.emptySectionText}>无配置数据</Text>
        </View>
      );
    }

    return (
      <View style={styles.configSection}>
        {/* 启用开关 */}
        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Icon source="toggle-switch" size={20} color="#805ad5" />
            <Text style={styles.switchLabelText}>启用人脸检测</Text>
          </View>
          <Switch
            value={faceConfig.enabled}
            onValueChange={(value) => handleToggleEnabled('FACE_DETECTION', value)}
            trackColor={{ false: '#e2e8f0', true: '#e9d8fd' }}
            thumbColor={faceConfig.enabled ? '#805ad5' : '#a0aec0'}
            disabled={saving}
          />
        </View>

        {/* 灵敏度 */}
        <View style={styles.sliderSection}>
          <View style={styles.sliderHeader}>
            <Text style={styles.sliderLabel}>灵敏度</Text>
            <Text style={styles.sliderValue}>{faceConfig.sensitivity || 50}</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={faceConfig.sensitivity || 50}
            onSlidingComplete={(value) => handleSensitivityChange('FACE_DETECTION', value)}
            minimumTrackTintColor="#805ad5"
            maximumTrackTintColor="#e2e8f0"
            thumbTintColor="#805ad5"
            disabled={saving || !faceConfig.enabled}
          />
          <View style={styles.sliderLabels}>
            <Text style={styles.sliderMinMax}>低</Text>
            <Text style={styles.sliderMinMax}>高</Text>
          </View>
        </View>

        {/* 人脸检测说明 */}
        <View style={styles.infoCard}>
          <Icon source="information" size={20} color="#805ad5" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>人脸检测说明</Text>
            <Text style={styles.infoText}>
              人脸检测会自动识别画面中的人脸，并触发告警。灵敏度越高，检测越敏感但可能增加误报。
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'LINE_DETECTION':
        return renderLineDetection();
      case 'FIELD_DETECTION':
        return renderFieldDetection();
      case 'FACE_DETECTION':
        return renderFaceDetection();
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Saving Overlay */}
      {saving && (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="small" color="#3182ce" />
          <Text style={styles.savingText}>保存中...</Text>
        </View>
      )}

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {renderTab('LINE_DETECTION')}
        {renderTab('FIELD_DETECTION')}
        {renderTab('FACE_DETECTION')}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3182ce']} />
        }
      >
        {/* Capability Summary */}
        <View style={styles.capabilitySummary}>
          <Text style={styles.capabilitySummaryTitle}>设备能力</Text>
          <View style={styles.capabilityRow}>
            <CapabilityBadge
              label="越界检测"
              supported={capabilities.lineDetectionSupported}
              maxRules={capabilities.maxLineDetectionRules}
            />
            <CapabilityBadge
              label="区域入侵"
              supported={capabilities.fieldDetectionSupported}
              maxRules={capabilities.maxFieldDetectionRules}
            />
            <CapabilityBadge
              label="人脸检测"
              supported={capabilities.faceDetectionSupported}
            />
          </View>
        </View>

        {/* Active Tab Content */}
        {renderActiveTabContent()}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

// Capability Badge Component
function CapabilityBadge({
  label,
  supported,
  maxRules,
}: {
  label: string;
  supported?: boolean;
  maxRules?: number;
}) {
  return (
    <View style={[styles.capabilityBadge, supported && styles.capabilityBadgeSupported]}>
      <Icon
        source={supported ? 'check-circle' : 'close-circle'}
        size={16}
        color={supported ? '#48bb78' : '#a0aec0'}
      />
      <Text style={[styles.capabilityBadgeText, supported && styles.capabilityBadgeTextSupported]}>
        {label}
      </Text>
      {maxRules !== undefined && maxRules > 0 && (
        <Text style={styles.capabilityBadgeMax}>(max:{maxRules})</Text>
      )}
    </View>
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
    color: '#718096',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#e53e3e',
  },
  savingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ebf8ff',
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    gap: 8,
  },
  savingText: {
    fontSize: 13,
    color: '#3182ce',
  },
  // Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#f7fafc',
  },
  tabDisabled: {
    opacity: 0.5,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#718096',
  },
  tabTextDisabled: {
    color: '#a0aec0',
  },
  tabUnsupported: {
    fontSize: 10,
    color: '#a0aec0',
  },
  // Capability Summary
  capabilitySummary: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  capabilitySummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  capabilityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  capabilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  capabilityBadgeSupported: {
    backgroundColor: '#f0fff4',
  },
  capabilityBadgeText: {
    fontSize: 12,
    color: '#a0aec0',
  },
  capabilityBadgeTextSupported: {
    color: '#276749',
  },
  capabilityBadgeMax: {
    fontSize: 10,
    color: '#718096',
  },
  // Config Section
  configSection: {
    marginHorizontal: 16,
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff5f5',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  errorSectionText: {
    flex: 1,
    fontSize: 14,
    color: '#e53e3e',
  },
  emptySection: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: '#a0aec0',
  },
  // Switch Row
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  switchLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  switchLabelText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#2d3748',
  },
  // Slider Section
  sliderSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3748',
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3182ce',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderMinMax: {
    fontSize: 12,
    color: '#a0aec0',
  },
  // Rules Section
  rulesSection: {
    marginBottom: 16,
  },
  rulesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  rulesSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
  },
  addRuleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3182ce',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  addRuleBtnGreen: {
    backgroundColor: '#38a169',
  },
  addRuleBtnDisabled: {
    opacity: 0.6,
  },
  addRuleBtnText: {
    fontSize: 13,
    color: '#ffffff',
    fontWeight: '500',
  },
  // Rule Card
  ruleCard: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ruleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  ruleName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#2d3748',
    marginLeft: 10,
  },
  ruleNameDisabled: {
    color: '#a0aec0',
  },
  deleteRuleBtn: {
    padding: 4,
  },
  ruleDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingLeft: 48,
  },
  ruleDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ruleDetailLabel: {
    fontSize: 12,
    color: '#718096',
  },
  ruleDetailValue: {
    fontSize: 12,
    color: '#2d3748',
    fontWeight: '500',
  },
  noRules: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  noRulesText: {
    fontSize: 14,
    color: '#a0aec0',
  },
  // Info Card
  infoCard: {
    flexDirection: 'row',
    backgroundColor: '#faf5ff',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#553c9a',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#6b46c1',
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});

export default IsapiSmartConfigScreen;
