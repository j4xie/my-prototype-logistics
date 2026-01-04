/**
 * BlueprintDetailScreen - Blueprint detail with components, history, usage stats
 *
 * Shows comprehensive blueprint information and management options
 *
 * @author Cretas Team
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
} from 'react-native';
import {
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  ActivityIndicator,
  Divider,
  Avatar,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { isAxiosError } from 'axios';
import { apiClient } from '../../../services/api/apiClient';

// Types
interface BlueprintDetail {
  id: string;
  name: string;
  description: string;
  industryType: string;
  version: string;
  status: 'active' | 'inactive' | 'draft';
  icon: string;
  iconColor: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  stats: {
    factoryCount: number;
    productTypes: number;
    departments: number;
  };
  components: {
    productTypes: number;
    materialTypes: number;
    departments: number;
    formTemplates: number;
    businessRules: number;
  };
  versions: {
    version: string;
    date: string;
    description: string;
    isCurrent: boolean;
  }[];
  factories: {
    id: string;
    name: string;
    status: 'running' | 'synced' | 'pending';
  }[];
}

type RootStackParamList = {
  BlueprintList: undefined;
  BlueprintDetail: { blueprintId: string; blueprintName: string };
  BlueprintEdit: { blueprintId: string };
  BlueprintCreate: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'BlueprintDetail'>;
type RouteProps = RouteProp<RootStackParamList, 'BlueprintDetail'>;

export function BlueprintDetailScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('platform');
  const { blueprintId, blueprintName } = route.params;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [blueprint, setBlueprint] = useState<BlueprintDetail | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ success: boolean; data: Record<string, unknown> }>(
        `/api/platform/blueprints/${blueprintId}`
      );
      if (response.success && response.data) {
        const bp = response.data;
        // Transform backend data to match frontend BlueprintDetail interface
        const transformedBlueprint: BlueprintDetail = {
          id: (bp.id as string) || blueprintId,
          name: (bp.blueprintName as string) || (bp.name as string) || blueprintName,
          description: (bp.description as string) || '',
          industryType: (bp.industryType as string) || '水产加工',
          version: (bp.version as string) || '1.0',
          status: (bp.status as BlueprintDetail['status']) || 'active',
          icon: (bp.icon as string) || '🏭',
          iconColor: (bp.iconColor as string) || '#667eea',
          createdAt: (bp.createdAt as string) || '',
          updatedAt: (bp.updatedAt as string) || '',
          createdBy: (bp.createdBy as string) || '系统',
          stats: {
            factoryCount: ((bp.stats as Record<string, number>)?.factoryCount as number) || 0,
            productTypes: ((bp.stats as Record<string, number>)?.productTypes as number) || 0,
            departments: ((bp.stats as Record<string, number>)?.departments as number) || 0,
          },
          components: {
            productTypes: ((bp.components as Record<string, number>)?.productTypes as number) || 0,
            materialTypes: ((bp.components as Record<string, number>)?.materialTypes as number) || 0,
            departments: ((bp.components as Record<string, number>)?.departments as number) || 0,
            formTemplates: ((bp.components as Record<string, number>)?.formTemplates as number) || 0,
            businessRules: ((bp.components as Record<string, number>)?.businessRules as number) || 0,
          },
          versions: (bp.versions as BlueprintDetail['versions']) || [],
          factories: (bp.factories as BlueprintDetail['factories']) || [],
        };
        setBlueprint(transformedBlueprint);
      }
    } catch (error) {
      if (isAxiosError(error)) {
        Alert.alert('加载失败', error.response?.data?.message || '网络错误');
      } else if (error instanceof Error) {
        Alert.alert('加载失败', error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [blueprintId, blueprintName]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const getFactoryStatusConfig = (status: string) => {
    switch (status) {
      case 'running':
        return { label: '运行中', color: '#52c41a', bg: '#f6ffed' };
      case 'synced':
        return { label: '已同步', color: '#52c41a', bg: '#f6ffed' };
      case 'pending':
        return { label: '待同步', color: '#faad14', bg: '#fffbe6' };
      default:
        return { label: status, color: '#8c8c8c', bg: '#f5f5f5' };
    }
  };

  const handleApplyToFactory = () => {
    Alert.alert('应用到工厂', '选择要应用此蓝图的工厂', [
      { text: '取消', style: 'cancel' },
      { text: '确定', onPress: () => {} },
    ]);
  };

  if (loading || !blueprint) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1890ff" />
          <Text style={{ marginTop: 16, color: '#666' }}>加载蓝图详情...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.header}>
        <View style={styles.headerRow}>
          <IconButton
            icon="arrow-left"
            iconColor="#fff"
            onPress={() => navigation.goBack()}
          />
          <Text variant="titleLarge" style={styles.headerTitle}>
            蓝图详情
          </Text>
          <Pressable
            onPress={() =>
              navigation.navigate('BlueprintEdit', { blueprintId: blueprint.id })
            }
          >
            <Text style={styles.headerAction}>编辑</Text>
          </Pressable>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Blueprint Header Card */}
        <LinearGradient
          colors={[blueprint.iconColor, `${blueprint.iconColor}cc`]}
          style={styles.heroCard}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Text style={styles.heroIconText}>{blueprint.icon}</Text>
            </View>
            <View style={styles.heroInfo}>
              <Text style={styles.heroTitle}>{blueprint.name}</Text>
              <Text style={styles.heroVersion}>版本 {blueprint.version}</Text>
            </View>
            <Chip
              mode="flat"
              style={styles.heroStatus}
              textStyle={{ color: '#fff', fontSize: 11 }}
            >
              已激活
            </Chip>
          </View>

          {/* Stats Row */}
          <View style={styles.heroStats}>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{blueprint.stats.factoryCount}</Text>
              <Text style={styles.heroStatLabel}>绑定工厂</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{blueprint.stats.productTypes}</Text>
              <Text style={styles.heroStatLabel}>产品类型</Text>
            </View>
            <View style={styles.heroStatItem}>
              <Text style={styles.heroStatValue}>{blueprint.stats.departments}</Text>
              <Text style={styles.heroStatLabel}>部门模板</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Basic Info */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>基本信息</Text>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>蓝图ID</Text>
              <Text style={styles.infoValue}>{blueprint.id}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>行业类型</Text>
              <Text style={styles.infoValue}>{blueprint.industryType}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>创建时间</Text>
              <Text style={styles.infoValue}>{blueprint.createdAt}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>最后更新</Text>
              <Text style={styles.infoValue}>{blueprint.updatedAt}</Text>
            </View>
            <Divider style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>创建者</Text>
              <Text style={styles.infoValue}>{blueprint.createdBy}</Text>
            </View>
          </Card.Content>
        </Card>

        {/* Description */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>描述</Text>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.descriptionText}>{blueprint.description}</Text>
          </Card.Content>
        </Card>

        {/* Components */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>配置内容</Text>
          <Text style={styles.sectionAction}>预览全部</Text>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            {[
              { icon: 'package-variant', color: '#52c41a', label: '产品类型', count: blueprint.components.productTypes },
              { icon: 'map-marker', color: '#1890ff', label: '原材料类型', count: blueprint.components.materialTypes },
              { icon: 'account-group', color: '#faad14', label: '部门模板', count: blueprint.components.departments },
              { icon: 'file-document', color: '#722ed1', label: '表单模板', count: blueprint.components.formTemplates },
              { icon: 'book-open-page-variant', color: '#ff4d4f', label: '业务规则', count: blueprint.components.businessRules },
            ].map((item, index) => (
              <View key={item.label}>
                <View style={styles.componentRow}>
                  <View style={styles.componentIcon}>
                    <Avatar.Icon
                      icon={item.icon}
                      size={36}
                      color={item.color}
                      style={{ backgroundColor: `${item.color}15` }}
                    />
                  </View>
                  <Text style={styles.componentLabel}>{item.label}</Text>
                  <Text style={styles.componentCount}>{item.count} 个</Text>
                </View>
                {index < 4 && <Divider style={styles.componentDivider} />}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Version History */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>版本历史</Text>
          <Text style={styles.sectionAction}>查看全部</Text>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            {blueprint.versions.map((version, index) => (
              <View key={version.version}>
                <View style={styles.versionRow}>
                  <View
                    style={[
                      styles.versionDot,
                      { backgroundColor: version.isCurrent ? '#52c41a' : '#d9d9d9' },
                    ]}
                  />
                  <View style={styles.versionInfo}>
                    <View style={styles.versionHeader}>
                      <Text style={styles.versionNumber}>{version.version}</Text>
                      <Text style={styles.versionDate}>{version.date}</Text>
                    </View>
                    <Text style={styles.versionDesc}>{version.description}</Text>
                  </View>
                </View>
                {index < blueprint.versions.length - 1 && (
                  <Divider style={styles.versionDivider} />
                )}
              </View>
            ))}
          </Card.Content>
        </Card>

        {/* Bound Factories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            绑定工厂 ({blueprint.factories.length})
          </Text>
          <Text style={styles.sectionAction}>管理</Text>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            {blueprint.factories.map((factory, index) => {
              const statusConfig = getFactoryStatusConfig(factory.status);
              return (
                <View key={factory.id}>
                  <View style={styles.factoryRow}>
                    <View style={styles.factoryIcon}>
                      <Text style={styles.factoryIconText}>厂</Text>
                    </View>
                    <View style={styles.factoryInfo}>
                      <Text style={styles.factoryName}>{factory.name}</Text>
                      <Text style={styles.factoryId}>
                        {factory.id} - {statusConfig.label}
                      </Text>
                    </View>
                    <Chip
                      mode="flat"
                      compact
                      textStyle={{ color: statusConfig.color, fontSize: 11 }}
                      style={{ backgroundColor: statusConfig.bg, height: 24 }}
                    >
                      {statusConfig.label}
                    </Chip>
                  </View>
                  {index < blueprint.factories.length - 1 && (
                    <Divider style={styles.factoryDivider} />
                  )}
                </View>
              );
            })}
          </Card.Content>
        </Card>

        {/* Actions Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>操作</Text>
        </View>
        <Card style={styles.card}>
          <Card.Content>
            <View style={styles.actionsGrid}>
              <Pressable style={styles.actionItem} onPress={handleApplyToFactory}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(82,196,26,0.1)' }]}>
                  <IconButton icon="check-circle" iconColor="#52c41a" size={20} />
                </View>
                <Text style={styles.actionLabel}>应用到工厂</Text>
              </Pressable>
              <Pressable style={styles.actionItem}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(24,144,255,0.1)' }]}>
                  <IconButton icon="clock-outline" iconColor="#1890ff" size={20} />
                </View>
                <Text style={styles.actionLabel}>版本管理</Text>
              </Pressable>
              <Pressable style={styles.actionItem}>
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(114,46,209,0.1)' }]}>
                  <IconButton icon="eye" iconColor="#722ed1" size={20} />
                </View>
                <Text style={styles.actionLabel}>预览效果</Text>
              </Pressable>
              <Pressable
                style={styles.actionItem}
                onPress={() =>
                  navigation.navigate('BlueprintEdit', { blueprintId: blueprint.id })
                }
              >
                <View style={[styles.actionIcon, { backgroundColor: 'rgba(250,173,20,0.1)' }]}>
                  <IconButton icon="pencil" iconColor="#faad14" size={20} />
                </View>
                <Text style={styles.actionLabel}>编辑蓝图</Text>
              </Pressable>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <Button
          mode="outlined"
          style={styles.bottomButton}
          onPress={() => navigation.goBack()}
        >
          返回列表
        </Button>
        <Button
          mode="contained"
          style={[styles.bottomButton, styles.primaryButton]}
          onPress={handleApplyToFactory}
        >
          应用到工厂
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 16,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  headerAction: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  heroCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroIcon: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  heroVersion: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  heroStatus: {
    backgroundColor: 'rgba(82,196,26,0.3)',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStatItem: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionAction: {
    fontSize: 13,
    color: '#667eea',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  infoValue: {
    fontSize: 14,
    color: '#262626',
  },
  infoDivider: {
    backgroundColor: '#f0f0f0',
  },
  descriptionText: {
    fontSize: 14,
    color: '#595959',
    lineHeight: 22,
  },
  componentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  componentIcon: {
    marginRight: 12,
  },
  componentLabel: {
    flex: 1,
    fontSize: 14,
    color: '#262626',
  },
  componentCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#667eea',
  },
  componentDivider: {
    backgroundColor: '#f5f5f5',
  },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  versionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: 12,
  },
  versionInfo: {
    flex: 1,
  },
  versionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  versionNumber: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  versionDate: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  versionDesc: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  versionDivider: {
    backgroundColor: '#f0f0f0',
  },
  factoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  factoryIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(24,144,255,0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  factoryIconText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1890ff',
  },
  factoryInfo: {
    flex: 1,
  },
  factoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
  },
  factoryId: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  factoryDivider: {
    backgroundColor: '#f0f0f0',
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionItem: {
    width: '47%',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionLabel: {
    fontSize: 13,
    color: '#262626',
  },
  bottomPadding: {
    height: 20,
  },
  bottomActions: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  bottomButton: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#667eea',
  },
});

export default BlueprintDetailScreen;
