/**
 * 帮助中心页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon } from 'react-native-paper';

// 启用 Android 动画
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    id: '1',
    question: '如何创建新的生产批次？',
    answer: '在首页点击"今日批次"或"生产管理"，然后点击右上角的"+"按钮，填写批次信息后提交即可创建新批次。',
  },
  {
    id: '2',
    question: '如何查看生产进度？',
    answer: '在首页可以查看今日生产概览，点击"今日生产"可以查看详细的生产统计和进度信息。',
  },
  {
    id: '3',
    question: '如何进行质量检测？',
    answer: '进入批次详情页面，点击"质检记录"可以查看历史质检记录，点击"添加质检"可以新增质检记录。',
  },
  {
    id: '4',
    question: '如何导出数据报表？',
    answer: '在"我的"页面点击"数据导出"，选择需要导出的数据类型和时间范围，即可导出Excel格式的报表。',
  },
  {
    id: '5',
    question: '设备告警如何处理？',
    answer: '收到设备告警通知后，点击查看详情，可以了解告警原因和建议处理方式。处理完成后，在告警详情页面点击"确认处理"。',
  },
  {
    id: '6',
    question: '忘记密码怎么办？',
    answer: '请联系工厂管理员重置密码，或拨打客服热线 400-XXX-XXXX 获取帮助。',
  },
];

export function HelpCenterScreen() {
  const navigation = useNavigation();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon source="arrow-left" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>帮助中心</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* 快捷操作 */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#e8f5e9' }]}>
              <Icon source="book-open-variant" size={24} color="#4caf50" />
            </View>
            <Text style={styles.actionText}>使用指南</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#e3f2fd' }]}>
              <Icon source="video" size={24} color="#2196f3" />
            </View>
            <Text style={styles.actionText}>视频教程</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIcon, { backgroundColor: '#fff3e0' }]}>
              <Icon source="phone" size={24} color="#ff9800" />
            </View>
            <Text style={styles.actionText}>联系客服</Text>
          </TouchableOpacity>
        </View>

        {/* 常见问题 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>常见问题</Text>
          <View style={styles.faqList}>
            {faqData.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.faqItem}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.7}
              >
                <View style={styles.faqHeader}>
                  <Text style={styles.faqQuestion}>{item.question}</Text>
                  <Icon
                    source={expandedId === item.id ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color="#999"
                  />
                </View>
                {expandedId === item.id && (
                  <Text style={styles.faqAnswer}>{item.answer}</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 联系方式 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>联系我们</Text>
          <View style={styles.contactCard}>
            <View style={styles.contactItem}>
              <Icon source="phone" size={20} color="#667eea" />
              <Text style={styles.contactText}>客服热线: 400-XXX-XXXX</Text>
            </View>
            <View style={styles.contactItem}>
              <Icon source="email" size={20} color="#667eea" />
              <Text style={styles.contactText}>邮箱: support@cretas.com</Text>
            </View>
            <View style={styles.contactItem}>
              <Icon source="clock-outline" size={20} color="#667eea" />
              <Text style={styles.contactText}>工作时间: 周一至周五 9:00-18:00</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  actionItem: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    color: '#666',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    color: '#999',
    marginLeft: 20,
    marginBottom: 8,
  },
  faqList: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  faqItem: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
    marginRight: 12,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
    marginTop: 12,
  },
  contactCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 16,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
  },
});

export default HelpCenterScreen;
