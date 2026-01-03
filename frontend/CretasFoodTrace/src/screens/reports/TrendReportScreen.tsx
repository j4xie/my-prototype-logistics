import React, { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Appbar, Surface, SegmentedButtons, Icon } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

export default function TrendReportScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('reports');
  const [timeRange, setTimeRange] = useState('month');

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('trend.title')} />
      </Appbar.Header>
      <ScrollView style={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <Text variant="bodyMedium" style={styles.label}>{t('trend.timeRange')}</Text>
          <SegmentedButtons
            value={timeRange}
            onValueChange={setTimeRange}
            buttons={[
              { value: 'week', label: t('trend.week') },
              { value: 'month', label: t('trend.month') },
              { value: 'quarter', label: t('trend.quarter') },
              { value: 'year', label: t('trend.year') },
            ]}
          />
        </Surface>
        <Surface style={styles.card} elevation={1}>
          <View style={styles.infoBox}>
            <Icon source="chart-line" size={48} color="#2196F3" />
            <Text variant="titleMedium" style={styles.infoTitle}>{t('trend.trendAnalysis')}</Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              {t('trend.comingSoon')}
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
