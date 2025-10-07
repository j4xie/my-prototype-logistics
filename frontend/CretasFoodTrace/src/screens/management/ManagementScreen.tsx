import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Card, List, Divider, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';

type ManagementNavigationProp = NativeStackNavigationProp<any>;

/**
 * 管理主页 - 工厂配置和管理功能入口
 */
export default function ManagementScreen() {
  const navigation = useNavigation<ManagementNavigationProp>();
  const theme = useTheme();
  const { user } = useAuthStore();

  const isAdmin = user?.factoryUser?.roleCode === 'factory_super_admin' ||
                  user?.factoryUser?.roleCode === 'permission_admin';

  // 调试日志：检查用户角色
  console.log('ManagementScreen - User:', user);
  console.log('ManagementScreen - isAdmin:', isAdmin);
  console.log('ManagementScreen - roleCode:', user?.factoryUser?.roleCode);

  const managementSections = [
    {
      title: '生产配置',
      icon: 'cog-outline',
      items: [
        {
          id: 'product-types',
          title: '产品类型管理',
          description: '配置产品类型(鱼片、鱼头、鱼骨等)',
          icon: 'fish',
          route: 'ProductTypeManagement',
        },
        {
          id: 'conversion-rates',
          title: '转换率配置',
          description: '设置原料到产品的转换率和损耗率',
          icon: 'swap-horizontal',
          route: 'ConversionRate',
        },
      ],
    },
    {
      title: '高级功能',
      icon: 'brain',
      items: [
        {
          id: 'ai-settings',
          title: 'AI分析设置',
          description: '配置AI成本分析的语气、目标和行业标准',
          icon: 'robot',
          route: 'AISettings',
          adminOnly: false,
        },
      ],
    },
    // TODO: Phase 2功能 - 暂时注释
    /*
    {
      title: '业务伙伴管理',
      icon: 'handshake',
      items: [
        {
          id: 'suppliers',
          title: '供应商管理',
          description: '管理供应商信息和采购历史',
          icon: 'truck-delivery',
          route: 'SupplierManagement',
        },
        {
          id: 'customers',
          title: '客户管理',
          description: '管理客户信息和销售历史',
          icon: 'store',
          route: 'CustomerManagement',
        },
      ],
    },
    {
      title: '系统管理',
      icon: 'shield-account',
      items: [
        {
          id: 'users',
          title: '用户管理',
          description: '管理用户、角色和权限',
          icon: 'account-cog',
          route: 'UserManagement',
          adminOnly: true,
        },
        {
          id: 'factory-settings',
          title: '工厂设置',
          description: '工厂基本信息和配置',
          icon: 'factory',
          route: 'FactorySettings',
          adminOnly: true,
        },
      ],
    },
    */
  ];

  const handleNavigate = (route: string) => {
    if (route) {
      navigation.navigate(route);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <Text style={styles.headerTitle}>管理中心</Text>
        <Text style={styles.headerSubtitle}>
          工厂配置和系统管理
        </Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {managementSections.map((section, sectionIndex) => {
          // 过滤出当前用户可见的items
          const visibleItems = section.items.filter(item => {
            if (item.adminOnly && !isAdmin) {
              return false;
            }
            return true;
          });

          // 如果没有可见items，不渲染整个section
          if (visibleItems.length === 0) {
            return null;
          }

          return (
            <Card key={sectionIndex} style={styles.sectionCard}>
              <Card.Content>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <List.Icon icon={section.icon} color={theme.colors.primary} />
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                </View>

                <Divider style={styles.divider} />

                {/* Section Items */}
                {visibleItems.map((item, itemIndex) => (
                  <React.Fragment key={item.id}>
                    <List.Item
                      title={item.title}
                      description={item.description}
                      left={props => <List.Icon {...props} icon={item.icon} />}
                      right={props => (
                        <View style={styles.rightContent}>
                          {item.badge && (
                            <View style={[styles.badge, { backgroundColor: theme.colors.error }]}>
                              <Text style={styles.badgeText}>{item.badge}</Text>
                            </View>
                          )}
                          <List.Icon {...props} icon="chevron-right" />
                        </View>
                      )}
                      onPress={() => handleNavigate(item.route)}
                      style={styles.listItem}
                    />
                    {itemIndex < visibleItems.length - 1 && (
                      <Divider style={styles.itemDivider} />
                    )}
                  </React.Fragment>
                ))}
              </Card.Content>
            </Card>
          );
        })}

        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <List.Icon icon="information" color={theme.colors.primary} />
              <Text style={styles.infoTitle}>提示</Text>
            </View>
            <Text style={styles.infoText}>
              • 产品类型和原料类型需要先配置,才能设置转换率
            </Text>
            <Text style={styles.infoText}>
              • 转换率用于自动计算生产计划所需的原料用量
            </Text>
            <Text style={styles.infoText}>
              • 商家信息用于记录成品出库和供货历史
            </Text>
            <Text style={styles.infoText}>
              • 部分功能需要管理员权限才能访问
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  scrollView: {
    flex: 1,
  },
  sectionCard: {
    margin: 16,
    marginBottom: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: -8,
  },
  divider: {
    marginVertical: 8,
  },
  listItem: {
    paddingVertical: 4,
  },
  itemDivider: {
    marginLeft: 56,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  infoCard: {
    margin: 16,
    backgroundColor: '#E3F2FD',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: -8,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#666',
    marginBottom: 4,
  },
  bottomPadding: {
    height: 20,
  },
});
