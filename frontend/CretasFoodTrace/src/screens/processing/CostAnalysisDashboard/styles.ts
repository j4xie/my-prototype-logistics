import { StyleSheet } from 'react-native';

/**
 * 统一样式定义
 * 从主组件中提取，避免重复定义
 */

export const styles = StyleSheet.create({
  // 通用容器样式
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    marginBottom: 16,
  },

  // 批次信息样式
  batchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#757575',
    marginBottom: 4,
  },
  batchNumber: {
    fontWeight: '700',
    color: '#1976D2',
  },
  productInfo: {
    color: '#616161',
  },

  // 成本网格样式
  costGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  costItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  costLabel: {
    color: '#616161',
    marginBottom: 8,
  },
  costValue: {
    fontWeight: '700',
    marginBottom: 4,
  },
  costPercentage: {
    color: '#757575',
  },

  // 详情行样式
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailValue: {
    fontWeight: '600',
  },

  // Loading状态
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 16,
    color: '#757575',
  },

  // 错误状态
  errorText: {
    color: '#D32F2F',
    textAlign: 'center',
  },

  // AI分析样式
  aiCard: {
    marginBottom: 16,
    backgroundColor: '#F0F9FF',
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  aiHeader: {
    marginBottom: 16,
  },
  aiTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  aiTitle: {
    fontWeight: '700',
    color: '#1E40AF',
  },
  quotaBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  quotaText: {
    color: '#1E40AF',
    fontWeight: '600',
  },
  resetText: {
    color: '#64748B',
    marginTop: 2,
  },
  aiInitial: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  aiDescription: {
    textAlign: 'center',
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 22,
  },
  aiButton: {
    width: '100%',
    borderRadius: 12,
  },
  aiButtonContent: {
    paddingVertical: 8,
  },
  limitHint: {
    color: '#EF4444',
    marginTop: 8,
    textAlign: 'center',
  },
  aiResultSection: {
    marginTop: 8,
  },
  aiLoadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  aiLoadingText: {
    marginTop: 16,
    color: '#64748B',
  },
  aiResultCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  aiResultTitle: {
    fontWeight: '700',
    color: '#1E40AF',
    marginBottom: 8,
  },
  aiDivider: {
    marginVertical: 12,
  },
  aiResultText: {
    fontSize: 14,
    lineHeight: 24,
    color: '#1F2937',
  },
  aiActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  quickQuestions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  quickQuestionsTitle: {
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
  },
  quickQuestionButton: {
    marginBottom: 6,
    justifyContent: 'flex-start',
  },
  quickQuestionContent: {
    justifyContent: 'flex-start',
  },
  customQuestionSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  questionInputContainer: {
    gap: 12,
  },
  questionInput: {
    backgroundColor: '#FFFFFF',
  },
  questionActions: {
    flexDirection: 'row',
    gap: 12,
  },
});

// 导出颜色常量，方便复用
export const colors = {
  // 成本类别颜色
  rawMaterial: {
    bg: '#FFEBEE',
    text: '#D32F2F',
  },
  labor: {
    bg: '#E3F2FD',
    text: '#1976D2',
  },
  equipment: {
    bg: '#F3E5F5',
    text: '#7B1FA2',
  },
  total: {
    bg: '#E8F5E9',
    text: '#388E3C',
  },

  // AI样式颜色
  ai: {
    bg: '#F0F9FF',
    border: '#3B82F6',
    title: '#1E40AF',
    description: '#64748B',
  },
};
