// 认证相关类型定义
export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  organization?: Organization;
  profile?: UserProfile;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile {
  firstName?: string;
  lastName?: string;
  avatar?: string;
  phone?: string;
  department?: string;
  position?: string;
}

export interface Organization {
  id: string;
  name: string;
  type: 'farm' | 'processor' | 'logistics' | 'retailer';
  address?: string;
  contactInfo?: ContactInfo;
}

export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

export type UserRole = 'farmer' | 'processor' | 'logistics' | 'retailer' | 'consumer' | 'admin' | 'inspector';

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'manage';
  scope?: 'own' | 'organization' | 'all';
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: UserRole;
  organizationId?: string;
  profile?: Partial<UserProfile>;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  tokenType: 'Bearer';
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: AuthToken | null;
  permissions: Permission[];
  loading: boolean;
  error: string | null;
}

export interface LoginResponse {
  user: User;
  token: AuthToken;
  permissions: Permission[];
}