import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import {
  Text,
  Card,
  Button,
  Chip,
  IconButton,
  ActivityIndicator,
  Divider,
  Menu,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { useAuthStore } from '../../../store/authStore';
import { ruleConfigApiClient, DroolsRule } from '../../../services/api/ruleConfigApiClient';
import { createLogger } from '../../../utils/logger';

const logger = createLogger('RuleTestScreen');

// Route params type
type RuleTestRouteParams = {
  RuleTest: {
    ruleId?: string;
    drlContent?: string;
    ruleName?: string;
  };
};

// Test result types
interface ConditionCheck {
  name: string;
  expression: string;
  passed: boolean;
  value?: string | number | boolean;
}

interface TestResult {
  success: boolean;
  executionTime: number;
  message: string;
  conditionChecks: ConditionCheck[];
  error?: string;
}

interface TestHistoryItem {
  id: string;
  testNumber: number;
  timestamp: Date;
  executionTime: number;
  passed: boolean;
  testData: Record<string, unknown>;
}

// Material type options
const MATERIAL_TYPES = [
  { value: 'fresh_fish', label: '鲜鱼 (Fresh Fish)' },
  { value: 'frozen_shrimp', label: '冻虾 (Frozen Shrimp)' },
  { value: 'crab', label: '螃蟹 (Crab)' },
  { value: 'squid', label: '鱿鱼 (Squid)' },
];

const RuleTestScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object>>>();
  const route = useRoute<RouteProp<RuleTestRouteParams, 'RuleTest'>>();
  const { tokens, getFactoryId } = useAuthStore();
  const factoryId = getFactoryId();

  // Route params
  const { ruleId, drlContent: initialDrlContent, ruleName: initialRuleName } = route.params || {};

  // State
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [rule, setRule] = useState<DroolsRule | null>(null);
  const [materialTypeMenuVisible, setMaterialTypeMenuVisible] = useState(false);

  // Test data state
  const [testData, setTestData] = useState({
    batchNumber: 'MB-TEST-001',
    quantity: '100',
    expirationDate: '2024-12-31',
    temperature: '-20',
    materialType: 'frozen_shrimp',
  });

  // Results state
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);

  // Load rule details if ruleId is provided
  useEffect(() => {
    if (ruleId && factoryId && tokens?.accessToken) {
      loadRuleDetails();
    }
  }, [ruleId, factoryId, tokens?.accessToken]);

  const loadRuleDetails = async () => {
    if (!ruleId || !factoryId) return;

    try {
      setLoading(true);
      const response = await ruleConfigApiClient.getRuleById(ruleId, factoryId);
      if (response) {
        setRule(response);
      }
    } catch (error) {
      logger.error('Failed to load rule details', error);
    } finally {
      setLoading(false);
    }
  };

  // Generate JSON preview
  const generateJsonPreview = useCallback(() => {
    const data: Record<string, unknown> = {
      batchNumber: testData.batchNumber,
      quantity: parseInt(testData.quantity, 10) || 0,
      expirationDate: testData.expirationDate,
      temperature: parseInt(testData.temperature, 10) || 0,
      materialType: testData.materialType,
    };
    return JSON.stringify(data, null, 2);
  }, [testData]);

  // Copy JSON to clipboard
  const copyJsonToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(generateJsonPreview());
      Alert.alert(t('common.success'), t('platform.ruleTest.jsonCopied'));
    } catch (error) {
      logger.error('Failed to copy JSON', error);
    }
  };

  // Execute test
  const executeTest = async () => {
    if (!factoryId) {
      Alert.alert(t('common.error'), t('platform.ruleTest.noFactory'));
      return;
    }

    try {
      setExecuting(true);
      setTestResult(null);

      const testPayload = {
        batchNumber: testData.batchNumber,
        quantity: parseInt(testData.quantity, 10) || 0,
        expirationDate: testData.expirationDate,
        temperature: parseInt(testData.temperature, 10) || 0,
        materialType: testData.materialType,
      };

      const startTime = Date.now();

      let response;
      if (ruleId) {
        // Test specific rule
        response = await ruleConfigApiClient.testRule(ruleId, testPayload, factoryId);
      } else if (initialDrlContent) {
        // Dry run with DRL content
        response = await ruleConfigApiClient.dryRun({
          ruleContent: initialDrlContent,
          testData: testPayload,
        }, factoryId);
      } else {
        Alert.alert(t('common.error'), t('platform.ruleTest.noRuleSelected'));
        return;
      }

      const executionTime = Date.now() - startTime;

      if (response.success) {
        // Build message from response properties
        const resultMessage = 'message' in response
          ? (response as { message?: string }).message
          : t('platform.ruleTest.testPassed');

        const result: TestResult = {
          success: true,
          executionTime,
          message: resultMessage || t('platform.ruleTest.testPassed'),
          conditionChecks: generateMockConditionChecks(testPayload),
        };
        setTestResult(result);

        // Add to history
        const historyItem: TestHistoryItem = {
          id: `test-${Date.now()}`,
          testNumber: testHistory.length + 1,
          timestamp: new Date(),
          executionTime,
          passed: result.success,
          testData: testPayload,
        };
        setTestHistory(prev => [historyItem, ...prev].slice(0, 10));
      } else {
        const errorMessage = 'message' in response
          ? (response as { message?: string }).message
          : t('platform.ruleTest.testFailed');

        setTestResult({
          success: false,
          executionTime,
          message: errorMessage || t('platform.ruleTest.testFailed'),
          conditionChecks: [],
          error: errorMessage,
        });
      }
    } catch (error) {
      logger.error('Failed to execute test', error);
      setTestResult({
        success: false,
        executionTime: 0,
        message: t('platform.ruleTest.executionError'),
        conditionChecks: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setExecuting(false);
    }
  };

  // Generate mock condition checks for demo
  const generateMockConditionChecks = (data: Record<string, unknown>): ConditionCheck[] => {
    return [
      {
        name: '批次号格式检查',
        expression: 'batchNumber.length() >= 5',
        passed: String(data.batchNumber).length >= 5,
        value: String(data.batchNumber).length,
      },
      {
        name: '数量有效性',
        expression: 'quantity > 0',
        passed: Number(data.quantity) > 0,
        value: data.quantity as number,
      },
      {
        name: '过期日期检查',
        expression: 'expirationDate > now()',
        passed: new Date(data.expirationDate as string) > new Date(),
      },
    ];
  };

  // Save test case
  const saveTestCase = async () => {
    Alert.alert(
      t('platform.ruleTest.saveTestCase'),
      t('platform.ruleTest.saveTestCaseConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.save'),
          onPress: () => {
            // TODO: Implement save test case API
            Alert.alert(t('common.success'), t('platform.ruleTest.testCaseSaved'));
          },
        },
      ]
    );
  };

  // Get material type label
  const getMaterialTypeLabel = (value: string) => {
    return MATERIAL_TYPES.find(m => m.value === value)?.label || value;
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <IconButton icon="chevron-left" size={24} iconColor="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('platform.ruleTest.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Rule Selection Card */}
        <LinearGradient
          colors={['#722ed1', '#531dab']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ruleCard}
        >
          <Text style={styles.ruleCardLabel}>{t('platform.ruleTest.testRule')}</Text>
          <View style={styles.ruleCardContent}>
            <View style={styles.ruleCardInfo}>
              <Text style={styles.ruleCardName}>
                {rule?.ruleName || initialRuleName || t('platform.ruleTest.noRuleSelected')}
              </Text>
              <Text style={styles.ruleCardMeta}>
                {rule?.id || ruleId || '--'} · {rule?.ruleGroup || t('platform.ruleTest.validationRule')}
              </Text>
            </View>
            <IconButton icon="chevron-down" size={20} iconColor="#fff" />
          </View>
        </LinearGradient>

        {/* Test Data Input */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('platform.ruleTest.testData')}</Text>
          <TouchableOpacity>
            <Text style={styles.importLink}>{t('platform.ruleTest.importJson')}</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.inputCard}>
          <Card.Content>
            {/* Batch Number */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('platform.ruleTest.batchNumber')} (batchNumber)
              </Text>
              <TextInput
                style={styles.textInput}
                value={testData.batchNumber}
                onChangeText={(text) => setTestData(prev => ({ ...prev, batchNumber: text }))}
                placeholder="MB-TEST-001"
              />
            </View>

            {/* Quantity */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('platform.ruleTest.quantity')} (quantity)
              </Text>
              <TextInput
                style={styles.textInput}
                value={testData.quantity}
                onChangeText={(text) => setTestData(prev => ({ ...prev, quantity: text }))}
                keyboardType="numeric"
                placeholder="100"
              />
            </View>

            {/* Expiration Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('platform.ruleTest.expirationDate')} (expirationDate)
              </Text>
              <TextInput
                style={styles.textInput}
                value={testData.expirationDate}
                onChangeText={(text) => setTestData(prev => ({ ...prev, expirationDate: text }))}
                placeholder="2024-12-31"
              />
            </View>

            {/* Temperature */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('platform.ruleTest.temperature')} (temperature)
              </Text>
              <TextInput
                style={styles.textInput}
                value={testData.temperature}
                onChangeText={(text) => setTestData(prev => ({ ...prev, temperature: text }))}
                keyboardType="numeric"
                placeholder="-20"
              />
              <Text style={styles.inputHint}>{t('platform.ruleTest.temperatureUnit')}</Text>
            </View>

            {/* Material Type */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {t('platform.ruleTest.materialType')} (materialType)
              </Text>
              <Menu
                visible={materialTypeMenuVisible}
                onDismiss={() => setMaterialTypeMenuVisible(false)}
                anchor={
                  <TouchableOpacity
                    style={styles.selectInput}
                    onPress={() => setMaterialTypeMenuVisible(true)}
                  >
                    <Text style={styles.selectText}>
                      {getMaterialTypeLabel(testData.materialType)}
                    </Text>
                    <IconButton icon="chevron-down" size={20} />
                  </TouchableOpacity>
                }
              >
                {MATERIAL_TYPES.map((type) => (
                  <Menu.Item
                    key={type.value}
                    onPress={() => {
                      setTestData(prev => ({ ...prev, materialType: type.value }));
                      setMaterialTypeMenuVisible(false);
                    }}
                    title={type.label}
                  />
                ))}
              </Menu>
            </View>
          </Card.Content>
        </Card>

        {/* JSON Preview */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('platform.ruleTest.jsonPreview')}</Text>
          <TouchableOpacity onPress={copyJsonToClipboard}>
            <Text style={styles.importLink}>{t('common.copy')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.jsonPreviewCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Text style={styles.jsonText}>{generateJsonPreview()}</Text>
          </ScrollView>
        </View>

        {/* Execute Button */}
        <TouchableOpacity
          style={styles.executeButton}
          onPress={executeTest}
          disabled={executing}
        >
          <LinearGradient
            colors={['#722ed1', '#531dab']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.executeButtonGradient}
          >
            {executing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <IconButton icon="play" size={20} iconColor="#fff" style={styles.executeIcon} />
                <Text style={styles.executeButtonText}>{t('platform.ruleTest.executeTest')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Test Results */}
        {testResult && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('platform.ruleTest.testResult')}</Text>
            </View>

            {/* Result Card */}
            <View
              style={[
                styles.resultCard,
                testResult.success ? styles.resultCardSuccess : styles.resultCardError,
              ]}
            >
              <View style={styles.resultHeader}>
                <View
                  style={[
                    styles.resultIcon,
                    testResult.success ? styles.resultIconSuccess : styles.resultIconError,
                  ]}
                >
                  <IconButton
                    icon={testResult.success ? 'check' : 'close'}
                    size={24}
                    iconColor="#fff"
                  />
                </View>
                <View style={styles.resultInfo}>
                  <Text
                    style={[
                      styles.resultTitle,
                      testResult.success ? styles.resultTitleSuccess : styles.resultTitleError,
                    ]}
                  >
                    {testResult.success
                      ? t('platform.ruleTest.validationPassed')
                      : t('platform.ruleTest.validationFailed')}
                  </Text>
                  <Text style={styles.resultMeta}>
                    {t('platform.ruleTest.executionTime')}: {testResult.executionTime}ms
                  </Text>
                </View>
              </View>
              <View style={styles.resultMessage}>
                <Text style={styles.resultMessageText}>
                  {testResult.error || testResult.message}
                </Text>
              </View>
            </View>

            {/* Condition Checks */}
            {testResult.conditionChecks.length > 0 && (
              <Card style={styles.conditionCard}>
                <Card.Content>
                  <Text style={styles.conditionTitle}>
                    {t('platform.ruleTest.conditionChecks')}
                  </Text>

                  {testResult.conditionChecks.map((check, index) => (
                    <View
                      key={index}
                      style={[
                        styles.conditionItem,
                        check.passed ? styles.conditionItemSuccess : styles.conditionItemError,
                      ]}
                    >
                      <IconButton
                        icon={check.passed ? 'check' : 'close'}
                        size={16}
                        iconColor={check.passed ? '#52c41a' : '#f5222d'}
                      />
                      <View style={styles.conditionContent}>
                        <Text style={styles.conditionName}>{check.name}</Text>
                        <Text style={styles.conditionExpression}>
                          {check.expression}
                          {check.value !== undefined && ` → ${check.passed} (${check.value})`}
                        </Text>
                      </View>
                    </View>
                  ))}
                </Card.Content>
              </Card>
            )}
          </>
        )}

        {/* Test History */}
        {testHistory.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{t('platform.ruleTest.testHistory')}</Text>
            </View>

            <Card style={styles.historyCard}>
              <Card.Content>
                {testHistory.map((item, index) => (
                  <View key={item.id}>
                    <View style={styles.historyItem}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyTitle}>
                          {t('platform.ruleTest.test')} #{item.testNumber}
                        </Text>
                        <Text style={styles.historyMeta}>{formatDate(item.timestamp)}</Text>
                      </View>
                      <View style={styles.historyRight}>
                        <Text style={styles.historyTime}>{item.executionTime}ms</Text>
                        <Chip
                          mode="flat"
                          style={[
                            styles.historyChip,
                            item.passed ? styles.historyChipSuccess : styles.historyChipError,
                          ]}
                          textStyle={[
                            styles.historyChipText,
                            item.passed
                              ? styles.historyChipTextSuccess
                              : styles.historyChipTextError,
                          ]}
                        >
                          {item.passed
                            ? t('platform.ruleTest.passed')
                            : t('platform.ruleTest.failed')}
                        </Chip>
                      </View>
                    </View>
                    {index < testHistory.length - 1 && <Divider style={styles.historyDivider} />}
                  </View>
                ))}
              </Card.Content>
            </Card>
          </>
        )}

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.secondaryButtonText}>{t('platform.ruleTest.returnToDetail')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={saveTestCase}>
          <LinearGradient
            colors={['#722ed1', '#531dab']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>{t('platform.ruleTest.saveTestCase')}</Text>
          </LinearGradient>
        </TouchableOpacity>
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
    fontSize: 14,
    color: '#8c8c8c',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#722ed1',
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  backButton: {
    marginRight: 4,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  headerRight: {
    width: 48,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  ruleCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  ruleCardLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  ruleCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ruleCardInfo: {
    flex: 1,
  },
  ruleCardName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  ruleCardMeta: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
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
  importLink: {
    fontSize: 13,
    color: '#667eea',
  },
  inputCard: {
    marginBottom: 20,
    borderRadius: 12,
    elevation: 0,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#262626',
  },
  inputHint: {
    fontSize: 12,
    color: '#8c8c8c',
    marginTop: 4,
  },
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d9d9d9',
    borderRadius: 8,
    paddingLeft: 12,
    paddingRight: 4,
  },
  selectText: {
    fontSize: 14,
    color: '#262626',
    flex: 1,
  },
  jsonPreviewCard: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  jsonText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 20,
    color: '#d4d4d4',
  },
  executeButton: {
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  executeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  executeIcon: {
    margin: 0,
  },
  executeButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#fff',
  },
  resultCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultCardSuccess: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
    borderWidth: 1,
    borderColor: '#52c41a',
  },
  resultCardError: {
    backgroundColor: 'rgba(245, 34, 45, 0.1)',
    borderWidth: 1,
    borderColor: '#f5222d',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultIconSuccess: {
    backgroundColor: '#52c41a',
  },
  resultIconError: {
    backgroundColor: '#f5222d',
  },
  resultInfo: {
    flex: 1,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  resultTitleSuccess: {
    color: '#52c41a',
  },
  resultTitleError: {
    color: '#f5222d',
  },
  resultMeta: {
    fontSize: 13,
    color: '#595959',
  },
  resultMessage: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
  },
  resultMessageText: {
    fontSize: 13,
    color: '#595959',
    lineHeight: 20,
  },
  conditionCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 0,
  },
  conditionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#262626',
    marginBottom: 12,
  },
  conditionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  conditionItemSuccess: {
    backgroundColor: 'rgba(82, 196, 26, 0.05)',
  },
  conditionItemError: {
    backgroundColor: 'rgba(245, 34, 45, 0.05)',
  },
  conditionContent: {
    flex: 1,
  },
  conditionName: {
    fontSize: 13,
    color: '#262626',
    marginBottom: 2,
  },
  conditionExpression: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  historyCard: {
    marginBottom: 16,
    borderRadius: 12,
    elevation: 0,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  historyInfo: {
    flex: 1,
  },
  historyTitle: {
    fontSize: 14,
    color: '#262626',
    marginBottom: 2,
  },
  historyMeta: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  historyRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyTime: {
    fontSize: 12,
    color: '#8c8c8c',
  },
  historyChip: {
    height: 24,
  },
  historyChipSuccess: {
    backgroundColor: 'rgba(82, 196, 26, 0.1)',
  },
  historyChipError: {
    backgroundColor: 'rgba(245, 34, 45, 0.1)',
  },
  historyChipText: {
    fontSize: 12,
  },
  historyChipTextSuccess: {
    color: '#52c41a',
  },
  historyChipTextError: {
    color: '#f5222d',
  },
  historyDivider: {
    backgroundColor: '#f0f0f0',
  },
  bottomSpacing: {
    height: 100,
  },
  bottomActions: {
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
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#595959',
    fontWeight: '500',
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
});

export default RuleTestScreen;
