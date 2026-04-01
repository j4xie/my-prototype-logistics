import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Appbar,
  TextInput,
  Button,
  SegmentedButtons,
  Surface,
} from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { apiClient } from '../../../services/api/apiClient';
import { getCurrentFactoryId } from '../../../utils/factoryIdHelper';

type PaymentMethod = 'BANK_TRANSFER' | 'CASH' | 'WECHAT' | 'ALIPAY';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: '银行转账' },
  { value: 'CASH', label: '现金' },
  { value: 'WECHAT', label: '微信' },
  { value: 'ALIPAY', label: '支付宝' },
];

export default function PaymentRecordScreen() {
  const navigation = useNavigation();
  const factoryId = getCurrentFactoryId();

  const [salesOrderId, setSalesOrderId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [paymentReference, setPaymentReference] = useState('');
  const [remark, setRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!salesOrderId.trim()) {
      Alert.alert('提示', '请输入销售订单ID');
      return;
    }
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      Alert.alert('提示', '请输入有效的收款金额');
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post<{ success: boolean; data?: { paymentNumber?: string }; message?: string }>(`/${factoryId}/finance/payments/record`, {
        salesOrderId: salesOrderId.trim(),
        amount: amountNum,
        paymentMethod,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentReference: paymentReference.trim() || undefined,
        remark: remark.trim() || undefined,
      });

      if (response.success) {
        Alert.alert('成功', `收款记录已创建\n编号: ${response.data?.paymentNumber}`, [
          { text: '确定', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('失败', response.message || '创建收款记录失败');
      }
    } catch (error: unknown) {
      Alert.alert('错误', '网络请求失败，请检查网络连接');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Appbar.Header>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="录入收款" />
      </Appbar.Header>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          <Surface style={styles.card} elevation={1}>
            <Text variant="titleMedium" style={styles.sectionTitle}>收款信息</Text>

            <TextInput
              label="销售订单ID *"
              value={salesOrderId}
              onChangeText={setSalesOrderId}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="收款金额 *"
              value={amount}
              onChangeText={setAmount}
              mode="outlined"
              keyboardType="decimal-pad"
              right={<TextInput.Affix text="元" />}
              style={styles.input}
            />

            <Text variant="bodyMedium" style={styles.label}>支付方式</Text>
            <SegmentedButtons
              value={paymentMethod}
              onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
              buttons={PAYMENT_METHODS}
              style={styles.segmented}
            />

            <TextInput
              label="银行流水号"
              value={paymentReference}
              onChangeText={setPaymentReference}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="备注"
              value={remark}
              onChangeText={setRemark}
              mode="outlined"
              multiline
              numberOfLines={3}
              style={styles.input}
            />
          </Surface>

          <Button
            mode="contained"
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
            style={styles.submitButton}
            contentStyle={styles.submitButtonContent}
          >
            提交收款记录
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  flex: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 16 },
  card: { padding: 16, borderRadius: 12, marginBottom: 16 },
  sectionTitle: { marginBottom: 16, fontWeight: '600' },
  input: { marginBottom: 12 },
  label: { marginBottom: 8, color: '#666' },
  segmented: { marginBottom: 16 },
  submitButton: { marginTop: 8, borderRadius: 8 },
  submitButtonContent: { paddingVertical: 8 },
});
