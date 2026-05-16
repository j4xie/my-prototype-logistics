/**
 * Workflow node colors — Cretas Neo Minimal palette.
 *
 * Mirrors `frontend/CretasFoodTrace/src/theme/index.ts` `custom.workflow`.
 * Background/text pairs verified WCAG AA (>=4.5:1) on white surface.
 *
 * Consumers should NOT hardcode color literals — import from here.
 */
import type { WorkflowNodeStatus } from '@/types/workflow';

export interface WorkflowPalette {
  bg: string;
  text: string;
  border: string;
}

export const workflowColors = {
  pendingBg: '#FFE4B5',
  pendingText: '#8B4513',
  pendingBorder: '#F2C97D',
  inProgressBg: '#D4EDDA',
  inProgressText: '#155724',
  inProgressBorder: '#A3D9A5',
  doneBg: '#D1ECF1',
  doneText: '#0C5460',
  doneBorder: '#9FD0DC',
  connector: '#9CA3AF',
} as const;

export function getWorkflowPalette(status: WorkflowNodeStatus): WorkflowPalette {
  switch (status) {
    case 'PENDING':
      return {
        bg: workflowColors.pendingBg,
        text: workflowColors.pendingText,
        border: workflowColors.pendingBorder,
      };
    case 'IN_PROGRESS':
      return {
        bg: workflowColors.inProgressBg,
        text: workflowColors.inProgressText,
        border: workflowColors.inProgressBorder,
      };
    case 'DONE':
      return {
        bg: workflowColors.doneBg,
        text: workflowColors.doneText,
        border: workflowColors.doneBorder,
      };
  }
}

export function formatWorkflowCount(count: number): string {
  if (count <= 999) return String(count);
  if (count <= 9999) return `${Math.floor(count / 1000)}K+`;
  return '9K+';
}
