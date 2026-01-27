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

type NavigationProp = NativeStackNavigationProp<SmartBIStackParamList>;

interface MenuItemProps {
  icon: string;
  title: string;
  description: string;
  onPress: () => void;
  color: string;
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

export function SmartBIHomeScreen() {
  const navigation = useNavigation<NavigationProp>();

  const menuItems: MenuItemProps[] = [
    {
      icon: 'view-dashboard',
      title: '经营驾驶舱',
      description: 'KPI总览与实时监控',
      color: '#2196F3',
      onPress: () => navigation.navigate('ExecutiveDashboard'),
    },
    {
      icon: 'chart-bar',
      title: '销售分析',
      description: '销售趋势与区域分析',
      color: '#4CAF50',
      onPress: () => navigation.navigate('SalesAnalysis', {}),
    },
    {
      icon: 'currency-usd',
      title: '财务分析',
      description: '成本结构与利润分析',
      color: '#FF9800',
      onPress: () => navigation.navigate('FinanceAnalysis', {}),
    },
    {
      icon: 'chart-timeline-variant',
      title: '智能数据分析',
      description: '批量上传 + AI 图表分析',
      color: '#00BCD4',
      onPress: () => navigation.navigate('SmartBIDataAnalysis'),
    },
    {
      icon: 'file-excel',
      title: 'Excel上传',
      description: '导入外部数据进行分析',
      color: '#9C27B0',
      onPress: () => navigation.navigate('ExcelUpload'),
    },
    {
      icon: 'robot',
      title: 'AI问答',
      description: '自然语言数据查询',
      color: '#F44336',
      onPress: () => navigation.navigate('NLQuery', {}),
    },
  ];

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

        {/* 功能菜单 */}
        <View style={styles.menuContainer}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            分析功能
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
