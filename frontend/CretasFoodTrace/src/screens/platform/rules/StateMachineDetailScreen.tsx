import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import {
  Appbar,
  Text,
  Card,
  Chip,
  Button,
  IconButton,
  ActivityIndicator,
  Divider,
  Avatar,
  Switch,
  Menu,
  Badge,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line, Polygon, Text as SvgText, G, Defs, Marker, Path } from 'react-native-svg';
import { useAuthStore } from '../../../store/authStore';
import { createLogger } from '../../../utils/logger';
import { isAxiosError } from 'axios';
import { ruleConfigApiClient, StateMachineConfig, EntityType } from '../../../services/api/ruleConfigApiClient';

const logger = createLogger('StateMachineDetailScreen');

const { width: screenWidth } = Dimensions.get('window');

// Route params type
type StateMachineDetailRouteParams = {
  StateMachineDetail: {
    machineId: string;
  };
};

// Mock types
interface State {
  id: string;
  name: string;
  code: string;
  color: string;
  isInitial: boolean;
  isFinal: boolean;
  description: string;
}

interface Transition {
  id: string;
  fromStateId: string;
  toStateId: string;
  event: string;
  guard: string;
  action: string;
}

interface StateMachine {
  id: string;
  entityName: string;
  entityCode: string;
  description: string;
  status: 'running' | 'draft' | 'disabled';
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  states: State[];
  transitions: Transition[];
}

// 将API返回的StateMachineConfig转换为屏幕使用的StateMachine格式
const mapApiToStateMachine = (config: StateMachineConfig): StateMachine => {
  // 找到初始状态
  const initialStateCode = config.initialState;

  // 转换状态列表
  const states: State[] = (config.states || []).map((s, idx) => ({
    id: `S${idx + 1}`,
    name: s.name,
    code: s.code,
    color: s.color || '#8c8c8c',
    isInitial: s.code === initialStateCode,
    isFinal: s.isFinal || false,
    description: s.description || '',
  }));

  // 创建状态code到id的映射
  const codeToIdMap: Record<string, string> = {};
  states.forEach((s) => {
    codeToIdMap[s.code] = s.id;
  });

  // 转换转换规则列表
  const transitions: Transition[] = (config.transitions || []).map((t, idx) => ({
    id: `T${idx + 1}`,
    fromStateId: codeToIdMap[t.fromState] || t.fromState,
    toStateId: codeToIdMap[t.toState] || t.toState,
    event: t.event,
    guard: t.guard || '',
    action: t.action || '',
  }));

  return {
    id: config.id || config.entityType,
    entityName: config.machineName,
    entityCode: config.entityType,
    description: config.machineDescription || '',
    status: config.enabled ? 'running' : 'draft',
    version: String(config.version || '1.0'),
    createdAt: config.createdAt || new Date().toISOString(),
    updatedAt: config.updatedAt || new Date().toISOString(),
    createdBy: 'system',
    states,
    transitions,
  };
};

const StateMachineDetailScreen: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object>>>();
  const route = useRoute<RouteProp<StateMachineDetailRouteParams, 'StateMachineDetail'>>();
  const { getFactoryId } = useAuthStore();
  const factoryId = getFactoryId();

  const { machineId } = route.params || {};

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stateMachine, setStateMachine] = useState<StateMachine | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'states' | 'transitions'>('states');
  const [selectedState, setSelectedState] = useState<State | null>(null);
  const [selectedTransition, setSelectedTransition] = useState<Transition | null>(null);

  // Load state machine
  useEffect(() => {
    loadStateMachine();
  }, [machineId]);

  const loadStateMachine = async () => {
    try {
      setLoading(true);
      // machineId 对应 API 的 entityType 参数
      // 例如: MaterialBatch, ProcessingBatch, QualityInspection 等
      if (machineId) {
        const response = await ruleConfigApiClient.getStateMachine(machineId as EntityType);
        if (response) {
          setStateMachine(mapApiToStateMachine(response));
        } else {
          setStateMachine(null);
        }
      } else {
        setStateMachine(null);
      }
    } catch (error) {
      logger.error('Failed to load state machine', error);
      if (isAxiosError(error)) {
        Alert.alert(t('common.error'), error.response?.data?.message || t('stateMachine.loadFailed'));
      } else if (error instanceof Error) {
        Alert.alert(t('common.error'), error.message);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadStateMachine();
  };

  // Get status config
  const getStatusConfig = (status: string): { label: string; labelZh: string; color: string; bgColor: string } => {
    const defaultConfig = { label: 'Draft', labelZh: '草稿', color: '#faad14', bgColor: '#fffbe6' };
    const configs: Record<string, { label: string; labelZh: string; color: string; bgColor: string }> = {
      running: { label: 'Running', labelZh: '运行中', color: '#52c41a', bgColor: '#f6ffed' },
      draft: defaultConfig,
      disabled: { label: 'Disabled', labelZh: '已停用', color: '#8c8c8c', bgColor: '#f5f5f5' },
    };
    return configs[status] ?? defaultConfig;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Get state by ID
  const getStateById = (stateId: string): State | undefined => {
    return stateMachine?.states.find((s) => s.id === stateId);
  };

  // Calculate positions for state visualization
  const calculateStatePositions = useCallback(() => {
    if (!stateMachine) return [];

    const states = stateMachine.states;
    const svgWidth = screenWidth - 64;
    const svgHeight = 280;
    const centerX = svgWidth / 2;
    const centerY = svgHeight / 2;
    const radius = Math.min(svgWidth, svgHeight) / 2 - 40;

    // Arrange states in a circle
    return states.map((state, index) => {
      const angle = (2 * Math.PI * index) / states.length - Math.PI / 2;
      return {
        ...state,
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
      };
    });
  }, [stateMachine]);

  // Render state machine visualization
  const renderVisualization = () => {
    if (!stateMachine) return null;

    const svgWidth = screenWidth - 64;
    const svgHeight = 280;
    const statePositions = calculateStatePositions();
    const stateRadius = 24;

    return (
      <Card style={styles.visualCard}>
        <Card.Content>
          <Text style={styles.sectionTitle}>
            {t('stateMachine.visualization', 'State Flow Visualization')}
          </Text>
          <Svg width={svgWidth} height={svgHeight}>
            <Defs>
              <Marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <Polygon points="0 0, 10 3.5, 0 7" fill="#999" />
              </Marker>
            </Defs>

            {/* Draw transitions (lines) */}
            {stateMachine.transitions.map((transition) => {
              const fromState = statePositions.find((s) => s.id === transition.fromStateId);
              const toState = statePositions.find((s) => s.id === transition.toStateId);
              if (!fromState || !toState) return null;

              // Calculate line endpoints
              const dx = toState.x - fromState.x;
              const dy = toState.y - fromState.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              const offsetX = (dx / distance) * stateRadius;
              const offsetY = (dy / distance) * stateRadius;

              return (
                <G key={transition.id}>
                  <Line
                    x1={fromState.x + offsetX}
                    y1={fromState.y + offsetY}
                    x2={toState.x - offsetX}
                    y2={toState.y - offsetY}
                    stroke="#999"
                    strokeWidth="1.5"
                    markerEnd="url(#arrowhead)"
                  />
                </G>
              );
            })}

            {/* Draw states (circles) */}
            {statePositions.map((state) => (
              <G key={state.id}>
                {/* Initial state indicator */}
                {state.isInitial && (
                  <Circle
                    cx={state.x}
                    cy={state.y}
                    r={stateRadius + 4}
                    fill="none"
                    stroke={state.color}
                    strokeWidth="2"
                    strokeDasharray="4,4"
                  />
                )}
                {/* Final state indicator */}
                {state.isFinal && (
                  <Circle
                    cx={state.x}
                    cy={state.y}
                    r={stateRadius + 6}
                    fill="none"
                    stroke={state.color}
                    strokeWidth="1.5"
                  />
                )}
                {/* State circle */}
                <Circle
                  cx={state.x}
                  cy={state.y}
                  r={stateRadius}
                  fill={state.color}
                  onPress={() => setSelectedState(state)}
                />
                {/* State name */}
                <SvgText
                  x={state.x}
                  y={state.y + stateRadius + 16}
                  fontSize="10"
                  fill="#333"
                  textAnchor="middle"
                >
                  {state.name.length > 4 ? state.name.substring(0, 4) + '..' : state.name}
                </SvgText>
              </G>
            ))}
          </Svg>

          {/* Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { borderStyle: 'dashed', borderWidth: 2, borderColor: '#52c41a' }]} />
              <Text style={styles.legendText}>{t('stateMachine.initialState', 'Initial')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { borderWidth: 2, borderColor: '#722ed1' }]} />
              <Text style={styles.legendText}>{t('stateMachine.finalState', 'Final')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#1890ff' }]} />
              <Text style={styles.legendText}>{t('stateMachine.normalState', 'Normal')}</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  // Navigate to designer
  const handleEdit = () => {
    setMenuVisible(false);
    navigation.navigate('StateMachineDesigner', { machineId });
  };

  // Delete state machine
  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert(
      t('stateMachine.deleteConfirm', 'Delete State Machine'),
      t('stateMachine.deleteMessage', 'Are you sure you want to delete this state machine?'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            // TODO: Call API to delete
            navigation.goBack();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#722ed1" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!stateMachine) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <Appbar.Header>
          <Appbar.BackAction onPress={() => navigation.goBack()} />
          <Appbar.Content title={t('stateMachine.detail', 'State Machine Detail')} />
        </Appbar.Header>
        <View style={styles.emptyContainer}>
          <Avatar.Icon size={64} icon="alert-circle" color="#999" style={{ backgroundColor: '#f0f0f0' }} />
          <Text style={styles.emptyText}>{t('stateMachine.notFound', 'State machine not found')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const statusConfig = getStatusConfig(stateMachine.status);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <LinearGradient colors={['#722ed1', '#531dab']} style={styles.header}>
        <Appbar.Header style={styles.appbar}>
          <Appbar.BackAction onPress={() => navigation.goBack()} color="#fff" />
          <Appbar.Content
            title={t('stateMachine.detail', 'State Machine Detail')}
            titleStyle={styles.headerTitle}
          />
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Appbar.Action
                icon="dots-vertical"
                color="#fff"
                onPress={() => setMenuVisible(true)}
              />
            }
          >
            <Menu.Item
              leadingIcon="pencil"
              onPress={handleEdit}
              title={t('common.edit', 'Edit')}
            />
            <Divider />
            <Menu.Item
              leadingIcon="delete"
              onPress={handleDelete}
              title={t('common.delete', 'Delete')}
              titleStyle={{ color: '#f5222d' }}
            />
          </Menu>
        </Appbar.Header>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Info Card */}
        <Card style={styles.infoCard}>
          <Card.Content>
            <View style={styles.infoHeader}>
              <Avatar.Icon
                size={48}
                icon="state-machine"
                color="#fff"
                style={{ backgroundColor: '#722ed1' }}
              />
              <View style={styles.infoContent}>
                <Text style={styles.machineName}>{stateMachine.entityName}</Text>
                <View style={styles.infoMeta}>
                  <Text style={styles.entityCode}>{stateMachine.entityCode}</Text>
                  <Chip
                    compact
                    style={[styles.statusChip, { backgroundColor: statusConfig.bgColor }]}
                    textStyle={{ color: statusConfig.color }}
                  >
                    {i18n.language === 'en' ? statusConfig.label : statusConfig.labelZh}
                  </Chip>
                </View>
              </View>
            </View>

            <Text style={styles.description}>{stateMachine.description}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{stateMachine.states.length}</Text>
                <Text style={styles.statLabel}>{t('stateMachine.states', 'States')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#1890ff' }]}>
                  {stateMachine.transitions.length}
                </Text>
                <Text style={styles.statLabel}>{t('stateMachine.transitions', 'Transitions')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: '#52c41a' }]}>
                  v{stateMachine.version}
                </Text>
                <Text style={styles.statLabel}>{t('stateMachine.version', 'Version')}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        {/* Visualization */}
        {renderVisualization()}

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'states' && styles.tabActive]}
            onPress={() => setSelectedTab('states')}
          >
            <Text style={[styles.tabText, selectedTab === 'states' && styles.tabTextActive]}>
              {t('stateMachine.stateList', 'State List')}
            </Text>
            <Badge style={styles.tabBadge}>{stateMachine.states.length}</Badge>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'transitions' && styles.tabActive]}
            onPress={() => setSelectedTab('transitions')}
          >
            <Text style={[styles.tabText, selectedTab === 'transitions' && styles.tabTextActive]}>
              {t('stateMachine.transitionRules', 'Transition Rules')}
            </Text>
            <Badge style={styles.tabBadge}>{stateMachine.transitions.length}</Badge>
          </TouchableOpacity>
        </View>

        {/* States List */}
        {selectedTab === 'states' && (
          <Card style={styles.listCard}>
            <Card.Content>
              {stateMachine.states.map((state, index) => (
                <React.Fragment key={state.id}>
                  <TouchableOpacity
                    style={styles.stateItem}
                    onPress={() => setSelectedState(state)}
                  >
                    <View style={[styles.stateIndicator, { backgroundColor: state.color }]} />
                    <View style={styles.stateInfo}>
                      <View style={styles.stateHeader}>
                        <Text style={styles.stateName}>{state.name}</Text>
                        {state.isInitial && (
                          <Chip compact style={styles.stateTypeChip}>
                            {t('stateMachine.initial', 'Initial')}
                          </Chip>
                        )}
                        {state.isFinal && (
                          <Chip compact style={styles.stateTypeChip}>
                            {t('stateMachine.final', 'Final')}
                          </Chip>
                        )}
                      </View>
                      <Text style={styles.stateCode}>{state.code}</Text>
                      <Text style={styles.stateDesc} numberOfLines={1}>
                        {state.description}
                      </Text>
                    </View>
                    <IconButton icon="chevron-right" size={20} iconColor="#999" />
                  </TouchableOpacity>
                  {index < stateMachine.states.length - 1 && <Divider style={styles.itemDivider} />}
                </React.Fragment>
              ))}
            </Card.Content>
          </Card>
        )}

        {/* Transitions List */}
        {selectedTab === 'transitions' && (
          <Card style={styles.listCard}>
            <Card.Content>
              {stateMachine.transitions.map((transition, index) => {
                const fromState = getStateById(transition.fromStateId);
                const toState = getStateById(transition.toStateId);

                return (
                  <React.Fragment key={transition.id}>
                    <TouchableOpacity
                      style={styles.transitionItem}
                      onPress={() => setSelectedTransition(transition)}
                    >
                      <View style={styles.transitionFlow}>
                        <Chip
                          compact
                          style={[styles.stateChip, { backgroundColor: (fromState?.color || '#999') + '20' }]}
                          textStyle={{ color: fromState?.color || '#999' }}
                        >
                          {fromState?.name || '?'}
                        </Chip>
                        <IconButton icon="arrow-right" size={16} iconColor="#999" style={styles.arrowIcon} />
                        <Chip
                          compact
                          style={[styles.stateChip, { backgroundColor: (toState?.color || '#999') + '20' }]}
                          textStyle={{ color: toState?.color || '#999' }}
                        >
                          {toState?.name || '?'}
                        </Chip>
                      </View>
                      <View style={styles.transitionDetails}>
                        <View style={styles.transitionRow}>
                          <Text style={styles.transitionLabel}>{t('stateMachine.event', 'Event')}:</Text>
                          <Text style={styles.transitionValue}>{transition.event}</Text>
                        </View>
                        {transition.guard && (
                          <View style={styles.transitionRow}>
                            <Text style={styles.transitionLabel}>{t('stateMachine.guard', 'Guard')}:</Text>
                            <Text style={styles.transitionValue}>{transition.guard}</Text>
                          </View>
                        )}
                        {transition.action && (
                          <View style={styles.transitionRow}>
                            <Text style={styles.transitionLabel}>{t('stateMachine.action', 'Action')}:</Text>
                            <Text style={styles.transitionValue}>{transition.action}</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    {index < stateMachine.transitions.length - 1 && <Divider style={styles.itemDivider} />}
                  </React.Fragment>
                );
              })}
            </Card.Content>
          </Card>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Action Bar */}
      <View style={styles.actionBar}>
        <Button
          mode="outlined"
          icon="play-circle"
          onPress={() => {
            Alert.alert(t('common.info'), t('stateMachine.testNotImplemented'));
          }}
          style={styles.testButton}
        >
          {t('stateMachine.testTransition', 'Test')}
        </Button>
        <Button
          mode="contained"
          icon="pencil"
          onPress={handleEdit}
          style={styles.editButton}
        >
          {t('common.edit', 'Edit')}
        </Button>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#999',
  },
  header: {
    paddingBottom: 8,
  },
  appbar: {
    backgroundColor: 'transparent',
    elevation: 0,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  // Info Card
  infoCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 16,
  },
  machineName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  infoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  entityCode: {
    fontSize: 12,
    color: '#999',
  },
  statusChip: {
    height: 24,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#722ed1',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  // Visualization Card
  visualCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#666',
  },
  // Tab Container
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabActive: {
    backgroundColor: '#f9f0ff',
  },
  tabText: {
    fontSize: 14,
    color: '#666',
  },
  tabTextActive: {
    color: '#722ed1',
    fontWeight: '600',
  },
  tabBadge: {
    backgroundColor: '#722ed1',
  },
  // List Card
  listCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 2,
  },
  // State Item
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  stateIndicator: {
    width: 8,
    height: 40,
    borderRadius: 4,
    marginRight: 12,
  },
  stateInfo: {
    flex: 1,
  },
  stateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stateName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  stateTypeChip: {
    height: 20,
    backgroundColor: '#f0f0f0',
  },
  stateCode: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  stateDesc: {
    fontSize: 12,
    color: '#666',
  },
  itemDivider: {
    backgroundColor: '#f0f0f0',
  },
  // Transition Item
  transitionItem: {
    paddingVertical: 12,
  },
  transitionFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stateChip: {
    height: 28,
  },
  arrowIcon: {
    margin: 0,
  },
  transitionDetails: {
    marginLeft: 8,
  },
  transitionRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  transitionLabel: {
    fontSize: 12,
    color: '#999',
    width: 60,
  },
  transitionValue: {
    fontSize: 12,
    color: '#333',
    flex: 1,
  },
  // Action Bar
  actionBar: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    gap: 12,
  },
  testButton: {
    flex: 1,
  },
  editButton: {
    flex: 2,
    backgroundColor: '#722ed1',
  },
  bottomSpacing: {
    height: 80,
  },
});

export default StateMachineDetailScreen;
