/**
 * 任务执行引导 - 步骤2: 确认设备
 * Industrial Clean Design
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSHomeStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'TaskGuideStep2'>;
type RouteProps = RouteProp<WSHomeStackParamList, 'TaskGuideStep2'>;

const C = {
  dark: '#0f172a',
  darkMid: '#1e293b',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
  green: '#10b981',
  greenSoft: '#ecfdf5',
  greenMid: '#87d068',
  amber: '#f59e0b',
  amberSoft: '#fffbeb',
  red: '#ef4444',
  redSoft: '#fef2f2',
  redBorder: '#fecaca',
  bg: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  sub: '#64748b',
  muted: '#94a3b8',
  idle: '#94a3b8',
  border: '#e2e8f0',
  pending: '#cbd5e1',
};

const CURRENT_STEP = 2;
const STEPS = [
  { num: 1, label: '前往工位' },
  { num: 2, label: '确认设备' },
  { num: 3, label: '召集人员' },
];

export function TaskGuideStep2Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('workshop');
  const insets = useSafeAreaInsets();
  const { batchId, batchNumber } = route.params || {};

  const [isEquipmentReady, setIsEquipmentReady] = useState(false);
  const [equipmentStatus, setEquipmentStatus] = useState<
    'idle' | 'starting' | 'running'
  >('idle');

  const equipmentInfo = {
    name: '切片机A',
    equipmentId: 'EQ-001',
    status: 'idle',
    oee: 92,
    lastMaintenance: '2025-12-20',
    nextMaintenance: '2026-01-20',
  };

  const handleStartEquipment = () => {
    setEquipmentStatus('starting');
    setTimeout(() => {
      setEquipmentStatus('running');
      setIsEquipmentReady(true);
    }, 1500);
  };

  const handleReportIssue = () => {
    Alert.alert(
      t('taskGuideDetail.step2.reportIssueTitle'),
      t('taskGuideDetail.step2.reportIssueMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('taskGuideDetail.step2.reportIssueConfirm'),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('taskGuideDetail.step2.issueReported'),
              t('taskGuideDetail.step2.issueReportedMsg'),
            );
          },
        },
      ],
    );
  };

  const handleNext = () => {
    navigation.navigate('TaskGuideStep3', { batchId, batchNumber });
  };

  const statusConfig = {
    idle: { color: C.idle, bg: '#f1f5f9', text: t('taskGuideDetail.step2.equipmentStatus.idle') },
    starting: { color: C.amber, bg: C.amberSoft, text: t('taskGuideDetail.step2.equipmentStatus.starting') },
    running: { color: C.green, bg: C.greenSoft, text: t('taskGuideDetail.step2.equipmentStatus.running') },
  };
  const status = statusConfig[equipmentStatus];

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
        <Text style={styles.headerTitle}>{t('taskGuideDetail.title')}</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>2/3</Text>
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
            <Icon source="cog-outline" size={20} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {t('taskGuideDetail.step2.title')}
            </Text>
            <Text style={styles.sectionSub}>检查并启动生产设备</Text>
          </View>
        </View>

        {/* ── Equipment Card ── */}
        <View style={styles.equipCard}>
          <View style={styles.equipHeader}>
            <View style={[styles.equipIconWrap, { backgroundColor: status.color }]}>
              <Icon source="cog" size={22} color="#fff" />
            </View>
            <View style={styles.equipInfo}>
              <Text style={styles.equipName}>{equipmentInfo.name}</Text>
              <Text style={styles.equipId}>{equipmentInfo.equipmentId}</Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: status.bg }]}>
              <View
                style={[styles.statusDot, { backgroundColor: status.color }]}
              />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.text}
              </Text>
            </View>
          </View>

          <View style={styles.equipDivider} />

          <View style={styles.equipStats}>
            <View style={styles.equipStatItem}>
              <Text style={styles.equipStatValue}>{equipmentInfo.oee}%</Text>
              <Text style={styles.equipStatLabel}>
                {t('taskGuideDetail.step2.oee')}
              </Text>
            </View>
            <View style={styles.equipStatDivider} />
            <View style={styles.equipStatItem}>
              <Text style={styles.equipStatValue}>
                {equipmentInfo.lastMaintenance}
              </Text>
              <Text style={styles.equipStatLabel}>
                {t('taskGuideDetail.step2.lastMaintenance')}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[
              styles.startEquipBtn,
              equipmentStatus !== 'idle' && styles.startEquipBtnDone,
            ]}
            onPress={handleStartEquipment}
            disabled={equipmentStatus !== 'idle'}
            activeOpacity={0.8}
          >
            <Icon
              source={
                equipmentStatus === 'running' ? 'check-circle' : 'power'
              }
              size={20}
              color="#fff"
            />
            <Text style={styles.startEquipText}>
              {equipmentStatus === 'running'
                ? t('taskGuideDetail.step2.started')
                : equipmentStatus === 'starting'
                  ? t('taskGuideDetail.step2.starting')
                  : t('taskGuideDetail.step2.startEquipment')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.issueBtn}
            onPress={handleReportIssue}
            activeOpacity={0.7}
          >
            <Icon source="alert-circle-outline" size={20} color={C.red} />
            <Text style={styles.issueBtnText}>
              {t('taskGuideDetail.step2.reportIssue')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Equipment Ready Confirmation ── */}
        <TouchableOpacity
          style={[styles.confirmBtn, isEquipmentReady && styles.confirmBtnOn]}
          onPress={() => setIsEquipmentReady(!isEquipmentReady)}
          activeOpacity={0.7}
        >
          <Icon
            source={
              isEquipmentReady
                ? 'checkbox-marked-circle'
                : 'checkbox-blank-circle-outline'
            }
            size={24}
            color={isEquipmentReady ? C.green : C.muted}
          />
          <Text
            style={[styles.confirmText, isEquipmentReady && styles.confirmTextOn]}
          >
            {t('taskGuideDetail.step2.equipmentReady')}
          </Text>
          {isEquipmentReady && (
            <View style={styles.confirmedTag}>
              <Text style={styles.confirmedTagText}>已确认</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[styles.nextBtn, !isEquipmentReady && styles.nextBtnOff]}
          onPress={handleNext}
          disabled={!isEquipmentReady}
          activeOpacity={0.8}
        >
          <Text style={styles.nextBtnText}>
            {t('taskGuideDetail.step2.nextStep')}
          </Text>
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
  batchNum: { fontSize: 15, fontWeight: '600', color: '#fff' },
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

  // Equipment card
  equipCard: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  equipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  equipIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  equipInfo: { flex: 1, marginLeft: 12 },
  equipName: { fontSize: 16, fontWeight: '700', color: C.text },
  equipId: { fontSize: 13, color: C.sub, marginTop: 2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: { fontSize: 12, fontWeight: '600' },
  equipDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 14,
  },
  equipStats: { flexDirection: 'row' },
  equipStatItem: { flex: 1, alignItems: 'center' },
  equipStatValue: { fontSize: 16, fontWeight: '700', color: C.text },
  equipStatLabel: { fontSize: 12, color: C.sub, marginTop: 4 },
  equipStatDivider: { width: 1, backgroundColor: C.border },

  // Actions
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  startEquipBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 14,
  },
  startEquipBtnDone: { backgroundColor: C.greenMid },
  startEquipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  issueBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.redSoft,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: C.redBorder,
  },
  issueBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.red,
    marginLeft: 8,
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

export default TaskGuideStep2Screen;
