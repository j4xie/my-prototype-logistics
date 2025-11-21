import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text, List, Divider, useTheme, Avatar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '../../store/authStore';
import { NeoCard, NeoButton, ScreenWrapper, StatusBadge } from '../../components/ui';
import { theme } from '../../theme';

type ManagementNavigationProp = NativeStackNavigationProp<any>;

export default function ManagementScreen() {
  const navigation = useNavigation<ManagementNavigationProp>();
  const { user } = useAuthStore();
  const isAdmin = user?.factoryUser?.roleCode === 'factory_super_admin' || user?.factoryUser?.roleCode === 'permission_admin';

  const managementSections = [
    {
      title: '生产配置',
      icon: 'cog-outline',
      items: [
        { id: 'product-types', title: '产品类型', desc: '配置鱼片、鱼头等类型', icon: 'fish', route: 'ProductTypeManagement' },
        { id: 'material-types', title: '原材料类型', desc: '配置鲈鱼、带鱼等原料', icon: 'food-drumstick', route: 'MaterialTypeManagement' },
        { id: 'conversion-rates', title: '转换率', desc: '配置原料到产品转换率', icon: 'swap-horizontal', route: 'ConversionRate' },
        { id: 'work-types', title: '工作类型', desc: '配置工种和时薪', icon: 'account-hard-hat', route: 'WorkTypeManagement', adminOnly: true },
      ],
    },
    {
      title: '系统管理',
      icon: 'shield-account-outline',
      items: [
        { id: 'departments', title: '部门管理', desc: '组织架构和部门信息', icon: 'office-building', route: 'DepartmentManagement', adminOnly: true },
        { id: 'users', title: '用户管理', desc: '用户、角色和权限', icon: 'account-cog', route: 'UserManagement', adminOnly: true },
        { id: 'whitelist', title: '白名单', desc: '管理注册手机号', icon: 'shield-check', route: 'WhitelistManagement', adminOnly: true },
      ],
    },
    {
        title: '业务伙伴',
        icon: 'handshake-outline',
        items: [
            { id: 'suppliers', title: '供应商管理', desc: '管理供应商信息', icon: 'truck-delivery', route: 'SupplierManagement' },
            { id: 'customers', title: '客户管理', desc: '管理客户信息', icon: 'store', route: 'CustomerManagement' },
        ]
    },
    {
        title: '工厂配置',
        icon: 'factory',
        items: [
             { id: 'factory-settings', title: '工厂设置', desc: '工厂基本信息配置', icon: 'cog', route: 'FactorySettings', adminOnly: true },
        ]
    }
  ];

  const handleNavigate = (route: string) => route && navigation.navigate(route);

  return (
    <ScreenWrapper edges={['top']} backgroundColor={theme.colors.background}>
      <View style={styles.header}>
          <Text style={styles.headerTitle}>管理中心</Text>
          <Text style={styles.headerSubtitle}>工厂配置与系统管理</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {managementSections.map((section, index) => {
          const visibleItems = section.items.filter(item => !item.adminOnly || isAdmin);
          if (visibleItems.length === 0) return null;

          return (
            <NeoCard key={index} style={styles.sectionCard} padding="m">
              <View style={styles.sectionHeader}>
                <Avatar.Icon size={32} icon={section.icon} style={styles.sectionIcon} color={theme.colors.primary} />
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
              
              <View style={styles.grid}>
                  {visibleItems.map((item) => (
                      <TouchableOpacity key={item.id} style={styles.gridItem} onPress={() => handleNavigate(item.route)}>
                          <View style={styles.itemIconContainer}>
                              <Avatar.Icon size={40} icon={item.icon} style={styles.itemIcon} color={theme.colors.primary} />
                          </View>
                          <Text style={styles.itemTitle}>{item.title}</Text>
                          <Text style={styles.itemDesc} numberOfLines={1}>{item.desc}</Text>
                      </TouchableOpacity>
                  ))}
              </View>
            </NeoCard>
          );
        })}

        <NeoCard style={styles.infoCard} padding="m" variant="flat">
            <View style={styles.infoHeader}>
                <Avatar.Icon size={24} icon="information" style={{ backgroundColor: 'transparent' }} color={theme.colors.primary} />
                <Text style={styles.infoTitle}>提示</Text>
            </View>
            <Text style={styles.infoText}>• 产品类型和原料类型需先配置，才能设置转换率</Text>
            <Text style={styles.infoText}>• 部分功能需要管理员权限</Text>
        </NeoCard>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 24,
    paddingBottom: 16,
    backgroundColor: theme.colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
    paddingBottom: 40,
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    backgroundColor: theme.colors.surfaceVariant,
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text,
  },
  grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
  },
  gridItem: {
      width: '48%', // slightly less than 50% to account for gap
      backgroundColor: theme.colors.surfaceVariant,
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
  },
  itemIconContainer: {
      marginBottom: 12,
  },
  itemIcon: {
      backgroundColor: 'white',
  },
  itemTitle: {
      fontWeight: '600',
      fontSize: 14,
      marginBottom: 4,
      textAlign: 'center',
      color: theme.colors.text,
  },
  itemDesc: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      textAlign: 'center',
  },
  infoCard: {
      backgroundColor: theme.colors.surfaceVariant,
  },
  infoHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
  },
  infoTitle: {
      fontWeight: '600',
      marginLeft: 8,
      color: theme.colors.text,
  },
  infoText: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      marginBottom: 4,
      marginLeft: 32,
  },
});
