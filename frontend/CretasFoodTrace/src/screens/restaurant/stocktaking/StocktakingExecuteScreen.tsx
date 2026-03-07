/**
 * 盘点执行 — 录入实盘数量
 */
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Surface } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { RStocktakingStackParamList } from '../../../types/navigation';
import { restaurantApiClient } from '../../../services/api/restaurantApiClient';
import { StocktakingRecord } from '../../../types/restaurant';
import { handleError } from '../../../utils/errorHandler';

type Route = RouteProp<RStocktakingStackParamList, 'StocktakingExecute'>;

export function StocktakingExecuteScreen() {
  const { t } = useTranslation('restaurant');
  const navigation = useNavigation();
  const route = useRoute<Route>();
  const recordId = route.params?.recordId;
  const [loading, setLoading] = useState(!!recordId);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<StocktakingRecord | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [reason, setReason] = useState('');
  // For new stocktaking
  const [newMaterialId, setNewMaterialId] = useState('');

  useEffect(() => {
    if (recordId) loadRecord();
  }, [recordId]);

  async function loadRecord() {
    try {
      const data = await restaurantApiClient.getStocktakingRecord(recordId!);
      setRecord(data);
      if (data.actualQuantity != null) setActualQty(String(data.actualQuantity));
    } catch (error) {
      handleError(error, { title: t('common.loadFailed') });
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!actualQty) {
      Alert.alert('', t('stocktaking.execute.inputActual'));
      return;
    }
    const parsedQty = parseFloat(actualQty);
    if (isNaN(parsedQty) || parsedQty < 0) {
      Alert.alert('', t('stocktaking.execute.inputActual') + ': ' + t('common.operationFailed'));
      return;
    }
    setSubmitting(true);
    try {
      if (recordId) {
        await restaurantApiClient.completeStocktaking(recordId, {
          actualQuantity: parsedQty,
          adjustmentReason: reason || undefined,
        });
      } else {
        // Create new + complete
        if (!newMaterialId) {
          Alert.alert('', t('common.operationFailed'));
          setSubmitting(false);
          return;
        }
        const created = await restaurantApiClient.createStocktaking({
          rawMaterialTypeId: newMaterialId,
        });
        if (created?.id) {
          await restaurantApiClient.completeStocktaking(created.id, {
            actualQuantity: parsedQty,
            adjustmentReason: reason || undefined,
          });
        }
      }
      Alert.alert('', t('stocktaking.execute.completed'), [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      handleError(error, { title: t('common.operationFailed') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!recordId) return;
    Alert.alert(t('stocktaking.execute.cancel'), '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'), style: 'destructive',
        onPress: async () => {
          try {
            await restaurantApiClient.cancelStocktaking(recordId);
            navigation.goBack();
          } catch (error) {
            handleError(error, { title: t('common.operationFailed') });
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Button icon="arrow-left" textColor="#fff" onPress={() => navigation.goBack()}>{t('common.back')}</Button>
        <Text style={styles.headerTitle}>{t('stocktaking.execute.title')}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.center}><Text>...</Text></View>
        ) : (
          <>
            {record ? (
              <Surface style={styles.infoCard} elevation={1}>
                <Text style={styles.stkNumber}>{record.stocktakingNumber}</Text>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('stocktaking.list.material')}</Text>
                  <Text style={styles.infoValue}>{record.rawMaterialTypeName || record.rawMaterialTypeId}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>{t('stocktaking.execute.systemQty')}</Text>
                  <Text style={styles.systemQty}>{record.systemQuantity} {record.unit}</Text>
                </View>
              </Surface>
            ) : (
              <>
                <Text style={styles.label}>{t('stocktaking.list.material')} ID *</Text>
                <TextInput mode="outlined" value={newMaterialId} onChangeText={setNewMaterialId} placeholder="MT-XXX" style={styles.input} />
              </>
            )}

            <Text style={styles.label}>{t('stocktaking.execute.inputActual')} *</Text>
            <TextInput
              mode="outlined"
              value={actualQty}
              onChangeText={setActualQty}
              keyboardType="decimal-pad"
              placeholder="0.00"
              style={styles.input}
            />

            <Text style={styles.label}>{t('stocktaking.execute.reason')}</Text>
            <TextInput
              mode="outlined"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
              style={styles.input}
            />

            <Button
              mode="contained"
              onPress={handleComplete}
              loading={submitting}
              disabled={submitting}
              buttonColor="#FFAB00"
              style={styles.btn}
            >
              {t('stocktaking.execute.complete')}
            </Button>

            {recordId && (
              <Button mode="outlined" onPress={handleCancel} textColor="#999" style={styles.btn}>
                {t('stocktaking.execute.cancel')}
              </Button>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: { backgroundColor: '#FFAB00', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 8 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  content: { padding: 16, paddingBottom: 40 },
  infoCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 },
  stkNumber: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  infoLabel: { fontSize: 14, color: '#999' },
  infoValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  systemQty: { fontSize: 18, fontWeight: '700', color: '#1976d2' },
  label: { fontSize: 14, fontWeight: '500', color: '#333', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: '#fff' },
  btn: { marginTop: 16, borderRadius: 8 },
  center: { alignItems: 'center', paddingTop: 60 },
});

export default StocktakingExecuteScreen;
