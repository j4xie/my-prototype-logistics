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

interface LogisticsScreenProps {
  navigation: any;
}

export const LogisticsScreen: React.FC<LogisticsScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const logisticsSteps = [
    { id: 1, name: '出库管理', icon: 'cube-outline', color: '#3b82f6' },
    { id: 2, name: '运输跟踪', icon: 'car-outline', color: '#2563eb' },
    { id: 3, name: '中转管理', icon: 'swap-horizontal-outline', color: '#1d4ed8' },
    { id: 4, name: '温控监测', icon: 'thermometer-outline', color: '#1e40af' },
    { id: 5, name: '配送管理', icon: 'location-outline', color: '#1e3a8a' },
    { id: 6, name: '签收确认', icon: 'checkmark-circle-outline', color: '#1e293b' },
  ];

  const quickActions = [
    { name: '扫码出库', icon: 'scan', color: '#3b82f6' },
    { name: '运输跟踪', icon: 'navigate', color: '#2563eb' },
    { name: '温度监控', icon: 'thermometer', color: '#1d4ed8' },
    { name: '签收管理', icon: 'checkmark-done', color: '#1e40af' },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#3b82f6" />
      <LinearGradient
        colors={['#3b82f6', '#2563eb', '#1d4ed8']}
        style={styles.container}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>物流管理模块</Text>
            <Text style={styles.headerSubtitle}>Framework Only - 基础架构</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="car" size={32} color="#fff" />
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

          {/* 物流流程区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>物流流程管理</Text>
            {logisticsSteps.map((step) => (
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
            
            {/* 实时追踪卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="location" size={24} color="#3b82f6" />
                <Text style={styles.featureTitle}>实时位置追踪</Text>
              </View>
              <Text style={styles.featureDescription}>
                GPS实时定位，全程监控货物运输状态和位置信息
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>查看运输状态</Text>
                <Ionicons name="arrow-forward" size={16} color="#3b82f6" />
              </TouchableOpacity>
            </View>

            {/* 温控监测卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="thermometer" size={24} color="#2563eb" />
                <Text style={styles.featureTitle}>冷链温控监测</Text>
              </View>
              <Text style={styles.featureDescription}>
                24小时温度监控，确保冷链运输全程温度达标
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>查看温度记录</Text>
                <Ionicons name="arrow-forward" size={16} color="#2563eb" />
              </TouchableOpacity>
            </View>

            {/* 配送优化卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="analytics" size={24} color="#1d4ed8" />
                <Text style={styles.featureTitle}>智能路线优化</Text>
              </View>
              <Text style={styles.featureDescription}>
                基于交通状况和配送要求，智能规划最优配送路线
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>路线规划</Text>
                <Ionicons name="arrow-forward" size={16} color="#1d4ed8" />
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
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3b82f6',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});