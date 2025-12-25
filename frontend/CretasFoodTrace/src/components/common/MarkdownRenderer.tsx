import React from 'react';
import { StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MarkdownRendererProps {
  content: string;
  style?: object;
}

/**
 * AI 分析结果的 Markdown 渲染组件
 *
 * 支持渲染：
 * - 标题 (###)
 * - 表格 (| header |)
 * - 粗体 (**text**)
 * - 列表 (- item)
 * - 分隔线 (---)
 * - 引用块 (>)
 *
 * @version 1.1.0
 * @since 2025-12-23
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, style }) => {
  // 处理空内容，避免 "Input data should be a String" 错误
  if (!content || typeof content !== 'string') {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <Markdown style={markdownStyles}>
        {content}
      </Markdown>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

// Markdown 样式配置 - 专业商务风格
const markdownStyles = StyleSheet.create({
  // 整体内容
  body: {
    color: '#1F2937',
    fontSize: 14,
    lineHeight: 22,
  },

  // 标题样式 - 清晰层级
  heading1: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
    paddingBottom: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 18,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 6,
  },
  heading3: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
    marginTop: 16,
    marginBottom: 8,
  },
  heading4: {
    fontSize: 15,
    fontWeight: '600',
    color: '#475569',
    marginTop: 12,
    marginBottom: 6,
  },

  // 段落
  paragraph: {
    marginVertical: 6,
    lineHeight: 24,
    color: '#374151',
  },

  // 粗体
  strong: {
    fontWeight: '700',
    color: '#0F172A',
  },

  // 斜体
  em: {
    fontStyle: 'italic',
    color: '#64748B',
  },

  // 引用块 - 核心发现高亮
  blockquote: {
    backgroundColor: '#F0F9FF',
    borderLeftWidth: 4,
    borderLeftColor: '#0EA5E9',
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginVertical: 12,
    borderRadius: 6,
  },

  // 代码块
  code_inline: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#0369A1',
  },
  code_block: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 8,
    marginVertical: 10,
  },
  fence: {
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 8,
    marginVertical: 10,
  },

  // 列表 - 清晰可读
  bullet_list: {
    marginLeft: 4,
    marginVertical: 6,
  },
  ordered_list: {
    marginLeft: 4,
    marginVertical: 6,
  },
  list_item: {
    flexDirection: 'row',
    marginVertical: 4,
    paddingRight: 12,
  },
  bullet_list_icon: {
    marginRight: 10,
    color: '#3B82F6',
    fontWeight: '600',
  },
  ordered_list_icon: {
    marginRight: 10,
    color: '#3B82F6',
    fontWeight: '600',
  },

  // 表格样式 - 专业数据展示
  table: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    marginVertical: 12,
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: '#F8FAFC',
  },
  th: {
    padding: 10,
    fontWeight: '700',
    color: '#1E293B',
    backgroundColor: '#F1F5F9',
    borderRightWidth: 1,
    borderBottomWidth: 2,
    borderColor: '#CBD5E1',
    textAlign: 'left',
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  td: {
    padding: 10,
    borderRightWidth: 1,
    borderColor: '#E2E8F0',
    color: '#475569',
    fontSize: 13,
  },

  // 分隔线 - 清晰分区
  hr: {
    backgroundColor: '#E2E8F0',
    height: 1,
    marginVertical: 16,
  },

  // 链接
  link: {
    color: '#2563EB',
    textDecorationLine: 'underline',
  },

  // 文本内容
  text: {
    color: '#374151',
  },

  // 删除线
  s: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
});

export default MarkdownRenderer;
