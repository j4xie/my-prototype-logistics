/**
 * Factory Admin 管理中心
 * 包含: 员工管理、设备管理等9宫格入口
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('home');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{t('management.title')}</Text>
          <Text style={styles.subtitle}>{t('management.subtitle')}</Text>
        </View>

        {/* 核心管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('management.coreManagement')}</Text>
          <View style={styles.grid}>
            <GridItem
              icon="account-group"
              title={t('management.employeeManagement')}
              color="#667eea"
              onPress={() => navigation.navigate('EmployeeList')}
            />
            <GridItem
              icon="devices"
              title={t('management.deviceCenter', '设备中心')}
              color="#52c41a"
              onPress={() => navigation.navigate('UnifiedDeviceManagement')}
            />
            <GridItem
              icon="chart-line"
              title={t('management.equipmentAnalysis', '设备分析')}
              color="#667eea"
              onPress={() => navigation.navigate('EquipmentAnalysis')}
            />
            <GridItem
              icon="domain"
              title={t('management.departmentManagement')}
              color="#fa8c16"
              onPress={() => navigation.navigate('DepartmentManagement')}
            />
          </View>
        </View>

        {/* 业务管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('management.businessManagement')}</Text>
          <View style={styles.grid}>
            <GridItem
              icon="cube-outline"
              title={t('management.productTypeManagement')}
              color="#1890ff"
              onPress={() => navigation.navigate('ProductTypeManagement')}
            />
            <GridItem
              icon="package-variant"
              title={t('management.materialTypeManagement')}
              color="#eb2f96"
              onPress={() => navigation.navigate('MaterialTypeManagement')}
            />
            <GridItem
              icon="swap-horizontal"
              title={t('management.conversionRate')}
              color="#722ed1"
              onPress={() => navigation.navigate('ConversionRate')}
            />
          </View>
        </View>

        {/* 供应链管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('management.supplyChainManagement')}</Text>
          <View style={styles.grid}>
            <GridItem
              icon="truck-delivery"
              title={t('management.supplierManagement')}
              color="#13c2c2"
              onPress={() => navigation.navigate('SupplierManagement')}
            />
            <GridItem
              icon="store"
              title={t('management.customerManagement')}
              color="#f5222d"
              onPress={() => navigation.navigate('CustomerManagement')}
            />
            <GridItem
              icon="truck"
              title={t('management.shipmentManagement')}
              color="#faad14"
              onPress={() => navigation.navigate('ShipmentManagement')}
            />
          </View>
        </View>

        {/* 进销存管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>进销存管理</Text>
          <View style={styles.grid}>
            <GridItem
              icon="cart-arrow-down"
              title="采购订单"
              color="#409eff"
              onPress={() => navigation.navigate('PurchaseOrderList')}
            />
            <GridItem
              icon="cart-arrow-up"
              title="销售订单"
              color="#67c23a"
              onPress={() => navigation.navigate('SalesOrderList')}
            />
            <GridItem
              icon="package-variant-closed"
              title="成品库存"
              color="#722ed1"
              onPress={() => navigation.navigate('FinishedGoodsList')}
            />
            <GridItem
              icon="swap-horizontal-bold"
              title="调拨管理"
              color="#fa8c16"
              onPress={() => navigation.navigate('TransferList')}
            />
            <GridItem
              icon="cash-multiple"
              title="应收应付"
              color="#eb2f96"
              onPress={() => navigation.navigate('ArApOverview')}
            />
            <GridItem
              icon="tag-text"
              title="价格表"
              color="#13c2c2"
              onPress={() => navigation.navigate('PriceList')}
            />
          </View>
        </View>

        {/* 系统配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('management.systemConfig')}</Text>
          <View style={styles.grid}>
            <GridItem
              icon="form-select"
              title={t('schemaConfig.title')}
              color="#667eea"
              onPress={() => navigation.navigate('SchemaConfig')}
            />
            <GridItem
              icon="file-document-multiple-outline"
              title={t('formTemplate.title', '表单模版')}
              color="#722ed1"
              onPress={() => navigation.navigate('FormTemplateList')}
            />
            <GridItem
              icon="code-braces"
              title={t('management.ruleConfiguration')}
              color="#9c27b0"
              onPress={() => navigation.navigate('RuleConfiguration')}
            />
            <GridItem
              icon="robot"
              title={t('aiBusinessInit.title')}
              color="#1890ff"
              onPress={() => navigation.navigate('AIBusinessInit')}
            />
            <GridItem
              icon="barcode"
              title={t('encodingRuleConfig.title')}
              color="#fa8c16"
              onPress={() => navigation.navigate('EncodingRuleConfig')}
            />
            <GridItem
              icon="clipboard-check-outline"
              title={t('qualityCheckItemConfig.title')}
              color="#52c41a"
              onPress={() => navigation.navigate('QualityCheckItemConfig')}
            />
            <GridItem
              icon="clipboard-flow-outline"
              title={t('management.sopConfig')}
              color="#13c2c2"
              onPress={() => navigation.navigate('SopConfig')}
            />
            <GridItem
              icon="robot-outline"
              title={t('management.intentView', 'AI意图查看')}
              color="#eb2f96"
              onPress={() => navigation.navigate('IntentView')}
            />
          </View>
        </View>

        {/* 其他 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('management.other')}</Text>
          <View style={styles.grid}>
            <GridItem
              icon="delete-outline"
              title={t('management.disposalRecordManagement')}
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
