import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Appbar, TextInput, Button, SegmentedButtons, Surface } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { apiClient } from '../../../services/api/apiClient';
import { getCurrentFactoryId } from '../../../utils/factoryIdHelper';

type Urgency = 'HIGH' | 'MEDIUM' | 'LOW';

export default function RdRequestCreateScreen() {
  const navigation = useNavigation();
  const factoryId = getCurrentFactoryId();

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [requirements, setRequirements] = useState('');
  const [urgency, setUrgency] = useState<Urgency>('MEDIUM');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!customerName.trim() || !requirements.trim()) {
      Alert.alert('提示', '请填写客户名称和需求描述');
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiClient.post<{ success: boolean; data?: { requestNumber?: string }; message?: string }>(`/${factoryId}/rd/requests`, {
        customerName: customerName.trim(),
        customerContact: customerContact.trim() || undefined,
        requirements: requirements.trim(),
        urgency,
      });
      if (response.success) {
        Alert.alert('成功', `研发需求已创建\n编号: ${response.data?.requestNumber}`, [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('失败', response.message || '创建失败');
      }
    } catch {
      Alert.alert('错误', '网络请求失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="新建研发需求" />
      </Appbar.Header>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleMedium" style={{ marginBottom: 16, fontWeight: '600' }}>客户信息</Text>
            <TextInput label="客户名称 *" value={customerName} onChangeText={setCustomerName} mode="outlined" style={styles.input} />
            <TextInput label="联系方式" value={customerContact} onChangeText={setCustomerContact} mode="outlined" style={styles.input} />

            <Text variant="bodyMedium" style={{ marginBottom: 8, color: '#666' }}>紧急程度</Text>
            <SegmentedButtons
              value={urgency}
              onValueChange={(v) => setUrgency(v as Urgency)}
              buttons={[
                { value: 'HIGH', label: '紧急' },
                { value: 'MEDIUM', label: '普通' },
                { value: 'LOW', label: '低' },
              ]}
              style={{ marginBottom: 16 }}
            />

            <TextInput
              label="需求描述 *"
              value={requirements}
              onChangeText={setRequirements}
              mode="outlined"
              multiline
              numberOfLines={5}
              style={styles.input}
              placeholder="请描述客户的样品需求、规格、口味要求等"
            />
          </Surface>

          <Button mode="contained" onPress={handleSubmit} loading={submitting} disabled={submitting}
            style={{ marginTop: 8, borderRadius: 8 }} contentStyle={{ paddingVertical: 8 }}>
            提交研发需求
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  card: { padding: 16, borderRadius: 12, marginBottom: 16 },
  input: { marginBottom: 12 },
});
