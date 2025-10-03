import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { usePermission } from '../../hooks/usePermission';
import { hasWhitelistPermission } from '../../utils/navigationHelper';

interface FarmingScreenProps {
  navigation: any;
}

export const FarmingScreen: React.FC<FarmingScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const farmingSteps = [
    { id: 1, name: '土地准备', icon: 'leaf-outline', color: '#10b981' },
    { id: 2, name: '种子播种', icon: 'flower-outline', color: '#059669' },
    { id: 3, name: '施肥管理', icon: 'water-outline', color: '#047857' },
    { id: 4, name: '病虫防治', icon: 'bug-outline', color: '#065f46' },
    { id: 5, name: '生长监测', icon: 'analytics-outline', color: '#064e3b' },
    { id: 6, name: '收获管理', icon: 'basket-outline', color: '#022c22' },
  ];

  const baseQuickActions = [
    { name: '环境监测', icon: 'thermometer', color: '#10b981' },
    { name: '施肥记录', icon: 'water', color: '#059669' },
    { name: '病虫记录', icon: 'bug', color: '#047857' },
    { name: '收获记录', icon: 'basket', color: '#065f46' },
  ];

  // 如果有白名单管理权限，添加白名单管理按钮
  const quickActions = hasWhitelistPermission('department')
    ? [...baseQuickActions, { name: '白名单管理', icon: 'people-circle', color: '#ec4899', screen: 'WhitelistManagement' }]
    : baseQuickActions;

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#10b981" />
      <LinearGradient
        colors={['#10b981', '#059669', '#047857']}
        style={styles.container}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>种植管理模块</Text>
            <Text style={styles.headerSubtitle}>Framework Only - 基础架构</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="leaf" size={32} color="#fff" />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          {/* 快速操作区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快速操作</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action, index) => (
                <TouchableOpacity key={index} style={styles.quickActionCard}>
                  <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                    <Ionicons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={styles.quickActionText}>{action.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 种植流程区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>种植流程管理</Text>
            {farmingSteps.map((step) => (
              <TouchableOpacity key={step.id} style={styles.stepCard}>
                <View style={[styles.stepIcon, { backgroundColor: step.color }]}>
                  <Ionicons name={step.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepName}>{step.name}</Text>
                  <Text style={styles.stepDescription}>
                    步骤 {step.id} - 框架已就绪，待完整开发
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>

          {/* 功能卡片 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>核心功能</Text>
            
            {/* 环境监测卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="thermometer" size={24} color="#10b981" />
                <Text style={styles.featureTitle}>环境监测系统</Text>
              </View>
              <Text style={styles.featureDescription}>
                实时监测温度、湿度、土壤等环境指标，为种植决策提供数据支撑
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>查看监测数据</Text>
                <Ionicons name="arrow-forward" size={16} color="#10b981" />
              </TouchableOpacity>
            </View>

            {/* 生长档案卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="document-text" size={24} color="#059669" />
                <Text style={styles.featureTitle}>作物生长档案</Text>
              </View>
              <Text style={styles.featureDescription}>
                记录作物从播种到收获的完整生长过程和管理措施
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>查看生长档案</Text>
                <Ionicons name="arrow-forward" size={16} color="#059669" />
              </TouchableOpacity>
            </View>

            {/* 智能决策卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="analytics" size={24} color="#047857" />
                <Text style={styles.featureTitle}>智能种植建议</Text>
              </View>
              <Text style={styles.featureDescription}>
                基于历史数据和当前环境，提供个性化的种植管理建议
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>获取建议</Text>
                <Ionicons name="arrow-forward" size={16} color="#047857" />
              </TouchableOpacity>
            </View>
          </View>

          {/* 开发状态 */}
          <View style={styles.developmentStatus}>
            <View style={styles.statusHeader}>
              <Ionicons name="construct" size={20} color="#f59e0b" />
              <Text style={styles.statusTitle}>Framework Only</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '15%' }]} />
            </View>
            <Text style={styles.progressText}>15% 完成 - 基础架构已搭建</Text>
            <Text style={styles.statusDescription}>
              当前提供基础框架和导航结构，完整功能将在后续阶段开发
            </Text>
          </View>

        </ScrollView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80, // 为底部Tab留出空间
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  stepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepInfo: {
    flex: 1,
  },
  stepName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  stepDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  featureCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  featureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 12,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
    lineHeight: 20,
  },
  featureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  featureButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  developmentStatus: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#10b981',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});