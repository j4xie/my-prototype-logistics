import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useDraftReportStore } from '../../store/draftReportStore';
import { getCurrentFactoryId } from '../../utils/factoryIdHelper';

export const OfflineIndicator: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const { drafts } = useDraftReportStore();
  const opacity = React.useRef(new Animated.Value(0)).current;

  let factoryId: string;
  try {
    factoryId = getCurrentFactoryId();
  } catch {
    factoryId = '';
  }

  const draftCount = drafts.filter(d => d.factoryId === factoryId).length;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!state.isConnected);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: isOffline || draftCount > 0 ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOffline, draftCount, opacity]);

  if (!isOffline && draftCount === 0) return null;

  return (
    <Animated.View style={[styles.container, isOffline ? styles.offline : styles.pending, { opacity }]}>
      <Text style={styles.text}>
        {isOffline ? '当前离线' : ''}
        {draftCount > 0 ? `${isOffline ? ' · ' : ''}${draftCount}条待同步` : ''}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { paddingVertical: 6, paddingHorizontal: 16, alignItems: 'center' },
  offline: { backgroundColor: '#EF4444' },
  pending: { backgroundColor: '#F59E0B' },
  text: { color: '#fff', fontSize: 13, fontWeight: '500' },
});

export default OfflineIndicator;
