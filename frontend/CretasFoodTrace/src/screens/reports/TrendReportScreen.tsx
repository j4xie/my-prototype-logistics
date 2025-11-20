import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Appbar, Surface, SegmentedButtons, Icon } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

export default function TrendReportScreen() {
  const navigation = useNavigation();
  const [timeRange, setTimeRange] = useState('month');

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="趋势分析" />
      </Appbar.Header>
      <ScrollView style={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <Text variant="bodyMedium" style={styles.label}>时间范围</Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'week', label: '周' },
              { value: 'month', label: '月' },
              { value: 'quarter', label: '季' },
              { value: 'year', label: '年' },
            ]}
          />
        </Surface>
        <Surface style={styles.card} elevation={1}>
          <View style={styles.infoBox}>
            <Icon source="chart-line" size={48} color="#2196F3" />
            <Text variant="titleMedium" style={styles.infoTitle}>趋势分析</Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              历史数据趋势、周期对比、增长分析等功能即将上线
            </Text>
          </View>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, margin: 16, marginBottom: 8 },
  label: { color: '#666', marginBottom: 12, fontWeight: '500' },
  infoBox: { alignItems: 'center', padding: 32 },
  infoTitle: { fontWeight: '600', color: '#212121', marginTop: 16, marginBottom: 8 },
  infoText: { color: '#666', textAlign: 'center', lineHeight: 20 },
});
