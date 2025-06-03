// 数据存储管理
export class TraceStore {
    static data = new Map();

    static set(key, value) {
        this.data.set(key, value);
    }

    static get(key) {
        return this.data.get(key);
    }

    static remove(key) {
        this.data.delete(key);
    }

    static clear() {
        this.data.clear();
    }
} 