import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Appbar } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { ProcessingScreenProps } from '../../types/navigation';

type EquipmentMonitoringScreenProps = ProcessingScreenProps<'EquipmentMonitoring'>;

/**
 * 设备监控页面
 * TODO: 实现完整设备监控功能
 */
export default function EquipmentMonitoringScreen() {
  const navigation = useNavigation<EquipmentMonitoringScreenProps['navigation']>();

  return (
    <View style={styles.container}>
      <Appbar.Header elevated>
        <Appbar.BackAction onPress={() => navigation.goBack()} />
        <Appbar.Content title="设备监控" />
        <Appbar.Action icon="refresh" onPress={() => {}} />
      </Appbar.Header>

      <View style={styles.content}>
        <Text variant="bodyLarge" style={styles.placeholder}>
          设备监控功能开发中...
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  placeholder: {
    color: '#9E9E9E',
    textAlign: 'center',
  },
});
