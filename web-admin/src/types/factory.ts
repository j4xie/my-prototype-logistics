/** Factory feature configuration types */

export interface FeatureConfig {
  id: number;
  factoryId: string;
  moduleId: string;
  moduleName: string;
  enabled: boolean;
  config: ModuleConfigDetail;
  conversationSummary?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ModuleConfigDetail {
  analysisDimensions?: string[];
  disabledScreens?: string[];
  disabledReports?: string[];
  quickActions?: string[];
  benchmarks?: Record<string, number>;
  priority?: number;
  [key: string]: unknown;
}

export interface CreateUserDTO {
  username: string;
  password: string;
  email: string;
  fullName?: string;
  phone?: string;
  roleCode: string;
  position?: string;
}
