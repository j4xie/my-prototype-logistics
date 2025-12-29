/**
 * 质检结果页面
 * Quality Inspector - Inspection Result Screen
 */

import React, { useEffect } from 'react';
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

import { QI_COLORS, QualityInspectorStackParamList } from '../../types/qualityInspector';

type NavigationProp = NativeStackNavigationProp<QualityInspectorStackParamList>;
type RouteProps = RouteProp<QualityInspectorStackParamList, 'QIResult'>;

export default function QIResultScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const insets = useSafeAreaInsets();
  const { recordId, passed } = route.params;

  const handleViewDetail = () => {
    navigation.navigate('QIRecordDetail', { recordId });
  };

  const handleContinue = () => {
    navigation.navigate('QIInspectList');
  };

  const handleGoHome = () => {
    navigation.navigate('QIHome');
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* 结果图标 */}
        <View style={[styles.resultIcon, passed ? styles.resultIconPass : styles.resultIconFail]}>
          <Ionicons
            name={passed ? 'checkmark-circle' : 'close-circle'}
            size={80}
            color="#fff"
          />
        </View>

        {/* 结果标题 */}
        <Text style={[styles.resultTitle, passed ? styles.titlePass : styles.titleFail]}>
          {passed ? '检验通过' : '检验未通过'}
        </Text>

        <Text style={styles.resultSubtitle}>
          {passed
            ? '该批次产品符合质量标准，可以进入下一环节'
            : '该批次产品存在质量问题，请按规定处理'}
        </Text>

        {/* 结果详情卡片 */}
        <View style={styles.detailCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>记录编号</Text>
            <Text style={styles.detailValue}>{recordId}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>检验时间</Text>
            <Text style={styles.detailValue}>{new Date().toLocaleString('zh-CN')}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>检验结果</Text>
            <View style={[styles.statusBadge, passed ? styles.badgePass : styles.badgeFail]}>
              <Text style={styles.statusText}>{passed ? '合格' : '不合格'}</Text>
            </View>
          </View>
        </View>

        {/* 下一步操作提示 */}
        {passed ? (
          <View style={styles.nextStepCard}>
            <Ionicons name="arrow-forward-circle" size={24} color={QI_COLORS.secondary} />
            <View style={styles.nextStepText}>
              <Text style={styles.nextStepTitle}>下一步</Text>
              <Text style={styles.nextStepDesc}>产品将进入包装/出货流程</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.nextStepCard, styles.nextStepCardWarning]}>
            <Ionicons name="warning" size={24} color={QI_COLORS.warning} />
            <View style={styles.nextStepText}>
              <Text style={styles.nextStepTitle}>需要处理</Text>
              <Text style={styles.nextStepDesc}>请将不合格批次进行隔离标记</Text>
            </View>
          </View>
        )}

        {/* 查看详情按钮 */}
        <TouchableOpacity style={styles.viewDetailBtn} onPress={handleViewDetail}>
          <Ionicons name="document-text-outline" size={20} color={QI_COLORS.primary} />
          <Text style={styles.viewDetailText}>查看检验详情</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 底部操作 */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.homeBtn} onPress={handleGoHome}>
          <Ionicons name="home-outline" size={20} color={QI_COLORS.text} />
          <Text style={styles.homeBtnText}>返回首页</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.continueBtn} onPress={handleContinue}>
          <Text style={styles.continueBtnText}>继续质检</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: QI_COLORS.background,
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },

  // 结果图标
  resultIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  resultIconPass: {
    backgroundColor: QI_COLORS.success,
  },
  resultIconFail: {
    backgroundColor: QI_COLORS.danger,
  },

  // 结果标题
  resultTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 12,
  },
  titlePass: {
    color: QI_COLORS.success,
  },
  titleFail: {
    color: QI_COLORS.danger,
  },
  resultSubtitle: {
    fontSize: 15,
    color: QI_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 20,
  },

  // 详情卡片
  detailCard: {
    width: '100%',
    backgroundColor: QI_COLORS.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: QI_COLORS.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    color: QI_COLORS.text,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: QI_COLORS.border,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  badgePass: {
    backgroundColor: '#E8F5E9',
  },
  badgeFail: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // 下一步
  nextStepCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    marginBottom: 24,
  },
  nextStepCardWarning: {
    backgroundColor: '#FFF8E1',
  },
  nextStepText: {
    flex: 1,
  },
  nextStepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: QI_COLORS.text,
    marginBottom: 2,
  },
  nextStepDesc: {
    fontSize: 13,
    color: QI_COLORS.textSecondary,
  },

  // 查看详情
  viewDetailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  viewDetailText: {
    fontSize: 15,
    color: QI_COLORS.primary,
  },

  // 底部栏
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: QI_COLORS.card,
    borderTopWidth: 1,
    borderTopColor: QI_COLORS.border,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  homeBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  homeBtnText: {
    fontSize: 15,
    color: QI_COLORS.text,
    fontWeight: '500',
  },
  continueBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: QI_COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 6,
  },
  continueBtnText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
