/**
 * FAHomeScreen shared types
 */

// Statistics card data used by StatCardGrid and useDashboardData
export interface StatCardData {
  id: string;
  value: string | number;
  label: string;
  icon: string;
  color: string;
  trend?: string;
  onPress: () => void;
}

// AI insight data used by AIInsightCard and useDashboardData
export interface AIInsight {
  status: 'loading' | 'success' | 'error';
  message: string;
  metrics: {
    qualityRate: number;
    unitCost: number;
    avgCycle: number;
  };
}

// Quick action item used by QuickActionsModule and useQuickActions
export interface QuickActionItem {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}
