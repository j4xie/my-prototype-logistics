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

interface PlatformScreenProps {
  navigation: any;
}

export const PlatformScreen: React.FC<PlatformScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const platformModules = [
    { id: 1, name: '工厂管理', icon: 'business-outline', color: '#6366f1' },
    { id: 2, name: '白名单管理', icon: 'shield-checkmark-outline', color: '#4f46e5' },
    { id: 3, name: '计划管理', icon: 'calendar-outline', color: '#4338ca' },
    { id: 4, name: '系统监控', icon: 'pulse-outline', color: '#3730a3' },
    { id: 5, name: '数据统计', icon: 'stats-chart-outline', color: '#312e81' },
    { id: 6, name: '平台配置', icon: 'construct-outline', color: '#1e1b4b' },
  ];

  const quickActions = [
    { name: '工厂注册', icon: 'add-circle', color: '#6366f1' },
    { name: '审核管理', icon: 'checkmark-circle', color: '#4f46e5' },
    { name: '数据概览', icon: 'bar-chart', color: '#4338ca' },
    { name: '系统通知', icon: 'notifications', color: '#3730a3' },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#6366f1" />
      <LinearGradient
        colors={['#6366f1', '#4f46e5', '#4338ca']}
        style={styles.container}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>平台管理模块</Text>
            <Text style={styles.headerSubtitle}>Framework Only - 基础架构</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="planet" size={32} color="#fff" />
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

          {/* 平台管理模块区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>平台管理功能</Text>
            {platformModules.map((module) => (
              <TouchableOpacity key={module.id} style={styles.stepCard}>
                <View style={[styles.stepIcon, { backgroundColor: module.color }]}>
                  <Ionicons name={module.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepName}>{module.name}</Text>
                  <Text style={styles.stepDescription}>
                    功能 {module.id} - 框架已就绪，待完整开发
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>

          {/* 功能卡片 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>核心功能</Text>
            
            {/* 工厂管理卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="business" size={24} color="#6366f1" />
                <Text style={styles.featureTitle}>工厂管理中心</Text>
              </View>
              <Text style={styles.featureDescription}>
                统一管理平台上的所有工厂，包括注册审核、状态监控和运营数据
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>工厂管理</Text>
                <Ionicons name="arrow-forward" size={16} color="#6366f1" />
              </TouchableOpacity>
            </View>

            {/* 白名单管理卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="shield-checkmark" size={24} color="#4f46e5" />
                <Text style={styles.featureTitle}>白名单管理</Text>
              </View>
              <Text style={styles.featureDescription}>
                管理平台用户注册白名单，控制新用户接入权限
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>白名单配置</Text>
                <Ionicons name="arrow-forward" size={16} color="#4f46e5" />
              </TouchableOpacity>
            </View>

            {/* 数据监控卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="analytics" size={24} color="#4338ca" />
                <Text style={styles.featureTitle}>数据监控分析</Text>
              </View>
              <Text style={styles.featureDescription}>
                实时监控平台运营数据，提供多维度数据分析和报表
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>数据中心</Text>
                <Ionicons name="arrow-forward" size={16} color="#4338ca" />
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
    backgroundColor: '#6366f1',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6366f1',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});