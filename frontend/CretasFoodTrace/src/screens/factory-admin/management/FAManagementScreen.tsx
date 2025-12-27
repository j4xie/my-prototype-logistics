/**
 * Factory Admin 管理中心
 * 包含: 员工管理、设备管理等9宫格入口
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { FAManagementStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<FAManagementStackParamList, 'FAManagement'>;

interface GridItemProps {
  icon: string;
  title: string;
  color: string;
  onPress: () => void;
}

function GridItem({ icon, title, color, onPress }: GridItemProps) {
  return (
    <TouchableOpacity style={styles.gridItem} onPress={onPress}>
      <View style={[styles.gridIcon, { backgroundColor: color + '15' }]}>
        <Icon source={icon} size={28} color={color} />
      </View>
      <Text style={styles.gridTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

export function FAManagementScreen() {
  const navigation = useNavigation<NavigationProp>();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>管理</Text>
          <Text style={styles.subtitle}>工厂运营管理中心</Text>
        </View>

        {/* 核心管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>核心管理</Text>
          <View style={styles.grid}>
            <GridItem
              icon="account-group"
              title="员工管理"
              color="#667eea"
              onPress={() => navigation.navigate('EmployeeList')}
            />
            <GridItem
              icon="cog"
              title="设备管理"
              color="#52c41a"
              onPress={() => navigation.navigate('EquipmentList')}
            />
            <GridItem
              icon="domain"
              title="部门管理"
              color="#fa8c16"
              onPress={() => navigation.navigate('DepartmentManagement')}
            />
          </View>
        </View>

        {/* 业务管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>业务管理</Text>
          <View style={styles.grid}>
            <GridItem
              icon="cube-outline"
              title="产品类型"
              color="#1890ff"
              onPress={() => navigation.navigate('ProductTypeManagement')}
            />
            <GridItem
              icon="package-variant"
              title="原料类型"
              color="#eb2f96"
              onPress={() => navigation.navigate('MaterialTypeManagement')}
            />
            <GridItem
              icon="swap-horizontal"
              title="转换率"
              color="#722ed1"
              onPress={() => navigation.navigate('ConversionRate')}
            />
          </View>
        </View>

        {/* 供应链管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>供应链管理</Text>
          <View style={styles.grid}>
            <GridItem
              icon="truck-delivery"
              title="供应商"
              color="#13c2c2"
              onPress={() => navigation.navigate('SupplierManagement')}
            />
            <GridItem
              icon="store"
              title="客户管理"
              color="#f5222d"
              onPress={() => navigation.navigate('CustomerManagement')}
            />
            <GridItem
              icon="truck"
              title="出货管理"
              color="#faad14"
              onPress={() => navigation.navigate('ShipmentManagement')}
            />
          </View>
        </View>

        {/* 其他 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>其他</Text>
          <View style={styles.grid}>
            <GridItem
              icon="delete-outline"
              title="报废记录"
              color="#8c8c8c"
              onPress={() => navigation.navigate('DisposalRecordManagement')}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    marginLeft: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
  },
  gridItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  gridIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  gridTitle: {
    fontSize: 13,
    color: '#333',
  },
});

export default FAManagementScreen;
