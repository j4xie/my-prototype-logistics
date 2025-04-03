// 数据导入处理
import { TraceErrorHandler } from './trace-error-handler.js';
import { TraceStore } from './trace-store.js';

export class TraceDataImport {
    static async importData(file) {
        try {
            const data = await this.readFile(file);
            TraceStore.set('importedData', data);
            return data;
        } catch (error) {
            TraceErrorHandler.handleError(error, 'DataImport');
            throw error;
        }
    }

    static async readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }
} 