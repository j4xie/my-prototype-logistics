import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import {
  Text,
  Card,
  Button,
  List
} from 'react-native-paper';

export default function FarmingScreen() {
  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge" style={styles.title}>
            农业管理
          </Text>
          <Text variant="bodyMedium" style={styles.subtitle}>
            农业模块功能框架已搭建，详细功能开发中...
          </Text>
          
          <View style={styles.moduleList}>
            <List.Item
              title="农场管理"
              description="农场信息、田地管理"
              left={(props) => <List.Icon {...props} icon="barn" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              style={styles.listItem}
            />
            
            <List.Item
              title="种植计划"
              description="作物规划、种植安排"
              left={(props) => <List.Icon {...props} icon="sprout" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              style={styles.listItem}
            />
            
            <List.Item
              title="收获记录"
              description="收获数据、产量统计"
              left={(props) => <List.Icon {...props} icon="grain" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              style={styles.listItem}
            />
            
            <List.Item
              title="农事活动"
              description="日常管理、作业记录"
              left={(props) => <List.Icon {...props} icon="calendar-check" />}
              right={(props) => <List.Icon {...props} icon="chevron-right" />}
              style={styles.listItem}
            />
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  card: {
    margin: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
  },
  moduleList: {
    gap: 8,
  },
  listItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    marginBottom: 8,
  },
});