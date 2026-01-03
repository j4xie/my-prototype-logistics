/**
 * 任务执行引导 - 步骤1: 前往工位
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Icon } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { WSHomeStackParamList } from '../../../types/navigation';

type NavigationProp = NativeStackNavigationProp<WSHomeStackParamList, 'TaskGuide'>;
type RouteProps = RouteProp<WSHomeStackParamList, 'TaskGuide'>;

export function TaskGuideScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { batchId, batchNumber } = route.params || {};
  const { t } = useTranslation('workshop');

  const [isArrived, setIsArrived] = useState(false);

  // 模拟任务位置信息
  const locationInfo = {
    workshop: 'A区车间',
    line: '1号生产线',
    station: '切片工位',
    equipment: '切片机A (EQ-001)',
  };

  const handleNext = () => {
    navigation.navigate('TaskGuideStep2', { batchId, batchNumber });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon source="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>任务执行</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 批次信息 */}
        <View style={styles.batchCard}>
          <Text style={styles.batchNumber}>{batchNumber || 'PB-20251227-001'}</Text>
          <Text style={styles.batchProduct}>带鱼片 · 目标80kg</Text>
        </View>

        {/* 步骤指示器 */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, styles.stepDotActive]}>
            <Text style={styles.stepDotText}>1</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepDot}>
            <Text style={styles.stepDotTextInactive}>2</Text>
          </View>
          <View style={styles.stepLine} />
          <View style={styles.stepDot}>
            <Text style={styles.stepDotTextInactive}>3</Text>
          </View>
        </View>

        {/* 步骤标题 */}
        <View style={styles.stepHeader}>
          <Icon source="map-marker" size={24} color="#667eea" />
          <Text style={styles.stepTitle}>步骤 1/3: 前往工位</Text>
        </View>

        {/* 位置信息 */}
        <View style={styles.locationCard}>
          <View style={styles.locationItem}>
            <Icon source="factory" size={20} color="#666" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>车间</Text>
              <Text style={styles.locationValue}>{locationInfo.workshop}</Text>
            </View>
          </View>
          <View style={styles.locationItem}>
            <Icon source="ray-start-arrow" size={20} color="#666" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>生产线</Text>
              <Text style={styles.locationValue}>{locationInfo.line}</Text>
            </View>
          </View>
          <View style={styles.locationItem}>
            <Icon source="account-hard-hat" size={20} color="#666" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>工位</Text>
              <Text style={styles.locationValue}>{locationInfo.station}</Text>
            </View>
          </View>
          <View style={styles.locationItem}>
            <Icon source="cog" size={20} color="#666" />
            <View style={styles.locationInfo}>
              <Text style={styles.locationLabel}>设备</Text>
              <Text style={styles.locationValue}>{locationInfo.equipment}</Text>
            </View>
          </View>
        </View>

        {/* 地图入口 */}
        <TouchableOpacity style={styles.mapBtn}>
          <Icon source="map" size={20} color="#667eea" />
          <Text style={styles.mapBtnText}>查看车间地图</Text>
          <Icon source="chevron-right" size={20} color="#667eea" />
        </TouchableOpacity>

        {/* 确认到达 */}
        <TouchableOpacity
          style={[styles.confirmBtn, isArrived && styles.confirmBtnActive]}
          onPress={() => setIsArrived(!isArrived)}
        >
          <Icon
            source={isArrived ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={isArrived ? '#52c41a' : '#999'}
          />
          <Text style={[styles.confirmText, isArrived && styles.confirmTextActive]}>
            我已到达工位
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* 底部按钮 */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.nextBtn, !isArrived && styles.nextBtnDisabled]}
          onPress={handleNext}
          disabled={!isArrived}
        >
          <Text style={styles.nextBtnText}>下一步：确认设备</Text>
          <Icon source="arrow-right" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#667eea',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  batchCard: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  batchNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  batchProduct: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#667eea',
  },
  stepDotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  stepDotTextInactive: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#999',
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: '#e0e0e0',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  locationInfo: {
    marginLeft: 12,
    flex: 1,
  },
  locationLabel: {
    fontSize: 12,
    color: '#999',
  },
  locationValue: {
    fontSize: 16,
    color: '#333',
    marginTop: 2,
  },
  mapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f5ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  mapBtnText: {
    fontSize: 14,
    color: '#667eea',
    marginHorizontal: 8,
  },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  confirmBtnActive: {
    borderColor: '#52c41a',
    backgroundColor: '#f6ffed',
  },
  confirmText: {
    fontSize: 16,
    color: '#999',
    marginLeft: 12,
  },
  confirmTextActive: {
    color: '#52c41a',
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 16,
  },
  nextBtnDisabled: {
    backgroundColor: '#ccc',
  },
  nextBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginRight: 8,
  },
});

export default TaskGuideScreen;
