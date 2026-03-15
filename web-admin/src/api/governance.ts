import { get, post, put, del } from './request';
import type { ApiResponse } from '@/types/api';

export interface SkillInfo {
  name: string;
  displayName: string;
  description: string;
  tools: string[];
  triggers: string[];
  source: string;
  version: string;
  enabled: boolean;
  hasExecutionGraph: boolean;
}

export interface SkillRecommendation {
  suggestedName: string;
  suggestedDisplayName: string;
  tools: string[];
  suggestedTriggers: string[];
  evidenceCount: number;
  confidenceScore: number;
  reason: string;
  alreadyCoveredBySkill: boolean;
}

export interface CoOccurrence {
  toolA: string;
  toolB: string;
  sessionCount: number;
  supportRate: number;
}

export interface ToolSequence {
  tools: string[];
  occurrences: number;
  avgTotalTimeMs: number;
}

export function listSkills(factoryId: string): Promise<ApiResponse<SkillInfo[]>> {
  return get(`/${factoryId}/governance/skills`);
}

export function getSkillDetail(factoryId: string, skillName: string): Promise<ApiResponse<SkillInfo>> {
  return get(`/${factoryId}/governance/skills/${skillName}`);
}

export function createSkill(factoryId: string, data: {
  name: string;
  displayName?: string;
  tools: string[];
  triggers?: string[];
  description?: string;
  category?: string;
}): Promise<ApiResponse<{ id: string; name: string }>> {
  return post(`/${factoryId}/governance/skills`, data);
}

export function toggleSkill(factoryId: string, skillName: string, enabled: boolean): Promise<ApiResponse<void>> {
  return put(`/${factoryId}/governance/skills/${skillName}/active`, { enabled });
}

export function deleteSkill(factoryId: string, skillName: string): Promise<ApiResponse<void>> {
  return del(`/${factoryId}/governance/skills/${skillName}`);
}

export function getPatterns(factoryId: string, days = 30, minCount = 3): Promise<ApiResponse<{
  co_occurrences: CoOccurrence[];
  sequences: ToolSequence[];
  period_days: number;
}>> {
  return get(`/${factoryId}/governance/skills/patterns`, { params: { days, minCount } });
}

export function getRecommendations(factoryId: string, days = 30): Promise<ApiResponse<SkillRecommendation[]>> {
  return get(`/${factoryId}/governance/skills/recommendations`, { params: { days } });
}
