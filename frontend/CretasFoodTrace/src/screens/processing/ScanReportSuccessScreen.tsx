import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WSBatchesStackParamList } from '../../types/navigation';

type ScreenRouteProp = RouteProp<WSBatchesStackParamList, 'ScanReportSuccess'>;
type ScreenNavProp = NativeStackNavigationProp<WSBatchesStackParamList, 'ScanReportSuccess'>;

const ScanReportSuccessScreen: React.FC = () => {
  const navigation = useNavigation<ScreenNavProp>();
  const route = useRoute<ScreenRouteProp>();
  const { batchNumber, outputQuantity, goodQuantity, defectQuantity } = route.params;

  const handleContinueScan = () => {
    navigation.replace('ScanReport');
  };

  const handleGoHome = () => {
    navigation.popToTop();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success icon */}
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons name="check-circle" size={80} color="#10B981" />
        </View>

        <Text style={styles.title}>报工提交成功</Text>
        <Text style={styles.subtitle}>数据已同步至系统</Text>

        {/* Summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.cardTitle}>报工摘要</Text>

          <View style={styles.row}>
            <Text style={styles.label}>批次号</Text>
            <Text style={styles.value}>{batchNumber}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>产出数量</Text>
            <Text style={styles.valueHighlight}>{outputQuantity} kg</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>合格数量</Text>
            <Text style={[styles.value, { color: '#10B981' }]}>{goodQuantity} kg</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>缺陷数量</Text>
            <Text style={[styles.value, defectQuantity > 0 ? { color: '#EF4444' } : {}]}>
              {defectQuantity} kg
            </Text>
          </View>

          {outputQuantity > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.label}>合格率</Text>
                <Text style={[styles.value, { color: '#10B981', fontWeight: '700' }]}>
                  {Math.round((goodQuantity / outputQuantity) * 100)}%
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryButton} onPress={handleContinueScan}>
            <MaterialCommunityIcons name="barcode-scan" size={20} color="#fff" />
            <Text style={styles.primaryButtonText}>继续扫码</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={handleGoHome}>
            <MaterialCommunityIcons name="home-outline" size={20} color="#4F46E5" />
            <Text style={styles.secondaryButtonText}>返回首页</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#666',
    marginBottom: 32,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  valueHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4F46E5',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4F46E5',
    gap: 8,
  },
  secondaryButtonText: {
    color: '#4F46E5',
    fontSize: 17,
    fontWeight: '600',
  },
});

export default ScanReportSuccessScreen;
