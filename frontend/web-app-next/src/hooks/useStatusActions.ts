import { useState } from 'react';

interface StatusActionConfig {
  itemType: string; // '工厂'、'员工'、'白名单记录'
  confirmMessages?: {
    activate?: string;
    suspend?: string;
    delete?: string;
  };
}

export const useStatusActions = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleStatusToggle = async (
    id: string,
    currentStatus: string,
    config: StatusActionConfig,
    apiCall: (id: string, ...args: any[]) => Promise<any>,
    onSuccess?: () => void,
    ...apiArgs: any[]
  ) => {
    const isActive = currentStatus === 'active';
    const action = isActive ? '暂停' : '激活';
    const defaultMessage = `确定要${action}该${config.itemType}吗？`;
    
    const confirmMessage = isActive 
      ? (config.confirmMessages?.suspend || defaultMessage)
      : (config.confirmMessages?.activate || defaultMessage);

    if (!confirm(confirmMessage)) return;

    try {
      setIsLoading(true);
      await apiCall(id, ...apiArgs);
      onSuccess?.();
    } catch (error) {
      console.error(`${action}${config.itemType}失败:`, error);
      alert(`${action}失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (
    id: string,
    identifier: string,
    config: StatusActionConfig,
    apiCall: (id: string) => Promise<any>,
    onSuccess?: () => void
  ) => {
    const confirmMessage = config.confirmMessages?.delete || 
      `确定要删除${config.itemType} "${identifier}" 吗？此操作不可撤销。`;

    if (!confirm(confirmMessage)) return;

    try {
      setIsLoading(true);
      await apiCall(id);
      onSuccess?.();
    } catch (error) {
      console.error(`删除${config.itemType}失败:`, error);
      alert(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBatchDelete = async (
    selectedIds: string[],
    config: StatusActionConfig,
    apiCall: (ids: string[]) => Promise<any>,
    onSuccess?: () => void
  ) => {
    if (selectedIds.length === 0) {
      alert('请先选择要删除的项目');
      return;
    }

    if (!confirm(`确定要删除选中的 ${selectedIds.length} 个${config.itemType}吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setIsLoading(true);
      await apiCall(selectedIds);
      onSuccess?.();
    } catch (error) {
      console.error(`批量删除${config.itemType}失败:`, error);
      alert(`批量删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    handleStatusToggle,
    handleDelete,
    handleBatchDelete,
    isLoading
  };
};