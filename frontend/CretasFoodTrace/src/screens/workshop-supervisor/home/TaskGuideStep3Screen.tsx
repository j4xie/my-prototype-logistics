/**
 * 任务执行引导 - 步骤3: 召集人员
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

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'TaskGuideStep3'>;
type RouteProps = RouteProp<WSHomeStackParamList, 'TaskGuideStep3'>;

const C = {
  dark: '#0f172a',
  darkMid: '#1e293b',
  blue: '#3b82f6',
  blueSoft: '#eff6ff',
  green: '#10b981',
  greenSoft: '#ecfdf5',
  amber: '#f59e0b',
  amberSoft: '#fffbeb',
  bg: '#f1f5f9',
  card: '#ffffff',
  text: '#0f172a',
  sub: '#64748b',
  muted: '#94a3b8',
  border: '#e2e8f0',
  pending: '#cbd5e1',
};

const CURRENT_STEP = 3;
const STEPS = [
  { num: 1, label: '前往工位' },
  { num: 2, label: '确认设备' },
  { num: 3, label: '召集人员' },
];

interface AssignedWorker {
  id: number;
  name: string;
  employeeId: string;
  role: string;
  efficiency: number;
  status: 'ready' | 'pending' | 'absent';
}

export function TaskGuideStep3Screen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { t } = useTranslation('workshop');
  const insets = useSafeAreaInsets();
  const { batchId, batchNumber } = route.params || {};

  const [isAllReady, setIsAllReady] = useState(false);

  const [assignedWorkers] = useState<AssignedWorker[]>([
    { id: 1, name: '王建国', employeeId: 'EMP-001', role: '切片操作员', efficiency: 96, status: 'ready' },
    { id: 2, name: '李明辉', employeeId: 'EMP-002', role: '包装操作员', efficiency: 92, status: 'ready' },
    { id: 3, name: '刘晓峰', employeeId: 'EMP-003', role: '清洗操作员', efficiency: 88, status: 'ready' },
  ]);

  const readyCount = assignedWorkers.filter(w => w.status === 'ready').length;
  const allReady = readyCount === assignedWorkers.length;

  const handleStartProduction = () => {
    Alert.alert(
      t('taskGuideDetail.step3.confirmStart'),
      t('taskGuideDetail.step3.confirmStartMsg', {
        batchNumber: batchNumber || 'PB-20251227-001',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('taskGuideDetail.step3.confirmButton'),
          onPress: () => {
            navigation.navigate('BatchDetail', { batchId: batchId || '1' });
          },
        },
      ],
    );
  };

  const getEfficiencyGrade = (efficiency: number) => {
    if (efficiency >= 95) return { grade: 'A', color: '#10b981', bg: '#ecfdf5' };
    if (efficiency >= 85) return { grade: 'B', color: '#3b82f6', bg: '#eff6ff' };
    if (efficiency >= 75) return { grade: 'C', color: '#f59e0b', bg: '#fffbeb' };
    return { grade: 'D', color: '#ef4444', bg: '#fef2f2' };
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
        <Text style={styles.headerTitle}>{t('taskGuideDetail.title')}</Text>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>3/3</Text>
        </View>
      </View>

      {/* ── Batch info bar ── */}
      <View style={styles.batchBar}>
        <View style={[styles.batchIndicator, { backgroundColor: C.green }]} />
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
            <Icon source="account-group-outline" size={20} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>
              {t('taskGuideDetail.step3.title')}
            </Text>
            <Text style={styles.sectionSub}>确认生产人员已到位</Text>
          </View>
        </View>

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: C.greenSoft }]}>
            <Icon source="account-check" size={18} color={C.green} />
            <Text style={[styles.statValue, { color: C.green }]}>{readyCount}</Text>
            <Text style={styles.statLabel}>
              {t('taskGuideDetail.step3.stats.ready')}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.amberSoft }]}>
            <Icon source="account-clock" size={18} color={C.amber} />
            <Text style={[styles.statValue, { color: C.amber }]}>
              {assignedWorkers.length - readyCount}
            </Text>
            <Text style={styles.statLabel}>
              {t('taskGuideDetail.step3.stats.pending')}
            </Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: C.blueSoft }]}>
            <Icon source="account-group" size={18} color={C.blue} />
            <Text style={[styles.statValue, { color: C.blue }]}>
              {assignedWorkers.length}
            </Text>
            <Text style={styles.statLabel}>
              {t('taskGuideDetail.step3.stats.total')}
            </Text>
          </View>
        </View>

        {/* ── Worker List ── */}
        <View style={styles.workersSection}>
          <Text style={styles.workersSectionTitle}>
            {t('taskGuideDetail.step3.assignedWorkers')}
          </Text>
          {assignedWorkers.map(worker => {
            const eff = getEfficiencyGrade(worker.efficiency);
            return (
              <View key={worker.id} style={styles.workerCard}>
                <View style={styles.workerAvatar}>
                  <Text style={styles.workerAvatarText}>
                    {worker.name.charAt(0)}
                  </Text>
                  <View
                    style={[
                      styles.workerStatusDot,
                      {
                        backgroundColor:
                          worker.status === 'ready' ? C.green : C.amber,
                      },
                    ]}
                  />
                </View>

                <View style={styles.workerInfo}>
                  <Text style={styles.workerName}>{worker.name}</Text>
                  <Text style={styles.workerMeta}>
                    {worker.employeeId} · {worker.role}
                  </Text>
                </View>

                <View style={styles.workerRight}>
                  <View style={[styles.effBadge, { backgroundColor: eff.bg }]}>
                    <Text style={[styles.effGrade, { color: eff.color }]}>
                      {eff.grade}
                    </Text>
                  </View>
                  <Text style={styles.effPercent}>{worker.efficiency}%</Text>
                </View>

                <Icon
                  source={
                    worker.status === 'ready'
                      ? 'check-circle'
                      : 'clock-outline'
                  }
                  size={22}
                  color={worker.status === 'ready' ? C.green : C.amber}
                />
              </View>
            );
          })}
        </View>

        {/* ── Personnel Ready Confirmation ── */}
        <TouchableOpacity
          style={[styles.confirmBtn, isAllReady && styles.confirmBtnOn]}
          onPress={() => setIsAllReady(!isAllReady)}
          activeOpacity={0.7}
        >
          <Icon
            source={
              isAllReady
                ? 'checkbox-marked-circle'
                : 'checkbox-blank-circle-outline'
            }
            size={24}
            color={isAllReady ? C.green : C.muted}
          />
          <Text style={[styles.confirmText, isAllReady && styles.confirmTextOn]}>
            {t('taskGuideDetail.step3.personnelReady')}
          </Text>
          {isAllReady && (
            <View style={styles.confirmedTag}>
              <Text style={styles.confirmedTagText}>已确认</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={[
            styles.startBtn,
            !(isAllReady && allReady) && styles.startBtnOff,
          ]}
          onPress={handleStartProduction}
          disabled={!(isAllReady && allReady)}
          activeOpacity={0.8}
        >
          <Icon source="play-circle" size={22} color="#fff" />
          <Text style={styles.startBtnText}>
            {t('taskGuideDetail.step3.startProduction')}
          </Text>
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

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 4,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 11, color: C.sub, fontWeight: '500' },

  // Workers
  workersSection: { marginBottom: 20 },
  workersSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: C.sub,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  workerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  workerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: C.dark,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  workerAvatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  workerStatusDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.card,
  },
  workerInfo: { flex: 1, marginLeft: 12 },
  workerName: { fontSize: 15, fontWeight: '600', color: C.text },
  workerMeta: { fontSize: 12, color: C.muted, marginTop: 2 },
  workerRight: { alignItems: 'center', marginRight: 12 },
  effBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  effGrade: { fontSize: 13, fontWeight: '800' },
  effPercent: { fontSize: 10, color: C.muted, marginTop: 2 },

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
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.green,
    borderRadius: 12,
    paddingVertical: 16,
  },
  startBtnOff: { backgroundColor: C.pending },
  startBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
});

export default TaskGuideStep3Screen;
