import { apiClient } from './apiClient';
import { requireFactoryId } from '../../utils/factoryIdHelper';

// ========== Types ==========

export interface ProcessTaskItem {
  id: string;
  factoryId: string;
  productTypeId: string;
  productTypeName?: string;
  workProcessId: string;
  processName?: string;
  processCategory?: string;
  unit: string;
  productionRunId?: string;
  sourceDocType?: string;
  sourceDocId?: string;
  plannedQuantity: number;
  completedQuantity: number;
  pendingQuantity: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'SUPPLEMENTING';
  assignedWorkerIds?: string;
  workflowVersionId?: string;
  previousTerminalStatus?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcessTaskSummary {
  task?: ProcessTaskItem;
  // Backend returns flat shape — task fields at top level
  taskId?: string;
  id?: string;
  processName?: string;
  productName?: string;
  productTypeName?: string;
  processCategory?: string;
  plannedQuantity?: number;
  completedQuantity?: number;
  pendingQuantity?: number;
  unit?: string;
  status?: string;
  productionRunId?: string;
  totalReported?: number;
  approvedTotal?: number;
  pendingTotal?: number;
  rejectedTotal?: number;
  workerCount?: number;
  totalWorkers?: number;
  totalReports?: number;
}

export interface WorkerSummary {
  workerId: number;
  workerName: string;
  totalQuantity: number;
  approvedQuantity: number;
  pendingQuantity: number;
  reportCount: number;
}

export interface RunOverview {
  productionRunId: string;
  tasks: ProcessTaskItem[];
  overallProgress: number;
  completedTasks: number;
  totalTasks: number;
}

export interface ProcessReportItem {
  id: number;
  processTaskId: string;
  reportDate: string;
  processCategory?: string;
  outputQuantity: number;
  reporterName?: string;
  isSupplemental: boolean;
  approvalStatus: string;
  approvedBy?: number;
  approvedAt?: string;
  rejectedReason?: string;
  reversalOfId?: number;
  createdAt?: string;
}

export interface ApprovalItem {
  id: number;
  reporterName: string;
  reportDate: string;
  processCategory: string;
  outputQuantity: number;
  isSupplemental: boolean;
  processTaskId: string;
}

// ========== API Client ==========

class ProcessTaskApiClient {
  private getBase(factoryId?: string) {
    const fid = factoryId || requireFactoryId();
    return `/api/mobile/${fid}`;
  }

  // --- Process Tasks ---

  async getActiveTasks(factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-tasks/active`);
  }

  async getTasks(params: { status?: string; productTypeId?: string; page?: number; size?: number }, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-tasks`, { params });
  }

  async getTaskById(taskId: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-tasks/${taskId}`);
  }

  async getTaskSummary(taskId: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-tasks/${taskId}/summary`);
  }

  async getRunOverview(productionRunId: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-tasks/run/${productionRunId}`);
  }

  async updateTaskStatus(taskId: string, status: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.put(`${base}/process-tasks/${taskId}/status`, { status });
  }

  // --- Work Reporting (Process Mode) ---

  async getPendingApprovals(params: { page?: number; size?: number } = {}, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-work-reporting/pending-approval`, { params });
  }

  async approveReport(reportId: number, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.put(`${base}/process-work-reporting/${reportId}/approve`);
  }

  async rejectReport(reportId: number, reason: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.put(`${base}/process-work-reporting/${reportId}/reject`, { reason });
  }

  async batchApprove(reportIds: number[], factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.put(`${base}/process-work-reporting/batch-approve`, reportIds);
  }

  async submitNormalReport(data: { processTaskId: string; outputQuantity: number; reporterName?: string; notes?: string }, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.post(`${base}/process-work-reporting/normal`, data);
  }

  async submitSupplement(data: { processTaskId: string; outputQuantity: number; reporterName?: string; processCategory?: string; notes?: string }, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.post(`${base}/process-work-reporting/supplement`, data);
  }

  async getReportsByTask(taskId: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-work-reporting/by-task/${taskId}`);
  }

  async getWorkersByTask(taskId: string, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-work-reporting/by-task/${taskId}/workers`);
  }

  // --- Process Checkin (工序模式签到) ---

  async processCheckin(data: { employeeId: number; processName?: string; processCategory?: string; checkinMethod?: string }, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.post(`${base}/process-checkin`, data);
  }

  async processCheckout(checkinRecordId: number, factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.post(`${base}/process-checkin/checkout/${checkinRecordId}`);
  }

  async getActiveCheckins(factoryId?: string) {
    const base = this.getBase(factoryId);
    return apiClient.get(`${base}/process-checkin/active`);
  }
}

export const processTaskApiClient = new ProcessTaskApiClient();
