import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { usePermission } from '../../hooks/usePermission';
import { USER_ROLE_CONFIG, EnhancedUserRole } from './RoleSelector';
import { PERMISSION_GROUPS, Permission } from './PermissionSettingsPanel';
import { DEPARTMENTS, Department } from './DepartmentPermissionManager';

const screenWidth = Dimensions.get('window').width;

// 用户权限显示数据类型
export interface UserPermissionData {
  userId: string;
  userName: string;
  userRole: string;
  directPermissions: string[];
  inheritedPermissions: string[];
  departmentPermissions: Record<string, string[]>;
  effectivePermissions: string[];
  riskLevel: 'low' | 'medium' | 'high';
  lastUpdated: Date;
  permissionScore: number;
}

// 权限分析数据
export interface PermissionAnalytics {
  totalPermissions: number;
  directCount: number;
  inheritedCount: number;
  departmentCount: number;
  highRiskCount: number;
  coveragePercentage: number;
  categoryBreakdown: Record<string, number>;
  recentChanges: Array<{
    action: 'granted' | 'revoked' | 'modified';
    permission: string;
    timestamp: Date;
    source: 'direct' | 'inherited' | 'department';
  }>;
}

interface UserPermissionDisplayProps {
  userId?: string;
  userRole?: string;
  showAnalytics?: boolean;
  showHistory?: boolean;
  allowExport?: boolean;
  refreshable?: boolean;
  compactMode?: boolean;
  onPermissionClick?: (permission: string) => void;
  onRoleClick?: (role: string) => void;
}

/**
 * 用户权限显示组件
 * 提供全面的用户权限可视化和分析功能
 */
export const UserPermissionDisplay: React.FC<UserPermissionDisplayProps> = ({
  userId,
  userRole,
  showAnalytics = true,
  showHistory = true,
  allowExport = false,
  refreshable = true,
  compactMode = false,
  onPermissionClick,
  onRoleClick
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'overview' | 'details' | 'analytics' | 'history'>('overview');
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['user', 'processing']);
  const [showRiskOnly, setShowRiskOnly] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { user, permissions, hasPermission, refreshPermissions } = usePermission();

  // Mock用户权限数据
  const mockUserPermissionData: UserPermissionData = useMemo(() => ({
    userId: userId || user?.id || 'current_user',
    userName: user?.username || '当前用户',
    userRole: userRole || (user?.userType === 'platform' ? user.platformUser?.role : user?.userType === 'factory' ? user.factoryUser?.role : 'operator') || 'operator',
    directPermissions: ['processing.operate', 'data.input', 'report.view'],
    inheritedPermissions: ['data.view'],
    departmentPermissions: {
      'processing': ['processing.operate', 'processing.quality_control'],
      'processing_qa': ['data.input', 'report.generate']
    },
    effectivePermissions: ['processing.operate', 'data.input', 'report.view', 'data.view', 'processing.quality_control', 'report.generate'],
    riskLevel: 'medium',
    lastUpdated: new Date(),
    permissionScore: 75
  }), [userId, userRole, user]);

  // 计算权限分析数据
  const analyticsData: PermissionAnalytics = useMemo(() => {
    const data = mockUserPermissionData;
    const allPermissions = PERMISSION_GROUPS.flatMap(group => group.permissions);
    
    // 按类别统计权限
    const categoryBreakdown: Record<string, number> = {};
    PERMISSION_GROUPS.forEach(group => {
      const categoryPermissions = data.effectivePermissions.filter(perm =>
        group.permissions.some(p => p.key === perm)
      );
      categoryBreakdown[group.displayName] = categoryPermissions.length;
    });

    // 风险权限统计
    const highRiskPermissions = data.effectivePermissions.filter(perm => {
      const permission = allPermissions.find(p => p.key === perm);
      return permission?.riskLevel === 'high';
    });

    return {
      totalPermissions: allPermissions.length,
      directCount: data.directPermissions.length,
      inheritedCount: data.inheritedPermissions.length,
      departmentCount: Object.values(data.departmentPermissions).flat().length,
      highRiskCount: highRiskPermissions.length,
      coveragePercentage: Math.round((data.effectivePermissions.length / allPermissions.length) * 100),
      categoryBreakdown,
      recentChanges: [
        {
          action: 'granted',
          permission: 'processing.quality_control',
          timestamp: new Date(Date.now() - 86400000),
          source: 'department'
        },
        {
          action: 'revoked',
          permission: 'user.manage',
          timestamp: new Date(Date.now() - 172800000),
          source: 'direct'
        }
      ]
    };
  }, [mockUserPermissionData]);

  // 处理刷新
  const handleRefresh = useCallback(async () => {
    if (!refreshable) return;
    
    setRefreshing(true);
    try {
      await refreshPermissions();
      // 模拟刷新延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      Alert.alert('错误', '权限数据刷新失败');
    } finally {
      setRefreshing(false);
    }
  }, [refreshable, refreshPermissions]);

  // 处理导出
  const handleExport = useCallback(async () => {
    if (!allowExport) return;

    setIsExporting(true);
    try {
      // 模拟导出过程
      await new Promise(resolve => setTimeout(resolve, 2000));
      Alert.alert('导出成功', '权限数据已导出到本地文件');
    } catch (error) {
      Alert.alert('导出失败', '无法导出权限数据');
    } finally {
      setIsExporting(false);
    }
  }, [allowExport]);

  // 切换分类展开状态
  const toggleCategoryExpansion = useCallback((categoryKey: string) => {
    setExpandedCategories(prev =>
      prev.includes(categoryKey)
        ? prev.filter(key => key !== categoryKey)
        : [...prev, categoryKey]
    );
  }, []);

  // 获取权限风险等级颜色
  const getPermissionRiskColor = useCallback((permissionKey: string): string => {
    const allPermissions = PERMISSION_GROUPS.flatMap(group => group.permissions);
    const permission = allPermissions.find(p => p.key === permissionKey);
    
    switch (permission?.riskLevel) {
      case 'high': return '#E74C3C';
      case 'medium': return '#F39C12';
      case 'low': return '#27AE60';
      default: return '#95A5A6';
    }
  }, []);

  // 渲染概览视图
  const renderOverview = useCallback(() => {
    const roleInfo = USER_ROLES[mockUserPermissionData.userRole];
    const data = mockUserPermissionData;

    return (
      <ScrollView
        style={styles.overviewContainer}
        refreshControl={
          refreshable ? (
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          ) : undefined
        }
      >
        {/* 用户信息卡片 */}
        <View style={styles.userInfoCard}>
          <View style={styles.userHeader}>
            <View style={styles.userAvatar}>
              <Ionicons
                name={roleInfo?.icon as any || 'person-circle'}
                size={40}
                color={roleInfo?.color || '#4ECDC4'}
              />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{data.userName}</Text>
              <TouchableOpacity
                style={styles.roleContainer}
                onPress={() => onRoleClick?.(data.userRole)}
              >
                <Text style={[styles.userRole, { color: roleInfo?.color || '#4ECDC4' }]}>
                  {roleInfo?.displayName || data.userRole}
                </Text>
                <View style={[styles.roleBadge, { backgroundColor: roleInfo?.color || '#4ECDC4' }]}>
                  <Text style={styles.roleLevelText}>L{roleInfo?.level || 0}</Text>
                </View>
              </TouchableOpacity>
              <Text style={styles.lastUpdated}>
                更新时间: {data.lastUpdated.toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.permissionScore}>
              <Text style={styles.scoreNumber}>{data.permissionScore}</Text>
              <Text style={styles.scoreLabel}>权限分</Text>
            </View>
          </View>
        </View>

        {/* 权限统计卡片 */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{data.effectivePermissions.length}</Text>
            <Text style={styles.statLabel}>有效权限</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{data.directPermissions.length}</Text>
            <Text style={styles.statLabel}>直接权限</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#F39C12' }]}>
              {data.inheritedPermissions.length}
            </Text>
            <Text style={styles.statLabel}>继承权限</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statNumber, { color: '#E74C3C' }]}>
              {analyticsData.highRiskCount}
            </Text>
            <Text style={styles.statLabel}>高风险</Text>
          </View>
        </View>

        {/* 权限分布图表 */}
        {showAnalytics && (
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>权限分类分布</Text>
            <PieChart
              data={Object.entries(analyticsData.categoryBreakdown)
                .filter(([, count]) => count > 0)
                .map(([name, count], index) => ({
                  name,
                  population: count,
                  color: PERMISSION_GROUPS[index]?.color || '#95A5A6',
                  legendFontColor: '#666',
                  legendFontSize: 12
                }))}
              width={screenWidth - 60}
              height={180}
              chartConfig={{
                color: (opacity = 1) => `rgba(78, 205, 196, ${opacity})`,
              }}
              accessor="population"
              backgroundColor="transparent"
              paddingLeft="15"
              absolute
            />
          </View>
        )}

        {/* 快速权限列表 */}
        <View style={styles.quickPermissionsCard}>
          <Text style={styles.cardTitle}>常用权限</Text>
          <View style={styles.permissionTags}>
            {data.effectivePermissions.slice(0, 8).map(permission => (
              <TouchableOpacity
                key={permission}
                style={[
                  styles.permissionTag,
                  { borderColor: getPermissionRiskColor(permission) }
                ]}
                onPress={() => onPermissionClick?.(permission)}
              >
                <View style={[
                  styles.permissionIndicator,
                  { backgroundColor: getPermissionRiskColor(permission) }
                ]} />
                <Text style={styles.permissionTagText}>{permission}</Text>
              </TouchableOpacity>
            ))}
            {data.effectivePermissions.length > 8 && (
              <TouchableOpacity
                style={styles.morePermissionsTag}
                onPress={() => setSelectedView('details')}
              >
                <Text style={styles.morePermissionsText}>
                  +{data.effectivePermissions.length - 8} 更多
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 部门权限摘要 */}
        <View style={styles.departmentSummaryCard}>
          <Text style={styles.cardTitle}>部门权限摘要</Text>
          {Object.entries(data.departmentPermissions).map(([deptId, perms]) => {
            const department = DEPARTMENTS.find(d => d.id === deptId);
            return (
              <View key={deptId} style={styles.departmentRow}>
                <View style={styles.departmentInfo}>
                  <Ionicons
                    name={department?.icon as any || 'business'}
                    size={16}
                    color={department?.color || '#4ECDC4'}
                  />
                  <Text style={styles.departmentName}>
                    {department?.displayName || deptId}
                  </Text>
                </View>
                <Text style={styles.departmentPermCount}>{perms.length} 权限</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }, [
    mockUserPermissionData,
    analyticsData,
    refreshable,
    refreshing,
    showAnalytics,
    handleRefresh,
    onRoleClick,
    onPermissionClick,
    getPermissionRiskColor
  ]);

  // 渲染详细视图
  const renderDetails = useCallback(() => {
    const data = mockUserPermissionData;
    const filteredGroups = showRiskOnly
      ? PERMISSION_GROUPS.map(group => ({
          ...group,
          permissions: group.permissions.filter(p =>
            p.riskLevel === 'high' && data.effectivePermissions.includes(p.key)
          )
        })).filter(group => group.permissions.length > 0)
      : PERMISSION_GROUPS;

    return (
      <ScrollView style={styles.detailsContainer}>
        {/* 过滤器 */}
        <View style={styles.filterBar}>
          <TouchableOpacity
            style={[styles.filterButton, showRiskOnly && styles.filterButtonActive]}
            onPress={() => setShowRiskOnly(!showRiskOnly)}
          >
            <Ionicons
              name="warning"
              size={16}
              color={showRiskOnly ? '#FFFFFF' : '#E74C3C'}
            />
            <Text style={[
              styles.filterButtonText,
              showRiskOnly && styles.filterButtonTextActive
            ]}>
              仅高风险
            </Text>
          </TouchableOpacity>
        </View>

        {/* 权限分组详情 */}
        {filteredGroups.map(group => {
          const isExpanded = expandedCategories.includes(group.key);
          const userPermissionsInGroup = group.permissions.filter(p =>
            data.effectivePermissions.includes(p.key)
          );

          if (userPermissionsInGroup.length === 0) return null;

          return (
            <View key={group.key} style={styles.permissionGroupCard}>
              {/* 分组头部 */}
              <TouchableOpacity
                style={styles.groupHeader}
                onPress={() => toggleCategoryExpansion(group.key)}
              >
                <View style={styles.groupInfo}>
                  <Ionicons
                    name={group.icon as any}
                    size={24}
                    color={group.color}
                  />
                  <View style={styles.groupTextInfo}>
                    <Text style={[styles.groupName, { color: group.color }]}>
                      {group.displayName}
                    </Text>
                    <Text style={styles.groupDescription}>{group.description}</Text>
                  </View>
                </View>
                <View style={styles.groupStats}>
                  <Text style={styles.groupPermCount}>
                    {userPermissionsInGroup.length}/{group.permissions.length}
                  </Text>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#666"
                  />
                </View>
              </TouchableOpacity>

              {/* 权限详情列表 */}
              {isExpanded && (
                <View style={styles.permissionsList}>
                  {userPermissionsInGroup.map(permission => {
                    const source = data.directPermissions.includes(permission.key) ? 'direct'
                      : data.inheritedPermissions.includes(permission.key) ? 'inherited'
                      : 'department';

                    return (
                      <TouchableOpacity
                        key={permission.key}
                        style={styles.permissionDetailItem}
                        onPress={() => onPermissionClick?.(permission.key)}
                      >
                        <View style={styles.permissionDetailHeader}>
                          <Text style={styles.permissionName}>
                            {permission.displayName}
                          </Text>
                          <View style={styles.permissionBadges}>
                            <View style={[
                              styles.sourceBadge,
                              source === 'direct' && styles.directBadge,
                              source === 'inherited' && styles.inheritedBadge,
                              source === 'department' && styles.departmentBadge
                            ]}>
                              <Text style={styles.sourceBadgeText}>
                                {source === 'direct' ? '直接' : source === 'inherited' ? '继承' : '部门'}
                              </Text>
                            </View>
                            <View style={[
                              styles.riskBadge,
                              { backgroundColor: getPermissionRiskColor(permission.key) }
                            ]}>
                              <Text style={styles.riskBadgeText}>
                                {permission.riskLevel === 'high' ? '高' : permission.riskLevel === 'medium' ? '中' : '低'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.permissionDescription}>
                          {permission.description}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    );
  }, [
    mockUserPermissionData,
    showRiskOnly,
    expandedCategories,
    toggleCategoryExpansion,
    onPermissionClick,
    getPermissionRiskColor
  ]);

  // 渲染分析视图
  const renderAnalytics = useCallback(() => {
    if (!showAnalytics) return null;

    return (
      <ScrollView style={styles.analyticsContainer}>
        {/* 权限趋势图表 */}
        <View style={styles.chartCard}>
          <Text style={styles.chartTitle}>权限数量趋势</Text>
          <LineChart
            data={{
              labels: ['本月', '上月', '3个月前', '6个月前'],
              datasets: [
                {
                  data: [
                    mockUserPermissionData.effectivePermissions.length,
                    mockUserPermissionData.effectivePermissions.length - 2,
                    mockUserPermissionData.effectivePermissions.length - 5,
                    mockUserPermissionData.effectivePermissions.length - 8
                  ]
                }
              ]
            }}
            width={screenWidth - 60}
            height={200}
            yAxisLabel=""
            chartConfig={{
              backgroundColor: '#4ECDC4',
              backgroundGradientFrom: '#4ECDC4',
              backgroundGradientTo: '#44D7CE',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: {
                borderRadius: 16
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: '#FFFFFF'
              }
            }}
            bezier
            style={styles.chart}
          />
        </View>

        {/* 风险分析 */}
        <View style={styles.riskAnalysisCard}>
          <Text style={styles.cardTitle}>权限风险分析</Text>
          <View style={styles.riskLevelBars}>
            {['high', 'medium', 'low'].map(level => {
              const count = mockUserPermissionData.effectivePermissions.filter(perm => {
                const allPermissions = PERMISSION_GROUPS.flatMap(g => g.permissions);
                const permission = allPermissions.find(p => p.key === perm);
                return permission?.riskLevel === level;
              }).length;

              const total = mockUserPermissionData.effectivePermissions.length;
              const percentage = total > 0 ? (count / total) * 100 : 0;

              return (
                <View key={level} style={styles.riskBar}>
                  <Text style={styles.riskLabel}>
                    {level === 'high' ? '高风险' : level === 'medium' ? '中风险' : '低风险'}
                  </Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBackground}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${percentage}%`,
                            backgroundColor: getPermissionRiskColor(`mock_${level}`)
                          }
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>{count}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  }, [showAnalytics, mockUserPermissionData, getPermissionRiskColor]);

  // 渲染历史视图
  const renderHistory = useCallback(() => {
    if (!showHistory) return null;

    return (
      <ScrollView style={styles.historyContainer}>
        <View style={styles.historyCard}>
          <Text style={styles.cardTitle}>权限变更历史</Text>
          {analyticsData.recentChanges.map((change, index) => (
            <View key={index} style={styles.historyItem}>
              <View style={styles.historyIconContainer}>
                <Ionicons
                  name={
                    change.action === 'granted' ? 'add-circle' :
                    change.action === 'revoked' ? 'remove-circle' : 'sync-circle'
                  }
                  size={20}
                  color={
                    change.action === 'granted' ? '#27AE60' :
                    change.action === 'revoked' ? '#E74C3C' : '#F39C12'
                  }
                />
              </View>
              <View style={styles.historyDetails}>
                <Text style={styles.historyAction}>
                  {change.action === 'granted' ? '授予' :
                   change.action === 'revoked' ? '撤销' : '修改'}权限
                </Text>
                <Text style={styles.historyPermission}>{change.permission}</Text>
                <Text style={styles.historyMeta}>
                  来源: {change.source === 'direct' ? '直接分配' :
                         change.source === 'inherited' ? '角色继承' : '部门权限'} •{' '}
                  {change.timestamp.toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }, [showHistory, analyticsData]);

  return (
    <View style={styles.container}>
      {/* 顶部导航栏 */}
      <View style={styles.navigationBar}>
        <View style={styles.navTabs}>
          {[
            { key: 'overview', label: '概览', icon: 'pie-chart' },
            { key: 'details', label: '详情', icon: 'list' },
            ...(showAnalytics ? [{ key: 'analytics', label: '分析', icon: 'analytics' }] : []),
            ...(showHistory ? [{ key: 'history', label: '历史', icon: 'time' }] : [])
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.navTab,
                selectedView === tab.key && styles.navTabActive
              ]}
              onPress={() => setSelectedView(tab.key as any)}
            >
              <Ionicons
                name={tab.icon as any}
                size={16}
                color={selectedView === tab.key ? '#4ECDC4' : '#666'}
              />
              <Text style={[
                styles.navTabText,
                selectedView === tab.key && styles.navTabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 操作按钮 */}
        <View style={styles.actionButtons}>
          {allowExport && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <ActivityIndicator size="small" color="#4ECDC4" />
              ) : (
                <Ionicons name="download" size={20} color="#4ECDC4" />
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 内容区域 */}
      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={styles.loadingText}>加载权限数据...</Text>
          </View>
        ) : (
          <>
            {selectedView === 'overview' && renderOverview()}
            {selectedView === 'details' && renderDetails()}
            {selectedView === 'analytics' && renderAnalytics()}
            {selectedView === 'history' && renderHistory()}
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  navigationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  navTabs: {
    flexDirection: 'row',
    flex: 1,
  },
  navTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 8,
  },
  navTabActive: {
    backgroundColor: '#F0FDFC',
  },
  navTabText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
  },
  navTabTextActive: {
    color: '#4ECDC4',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#F8F9FA',
    marginLeft: 8,
  },
  contentArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
  },
  overviewContainer: {
    flex: 1,
    padding: 16,
  },
  userInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 14,
    fontWeight: '600',
    marginRight: 8,
  },
  roleBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleLevelText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#999',
  },
  permissionScore: {
    alignItems: 'center',
  },
  scoreNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4ECDC4',
  },
  scoreLabel: {
    fontSize: 12,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 16,
  },
  quickPermissionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  permissionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  permissionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  permissionIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  permissionTagText: {
    fontSize: 12,
    color: '#333',
  },
  morePermissionsTag: {
    backgroundColor: '#F0FDFC',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  morePermissionsText: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  departmentSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  departmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  departmentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  departmentName: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
  },
  departmentPermCount: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
  },
  detailsContainer: {
    flex: 1,
    padding: 16,
  },
  filterBar: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  filterButtonActive: {
    backgroundColor: '#E74C3C',
    borderColor: '#E74C3C',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#E74C3C',
    marginLeft: 4,
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  permissionGroupCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupTextInfo: {
    marginLeft: 12,
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  groupDescription: {
    fontSize: 12,
    color: '#666',
  },
  groupStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupPermCount: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '500',
    marginRight: 8,
  },
  permissionsList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  permissionDetailItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  permissionDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  permissionName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  permissionBadges: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 4,
  },
  directBadge: {
    backgroundColor: '#4ECDC4',
  },
  inheritedBadge: {
    backgroundColor: '#F39C12',
  },
  departmentBadge: {
    backgroundColor: '#9B59B6',
  },
  sourceBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  riskBadge: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
  },
  riskBadgeText: {
    fontSize: 8,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  analyticsContainer: {
    flex: 1,
    padding: 16,
  },
  riskAnalysisCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  riskLevelBars: {
    marginTop: 8,
  },
  riskBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  riskLabel: {
    fontSize: 14,
    color: '#666',
    width: 60,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 12,
  },
  progressBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#F0F0F0',
    borderRadius: 4,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'right',
  },
  historyContainer: {
    flex: 1,
    padding: 16,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  historyIconContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  historyDetails: {
    flex: 1,
  },
  historyAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  historyPermission: {
    fontSize: 13,
    color: '#4ECDC4',
    marginBottom: 4,
  },
  historyMeta: {
    fontSize: 11,
    color: '#999',
  },
});

export default UserPermissionDisplay;