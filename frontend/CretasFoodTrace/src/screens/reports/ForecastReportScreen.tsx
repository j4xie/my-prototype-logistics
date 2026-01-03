import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Appbar, Surface, Icon, Card } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

export default function ForecastReportScreen() {
  const navigation = useNavigation();
  const { t } = useTranslation('reports');

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title={t('forecast.title')} />
      </Appbar.Header>
      <ScrollView style={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <View style={styles.infoBox}>
            <Icon source="crystal-ball" size={48} color="#E91E63" />
            <Text variant="titleMedium" style={styles.infoTitle}>{t('forecast.aiSmartForecast')}</Text>
            <Text variant="bodyMedium" style={styles.infoText}>
              {t('forecast.description')}
            </Text>
          </View>
        </Surface>
        <Card style={styles.featureCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.featureTitle}>{t('forecast.features')}</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• {t('forecast.demandForecast')}</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• {t('forecast.inventoryAlert')}</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• {t('forecast.productionPlanOptimization')}</Text>
            <Text variant="bodySmall" style={styles.featureItem}>• {t('forecast.costTrendForecast')}</Text>
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
