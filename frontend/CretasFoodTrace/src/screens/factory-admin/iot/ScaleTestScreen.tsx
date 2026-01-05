/**
 * 电子秤数据测试界面
 * 用于测试秤协议解析和实时数据读取
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Icon } from 'react-native-paper';
import scaleApiClient, {
  ScaleProtocol,
  ScaleDataParseResult,
} from '../../../services/api/scaleApiClient';

type RouteParams = {
  ScaleTest: {
    equipmentId?: number;
    protocolId?: string;
  };
};

export function ScaleTestScreen() {
  const route = useRoute<RouteProp<RouteParams, 'ScaleTest'>>();
  const { equipmentId, protocolId: initialProtocolId } = route.params || {};

  const [loading, setLoading] = useState(false);
  const [protocols, setProtocols] = useState<ScaleProtocol[]>([]);
  const [selectedProtocolId, setSelectedProtocolId] = useState<string>(initialProtocolId || '');
  const [rawDataHex, setRawDataHex] = useState('');
  const [parseResult, setParseResult] = useState<ScaleDataParseResult | null>(null);
  const [parseHistory, setParseHistory] = useState<Array<{
    time: string;
    input: string;
    result: ScaleDataParseResult;
  }>>([]);

  // 加载可用协议列表
  useEffect(() => {
    loadProtocols();
  }, []);

  const loadProtocols = async () => {
    try {
      const data = await scaleApiClient.getAvailableProtocols();
      setProtocols(data);
      if (data && data.length > 0 && !selectedProtocolId) {
        setSelectedProtocolId(data[0]?.id ?? '');
      }
    } catch (err) {
      console.error('加载协议列表失败:', err);
    }
  };

  // 测试解析
  const handleTestParse = useCallback(async () => {
    if (!selectedProtocolId) {
      Alert.alert('提示', '请选择协议');
      return;
    }
    if (!rawDataHex.trim()) {
      Alert.alert('提示', '请输入测试数据');
      return;
    }

    setLoading(true);
    try {
      const response = await scaleApiClient.testParse(selectedProtocolId, rawDataHex.trim());
      if (response.success && response.parseResult) {
        setParseResult(response.parseResult);
        setParseHistory(prev => [{
          time: new Date().toLocaleTimeString(),
          input: rawDataHex.trim(),
          result: response.parseResult!,
        }, ...prev.slice(0, 9)]);
      } else {
        Alert.alert('解析失败', response.errorMessage || '未知错误');
      }
    } catch (err) {
      console.error('测试解析失败:', err);
      Alert.alert('错误', '测试请求失败');
    } finally {
      setLoading(false);
    }
  }, [selectedProtocolId, rawDataHex]);

  // 预设测试数据
  const presetTestData = [
    { label: '柯力 10.50kg', hex: '30 31 30 2E 35 30 0D 0A' },
    { label: '耀华 25.00kg', hex: '02 2B 30 30 30 32 35 2E 30 30 6B 67 03' },
    { label: '矽策 100.5kg', hex: 'AA 31 30 30 2E 35 6B 67 BB' },
  ];

  const selectedProtocol = protocols.find(p => p.id === selectedProtocolId);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 协议选择 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择协议</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.protocolScroll}>
            {protocols.map(protocol => (
              <TouchableOpacity
                key={protocol.id}
                style={[
                  styles.protocolChip,
                  selectedProtocolId === protocol.id && styles.protocolChipActive,
                ]}
                onPress={() => setSelectedProtocolId(protocol.id)}
              >
                <Text
                  style={[
                    styles.protocolChipText,
                    selectedProtocolId === protocol.id && styles.protocolChipTextActive,
                  ]}
                >
                  {protocol.protocolName}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {selectedProtocol && (
            <View style={styles.protocolInfo}>
              <Text style={styles.protocolInfoLabel}>
                连接类型: {selectedProtocol.connectionType}
              </Text>
              <Text style={styles.protocolInfoLabel}>
                帧格式: {selectedProtocol.frameFormat || '-'}
              </Text>
            </View>
          )}
        </View>

        {/* 测试数据输入 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>测试数据 (Hex)</Text>
          <TextInput
            style={styles.dataInput}
            value={rawDataHex}
            onChangeText={setRawDataHex}
            placeholder="输入十六进制数据，如: 30 31 30 2E 35 30 0D 0A"
            placeholderTextColor="#a0aec0"
            multiline
            numberOfLines={3}
            autoCapitalize="characters"
          />
          <View style={styles.presetContainer}>
            <Text style={styles.presetLabel}>预设数据:</Text>
            {presetTestData.map((preset, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.presetButton}
                onPress={() => setRawDataHex(preset.hex)}
              >
                <Text style={styles.presetButtonText}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 解析按钮 */}
        <TouchableOpacity
          style={[styles.testButton, loading && styles.testButtonDisabled]}
          onPress={handleTestParse}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon source="play" size={20} color="#fff" />
              <Text style={styles.testButtonText}>测试解析</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 解析结果 */}
        {parseResult && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>解析结果</Text>
            <View style={styles.resultCard}>
              <View style={styles.resultMain}>
                <Icon
                  source={parseResult.success ? 'check-circle' : 'close-circle'}
                  size={32}
                  color={parseResult.success ? '#48bb78' : '#e53e3e'}
                />
                <View style={styles.resultMainText}>
                  <Text style={styles.resultWeight}>
                    {parseResult.weight !== undefined
                      ? `${parseResult.weight} ${parseResult.unit || 'kg'}`
                      : '-'}
                  </Text>
                  <Text style={styles.resultStatus}>
                    {parseResult.isStable ? '稳定' : '不稳定'}
                    {parseResult.isZero ? ' | 零位' : ''}
                    {parseResult.isOverload ? ' | 超载' : ''}
                  </Text>
                </View>
              </View>
              {parseResult.rawValue && (
                <View style={styles.resultDetail}>
                  <Text style={styles.resultDetailLabel}>原始值:</Text>
                  <Text style={styles.resultDetailValue}>{parseResult.rawValue}</Text>
                </View>
              )}
              {parseResult.errorMessage && (
                <View style={styles.resultError}>
                  <Icon source="alert" size={16} color="#e53e3e" />
                  <Text style={styles.resultErrorText}>{parseResult.errorMessage}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 历史记录 */}
        {parseHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>测试历史</Text>
            {parseHistory.map((item, idx) => (
              <View key={idx} style={styles.historyItem}>
                <View style={styles.historyHeader}>
                  <Text style={styles.historyTime}>{item.time}</Text>
                  <Icon
                    source={item.result.success ? 'check' : 'close'}
                    size={16}
                    color={item.result.success ? '#48bb78' : '#e53e3e'}
                  />
                </View>
                <Text style={styles.historyInput} numberOfLines={1}>
                  {item.input}
                </Text>
                <Text style={styles.historyResult}>
                  {item.result.weight !== undefined
                    ? `${item.result.weight} ${item.result.unit || 'kg'}`
                    : item.result.errorMessage || '-'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 12,
  },
  protocolScroll: {
    flexDirection: 'row',
  },
  protocolChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#edf2f7',
    marginRight: 8,
  },
  protocolChipActive: {
    backgroundColor: '#3182ce',
  },
  protocolChipText: {
    fontSize: 14,
    color: '#4a5568',
  },
  protocolChipTextActive: {
    color: '#fff',
    fontWeight: '500',
  },
  protocolInfo: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  protocolInfoLabel: {
    fontSize: 13,
    color: '#718096',
    marginBottom: 4,
  },
  dataInput: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#2d3748',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  presetLabel: {
    fontSize: 13,
    color: '#718096',
  },
  presetButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#edf2f7',
    borderRadius: 4,
  },
  presetButtonText: {
    fontSize: 12,
    color: '#4a5568',
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3182ce',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
    marginBottom: 20,
  },
  testButtonDisabled: {
    backgroundColor: '#a0aec0',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  resultMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  resultMainText: {
    flex: 1,
  },
  resultWeight: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2d3748',
  },
  resultStatus: {
    fontSize: 13,
    color: '#718096',
    marginTop: 4,
  },
  resultDetail: {
    flexDirection: 'row',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#edf2f7',
  },
  resultDetailLabel: {
    fontSize: 13,
    color: '#718096',
    marginRight: 8,
  },
  resultDetailValue: {
    fontSize: 13,
    color: '#4a5568',
    fontFamily: 'monospace',
    flex: 1,
  },
  resultError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fff5f5',
    borderRadius: 6,
  },
  resultErrorText: {
    fontSize: 13,
    color: '#e53e3e',
    flex: 1,
  },
  historyItem: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  historyTime: {
    fontSize: 12,
    color: '#a0aec0',
  },
  historyInput: {
    fontSize: 12,
    color: '#718096',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  historyResult: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2d3748',
  },
});

export default ScaleTestScreen;
