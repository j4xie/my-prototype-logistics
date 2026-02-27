/**
 * 任务执行引导 - 步骤1: 前往工位
 * Industrial Clean Design
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSHomeStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'TaskGuide'>;
type RouteProps = RouteProp<WSHomeStackParamList, 'TaskGuide'>;

const C = {
  dark: '#0f172a',
  darkMid: '#1e293b',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
  green: '#10b981',
  greenSoft: '#ecfdf5',
  bg: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  sub: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  pending: '#cbd5e1',
};

const CURRENT_STEP = 1;
const STEPS = [
  { num: 1, label: '前往工位' },
  { num: 2, label: '确认设备' },
  { num: 3, label: '召集人员' },
];

export function TaskGuideScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { batchId, batchNumber } = route.params || {};
  const { t } = useTranslation('workshop');
  const insets = useSafeAreaInsets();

  const [isArrived, setIsArrived] = useState(false);

  const locationInfo = [
    { icon: 'factory' as const, label: '车间', value: 'A区车间' },
    { icon: 'ray-start-arrow' as const, label: '生产线', value: '1号生产线' },
    { icon: 'account-hard-hat' as const, label: '工位', value: '切片工位' },
    { icon: 'cog' as const, label: '设备', value: '切片机A (EQ-001)' },
  ];

  const handleNext = () => {
    navigation.navigate('TaskGuideStep2', { batchId, batchNumber });
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon source="arrow-left" size={22} color="rgba(255,255,255,0.9)" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>任务执行</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>1/3</Text>
        </View>
      </View>

      {/* ── Batch info bar ── */}
      <View style={styles.batchBar}>
        <View style={[styles.batchIndicator, { backgroundColor: C.blue }]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.batchNum} numberOfLines={1} ellipsizeMode="middle">
            {batchNumber || 'PB-20251227-001'}
          </Text>
          <Text style={styles.batchMeta}>
            {t('taskGuideDetail.batchProduct', { product: '带鱼片', target: '80' })}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Step Progress ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressRow}>
            {STEPS.map((step, i) => {
              const done = step.num < CURRENT_STEP;
              const active = step.num === CURRENT_STEP;
              return (
                <React.Fragment key={step.num}>
                  {i > 0 && (
                    <View
                      style={[
                        styles.progressLine,
                        step.num <= CURRENT_STEP && styles.progressLineDone,
                      ]}
                    />
                  )}
                  <View style={styles.stepItem}>
                    <View
                      style={[
                        styles.stepCircle,
                        done && styles.stepCircleDone,
                        active && styles.stepCircleActive,
                      ]}
                    >
                      {done ? (
                        <Icon source="check" size={14} color="#fff" />
                      ) : (
                        <Text
                          style={[
                            styles.stepCircleNum,
                            (done || active) && { color: '#fff' },
                          ]}
                        >
                          {step.num}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        styles.stepLabel,
                        (done || active) && styles.stepLabelActive,
                      ]}
                    >
                      {step.label}
                    </Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* ── Section Header ── */}
        <View style={styles.sectionRow}>
          <View style={styles.sectionIcon}>
            <Icon source="map-marker-radius" size={20} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>步骤 1: 前往工位</Text>
            <Text style={styles.sectionSub}>请按照以下信息前往指定工位</Text>
          </View>
        </View>

        {/* ── Location Card ── */}
        <View style={styles.card}>
          {locationInfo.map((item, idx) => (
            <View
              key={idx}
              style={[
                styles.locRow,
                idx < locationInfo.length - 1 && styles.locRowBorder,
              ]}
            >
              <View style={styles.locIconWrap}>
                <Icon source={item.icon} size={18} color={C.sub} />
              </View>
              <View>
                <Text style={styles.locLabel}>{item.label}</Text>
                <Text style={styles.locValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Map Button ── */}
        <TouchableOpacity style={styles.mapBtn} activeOpacity={0.7}>
          <Icon source="map-outline" size={18} color={C.blue} />
          <Text style={styles.mapText}>查看车间地图</Text>
          <Icon source="chevron-right" size={18} color={C.blue} />
        </TouchableOpacity>

        {/* ── Arrival Confirmation ── */}
        <TouchableOpacity
          style={[styles.confirmBtn, isArrived && styles.confirmBtnOn]}
          onPress={() => setIsArrived(!isArrived)}
          activeOpacity={0.7}
        >
          <Icon
            source={
              isArrived
                ? 'checkbox-marked-circle'
                : 'checkbox-blank-circle-outline'
            }
            size={24}
            color={isArrived ? C.green : C.muted}
          />
          <Text style={[styles.confirmText, isArrived && styles.confirmTextOn]}>
            我已到达工位
          </Text>
          {isArrived && (
            <View style={styles.confirmedTag}>
              <Text style={styles.confirmedTagText}>已确认</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !isArrived && styles.nextBtnOff]}
          onPress={handleNext}
          disabled={!isArrived}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>下一步：确认设备</Text>
          <Icon source="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: C.dark,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
  },

  // Batch bar
  batchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.darkMid,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  batchIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  batchNum: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  batchMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },

  // Scroll
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },

  // Progress
  progressCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  stepItem: { alignItems: 'center', width: 72 },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: C.bg,
    borderWidth: 2,
    borderColor: C.pending,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleDone: { backgroundColor: C.green, borderColor: C.green },
  stepCircleActive: { backgroundColor: C.blue, borderColor: C.blue },
  stepCircleNum: { fontSize: 13, fontWeight: '700', color: C.muted },
  stepLabel: { fontSize: 11, color: C.muted, marginTop: 6, fontWeight: '500' },
  stepLabelActive: { color: C.text, fontWeight: '600' },
  progressLine: {
    height: 2,
    flex: 1,
    backgroundColor: C.pending,
    marginTop: 15,
  },
  progressLineDone: { backgroundColor: C.green },

  // Section header
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.blueSoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  sectionSub: { fontSize: 13, color: C.sub, marginTop: 2 },

  // Location card
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  locRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  locIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  locLabel: { fontSize: 12, color: C.sub },
  locValue: { fontSize: 15, color: C.text, fontWeight: '500', marginTop: 1 },

  // Map button
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.blueSoft,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 20,
  },
  mapText: {
    fontSize: 14,
    color: C.blue,
    fontWeight: '500',
    marginHorizontal: 6,
  },

  // Confirm
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: C.border,
  },
  confirmBtnOn: { borderColor: C.green, backgroundColor: C.greenSoft },
  confirmText: { fontSize: 16, color: C.muted, marginLeft: 12, flex: 1 },
  confirmTextOn: { color: C.green, fontWeight: '600' },
  confirmedTag: {
    backgroundColor: C.green,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  confirmedTagText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 16,
  },
  nextBtnOff: { backgroundColor: C.pending },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
});

export default TaskGuideScreen;
