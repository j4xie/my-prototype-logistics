/**
 * 关于页面
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '20251228';

export function AboutScreen() {
  const navigation = useNavigation();

  const handleCheckUpdate = () => {
    Alert.alert('检查更新', '当前已是最新版本');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://www.cretas.com/privacy');
  };

  const handleUserAgreement = () => {
    Linking.openURL('https://www.cretas.com/terms');
  };

  const MenuItem = ({ icon, title, onPress, rightText }: {
    icon: string;
    title: string;
    onPress: () => void;
    rightText?: string;
  }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
      <Icon source={icon} size={22} color="#666" />
      <Text style={styles.menuTitle}>{title}</Text>
      <View style={styles.menuRight}>
        {rightText && <Text style={styles.rightText}>{rightText}</Text>}
        <Icon source="chevron-right" size={20} color="#ccc" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>关于</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Logo 和版本信息 */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Icon source="fish" size={60} color="#667eea" />
          </View>
          <Text style={styles.appName}>白垩纪食品溯源系统</Text>
          <Text style={styles.version}>版本 {APP_VERSION} ({BUILD_NUMBER})</Text>
        </View>

        {/* 功能介绍 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>产品介绍</Text>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>
              白垩纪食品溯源系统是一款专为水产加工企业打造的智能化生产管理平台。
              通过全流程的数据采集和AI智能分析，帮助企业实现生产过程可视化、
              质量检测自动化、成本核算精细化，全面提升企业的生产效率和管理水平。
            </Text>
          </View>
        </View>

        {/* 菜单选项 */}
        <View style={styles.section}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="update"
              title="检查更新"
              onPress={handleCheckUpdate}
              rightText={`v${APP_VERSION}`}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="shield-check"
              title="隐私政策"
              onPress={handlePrivacyPolicy}
            />
            <View style={styles.divider} />
            <MenuItem
              icon="file-document"
              title="用户协议"
              onPress={handleUserAgreement}
            />
          </View>
        </View>

        {/* 版权信息 */}
        <View style={styles.copyrightSection}>
          <Text style={styles.copyrightText}>
            Copyright 2024-2025 Cretas Technology
          </Text>
          <Text style={styles.copyrightText}>
            All Rights Reserved
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  version: {
    fontSize: 14,
    color: '#999',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    marginLeft: 20,
    marginBottom: 8,
  },
  descriptionCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  descriptionText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 24,
  },
  menuCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  menuRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rightText: {
    fontSize: 14,
    color: '#999',
    marginRight: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
  },
  copyrightSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  copyrightText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
});

export default AboutScreen;
