/**
 * SmartBI - 智能分析首页
 * Phase 6B 将实现完整功能，目前为占位组件
 */

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, Card, Icon, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SmartBIStackParamList } from '../../types/smartbi';
import { useFactoryFeatureStore } from '../../store/factoryFeatureStore';
import KPICardMobile from '../../components/smartbi/KPICardMobile';

type NavigationProp = NativeStackNavigationProp<SmartBIStackParamList>;

interface MenuItemProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  color: string;
  screen: string;
}

function MenuItem({ icon, title, description, onPress, color }: MenuItemProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Surface style={styles.menuItem} elevation={1}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Icon source={icon} size={28} color={color} />
        </View>
        <View style={styles.menuTextContainer}>
          <Text variant="titleMedium" style={styles.menuTitle}>{title}</Text>
          <Text variant="bodySmall" style={styles.menuDescription}>{description}</Text>
        </View>
        <Icon source="chevron-right" size={24} color="#9E9E9E" />
      </Surface>
    </TouchableOpacity>
  );
}

interface QuickActionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
}

function QuickActionCard({ icon, title, subtitle, color, onPress }: QuickActionCardProps) {
  return (
    <TouchableOpacity
      style={styles.quickActionCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Surface style={styles.quickActionSurface} elevation={2}>
        <View style={[styles.quickActionIcon, { backgroundColor: color }]}>
          <Icon source={icon} size={32} color="#FFFFFF" />
        </View>
        <Text variant="titleSmall" style={styles.quickActionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text variant="bodySmall" style={styles.quickActionSubtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </Surface>
    </TouchableOpacity>
  );
}

export function SmartBIHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { isScreenEnabled } = useFactoryFeatureStore();

  const menuItems: MenuItemProps[] = [
    {
      icon: 'view-dashboard',
      title: '经营驾驶舱',
      description: 'KPI总览与实时监控',
      color: '#2196F3',
      screen: 'ExecutiveDashboard',
      onPress: () => navigation.navigate('ExecutiveDashboard'),
    },
    {
      icon: 'chart-bar',
      title: '销售分析',
      description: '销售趋势与区域分析',
      color: '#4CAF50',
      screen: 'SalesAnalysis',
      onPress: () => navigation.navigate('SalesAnalysis', {}),
    },
    {
      icon: 'currency-usd',
      title: '财务分析',
      description: '成本结构与利润分析',
      color: '#FF9800',
      screen: 'FinanceAnalysis',
      onPress: () => navigation.navigate('FinanceAnalysis', {}),
    },
    {
      icon: 'chart-timeline-variant',
      title: '智能数据分析',
      description: '批量上传 + AI 图表分析',
      color: '#00BCD4',
      screen: 'SmartBIDataAnalysis',
      onPress: () => navigation.navigate('SmartBIDataAnalysis'),
    },
    {
      icon: 'file-excel',
      title: 'Excel上传',
      description: '导入外部数据进行分析',
      color: '#9C27B0',
      screen: 'ExcelUpload',
      onPress: () => navigation.navigate('ExcelUpload'),
    },
    {
      icon: 'robot',
      title: 'AI问答',
      description: '自然语言数据查询',
      color: '#F44336',
      screen: 'NLQuery',
      onPress: () => navigation.navigate('NLQuery', {}),
    },
  ].filter(item => isScreenEnabled(item.screen));

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 头部介绍 */}
        <Card style={styles.headerCard}>
          <Card.Content>
            <View style={styles.headerContent}>
              <Icon source="chart-timeline-variant" size={48} color="#2196F3" />
              <View style={styles.headerTextContainer}>
                <Text variant="headlineSmall" style={styles.headerTitle}>
                  SmartBI 智能分析
                </Text>
                <Text variant="bodyMedium" style={styles.headerDescription}>
                  基于AI的数据分析与可视化平台
                </Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* 核心指标概览 */}
        <View style={styles.kpiContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            核心指标
          </Text>
          <View style={styles.kpiGrid}>
            <KPICardMobile title="总收入" value="¥862.5万" change={5.2} trend="up" colorPreset="purple" />
            <KPICardMobile title="净利率" value="6.8%" change={1.2} trend="up" colorPreset="blue" />
            <KPICardMobile title="销售费用率" value="12.3%" change={-0.8} trend="down" colorPreset="pink" />
            <KPICardMobile title="产量达标率" value="96.5%" change={2.1} trend="up" colorPreset="green" />
          </View>
        </View>

        {/* 快捷操作卡片 */}
        <View style={styles.quickActionsContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            快捷操作
          </Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="file-excel"
              title="上传Excel"
              subtitle="导入数据分析"
              color="#9C27B0"
              onPress={() => navigation.navigate('ExcelUpload')}
            />
            <QuickActionCard
              icon="view-dashboard"
              title="经营驾驶舱"
              subtitle="查看核心指标"
              color="#2196F3"
              onPress={() => navigation.navigate('ExecutiveDashboard')}
            />
            <QuickActionCard
              icon="robot"
              title="AI问答"
              subtitle="智能数据查询"
              color="#F44336"
              onPress={() => navigation.navigate('NLQuery', {})}
            />
            <QuickActionCard
              icon="chart-timeline-variant"
              title="数据分析"
              subtitle="批量图表生成"
              color="#00BCD4"
              onPress={() => navigation.navigate('SmartBIDataAnalysis')}
            />
          </View>
        </View>

        {/* 功能菜单 */}
        <View style={styles.menuContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            全部功能
          </Text>
          {menuItems.map((item, index) => (
            <MenuItem key={index} {...item} />
          ))}
        </View>

        {/* 提示信息 */}
        <Card style={styles.tipCard}>
          <Card.Content>
            <View style={styles.tipContent}>
              <Icon source="information" size={20} color="#2196F3" />
              <Text variant="bodySmall" style={styles.tipText}>
                SmartBI 功能正在开发中，更多功能即将上线
              </Text>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  headerCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTextContainer: {
    marginLeft: 16,
    flex: 1,
  },
  headerTitle: {
    color: '#212121',
    fontWeight: '600',
  },
  headerDescription: {
    color: '#757575',
    marginTop: 4,
  },
  kpiContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionsContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    marginBottom: 8,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    marginBottom: 12,
  },
  quickActionSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minHeight: 140,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  quickActionTitle: {
    color: '#212121',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 4,
  },
  quickActionSubtitle: {
    color: '#757575',
    textAlign: 'center',
  },
  menuContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    color: '#424242',
    marginBottom: 12,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  menuTitle: {
    color: '#212121',
    fontWeight: '500',
  },
  menuDescription: {
    color: '#757575',
    marginTop: 2,
  },
  tipCard: {
    margin: 16,
    backgroundColor: '#E3F2FD',
  },
  tipContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tipText: {
    color: '#1565C0',
    marginLeft: 8,
    flex: 1,
  },
});

export default SmartBIHomeScreen;
