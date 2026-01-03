import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import {
  Text,
  Appbar,
  Card,
  List,
  Chip,
  Button,
  ActivityIndicator,
  Banner,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { materialSpecApiClient, DEFAULT_SPEC_CONFIG, SpecConfig } from '../../services/api/materialSpecApiClient';
import { useAuthStore } from '../../store/authStore';
import { handleError, getErrorMsg } from '../../utils/errorHandler';
import { logger } from '../../utils/logger';

// 创建MaterialSpecManagement专用logger
const materialSpecLogger = logger.createContextLogger('MaterialSpecManagement');

/**
 * 原材料规格配置管理页面
 *
 * Phase 1-3: 仅显示当前配置（只读）
 * Phase 4: 完整编辑功能（批量编辑、添加/删除规格项、重置为默认）
 *
 * 权限：factory_super_admin、platform_admin
 */
export default function MaterialSpecManagementScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('management');
  const { user } = useAuthStore();

  const [specConfig, setSpecConfig] = useState<SpecConfig>(DEFAULT_SPEC_CONFIG);
  const [loading, setLoading] = useState(true);

  // 权限控制
  const userType = user?.userType || 'factory';
  const roleCode = user?.factoryUser?.role || user?.roleCode || 'viewer';
  const isPlatformAdmin = userType === 'platform';
  const isSuperAdmin = roleCode === 'factory_super_admin';
  const canManage = isPlatformAdmin || isSuperAdmin;

  useEffect(() => {
    loadSpecConfig();
  }, []);

  const loadSpecConfig = async () => {
    try {
      setLoading(true);
      const response = await materialSpecApiClient.getSpecConfig(user?.factoryId);
      materialSpecLogger.info('规格配置加载成功', {
        factoryId: user?.factoryId,
        categoryCount: Object.keys(response.data).length,
      });
      setSpecConfig(response.data);
    } catch (error) {
      materialSpecLogger.warn('加载规格配置失败，使用默认配置', {
        factoryId: user?.factoryId,
        error: (error as Error).message,
      });
      setSpecConfig(DEFAULT_SPEC_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) {
    return (
      <View style={styles.container}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('materialSpecManagement.title')} />
        </Appbar.Header>
        <View style={styles.noPermission}>
          <List.Icon icon="lock" color="#999" />
          <Text style={styles.noPermissionText}>{t('common.noPermission')}</Text>
          <Text style={styles.noPermissionHint}>{t('common.adminOnly')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('materialSpecManagement.title')} />
        <Appbar.Action icon="refresh" onPress={loadSpecConfig} />
      </Appbar.Header>

      <ScrollView style={styles.content}>
        {/* Phase 4 提示 */}
        <Banner
          visible={true}
          icon="information"
          style={styles.banner}
        >
          <Text style={styles.bannerText}>
            {t('materialSpecManagement.phase1to3ReadOnly')}
          </Text>
          <Text style={styles.bannerText}>
            {t('materialSpecManagement.phase4EditSupport')}
          </Text>
        </Banner>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>{t('common.loading')}</Text>
          </View>
        ) : (
          <>
            {/* 配置说明 */}
            <Card style={styles.infoCard}>
              <Card.Content>
                <Text style={styles.infoTitle}>{t('materialSpecManagement.configInfo.title')}</Text>
                <Text style={styles.infoText}>
                  {t('materialSpecManagement.configInfo.line1')}{'\n'}
                  {t('materialSpecManagement.configInfo.line2')}{'\n'}
                  {t('materialSpecManagement.configInfo.line3')}
                </Text>
              </Card.Content>
            </Card>

            {/* 当前配置列表 */}
            {Object.entries(specConfig).map(([category, specs]) => (
              <Card key={category} style={styles.categoryCard} mode="elevated">
                <Card.Content>
                  <View style={styles.categoryHeader}>
                    <Text style={styles.categoryName}>{category}</Text>
                    <Chip mode="outlined" compact>
                      {specs.length} {t('materialSpecManagement.items')}
                    </Chip>
                  </View>

                  <View style={styles.specsContainer}>
                    {specs.map((spec, index) => (
                      <Chip
                        key={index}
                        mode="outlined"
                        style={styles.specChip}
                      >
                        {spec}
                      </Chip>
                    ))}
                  </View>

                  {/* Phase 4 编辑按钮（当前禁用） */}
                  <View style={styles.actionRow}>
                    <Button
                      mode="outlined"
                      icon="pencil"
                      disabled
                      style={styles.actionButton}
                    >
                      {t('materialSpecManagement.editPhase4')}
                    </Button>
                    <Button
                      mode="outlined"
                      icon="restore"
                      disabled
                      style={styles.actionButton}
                    >
                      {t('materialSpecManagement.restoreDefaultPhase4')}
                    </Button>
                  </View>
                </Card.Content>
              </Card>
            ))}

            <View style={styles.bottomPadding} />
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
  },
  noPermission: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noPermissionText: {
    fontSize: 18,
    color: '#999',
    marginTop: 16,
  },
  noPermissionHint: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
  },
  banner: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#E3F2FD',
  },
  bannerText: {
    fontSize: 13,
    color: '#1976D2',
    marginVertical: 2,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  infoCard: {
    margin: 16,
    marginBottom: 8,
    backgroundColor: '#FFF9C4',
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#F57F17',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  categoryCard: {
    margin: 16,
    marginBottom: 12,
    borderRadius: 12,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  categoryName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#212121',
  },
  specsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  specChip: {
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
  },
  bottomPadding: {
    height: 40,
  },
});
