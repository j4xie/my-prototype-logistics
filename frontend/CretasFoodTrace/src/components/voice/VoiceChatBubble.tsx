/**
 * 对话气泡组件
 * Voice Chat Bubble Component
 */

import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChatMessage, InspectionData } from '../../services/voice/types';

interface VoiceChatBubbleProps {
  message: ChatMessage;
  style?: ViewStyle;
}

export const VoiceChatBubble: React.FC<VoiceChatBubbleProps> = ({
  message,
  style,
}) => {
  const isAI = message.role === 'ai';

  return (
    <View
      style={[
        styles.container,
        isAI ? styles.aiContainer : styles.userContainer,
        style,
      ]}
    >
      {/* 头像 */}
      <View style={[styles.avatar, isAI ? styles.aiAvatar : styles.userAvatar]}>
        <MaterialCommunityIcons
          name={isAI ? 'robot' : 'account'}
          size={20}
          color="#FFFFFF"
        />
      </View>

      {/* 气泡内容 */}
      <View
        style={[styles.bubble, isAI ? styles.aiBubble : styles.userBubble]}
      >
        <Text style={[styles.text, isAI ? styles.aiText : styles.userText]}>
          {message.content}
        </Text>

        {/* 提取的数据展示 */}
        {message.extractedData && (
          <ExtractedDataDisplay data={message.extractedData} />
        )}

        {/* 时间戳 */}
        <Text style={styles.timestamp}>
          {formatTime(message.timestamp)}
        </Text>
      </View>
    </View>
  );
};

/**
 * 提取数据展示组件
 */
interface ExtractedDataDisplayProps {
  data: Partial<InspectionData>;
}

const ExtractedDataDisplay: React.FC<ExtractedDataDisplayProps> = ({ data }) => {
  const items = [
    { key: 'appearance', label: '外观', icon: 'eye' },
    { key: 'smell', label: '气味', icon: 'flower' },
    { key: 'specification', label: '规格', icon: 'ruler' },
    { key: 'weight', label: '重量', icon: 'scale' },
    { key: 'packaging', label: '包装', icon: 'package-variant' },
  ] as const;

  const displayItems = items.filter(
    (item) => data[item.key]?.score !== undefined
  );

  if (displayItems.length === 0) {
    return null;
  }

  return (
    <View style={styles.extractedContainer}>
      {displayItems.map((item) => {
        const itemData = data[item.key];
        if (!itemData) return null;

        return (
          <View key={item.key} style={styles.extractedItem}>
            <View style={styles.extractedHeader}>
              <MaterialCommunityIcons
                name={item.icon as any}
                size={14}
                color="#6B7280"
              />
              <Text style={styles.extractedLabel}>{item.label}</Text>
              <View style={styles.scoreBadge}>
                <Text style={styles.scoreText}>{itemData.score}/20</Text>
              </View>
            </View>
            {itemData.notes && itemData.notes.length > 0 && (
              <Text style={styles.extractedNotes}>
                {itemData.notes.join('、')}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
};

/**
 * 打字效果气泡（AI正在思考）
 */
interface TypingBubbleProps {
  style?: ViewStyle;
}

export const TypingBubble: React.FC<TypingBubbleProps> = ({ style }) => {
  return (
    <View style={[styles.container, styles.aiContainer, style]}>
      <View style={[styles.avatar, styles.aiAvatar]}>
        <MaterialCommunityIcons name="robot" size={20} color="#FFFFFF" />
      </View>
      <View style={[styles.bubble, styles.aiBubble, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <View style={[styles.dot, styles.dot1]} />
          <View style={[styles.dot, styles.dot2]} />
          <View style={[styles.dot, styles.dot3]} />
        </View>
      </View>
    </View>
  );
};

/**
 * 系统消息气泡
 */
interface SystemMessageProps {
  text: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  style?: ViewStyle;
}

export const SystemMessage: React.FC<SystemMessageProps> = ({
  text,
  type = 'info',
  style,
}) => {
  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return { icon: 'check-circle', color: '#10B981', bg: '#D1FAE5' };
      case 'warning':
        return { icon: 'alert-circle', color: '#F59E0B', bg: '#FEF3C7' };
      case 'error':
        return { icon: 'close-circle', color: '#EF4444', bg: '#FEE2E2' };
      default:
        return { icon: 'information', color: '#3B82F6', bg: '#DBEAFE' };
    }
  };

  const config = getTypeConfig();

  return (
    <View style={[styles.systemContainer, { backgroundColor: config.bg }, style]}>
      <MaterialCommunityIcons
        name={config.icon as any}
        size={16}
        color={config.color}
      />
      <Text style={[styles.systemText, { color: config.color }]}>{text}</Text>
    </View>
  );
};

// 格式化时间
function formatTime(date: Date): string {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingHorizontal: 12,
  },
  aiContainer: {
    justifyContent: 'flex-start',
  },
  userContainer: {
    justifyContent: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  aiAvatar: {
    backgroundColor: '#2563EB',
  },
  userAvatar: {
    backgroundColor: '#6B7280',
  },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    padding: 12,
  },
  aiBubble: {
    backgroundColor: '#F3F4F6',
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: '#2563EB',
    borderTopRightRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  aiText: {
    color: '#1F2937',
  },
  userText: {
    color: '#FFFFFF',
  },
  timestamp: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
    textAlign: 'right',
  },
  // 提取数据样式
  extractedContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  extractedItem: {
    marginBottom: 6,
  },
  extractedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  extractedLabel: {
    fontSize: 13,
    color: '#4B5563',
    marginLeft: 4,
    flex: 1,
  },
  scoreBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  extractedNotes: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    marginLeft: 18,
  },
  // 打字效果
  typingBubble: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
    marginHorizontal: 2,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  // 系统消息
  systemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginVertical: 8,
  },
  systemText: {
    fontSize: 13,
    marginLeft: 6,
  },
});

export default VoiceChatBubble;
