import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Appbar, Surface, Icon, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';

export default function ForecastReportScreen() {
  const navigation = useNavigation();

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="预测报表" />
      </Appbar.Header>
      <ScrollView style={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <View style={styles.infoBox}>
            <Icon source="crystal-ball" size={48} color="#E91E63" />
            <Text variant="titleMedium" style={styles.infoTitle}>AI智能预测</Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              基于DeepSeek AI的智能预测分析功能
            </Text>
          </View>
        </Surface>
        <Card style={styles.featureCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.featureTitle}>预测功能</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• 需求预测</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• 库存预警</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• 生产计划优化</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• 成本趋势预测</Text>
          </Card.Content>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 12, padding: 16, margin: 16, marginBottom: 8 },
  infoBox: { alignItems: 'center', padding: 32 },
  infoTitle: { fontWeight: '600', color: '#212121', marginTop: 16, marginBottom: 8 },
  infoText: { color: '#666', textAlign: 'center', lineHeight: 20 },
  featureCard: { margin: 16, marginTop: 8 },
  featureTitle: { fontWeight: '600', marginBottom: 12 },
  featureItem: { color: '#666', paddingVertical: 4 },
});
