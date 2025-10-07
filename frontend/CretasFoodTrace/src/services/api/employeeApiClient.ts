import { apiClient } from './apiClient';

export interface Employee {
  id: number;
  username: string;
  fullName: string;
  department?: string;
  roleCode?: string;
}

export const employeeAPI = {
  getEmployees: async (params?: { department?: string }): Promise<Employee[]> => {
    const response: any = await apiClient.get('/api/mobile/employees', { params });
    return response.data || response || [];
  },
};
