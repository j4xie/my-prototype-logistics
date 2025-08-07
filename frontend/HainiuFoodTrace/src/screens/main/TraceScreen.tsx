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

interface TraceScreenProps {
  navigation: any;
}

export const TraceScreen: React.FC<TraceScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const traceSteps = [
    { id: 1, name: '源头追溯', icon: 'leaf-outline', color: '#8b5cf6' },
    { id: 2, name: '生产过程', icon: 'cog-outline', color: '#7c3aed' },
    { id: 3, name: '质量检测', icon: 'shield-checkmark-outline', color: '#6d28d9' },
    { id: 4, name: '物流运输', icon: 'car-outline', color: '#5b21b6' },
    { id: 5, name: '销售流向', icon: 'storefront-outline', color: '#4c1d95' },
    { id: 6, name: '消费反馈', icon: 'people-outline', color: '#3730a3' },
  ];

  const quickActions = [
    { name: '扫码查询', icon: 'scan', color: '#8b5cf6' },
    { name: '批次查询', icon: 'search', color: '#7c3aed' },
    { name: '产地查询', icon: 'location', color: '#6d28d9' },
    { name: '时间查询', icon: 'time', color: '#5b21b6' },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#8b5cf6" />
      <LinearGradient
        colors={['#8b5cf6', '#7c3aed', '#6d28d9']}
        style={styles.container}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>溯源查询模块</Text>
            <Text style={styles.headerSubtitle}>Framework Only - 基础架构</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="search" size={32} color="#fff" />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          {/* 快速操作区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快速查询</Text>
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

          {/* 溯源流程区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>溯源信息链路</Text>
            {traceSteps.map((step) => (
              <TouchableOpacity key={step.id} style={styles.stepCard}>
                <View style={[styles.stepIcon, { backgroundColor: step.color }]}>
                  <Ionicons name={step.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepName}>{step.name}</Text>
                  <Text style={styles.stepDescription}>
                    环节 {step.id} - 框架已就绪，待完整开发
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>

          {/* 功能卡片 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>核心功能</Text>
            
            {/* 二维码溯源卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="qr-code" size={24} color="#8b5cf6" />
                <Text style={styles.featureTitle}>二维码溯源</Text>
              </View>
              <Text style={styles.featureDescription}>
                扫描产品二维码，即可查看完整的生产溯源信息链
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>开始扫码</Text>
                <Ionicons name="arrow-forward" size={16} color="#8b5cf6" />
              </TouchableOpacity>
            </View>

            {/* 批次追溯卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="layers" size={24} color="#7c3aed" />
                <Text style={styles.featureTitle}>批次追溯查询</Text>
              </View>
              <Text style={styles.featureDescription}>
                输入批次号或生产日期，查询该批次产品的详细信息
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>批次查询</Text>
                <Ionicons name="arrow-forward" size={16} color="#7c3aed" />
              </TouchableOpacity>
            </View>

            {/* 全链路追踪卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="git-network" size={24} color="#6d28d9" />
                <Text style={styles.featureTitle}>全链路追踪</Text>
              </View>
              <Text style={styles.featureDescription}>
                从原料到销售的完整链路追踪，支持时间线和地图视图
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>链路分析</Text>
                <Ionicons name="arrow-forward" size={16} color="#6d28d9" />
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
    backgroundColor: '#8b5cf6',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8b5cf6',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});