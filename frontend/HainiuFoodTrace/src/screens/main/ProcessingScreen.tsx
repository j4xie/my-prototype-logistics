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

interface ProcessingScreenProps {
  navigation: any;
}

export const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const processingSteps = [
    { id: 1, name: '原料接收', icon: 'cube-outline', color: '#10b981' },
    { id: 2, name: '清洗处理', icon: 'water-outline', color: '#3b82f6' },
    { id: 3, name: '加工制作', icon: 'cog-outline', color: '#f59e0b' },
    { id: 4, name: '质量检测', icon: 'shield-checkmark-outline', color: '#8b5cf6' },
    { id: 5, name: '包装封装', icon: 'gift-outline', color: '#ef4444' },
    { id: 6, name: '成品入库', icon: 'archive-outline', color: '#6b7280' },
  ];

  const quickActions = [
    { name: '扫码录入', icon: 'scan', color: '#3182ce' },
    { name: '手动录入', icon: 'create', color: '#10b981' },
    { name: '批量导入', icon: 'cloud-upload', color: '#f59e0b' },
    { name: '数据导出', icon: 'download', color: '#8b5cf6' },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#f59e0b" />
      <LinearGradient
        colors={['#f59e0b', '#d97706', '#b45309']}
        style={styles.container}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>食品加工模块</Text>
            <Text style={styles.headerSubtitle}>Phase 2 重点开发模块</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="cog" size={32} color="#fff" />
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

          {/* 加工流程区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>加工流程管理</Text>
            {processingSteps.map((step) => (
              <TouchableOpacity key={step.id} style={styles.stepCard}>
                <View style={[styles.stepIcon, { backgroundColor: step.color }]}>
                  <Ionicons name={step.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepName}>{step.name}</Text>
                  <Text style={styles.stepDescription}>
                    步骤 {step.id} - 点击进入详细管理
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>

          {/* 功能卡片 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>高级功能</Text>
            
            {/* DeepSeek 智能分析卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="analytics" size={24} color="#8b5cf6" />
                <Text style={styles.featureTitle}>DeepSeek 智能分析</Text>
              </View>
              <Text style={styles.featureDescription}>
                利用AI技术分析加工数据，提供智能建议和问题诊断
              </Text>
              <TouchableOpacity 
                style={styles.featureButton}
                onPress={() => navigation.navigate('DeepSeekAnalysis')}
              >
                <Text style={styles.featureButtonText}>启动智能分析</Text>
                <Ionicons name="arrow-forward" size={16} color="#8b5cf6" />
              </TouchableOpacity>
            </View>

            {/* 员工管理卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="people" size={24} color="#10b981" />
                <Text style={styles.featureTitle}>员工录入管理</Text>
              </View>
              <Text style={styles.featureDescription}>
                管理加工环节的员工信息和工作记录
              </Text>
              <TouchableOpacity 
                style={styles.featureButton}
                onPress={() => navigation.navigate('EmployeeInput')}
              >
                <Text style={styles.featureButtonText}>员工录入</Text>
                <Ionicons name="arrow-forward" size={16} color="#10b981" />
              </TouchableOpacity>
            </View>

            {/* 设备管理卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="hardware-chip" size={24} color="#f59e0b" />
                <Text style={styles.featureTitle}>设备自动录入</Text>
              </View>
              <Text style={styles.featureDescription}>
                自动采集加工设备数据，实时监控设备状态
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>设备监控</Text>
                <Ionicons name="arrow-forward" size={16} color="#f59e0b" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Phase 2 开发状态 */}
          <View style={styles.developmentStatus}>
            <View style={styles.statusHeader}>
              <Ionicons name="code-working" size={20} color="#3182ce" />
              <Text style={styles.statusTitle}>Phase 2 开发进度</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: '30%' }]} />
            </View>
            <Text style={styles.progressText}>30% 完成 - 预计3周完成全部功能</Text>
            <Text style={styles.statusDescription}>
              当前已实现基础框架，正在开发完整功能和DeepSeek集成
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
    backgroundColor: '#3182ce',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3182ce',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});