/**
 * 批次类型选择页面
 * Quality Inspector - Batch Type Selection Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { QI_COLORS, QualityInspectorStackParamList } from '../../types/qualityInspector';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;
type RouteProps = RouteProp<QualityInspectorStackParamList, 'QIBatchSelect'>;

interface BatchType {
  id: string;
  nameKey: string;
  descKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}

const BATCH_TYPES: BatchType[] = [
  {
    id: 'processing',
    nameKey: 'batchSelect.processingBatch',
    descKey: 'batchSelect.processingDesc',
    icon: 'construct',
    color: '#2196F3',
  },
  {
    id: 'material',
    nameKey: 'batchSelect.materialBatch',
    descKey: 'batchSelect.materialDesc',
    icon: 'cube',
    color: '#4CAF50',
  },
  {
    id: 'finished',
    nameKey: 'batchSelect.productBatch',
    descKey: 'batchSelect.productDesc',
    icon: 'gift',
    color: '#9C27B0',
  },
  {
    id: 'return',
    nameKey: 'batchSelect.returnBatch',
    descKey: 'batchSelect.returnDesc',
    icon: 'return-down-back',
    color: '#FF9800',
  },
];

export default function QIBatchSelectScreen() {
  const { t } = useTranslation('quality');
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();

  const handleTypeSelect = (type: BatchType) => {
    // 可以根据类型筛选待检列表
    navigation.navigate('QIInspectList');
  };

  const handleScanPress = () => {
    navigation.navigate('QIScan');
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
    >
      {/* 扫码快速入口 */}
      <TouchableOpacity style={styles.scanCard} onPress={handleScanPress} activeOpacity={0.8}>
        <View style={styles.scanIconContainer}>
          <Ionicons name="scan" size={32} color="#fff" />
        </View>
        <View style={styles.scanTextContainer}>
          <Text style={styles.scanTitle}>{t('batchSelect.scanToStart')}</Text>
          <Text style={styles.scanSubtitle}>{t('batchSelect.scanQrCode')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      {/* 分隔 */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{t('batchSelect.orSelectType')}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* 批次类型列表 */}
      <View style={styles.typeList}>
        {BATCH_TYPES.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={styles.typeCard}
            onPress={() => handleTypeSelect(type)}
            activeOpacity={0.7}
          >
            <View style={[styles.typeIcon, { backgroundColor: `${type.color}20` }]}>
              <Ionicons name={type.icon} size={28} color={type.color} />
            </View>
            <View style={styles.typeInfo}>
              <Text style={styles.typeName}>{t(type.nameKey)}</Text>
              <Text style={styles.typeDescription}>{t(type.descKey)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={QI_COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>

      {/* 提示 */}
      <View style={styles.tipCard}>
        <Ionicons name="information-circle" size={20} color={QI_COLORS.secondary} />
        <Text style={styles.tipText}>
          {t('batchSelect.tip')}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 16,
  },

  // 扫码入口
  scanCard: {
    backgroundColor: QI_COLORS.primary,
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  scanTextContainer: {
    flex: 1,
  },
  scanTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  scanSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },

  // 分隔线
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: QI_COLORS.border,
  },
  dividerText: {
    color: QI_COLORS.textSecondary,
    fontSize: 13,
    marginHorizontal: 16,
  },

  // 类型列表
  typeList: {
    gap: 12,
  },
  typeCard: {
    backgroundColor: QI_COLORS.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typeIcon: {
    width: 52,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 16,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 4,
  },
  typeDescription: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
  },

  // 提示
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: QI_COLORS.secondary,
    lineHeight: 20,
  },
});
