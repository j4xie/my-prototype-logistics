/**
 * Factory management API client
 * Feature configs, user creation, etc.
 */
import { get, post, put } from './request';
import type { FeatureConfig, CreateUserDTO } from '@/types/factory';

// === Feature Config ===

export function getFeatureConfigs(factoryId: string) {
  return get<FeatureConfig[]>(`/${factoryId}/feature-config`);
}

export function getModuleConfig(factoryId: string, moduleId: string) {
  return get<FeatureConfig>(`/${factoryId}/feature-config/${moduleId}`);
}

export function toggleModule(factoryId: string, moduleId: string, enabled: boolean) {
  return put<FeatureConfig>(`/${factoryId}/feature-config/${moduleId}/toggle`, { enabled });
}

export function updateModuleConfig(factoryId: string, moduleId: string, config: Record<string, unknown>) {
  return put<FeatureConfig>(`/${factoryId}/feature-config/${moduleId}`, config);
}

export function batchUpdateConfigs(factoryId: string, configs: Partial<FeatureConfig>[]) {
  return post<FeatureConfig[]>(`/${factoryId}/feature-config/batch`, configs);
}

export function initDefaultConfigs(factoryId: string) {
  return post<FeatureConfig[]>(`/${factoryId}/feature-config/init-defaults`);
}

// === User Management ===

export function createUser(factoryId: string, userData: CreateUserDTO) {
  return post(`/${factoryId}/users`, userData);
}

export function activateUser(factoryId: string, userId: number) {
  return post(`/${factoryId}/users/${userId}/activate`);
}

export function deactivateUser(factoryId: string, userId: number) {
  return post(`/${factoryId}/users/${userId}/deactivate`);
}
