import { useCallback } from 'react';

export const useErrorHandler = () => {
  const handleError = useCallback((
    error: unknown,
    context: string,
    showAlert: boolean = true
  ) => {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error(`${context}失败:`, error);
    
    if (showAlert) {
      alert(`${context}失败: ${errorMessage}`);
    }
    
    return errorMessage;
  }, []);

  const handleAsyncError = useCallback(async (
    asyncFn: () => Promise<any>,
    context: string,
    onSuccess?: (result: any) => void,
    onError?: (error: string) => void
  ) => {
    try {
      const result = await asyncFn();
      onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = handleError(error, context);
      onError?.(errorMessage);
      throw error;
    }
  }, [handleError]);

  return {
    handleError,
    handleAsyncError
  };
};