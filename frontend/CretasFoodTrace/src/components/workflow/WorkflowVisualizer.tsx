import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useWorkflowStats } from '../../hooks/useWorkflowStats';
import type {
  WorkflowAIEntryContext,
  WorkflowModule,
} from '../../types/workflow';
import { WorkflowCard } from './WorkflowCard';

const MODULE_TITLES: Record<WorkflowModule, string> = {
  sales: '今日销售工作流',
  purchase: '今日采购工作流',
  production: '今日生产工作流',
  finance: '今日财务工作流',
  inventory: '库存状态',
};

export interface WorkflowVisualizerProps {
  /** 要显示的 module 列表; 顺序即渲染顺序 (按角色定制子集) */
  modules: WorkflowModule[];
  /** 工厂 ID; 留空时 API client 从登录 user 拿 */
  factoryId?: string;
  /** AI 入口按钮是否显示 (各 card 都显示, 由调用方决定 module 关联) */
  aiTriggerEnabled?: boolean;
  /** 自定义 title 覆盖默认映射 (key 必须是 modules 里的值) */
  titles?: Partial<Record<WorkflowModule, string>>;
  /** 节点点击; 调用方拿到 (module, nodeId) 后自己 navigate + filter */
  onNodePress?: (module: WorkflowModule, nodeId: string) => void;
  /** 节点长按; entryContext 推荐传给 AIChat 路由 */
  onNodeLongPress?: (module: WorkflowModule, ctx: WorkflowAIEntryContext) => void;
  /** AI 按钮点击; entryContext 推荐传给 AIChat 路由 */
  onAITrigger?: (module: WorkflowModule, ctx: WorkflowAIEntryContext) => void;
}

/**
 * 多模块工作流可视化 — 顶层 wrapper. 每个 module 渲染一张 {@link WorkflowCard}.
 *
 * 角色驱动: 调用方按角色传不同 modules 子集
 * (FA=全 5, DS=[production,sales], WS=[production], WH=[inventory]).
 *
 * 数据由内部 {@link useWorkflowStats} hook 自动取, 调用方不需自己 fetch.
 */
export function WorkflowVisualizer({
  modules,
  factoryId,
  aiTriggerEnabled,
  titles,
  onNodePress,
  onNodeLongPress,
  onAITrigger,
}: WorkflowVisualizerProps) {
  return (
    <View style={styles.stack}>
      {modules.map((module) => (
        <ModuleCard
          key={module}
          module={module}
          factoryId={factoryId}
          title={titles?.[module] ?? MODULE_TITLES[module]}
          aiTriggerEnabled={aiTriggerEnabled}
          onNodePress={onNodePress}
          onNodeLongPress={onNodeLongPress}
          onAITrigger={onAITrigger}
        />
      ))}
    </View>
  );
}

interface ModuleCardProps {
  module: WorkflowModule;
  factoryId?: string;
  title: string;
  aiTriggerEnabled?: boolean;
  onNodePress?: (module: WorkflowModule, nodeId: string) => void;
  onNodeLongPress?: (module: WorkflowModule, ctx: WorkflowAIEntryContext) => void;
  onAITrigger?: (module: WorkflowModule, ctx: WorkflowAIEntryContext) => void;
}

function ModuleCard({
  module,
  factoryId,
  title,
  aiTriggerEnabled,
  onNodePress,
  onNodeLongPress,
  onAITrigger,
}: ModuleCardProps) {
  const { stats, loading } = useWorkflowStats(module, factoryId);
  const nodes = stats?.nodes ?? [];

  return (
    <WorkflowCard
      title={title}
      nodes={nodes}
      loading={loading}
      aiTriggerEnabled={aiTriggerEnabled}
      onNodePress={onNodePress ? (nodeId) => onNodePress(module, nodeId) : undefined}
      onNodeLongPress={
        onNodeLongPress
          ? (nodeId) => onNodeLongPress(module, { module, node: nodeId, factoryId })
          : undefined
      }
      onAITrigger={
        onAITrigger ? () => onAITrigger(module, { module, factoryId }) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
  },
});
