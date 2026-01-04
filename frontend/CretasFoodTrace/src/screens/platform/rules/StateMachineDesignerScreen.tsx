import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  FAB,
  TextInput,
  Switch,
  Divider,
  Portal,
  Modal,
} from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

// Types
interface State {
  id: string;
  name: string;
  code: string;
  type: 'initial' | 'normal' | 'final';
  description: string;
  color: string;
}

interface Transition {
  id: string;
  fromState: string;
  toState: string;
  event: string;
  condition: string;
  action: string;
}

interface TriggerAction {
  id: string;
  name: string;
  description: string;
  type: 'function' | 'notification' | 'webhook';
  enabled: boolean;
}

interface StateMachine {
  id: string;
  name: string;
  entityType: string;
  status: 'running' | 'draft' | 'disabled';
  stateCount: number;
  transitionCount: number;
  triggerCount: number;
  states: State[];
  transitions: Transition[];
  triggers: TriggerAction[];
}

// TODO: 需要 API - ruleConfigApiClient.getStateMachine() 可用于获取已有状态机
// 设计器初始数据 - 用于创建新状态机时的默认值
const initialStateMachine: StateMachine = {
  id: 'SM001',
  name: '原材料批次状态机',
  entityType: '原材料批次',
  status: 'running',
  stateCount: 6,
  transitionCount: 12,
  triggerCount: 4,
  states: [
    { id: 'S1', name: '待检验', code: 'PENDING_INSPECTION', type: 'initial', description: '原材料刚入库，等待质检', color: '#1890ff' },
    { id: 'S2', name: '检验中', code: 'INSPECTING', type: 'normal', description: '质检员正在检验', color: '#faad14' },
    { id: 'S3', name: '合格', code: 'QUALIFIED', type: 'normal', description: '质检通过', color: '#52c41a' },
    { id: 'S4', name: '不合格', code: 'UNQUALIFIED', type: 'normal', description: '质检不通过', color: '#f5222d' },
    { id: 'S5', name: '已入库', code: 'STORED', type: 'final', description: '已正式入库可使用', color: '#722ed1' },
    { id: 'S6', name: '已处置', code: 'DISPOSED', type: 'final', description: '不合格品已处置', color: '#8c8c8c' },
  ],
  transitions: [
    { id: 'T1', fromState: '待检验', toState: '检验中', event: 'START_INSPECTION', condition: 'inspector != null', action: 'assignInspector()' },
    { id: 'T2', fromState: '检验中', toState: '合格', event: 'PASS_INSPECTION', condition: 'allChecksPass', action: 'updateQualityStatus()' },
    { id: 'T3', fromState: '检验中', toState: '不合格', event: 'FAIL_INSPECTION', condition: '!allChecksPass', action: 'triggerAlert()' },
    { id: 'T4', fromState: '合格', toState: '已入库', event: 'CONFIRM_STORAGE', condition: 'storageLocation != null', action: 'sendNotification()' },
    { id: 'T5', fromState: '不合格', toState: '已处置', event: 'DISPOSE', condition: 'disposalApproved', action: 'logDisposal()' },
  ],
  triggers: [
    { id: 'A1', name: 'assignInspector()', description: '分配质检员到批次', type: 'function', enabled: true },
    { id: 'A2', name: 'sendNotification()', description: '发送通知给相关人员', type: 'notification', enabled: true },
    { id: 'A3', name: 'updateQualityStatus()', description: '更新质量状态记录', type: 'function', enabled: true },
    { id: 'A4', name: 'triggerAlert()', description: '触发质量异常告警', type: 'notification', enabled: true },
  ],
};

type TabType = 'diagram' | 'states' | 'transitions' | 'triggers';

const StateMachineDesignerScreen: React.FC = () => {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('states');
  const [stateMachine, setStateMachine] = useState<StateMachine>(initialStateMachine);
  const [testModalVisible, setTestModalVisible] = useState(false);
  const [selectedFromState, setSelectedFromState] = useState<string>('');
  const [selectedEvent, setSelectedEvent] = useState<string>('');

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const getStateTypeLabel = (type: State['type']) => {
    switch (type) {
      case 'initial': return '初始态';
      case 'final': return '终态';
      default: return '普通';
    }
  };

  const getStateTypeColor = (type: State['type']) => {
    switch (type) {
      case 'initial': return '#1890ff';
      case 'final': return '#722ed1';
      default: return '#8c8c8c';
    }
  };

  const getTriggerIcon = (type: TriggerAction['type']) => {
    switch (type) {
      case 'function': return 'function';
      case 'notification': return 'bell-outline';
      case 'webhook': return 'webhook';
      default: return 'cog-outline';
    }
  };

  const handleSave = () => {
    // TODO: Implement save logic
    console.log('Saving state machine:', stateMachine);
  };

  const handleTestTransition = () => {
    setTestModalVisible(true);
  };

  const renderInfoCard = () => (
    <LinearGradient
      colors={['#1890ff', '#096dd9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.infoCard}
    >
      <View style={styles.infoHeader}>
        <View style={styles.infoTitleRow}>
          <MaterialCommunityIcons name="state-machine" size={24} color="#fff" />
          <Text style={styles.infoTitle}>{stateMachine.name}</Text>
        </View>
        <Chip
          mode="flat"
          style={[styles.statusChip, { backgroundColor: 'rgba(255,255,255,0.2)' }]}
          textStyle={{ color: '#fff', fontSize: 12 }}
        >
          {stateMachine.status === 'running' ? '运行中' : stateMachine.status === 'draft' ? '草稿' : '已禁用'}
        </Chip>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>实体类型</Text>
        <Text style={styles.infoValue}>{stateMachine.entityType}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stateMachine.stateCount}</Text>
          <Text style={styles.statLabel}>状态数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stateMachine.transitionCount}</Text>
          <Text style={styles.statLabel}>转换数</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stateMachine.triggerCount}</Text>
          <Text style={styles.statLabel}>触发器</Text>
        </View>
      </View>
    </LinearGradient>
  );

  const renderTabs = () => (
    <View style={styles.tabContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          { key: 'diagram', label: '状态流图', icon: 'graph-outline' },
          { key: 'states', label: '状态列表', icon: 'format-list-bulleted' },
          { key: 'transitions', label: '转换规则', icon: 'swap-horizontal' },
          { key: 'triggers', label: '触发动作', icon: 'lightning-bolt' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            onPress={() => setActiveTab(tab.key as TabType)}
          >
            <MaterialCommunityIcons
              name={tab.icon as any}
              size={18}
              color={activeTab === tab.key ? '#1890ff' : '#8c8c8c'}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const renderDiagram = () => (
    <Card style={styles.contentCard}>
      <Card.Content>
        <View style={styles.diagramContainer}>
          <View style={styles.diagramPlaceholder}>
            <MaterialCommunityIcons name="graph" size={64} color="#d9d9d9" />
            <Text style={styles.placeholderText}>状态流程图</Text>
            <Text style={styles.placeholderSubtext}>可视化状态转换流程</Text>
          </View>

          {/* Simple flow representation */}
          <View style={styles.flowContainer}>
            {stateMachine.states.map((state, index) => (
              <View key={state.id} style={styles.flowItem}>
                <View style={[styles.stateNode, { backgroundColor: state.color }]}>
                  <Text style={styles.stateNodeText}>{state.name}</Text>
                </View>
                {index < stateMachine.states.length - 1 && (
                  <MaterialCommunityIcons name="arrow-down" size={20} color="#d9d9d9" style={styles.flowArrow} />
                )}
              </View>
            ))}
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  const renderStates = () => (
    <View>
      {stateMachine.states.map((state) => (
        <Card key={state.id} style={styles.stateCard}>
          <Card.Content>
            <View style={styles.stateHeader}>
              <View style={styles.stateInfo}>
                <View style={[styles.stateColorDot, { backgroundColor: state.color }]} />
                <View>
                  <Text style={styles.stateName}>{state.name}</Text>
                  <Text style={styles.stateCode}>{state.code}</Text>
                </View>
              </View>
              <Chip
                mode="outlined"
                style={[styles.typeChip, { borderColor: getStateTypeColor(state.type) }]}
                textStyle={{ color: getStateTypeColor(state.type), fontSize: 11 }}
              >
                {getStateTypeLabel(state.type)}
              </Chip>
            </View>
            <Text style={styles.stateDescription}>{state.description}</Text>
            <View style={styles.stateActions}>
              <IconButton icon="pencil-outline" size={18} onPress={() => {}} />
              <IconButton icon="delete-outline" size={18} onPress={() => {}} iconColor="#f5222d" />
            </View>
          </Card.Content>
        </Card>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <MaterialCommunityIcons name="plus" size={20} color="#1890ff" />
        <Text style={styles.addButtonText}>添加状态</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTransitions = () => (
    <View>
      {stateMachine.transitions.map((transition) => (
        <Card key={transition.id} style={styles.transitionCard}>
          <Card.Content>
            <View style={styles.transitionHeader}>
              <View style={styles.transitionFlow}>
                <Chip mode="flat" style={styles.fromChip}>
                  {transition.fromState}
                </Chip>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#8c8c8c" />
                <Chip mode="flat" style={styles.toChip}>
                  {transition.toState}
                </Chip>
              </View>
              <View style={styles.transitionActions}>
                <IconButton icon="pencil-outline" size={18} onPress={() => {}} />
                <IconButton icon="delete-outline" size={18} onPress={() => {}} iconColor="#f5222d" />
              </View>
            </View>

            <View style={styles.transitionDetails}>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#faad14" />
                <Text style={styles.detailLabel}>事件:</Text>
                <Text style={styles.detailValue}>{transition.event}</Text>
              </View>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="help-circle-outline" size={16} color="#1890ff" />
                <Text style={styles.detailLabel}>条件:</Text>
                <Text style={styles.detailCode}>{transition.condition}</Text>
              </View>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="play-circle-outline" size={16} color="#52c41a" />
                <Text style={styles.detailLabel}>动作:</Text>
                <Text style={styles.detailCode}>{transition.action}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <MaterialCommunityIcons name="plus" size={20} color="#1890ff" />
        <Text style={styles.addButtonText}>添加转换规则</Text>
      </TouchableOpacity>
    </View>
  );

  const renderTriggers = () => (
    <View>
      {stateMachine.triggers.map((trigger) => (
        <Card key={trigger.id} style={styles.triggerCard}>
          <Card.Content>
            <View style={styles.triggerHeader}>
              <View style={styles.triggerInfo}>
                <View style={styles.triggerIconContainer}>
                  <MaterialCommunityIcons
                    name={getTriggerIcon(trigger.type) as any}
                    size={20}
                    color="#1890ff"
                  />
                </View>
                <View>
                  <Text style={styles.triggerName}>{trigger.name}</Text>
                  <Text style={styles.triggerDescription}>{trigger.description}</Text>
                </View>
              </View>
              <Switch
                value={trigger.enabled}
                onValueChange={(value) => {
                  const updated = stateMachine.triggers.map((t) =>
                    t.id === trigger.id ? { ...t, enabled: value } : t
                  );
                  setStateMachine({ ...stateMachine, triggers: updated });
                }}
                color="#1890ff"
              />
            </View>
          </Card.Content>
        </Card>
      ))}

      <TouchableOpacity style={styles.addButton}>
        <MaterialCommunityIcons name="plus" size={20} color="#1890ff" />
        <Text style={styles.addButtonText}>添加触发动作</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'diagram':
        return renderDiagram();
      case 'states':
        return renderStates();
      case 'transitions':
        return renderTransitions();
      case 'triggers':
        return renderTriggers();
      default:
        return renderStates();
    }
  };

  const renderTestModal = () => (
    <Portal>
      <Modal
        visible={testModalVisible}
        onDismiss={() => setTestModalVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Text style={styles.modalTitle}>测试状态转换</Text>
        <Divider style={styles.modalDivider} />

        <Text style={styles.modalLabel}>当前状态</Text>
        <View style={styles.stateSelector}>
          {stateMachine.states.slice(0, 3).map((state) => (
            <TouchableOpacity
              key={state.id}
              style={[
                styles.stateSelectorItem,
                selectedFromState === state.code && styles.stateSelectorItemActive,
              ]}
              onPress={() => setSelectedFromState(state.code)}
            >
              <Text
                style={[
                  styles.stateSelectorText,
                  selectedFromState === state.code && styles.stateSelectorTextActive,
                ]}
              >
                {state.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.modalLabel}>触发事件</Text>
        <TextInput
          mode="outlined"
          placeholder="例如: START_INSPECTION"
          value={selectedEvent}
          onChangeText={setSelectedEvent}
          style={styles.modalInput}
        />

        <View style={styles.modalActions}>
          <Button mode="outlined" onPress={() => setTestModalVisible(false)} style={styles.modalButton}>
            取消
          </Button>
          <Button
            mode="contained"
            onPress={() => {
              console.log('Testing transition:', selectedFromState, selectedEvent);
              setTestModalVisible(false);
            }}
            style={styles.modalButton}
          >
            执行测试
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {renderInfoCard()}
        {renderTabs()}
        <View style={styles.contentContainer}>{renderContent()}</View>
      </ScrollView>

      {/* Bottom Action Bar */}
      <View style={styles.bottomBar}>
        <Button
          mode="outlined"
          icon="play-circle-outline"
          onPress={handleTestTransition}
          style={styles.bottomButton}
        >
          测试转换
        </Button>
        <Button
          mode="contained"
          icon="content-save-outline"
          onPress={handleSave}
          style={[styles.bottomButton, styles.saveButton]}
        >
          保存状态机
        </Button>
      </View>

      {renderTestModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  infoCard: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusChip: {
    height: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    padding: 12,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabContainer: {
    backgroundColor: '#fff',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    gap: 6,
  },
  activeTab: {
    backgroundColor: '#e6f7ff',
  },
  tabText: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  activeTabText: {
    color: '#1890ff',
    fontWeight: '500',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  contentCard: {
    borderRadius: 12,
  },
  diagramContainer: {
    minHeight: 300,
  },
  diagramPlaceholder: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#8c8c8c',
    marginTop: 8,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#bfbfbf',
    marginTop: 4,
  },
  flowContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  flowItem: {
    alignItems: 'center',
  },
  stateNode: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  stateNodeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  flowArrow: {
    marginVertical: 4,
  },
  stateCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  stateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  stateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stateColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stateName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#262626',
  },
  stateCode: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  typeChip: {
    height: 24,
  },
  stateDescription: {
    fontSize: 13,
    color: '#595959',
    marginLeft: 24,
    marginBottom: 8,
  },
  stateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  transitionCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  transitionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transitionFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fromChip: {
    backgroundColor: '#e6f7ff',
  },
  toChip: {
    backgroundColor: '#f6ffed',
  },
  transitionActions: {
    flexDirection: 'row',
  },
  transitionDetails: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#8c8c8c',
    width: 40,
  },
  detailValue: {
    fontSize: 13,
    color: '#262626',
    fontWeight: '500',
  },
  detailCode: {
    fontSize: 12,
    color: '#722ed1',
    fontFamily: 'monospace',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  triggerCard: {
    marginBottom: 12,
    borderRadius: 12,
  },
  triggerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  triggerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  triggerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e6f7ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  triggerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#262626',
    fontFamily: 'monospace',
  },
  triggerDescription: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#1890ff',
    borderStyle: 'dashed',
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  addButtonText: {
    fontSize: 14,
    color: '#1890ff',
    fontWeight: '500',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    gap: 12,
  },
  bottomButton: {
    flex: 1,
  },
  saveButton: {
    backgroundColor: '#1890ff',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#262626',
    marginBottom: 8,
  },
  modalDivider: {
    marginVertical: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 8,
  },
  stateSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  stateSelectorItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d9d9d9',
  },
  stateSelectorItemActive: {
    borderColor: '#1890ff',
    backgroundColor: '#e6f7ff',
  },
  stateSelectorText: {
    fontSize: 14,
    color: '#595959',
  },
  stateSelectorTextActive: {
    color: '#1890ff',
    fontWeight: '500',
  },
  modalInput: {
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    minWidth: 100,
  },
});

export default StateMachineDesignerScreen;
