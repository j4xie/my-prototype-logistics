import React, { useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Appbar, Surface, Divider, ProgressBar } from 'react-native-paper';
import { useNavigation, useFocusEffect } from '@react-navigation/native';

export default function KPIReportScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);

  const kpis = [
    { name: '生产完成率', value: 92, target: 95, color: '#4CAF50' },
    { name: '质检合格率', value: 96, target: 98, color: '#2196F3' },
    { name: '设备利用率', value: 85, target: 90, color: '#FF9800' },
    { name: '准时交付率', value: 88, target: 95, color: '#9C27B0' },
  ];

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // 加载KPI数据
    }, [])
  );

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="KPI指标" />
        <Appbar.Action icon="refresh" onPress={handleRefresh} />
      </Appbar.Header>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        <Surface style={styles.card} elevation={1}>
          <Text variant="titleMedium" style={styles.title}>关键绩效指标</Text>
          <Divider style={styles.divider} />
          {kpis.map((kpi, index) => (
            <View key={index} style={styles.kpiItem}>
              <View style={styles.kpiHeader}>
                <Text style={styles.kpiName}>{kpi.name}</Text>
                <Text style={[styles.kpiValue, { color: kpi.color }]}>
                  {kpi.value}% / {kpi.target}%
                </Text>
              </View>
              <ProgressBar
                progress={kpi.value / 100}
                color={kpi.value >= kpi.target ? '#4CAF50' : '#FF9800'}
                style={styles.progressBar}
              />
            </View>
          ))}
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, margin: 16 },
  title: { fontWeight: '600', color: '#212121' },
  divider: { marginVertical: 12 },
  kpiItem: { marginBottom: 20 },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  kpiName: { fontSize: 16, fontWeight: '500', color: '#212121' },
  kpiValue: { fontSize: 16, fontWeight: '700' },
  progressBar: { height: 8, borderRadius: 4 },
});
