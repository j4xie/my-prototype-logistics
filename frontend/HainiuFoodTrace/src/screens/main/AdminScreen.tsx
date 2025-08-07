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

interface AdminScreenProps {
  navigation: any;
}

export const AdminScreen: React.FC<AdminScreenProps> = ({ navigation }) => {
  const { user } = useAuthStore();
  const { hasPermission } = usePermission();

  const adminModules = [
    { id: 1, name: '用户管理', icon: 'people-outline', color: '#6b7280', screen: 'UserManagement' },
    { id: 2, name: '角色权限', icon: 'shield-outline', color: '#4b5563', screen: null },
    { id: 3, name: '部门管理', icon: 'business-outline', color: '#374151', screen: null },
    { id: 4, name: '系统配置', icon: 'settings-outline', color: '#1f2937', screen: null },
    { id: 5, name: '审计日志', icon: 'document-text-outline', color: '#111827', screen: null },
    { id: 6, name: '数据统计', icon: 'analytics-outline', color: '#030712', screen: null },
  ];

  const quickActions = [
    { name: '用户管理', icon: 'person-add', color: '#6b7280' },
    { name: '权限配置', icon: 'key', color: '#4b5563' },
    { name: '系统监控', icon: 'pulse', color: '#374151' },
    { name: '日志查看', icon: 'list', color: '#1f2937' },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#6b7280" />
      <LinearGradient
        colors={['#6b7280', '#4b5563', '#374151']}
        style={styles.container}
      >
        {/* 头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>管理中心模块</Text>
            <Text style={styles.headerSubtitle}>Framework Only - 基础架构</Text>
          </View>
          <View style={styles.headerIcon}>
            <Ionicons name="settings" size={32} color="#fff" />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          
          {/* 快速操作区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>快速管理</Text>
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

          {/* 管理模块区域 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>系统管理模块</Text>
            {adminModules.map((module) => (
              <TouchableOpacity 
                key={module.id} 
                style={styles.stepCard}
                onPress={() => {
                  if (module.screen) {
                    navigation.navigate(module.screen);
                  } else {
                    // TODO: 显示开发中提示
                    console.log(`${module.name} 功能开发中...`);
                  }
                }}
              >
                <View style={[styles.stepIcon, { backgroundColor: module.color }]}>
                  <Ionicons name={module.icon as any} size={24} color="#fff" />
                </View>
                <View style={styles.stepInfo}>
                  <Text style={styles.stepName}>{module.name}</Text>
                  <Text style={styles.stepDescription}>
                    {module.screen ? '点击进入管理页面' : '模块框架已就绪，待完整开发'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#6b7280" />
              </TouchableOpacity>
            ))}
          </View>

          {/* 功能卡片 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>核心功能</Text>
            
            {/* 用户权限管理卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="people" size={24} color="#6b7280" />
                <Text style={styles.featureTitle}>用户权限管理</Text>
              </View>
              <Text style={styles.featureDescription}>
                统一管理系统用户、角色权限和部门结构配置
              </Text>
              <TouchableOpacity 
                style={styles.featureButton}
                onPress={() => navigation.navigate('UserManagement')}
              >
                <Text style={styles.featureButtonText}>用户管理</Text>
                <Ionicons name="arrow-forward" size={16} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* 系统监控卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="pulse" size={24} color="#4b5563" />
                <Text style={styles.featureTitle}>系统监控中心</Text>
              </View>
              <Text style={styles.featureDescription}>
                实时监控系统运行状态、性能指标和异常告警
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>监控面板</Text>
                <Ionicons name="arrow-forward" size={16} color="#4b5563" />
              </TouchableOpacity>
            </View>

            {/* 审计日志卡片 */}
            <View style={styles.featureCard}>
              <View style={styles.featureHeader}>
                <Ionicons name="document-text" size={24} color="#374151" />
                <Text style={styles.featureTitle}>审计日志系统</Text>
              </View>
              <Text style={styles.featureDescription}>
                记录和查询系统操作日志，支持安全审计和合规检查
              </Text>
              <TouchableOpacity style={styles.featureButton}>
                <Text style={styles.featureButtonText}>日志查询</Text>
                <Ionicons name="arrow-forward" size={16} color="#374151" />
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
    backgroundColor: '#6b7280',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 8,
  },
  statusDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
});