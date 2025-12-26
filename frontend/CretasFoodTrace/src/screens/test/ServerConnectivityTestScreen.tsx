/**
 * 服务器连接测试页面
 *
 * @description 测试远程服务器 API 连接性和数据完整性
 * @created 2025-12-26
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Text, Card, Button, Chip, ProgressBar, Divider, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NetworkManager, NetworkState } from '../../services/networkManager';
import { ConnectivityTestService } from '../../services/testing/connectivityTestService';
import { DataIntegrityTestService } from '../../services/testing/dataIntegrityTestService';
import {
  TestResult,
  TestSummary,
  PhaseStatus,
  TestLogEntry,
  TestContext,
  TestPhase,
  PHASE_NAMES,
  DEFAULT_SERVER_CONFIG,
  DataIntegrityTestResult,
} from '../../types/testing';

/**
 * 状态颜色映射
 */
const STATUS_COLORS = {
  pending: '#9E9E9E',
  running: '#2196F3',
  success: '#4CAF50',
  failed: '#F44336',
  skipped: '#FF9800',
};

/**
 * 状态图标映射
 */
const STATUS_ICONS = {
  pending: '⏳',
  running: '🔄',
  success: '✅',
  failed: '❌',
  skipped: '⏭️',
};

export const ServerConnectivityTestScreen: React.FC = () => {
  // 网络状态
  const [networkState, setNetworkState] = useState<NetworkState | null>(null);

  // 测试状态
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const [testSummary, setTestSummary] = useState<TestSummary | null>(null);
  const [dataIntegrityResults, setDataIntegrityResults] = useState<DataIntegrityTestResult[]>([]);

  // 日志
  const [logs, setLogs] = useState<TestLogEntry[]>([]);

  // 阶段展开状态
  const [expandedPhases, setExpandedPhases] = useState<Set<TestPhase>>(new Set([1, 2, 3, 4]));

  // 进度
  const [progress, setProgress] = useState({ completed: 0, total: 0, percentage: 0 });

  // 测试服务实例
  const [connectivityService] = useState(() => new ConnectivityTestService());
  const [dataIntegrityService] = useState(() => new DataIntegrityTestService());

  /**
   * 初始化网络监听
   */
  useEffect(() => {
    const initNetwork = async () => {
      await NetworkManager.initialize();
      const state = await NetworkManager.getCurrentState();
      setNetworkState(state);
    };

    initNetwork();

    // 订阅网络状态变化
    const unsubscribe = NetworkManager.addListener((state) => {
      setNetworkState(state);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  /**
   * 设置测试服务回调
   */
  useEffect(() => {
    connectivityService.setLogCallback((entry) => {
      setLogs((prev) => [...prev, entry]);
    });

    connectivityService.setResultCallback((result) => {
      setTestResults((prev) => new Map(prev).set(result.testId, result));

      // 更新进度
      setProgress((prev) => {
        const completed = prev.completed + 1;
        const percentage = Math.round((completed / prev.total) * 100);
        return { ...prev, completed, percentage };
      });
    });
  }, [connectivityService]);

  /**
   * 添加日志
   */
  const addLog = useCallback((level: TestLogEntry['level'], message: string, testId?: string) => {
    const entry: TestLogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      testId,
    };
    setLogs((prev) => [...prev, entry]);
  }, []);

  /**
   * 清除结果
   */
  const clearResults = useCallback(() => {
    setTestResults(new Map());
    setTestSummary(null);
    setDataIntegrityResults([]);
    setLogs([]);
    setProgress({ completed: 0, total: 0, percentage: 0 });
    connectivityService.clearContext();
  }, [connectivityService]);

  /**
   * 运行所有测试
   */
  const runAllTests = useCallback(async () => {
    clearResults();
    setIsRunning(true);

    const totalTests = connectivityService.getTestCases().length + dataIntegrityService.getTestCases().length;
    setProgress({ completed: 0, total: totalTests, percentage: 0 });

    addLog('info', '开始服务器连接测试...');
    addLog('info', `服务器: ${DEFAULT_SERVER_CONFIG.baseUrl}`);

    try {
      // Phase 1-3: 连接性测试
      const summary = await connectivityService.runAllTests();
      setTestSummary(summary);

      // 如果认证成功，继续 Phase 4: 数据完整性测试
      const context = connectivityService.getContext();
      if (context.accessToken && context.factoryId) {
        addLog('info', '开始数据完整性测试...');

        const integrityResults: DataIntegrityTestResult[] = [];
        for (const testCase of dataIntegrityService.getTestCases()) {
          addLog('info', `测试: ${testCase.testName}`, testCase.testId);
          const result = await dataIntegrityService.runTest(testCase, context);
          integrityResults.push(result);

          setTestResults((prev) => new Map(prev).set(result.testId, result));
          setProgress((prev) => {
            const completed = prev.completed + 1;
            const percentage = Math.round((completed / prev.total) * 100);
            return { ...prev, completed, percentage };
          });

          if (result.status === 'success') {
            addLog('success', `${testCase.testName} 通过`, testCase.testId);
          } else {
            addLog('error', `${testCase.testName} 失败: ${result.errorMessage}`, testCase.testId);
          }
        }
        setDataIntegrityResults(integrityResults);
      } else {
        addLog('warning', '跳过数据完整性测试 (认证失败)');
      }

      addLog('success', '测试完成!');
    } catch (error) {
      addLog('error', `测试异常: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsRunning(false);
    }
  }, [connectivityService, dataIntegrityService, clearResults, addLog]);

  /**
   * 切换阶段展开状态
   */
  const togglePhase = useCallback((phase: TestPhase) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(phase)) {
        next.delete(phase);
      } else {
        next.add(phase);
      }
      return next;
    });
  }, []);

  /**
   * 获取阶段测试结果
   */
  const getPhaseTests = useCallback((phase: TestPhase): TestResult[] => {
    return Array.from(testResults.values()).filter((r) => r.phase === phase);
  }, [testResults]);

  /**
   * 获取阶段状态
   */
  const getPhaseStatus = useCallback((phase: TestPhase): 'pending' | 'running' | 'success' | 'failed' => {
    const tests = getPhaseTests(phase);
    if (tests.length === 0) return 'pending';

    const allCases = phase === 4
      ? dataIntegrityService.getTestCases()
      : connectivityService.getTestCases().filter((t) => t.phase === phase);

    if (tests.length < allCases.length) return 'running';
    if (tests.every((t) => t.status === 'success')) return 'success';
    return 'failed';
  }, [getPhaseTests, connectivityService, dataIntegrityService]);

  /**
   * 渲染网络状态
   */
  const renderNetworkStatus = () => (
    <View style={styles.networkContainer}>
      <Text style={styles.serverUrl}>服务器: {DEFAULT_SERVER_CONFIG.baseUrl}</Text>
      <View style={styles.networkChips}>
        <Chip
          icon={networkState?.isConnected ? 'wifi' : 'wifi-off'}
          style={[
            styles.chip,
            { backgroundColor: networkState?.isConnected ? '#E8F5E9' : '#FFEBEE' },
          ]}
          textStyle={{ color: networkState?.isConnected ? '#2E7D32' : '#C62828' }}
        >
          {networkState?.type || '未知'}
        </Chip>
        <Chip
          icon={networkState?.isInternetReachable ? 'check-circle' : 'close-circle'}
          style={[
            styles.chip,
            { backgroundColor: networkState?.isInternetReachable ? '#E8F5E9' : '#FFEBEE' },
          ]}
          textStyle={{ color: networkState?.isInternetReachable ? '#2E7D32' : '#C62828' }}
        >
          {networkState?.isInternetReachable ? '在线' : '离线'}
        </Chip>
      </View>
    </View>
  );

  /**
   * 渲染进度条
   */
  const renderProgress = () => (
    <View style={styles.progressContainer}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressText}>
          整体进度: {progress.completed}/{progress.total} ({progress.percentage}%)
        </Text>
      </View>
      <ProgressBar
        progress={progress.total > 0 ? progress.completed / progress.total : 0}
        color="#2196F3"
        style={styles.progressBar}
      />
    </View>
  );

  /**
   * 渲染单个测试结果
   */
  const renderTestResult = (result: TestResult) => (
    <View key={result.testId} style={styles.testItem}>
      <View style={styles.testInfo}>
        <Text style={styles.testIcon}>{STATUS_ICONS[result.status]}</Text>
        <Text style={styles.testName}>{result.testName}</Text>
      </View>
      <View style={styles.testMeta}>
        {result.responseTimeMs !== undefined && (
          <Text style={styles.responseTime}>{result.responseTimeMs}ms</Text>
        )}
        <Chip
          style={[styles.statusChip, { backgroundColor: STATUS_COLORS[result.status] }]}
          textStyle={styles.statusChipText}
        >
          {result.status === 'success' ? 'PASS' : result.status === 'failed' ? 'FAIL' : result.status.toUpperCase()}
        </Chip>
      </View>
    </View>
  );

  /**
   * 渲染阶段卡片
   */
  const renderPhaseCard = (phase: TestPhase) => {
    const tests = getPhaseTests(phase);
    const status = getPhaseStatus(phase);
    const isExpanded = expandedPhases.has(phase);
    const passed = tests.filter((t) => t.status === 'success').length;
    const total = phase === 4
      ? dataIntegrityService.getTestCases().length
      : connectivityService.getTestCases().filter((t) => t.phase === phase).length;

    return (
      <Card key={phase} style={styles.phaseCard}>
        <View style={styles.phaseHeader}>
          <View style={styles.phaseHeaderLeft}>
            <IconButton
              icon={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={20}
              onPress={() => togglePhase(phase)}
            />
            <Text style={styles.phaseName}>
              Phase {phase}: {PHASE_NAMES[phase]}
            </Text>
            <Text style={styles.phaseCount}>
              ({passed}/{total})
            </Text>
          </View>
          <Chip
            style={[styles.phaseStatusChip, { backgroundColor: STATUS_COLORS[status] }]}
            textStyle={styles.phaseStatusText}
          >
            {status.toUpperCase()}
          </Chip>
        </View>
        {isExpanded && tests.length > 0 && (
          <View style={styles.phaseContent}>
            {tests.map(renderTestResult)}
          </View>
        )}
      </Card>
    );
  };

  /**
   * 渲染日志区域
   */
  const renderLogs = () => (
    <Card style={styles.logCard}>
      <Card.Title title="测试日志" />
      <Card.Content>
        <ScrollView style={styles.logContainer} nestedScrollEnabled>
          {logs.map((log, index) => (
            <Text
              key={index}
              style={[
                styles.logText,
                log.level === 'error' && styles.logError,
                log.level === 'success' && styles.logSuccess,
                log.level === 'warning' && styles.logWarning,
              ]}
            >
              [{log.timestamp}] {log.message}
            </Text>
          ))}
          {logs.length === 0 && (
            <Text style={styles.emptyText}>暂无日志，点击"运行全部测试"开始</Text>
          )}
        </ScrollView>
      </Card.Content>
    </Card>
  );

  /**
   * 渲染汇总
   */
  const renderSummary = () => {
    if (!testSummary && dataIntegrityResults.length === 0) return null;

    const totalPassed = (testSummary?.passed || 0) + dataIntegrityResults.filter((r) => r.status === 'success').length;
    const totalFailed = (testSummary?.failed || 0) + dataIntegrityResults.filter((r) => r.status === 'failed').length;
    const totalSkipped = testSummary?.skipped || 0;

    return (
      <Card style={styles.summaryCard}>
        <Card.Title title="测试汇总" />
        <Card.Content>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: '#4CAF50' }]}>{totalPassed}</Text>
              <Text style={styles.summaryLabel}>通过</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: '#F44336' }]}>{totalFailed}</Text>
              <Text style={styles.summaryLabel}>失败</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryNumber, { color: '#FF9800' }]}>{totalSkipped}</Text>
              <Text style={styles.summaryLabel}>跳过</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryNumber}>{testSummary?.totalDurationMs || 0}ms</Text>
              <Text style={styles.summaryLabel}>耗时</Text>
            </View>
          </View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRunning} onRefresh={runAllTests} />
        }
      >
        {/* 网络状态 */}
        <Card style={styles.card}>
          <Card.Title title="服务器连接测试" />
          <Card.Content>
            {renderNetworkStatus()}
            <Divider style={styles.divider} />
            {renderProgress()}
          </Card.Content>
        </Card>

        {/* 测试阶段 */}
        {([1, 2, 3, 4] as TestPhase[]).map(renderPhaseCard)}

        {/* 汇总 */}
        {renderSummary()}

        {/* 操作按钮 */}
        <View style={styles.buttonRow}>
          <Button
            mode="contained"
            onPress={runAllTests}
            loading={isRunning}
            disabled={isRunning}
            style={[styles.button, styles.runButton]}
            icon="play"
          >
            运行全部测试
          </Button>
          <Button
            mode="outlined"
            onPress={clearResults}
            disabled={isRunning}
            style={styles.button}
            icon="delete"
          >
            清除结果
          </Button>
        </View>

        {/* 日志 */}
        {renderLogs()}

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollView: {
    flex: 1,
  },
  card: {
    margin: 8,
  },
  networkContainer: {
    marginBottom: 8,
  },
  serverUrl: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  networkChips: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    height: 28,
  },
  divider: {
    marginVertical: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '500',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
  },
  phaseCard: {
    margin: 8,
    marginTop: 0,
  },
  phaseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    paddingRight: 16,
  },
  phaseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  phaseName: {
    fontSize: 14,
    fontWeight: '600',
  },
  phaseCount: {
    fontSize: 12,
    color: '#666',
    marginLeft: 8,
  },
  phaseStatusChip: {
    height: 24,
  },
  phaseStatusText: {
    fontSize: 10,
    color: '#FFF',
  },
  phaseContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  testItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  testInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  testIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  testName: {
    fontSize: 13,
    color: '#333',
  },
  testMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  responseTime: {
    fontSize: 12,
    color: '#666',
  },
  statusChip: {
    height: 22,
  },
  statusChipText: {
    fontSize: 10,
    color: '#FFF',
  },
  summaryCard: {
    margin: 8,
    marginTop: 0,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    margin: 8,
    gap: 8,
  },
  button: {
    flex: 1,
  },
  runButton: {
    backgroundColor: '#2196F3',
  },
  logCard: {
    margin: 8,
  },
  logContainer: {
    maxHeight: 300,
    backgroundColor: '#1E1E1E',
    padding: 12,
    borderRadius: 4,
  },
  logText: {
    fontSize: 11,
    color: '#D4D4D4',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  logError: {
    color: '#F48771',
  },
  logSuccess: {
    color: '#89D185',
  },
  logWarning: {
    color: '#CCA700',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginVertical: 20,
  },
  bottomSpacer: {
    height: 100,
  },
});

export default ServerConnectivityTestScreen;
