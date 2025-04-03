// 错误处理器
export class TraceErrorHandler {
    static handleError(error, context = '') {
        console.error(`[${context}] Error:`, error);
        // 可以在这里添加更多错误处理逻辑
    }

    static showErrorMessage(message) {
        // 显示错误消息给用户
        alert(message);
    }
} 