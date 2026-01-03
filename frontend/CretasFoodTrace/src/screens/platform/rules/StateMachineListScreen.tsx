import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Chip,
  Button,
  Menu,
  Avatar,
  Badge,
  IconButton,
  Searchbar,
  FAB,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../../store/authStore';

// State Machine mock data
interface StateMachineState {
  id: string;
  name: string;
  color: string;
}

interface StateMachine {
  id: string;
  entityName: string;
  entityCode: string;
  stateCount: number;
  transitionCount: number;
  status: 'running' | 'draft' | 'disabled';
  lastModified: string;
  borderColor: string;
  states: StateMachineState[];
}

const MOCK_STATE_MACHINES: StateMachine[] = [
  {
    id: '1',
    entityName: '原材料批次',
    entityCode: 'MaterialBatch',
    stateCount: 6,
    transitionCount: 12,
    status: 'running',
    lastModified: '2024-03-15',
    borderColor: '#1890ff',
    states: [
      { id: 's1', name: '待入库', color: '#faad14' },
      { id: 's2', name: '已入库', color: '#52c41a' },
      { id: 's3', name: '检验中', color: '#1890ff' },
      { id: 's4', name: '已使用', color: '#722ed1' },
    ],
  },
  {
    id: '2',
    entityName: '生产批次',
    entityCode: 'ProductionBatch',
    stateCount: 7,
    transitionCount: 15,
    status: 'running',
    lastModified: '2024-03-14',
    borderColor: '#52c41a',
    states: [
      { id: 's1', name: '待生产', color: '#faad14' },
      { id: 's2', name: '生产中', color: '#1890ff' },
      { id: 's3', name: '已完成', color: '#52c41a' },
      { id: 's4', name: '已入库', color: '#722ed1' },
    ],
  },
  {
    id: '3',
    entityName: '质检单',
    entityCode: 'QualityInspection',
    stateCount: 5,
    transitionCount: 8,
    status: 'running',
    lastModified: '2024-03-13',
    borderColor: '#722ed1',
    states: [
      { id: 's1', name: '待检验', color: '#faad14' },
      { id: 's2', name: '检验中', color: '#1890ff' },
      { id: 's3', name: '已通过', color: '#52c41a' },
      { id: 's4', name: '不合格', color: '#f5222d' },
    ],
  },
  {
    id: '4',
    entityName: '出货单',
    entityCode: 'Shipment',
    stateCount: 5,
    transitionCount: 6,
    status: 'running',
    lastModified: '2024-03-12',
    borderColor: '#fa8c16',
    states: [
      { id: 's1', name: '待发货', color: '#faad14' },
      { id: 's2', name: '已发货', color: '#1890ff' },
      { id: 's3', name: '已签收', color: '#52c41a' },
    ],
  },
  {
    id: '5',
    entityName: '设备维护单',
    entityCode: 'MaintenanceOrder',
    stateCount: 5,
    transitionCount: 4,
    status: 'draft',
    lastModified: '2024-03-11',
    borderColor: '#f5222d',
    states: [
      { id: 's1', name: '待处理', color: '#faad14' },
      { id: 's2', name: '处理中', color: '#1890ff' },
      { id: 's3', name: '已完成', color: '#52c41a' },
    ],
  },
];

const StateMachineListScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { user, currentFactory } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [factoryMenuVisible, setFactoryMenuVisible] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState({
    id: 'F001',
    name: '海鲜加工一厂',
  });

  const factories = [
    { id: 'F001', name: '海鲜加工一厂' },
    { id: 'F002', name: '海鲜加工二厂' },
    { id: 'F003', name: '冷冻水产厂' },
  ];

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  const handleFactorySelect = (factory: { id: string; name: string }) => {
    setSelectedFactory(factory);
    setFactoryMenuVisible(false);
  };

  const filteredStateMachines = MOCK_STATE_MACHINES.filter(
    (sm) =>
      sm.entityName.includes(searchQuery) ||
      sm.entityCode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Statistics
  const statistics = {
    totalMachines: MOCK_STATE_MACHINES.length,
    totalStates: MOCK_STATE_MACHINES.reduce((sum, sm) => sum + sm.stateCount, 0),
    totalTransitions: MOCK_STATE_MACHINES.reduce(
      (sum, sm) => sum + sm.transitionCount,
      0
    ),
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <IconButton icon="chevron-left" size={24} iconColor="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>状态机管理</Text>
      <View style={styles.headerRight} />
    </View>
  );

  const renderInfoCard = () => (
    <LinearGradient
      colors={['#722ed1', '#531dab']}
      style={styles.infoCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.infoCardContent}>
        <View style={styles.infoIconContainer}>
          <IconButton icon="state-machine" size={28} iconColor="#fff" />
        </View>
        <View style={styles.infoTextContainer}>
          <Text style={styles.infoTitle}>状态机引擎</Text>
          <Text style={styles.infoDescription}>
            统一管理业务实体的状态流转，定义状态、转换条件和动作
          </Text>
        </View>
      </View>
    </LinearGradient>
  );

  const renderFactorySelector = () => (
    <View style={styles.factorySelectorContainer}>
      <Menu
        visible={factoryMenuVisible}
        onDismiss={() => setFactoryMenuVisible(false)}
        anchor={
          <TouchableOpacity
            style={styles.factorySelector}
            onPress={() => setFactoryMenuVisible(true)}
          >
            <View style={styles.factoryInfo}>
              <View style={styles.factoryAvatarContainer}>
                <Avatar.Text
                  size={36}
                  label={selectedFactory.name.substring(0, 1)}
                  style={styles.factoryAvatar}
                />
                <Badge style={styles.factoryBadge}>{selectedFactory.id}</Badge>
              </View>
              <Text style={styles.factoryName}>{selectedFactory.name}</Text>
            </View>
            <IconButton icon="chevron-down" size={20} iconColor="#595959" />
          </TouchableOpacity>
        }
      >
        {factories.map((factory) => (
          <Menu.Item
            key={factory.id}
            onPress={() => handleFactorySelect(factory)}
            title={`${factory.name} (${factory.id})`}
            leadingIcon={
              factory.id === selectedFactory.id ? 'check' : undefined
            }
          />
        ))}
      </Menu>
    </View>
  );

  const renderStatistics = () => (
    <View style={styles.statsContainer}>
      <Card style={[styles.statCard, { backgroundColor: '#f9f0ff' }]} mode="elevated">
        <Card.Content style={styles.statContent}>
          <Text style={[styles.statValue, { color: '#722ed1' }]}>
            {statistics.totalMachines}
          </Text>
          <Text style={styles.statLabel}>状态机数</Text>
        </Card.Content>
      </Card>
      <Card style={[styles.statCard, { backgroundColor: '#f6ffed' }]} mode="elevated">
        <Card.Content style={styles.statContent}>
          <Text style={[styles.statValue, { color: '#52c41a' }]}>
            {statistics.totalStates}
          </Text>
          <Text style={styles.statLabel}>状态总数</Text>
        </Card.Content>
      </Card>
      <Card style={[styles.statCard, { backgroundColor: '#e6f7ff' }]} mode="elevated">
        <Card.Content style={styles.statContent}>
          <Text style={[styles.statValue, { color: '#1890ff' }]}>
            {statistics.totalTransitions}
          </Text>
          <Text style={styles.statLabel}>转换规则</Text>
        </Card.Content>
      </Card>
    </View>
  );

  const renderStateFlow = (states: StateMachineState[]) => (
    <View style={styles.stateFlowContainer}>
      {states.map((state, index) => (
        <React.Fragment key={state.id}>
          <Chip
            mode="flat"
            style={[styles.stateChip, { backgroundColor: `${state.color}20` }]}
            textStyle={[styles.stateChipText, { color: state.color }]}
          >
            {state.name}
          </Chip>
          {index < states.length - 1 && (
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const getStatusTag = (status: 'running' | 'draft' | 'disabled') => {
    const statusConfig = {
      running: { label: '运行中', color: '#52c41a', bgColor: '#f6ffed' },
      draft: { label: '草稿', color: '#faad14', bgColor: '#fffbe6' },
      disabled: { label: '已停用', color: '#8c8c8c', bgColor: '#f5f5f5' },
    };
    const config = statusConfig[status];
    return (
      <Chip
        mode="flat"
        style={[styles.statusChip, { backgroundColor: config.bgColor }]}
        textStyle={[styles.statusChipText, { color: config.color }]}
      >
        {config.label}
      </Chip>
    );
  };

  const renderStateMachineCard = (stateMachine: StateMachine) => (
    <TouchableOpacity
      key={stateMachine.id}
      onPress={() => {
        // Navigate to designer
        // navigation.navigate('StateMachineDesigner', { id: stateMachine.id });
      }}
      activeOpacity={0.7}
    >
      <Card
        style={[
          styles.machineCard,
          { borderLeftColor: stateMachine.borderColor },
        ]}
        mode="elevated"
      >
        <Card.Content>
          <View style={styles.machineHeader}>
            <View style={styles.machineInfo}>
              <Text style={styles.machineName}>{stateMachine.entityName}</Text>
              <Text style={styles.machineCode}>
                {stateMachine.entityCode} · {stateMachine.stateCount}个状态
              </Text>
            </View>
            {getStatusTag(stateMachine.status)}
          </View>

          <View style={styles.machineBody}>
            <Text style={styles.flowLabel}>状态流程</Text>
            {renderStateFlow(stateMachine.states)}
          </View>

          <View style={styles.machineFooter}>
            <View style={styles.footerLeft}>
              <IconButton
                icon="swap-horizontal"
                size={16}
                iconColor="#8c8c8c"
                style={styles.footerIcon}
              />
              <Text style={styles.footerText}>
                {stateMachine.transitionCount}个转换
              </Text>
            </View>
            <Text style={styles.footerDate}>
              更新于 {stateMachine.lastModified}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderQuickActions = () => (
    <View style={styles.quickActionsContainer}>
      <Text style={styles.sectionTitle}>快捷操作</Text>
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity style={styles.quickActionCard}>
          <LinearGradient
            colors={['#722ed1', '#531dab']}
            style={styles.quickActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <IconButton icon="play-circle" size={24} iconColor="#fff" />
            <Text style={styles.quickActionText}>转换测试</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickActionCard}
          onPress={() => navigation.goBack()}
        >
          <LinearGradient
            colors={['#1890ff', '#096dd9']}
            style={styles.quickActionGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <IconButton icon="cog" size={24} iconColor="#fff" />
            <Text style={styles.quickActionText}>规则管理</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={['#722ed1', '#531dab']}
        style={styles.headerGradient}
      >
        {renderHeader()}
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {renderInfoCard()}
        {renderFactorySelector()}
        {renderStatistics()}

        <View style={styles.searchContainer}>
          <Searchbar
            placeholder="搜索状态机..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchbar}
            inputStyle={styles.searchInput}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>业务实体状态机</Text>
          <Text style={styles.sectionCount}>
            {filteredStateMachines.length}个
          </Text>
        </View>

        <View style={styles.machineList}>
          {filteredStateMachines.map(renderStateMachineCard)}
        </View>

        {renderQuickActions()}
      </ScrollView>

      <FAB
        icon="plus"
        style={styles.fab}
        color="#fff"
        onPress={() => {
          // Navigate to create new state machine
          // navigation.navigate('StateMachineDesigner');
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerGradient: {
    paddingBottom: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  infoCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 18,
  },
  factorySelectorContainer: {
    marginBottom: 20,
  },
  factorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
  },
  factoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  factoryAvatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  factoryAvatar: {
    backgroundColor: '#722ed1',
  },
  factoryBadge: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    backgroundColor: '#722ed1',
    fontSize: 9,
  },
  factoryName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#262626',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    elevation: 0,
  },
  statContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchbar: {
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 0,
  },
  searchInput: {
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  sectionCount: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  machineList: {
    gap: 12,
    marginBottom: 24,
  },
  machineCard: {
    borderRadius: 12,
    borderLeftWidth: 4,
    backgroundColor: '#fff',
    elevation: 1,
  },
  machineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  machineInfo: {
    flex: 1,
  },
  machineName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 4,
  },
  machineCode: {
    fontSize: 13,
    color: '#8c8c8c',
  },
  statusChip: {
    height: 24,
  },
  statusChipText: {
    fontSize: 12,
  },
  machineBody: {
    marginBottom: 12,
  },
  flowLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    marginBottom: 8,
  },
  stateFlowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  stateChip: {
    height: 28,
    marginVertical: 2,
  },
  stateChipText: {
    fontSize: 12,
  },
  arrowContainer: {
    paddingHorizontal: 4,
  },
  arrow: {
    fontSize: 14,
    color: '#bfbfbf',
  },
  machineFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerIcon: {
    margin: 0,
    marginRight: 4,
  },
  footerText: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  footerDate: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  quickActionsContainer: {
    marginBottom: 20,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  quickActionCard: {
    flex: 1,
  },
  quickActionGradient: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    backgroundColor: '#722ed1',
  },
});

export default StateMachineListScreen;
