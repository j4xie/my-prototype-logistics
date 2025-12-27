/**
 * 员工详情页面
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import { WSWorkersStackParamList } from '../../../types/navigation';

type RouteProps = RouteProp<WSWorkersStackParamList, 'WorkerDetail'>;

export function WorkerDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  // 模拟员工数据
  const worker = {
    id: route.params?.workerId || 1,
    name: '王建国',
    employeeId: 'EMP-001',
    role: '切片操作员',
    department: '加工车间',
    status: 'on_duty',
    phone: '138****5678',
    joinDate: '2023-06-15',
    isTemporary: false,
    todayHours: 4.0,
    efficiency: {
      overall: 96,
      attendance: 92,
      quality: 95,
      speed: 88,
    },
    recentTasks: [
      { date: '今天', batch: 'PB-20251227-001', task: '切片', status: '进行中' },
      { date: '昨天', batch: 'PB-20251226-008', task: '切片', status: '已完成' },
      { date: '前天', batch: 'PB-20251225-005', task: '包装', status: '已完成' },
    ],
  };

  const getEfficiencyGrade = (value: number) => {
    if (value >= 95) return { grade: 'A', color: '#52c41a' };
    if (value >= 85) return { grade: 'B', color: '#1890ff' };
    if (value >= 75) return { grade: 'C', color: '#faad14' };
    return { grade: 'D', color: '#ff4d4f' };
  };

  const overallGrade = getEfficiencyGrade(worker.efficiency.overall);

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>员工详情</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 员工信息卡片 */}
        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{worker.name.charAt(0)}</Text>
              <View style={[styles.statusDot, { backgroundColor: '#52c41a' }]} />
            </View>
            <View style={styles.profileInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{worker.name}</Text>
                {worker.isTemporary && (
                  <View style={styles.tempBadge}>
                    <Text style={styles.tempBadgeText}>临时</Text>
                  </View>
                )}
              </View>
              <Text style={styles.role}>{worker.role}</Text>
              <Text style={styles.meta}>{worker.employeeId} | {worker.department}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{worker.todayHours}h</Text>
              <Text style={styles.statLabel}>今日工时</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.gradeBadge, { backgroundColor: `${overallGrade.color}20` }]}>
                <Text style={[styles.gradeText, { color: overallGrade.color }]}>
                  {overallGrade.grade}
                </Text>
              </View>
              <Text style={styles.statLabel}>效率评级</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{worker.efficiency.overall}%</Text>
              <Text style={styles.statLabel}>综合效率</Text>
            </View>
          </View>
        </View>

        {/* AI效率评分 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon source="robot" size={18} color="#667eea" />
            <Text style={styles.sectionTitle}>AI效率评分</Text>
          </View>
          <View style={styles.efficiencyCard}>
            <View style={styles.efficiencyRow}>
              <Text style={styles.efficiencyLabel}>出勤率</Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${worker.efficiency.attendance}%`, backgroundColor: '#52c41a' },
                    ]}
                  />
                </View>
                <Text style={styles.efficiencyValue}>{worker.efficiency.attendance}%</Text>
              </View>
            </View>
            <View style={styles.efficiencyRow}>
              <Text style={styles.efficiencyLabel}>质量</Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${worker.efficiency.quality}%`, backgroundColor: '#52c41a' },
                    ]}
                  />
                </View>
                <Text style={styles.efficiencyValue}>{worker.efficiency.quality}%</Text>
              </View>
            </View>
            <View style={styles.efficiencyRow}>
              <Text style={styles.efficiencyLabel}>效率</Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBg}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${worker.efficiency.speed}%`, backgroundColor: '#1890ff' },
                    ]}
                  />
                </View>
                <Text style={styles.efficiencyValue}>{worker.efficiency.speed}%</Text>
              </View>
            </View>
            <View style={styles.trendInfo}>
              <Icon source="trending-up" size={16} color="#52c41a" />
              <Text style={styles.trendText}>近7天效率提升 3%</Text>
            </View>
          </View>
        </View>

        {/* 近期任务 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>近期任务</Text>
          <View style={styles.tasksCard}>
            {worker.recentTasks.map((task, index) => (
              <View key={index} style={styles.taskItem}>
                <Text style={styles.taskDate}>{task.date}</Text>
                <View style={styles.taskInfo}>
                  <Text style={styles.taskBatch}>{task.batch}</Text>
                  <Text style={styles.taskName}>{task.task}</Text>
                </View>
                <View
                  style={[
                    styles.taskStatus,
                    { backgroundColor: task.status === '进行中' ? '#e6f7ff' : '#f6ffed' },
                  ]}
                >
                  <Text
                    style={[
                      styles.taskStatusText,
                      { color: task.status === '进行中' ? '#1890ff' : '#52c41a' },
                    ]}
                  >
                    {task.status}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 基本信息 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>联系电话</Text>
              <Text style={styles.infoValue}>{worker.phone}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>入职日期</Text>
              <Text style={styles.infoValue}>{worker.joinDate}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>所属部门</Text>
              <Text style={styles.infoValue}>{worker.department}</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  tempBadge: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#e6f7ff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  tempBadgeText: {
    fontSize: 10,
    color: '#1890ff',
  },
  role: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  meta: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  gradeBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradeText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginLeft: 6,
  },
  efficiencyCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  efficiencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  efficiencyLabel: {
    width: 60,
    fontSize: 13,
    color: '#666',
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  efficiencyValue: {
    width: 40,
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
  },
  trendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  trendText: {
    fontSize: 12,
    color: '#52c41a',
    marginLeft: 4,
  },
  tasksCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  taskDate: {
    width: 50,
    fontSize: 12,
    color: '#999',
  },
  taskInfo: {
    flex: 1,
  },
  taskBatch: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  taskName: {
    fontSize: 12,
    color: '#999',
  },
  taskStatus: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  taskStatusText: {
    fontSize: 11,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    color: '#333',
  },
});

export default WorkerDetailScreen;
