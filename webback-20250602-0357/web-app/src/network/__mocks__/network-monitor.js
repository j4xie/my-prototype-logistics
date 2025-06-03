// 模拟NetworkMonitor类
const NETWORK_STATES = {
  OFFLINE: 'offline',
  SLOW_2G: 'slow-2g',
  STANDARD_2G: '2g',
  STANDARD_3G: '3g',
  STANDARD_4G: '4g',
  WIFI: 'wifi',
  UNKNOWN: 'unknown'
};

class NetworkMonitor {
  constructor(options = {}) {
    this.options = options;
    this.currentState = options.initialState || NETWORK_STATES.WIFI;
    this.eventListeners = {};
    this.isMonitoring = false;
    this.latency = 0;
    this.bandwidth = 0;
    this.packetLoss = 0;
    this.updateNetworkMetrics();
  }

  start() {
    this.isMonitoring = true;
    return this;
  }

  stop() {
    this.isMonitoring = false;
    return this;
  }

  setNetworkState(state) {
    if (!Object.values(NETWORK_STATES).includes(state)) {
      throw new Error(`无效的网络状态: ${state}`);
    }
    
    const prevState = this.currentState;
    this.currentState = state;
    this.updateNetworkMetrics();
    
    this._dispatchEvent('network:change', {
      prevState, 
      currentState: state,
      latency: this.latency,
      bandwidth: this.bandwidth
    });
    
    return this;
  }

  updateNetworkMetrics() {
    // 根据不同网络状态设置模拟的网络指标
    switch(this.currentState) {
      case NETWORK_STATES.OFFLINE:
        this.latency = Infinity;
        this.bandwidth = 0;
        this.packetLoss = 1.0;
        break;
      case NETWORK_STATES.SLOW_2G:
        this.latency = 2000;
        this.bandwidth = 50 * 1024; // 50 Kbps
        this.packetLoss = 0.1;
        break;
      case NETWORK_STATES.STANDARD_2G:
        this.latency = 1000;
        this.bandwidth = 250 * 1024; // 250 Kbps
        this.packetLoss = 0.05;
        break;
      case NETWORK_STATES.STANDARD_3G:
        this.latency = 300;
        this.bandwidth = 1.5 * 1024 * 1024; // 1.5 Mbps
        this.packetLoss = 0.01;
        break;
      case NETWORK_STATES.STANDARD_4G:
        this.latency = 100;
        this.bandwidth = 10 * 1024 * 1024; // 10 Mbps
        this.packetLoss = 0.005;
        break;
      case NETWORK_STATES.WIFI:
        this.latency = 30;
        this.bandwidth = 50 * 1024 * 1024; // 50 Mbps
        this.packetLoss = 0.001;
        break;
      default:
        this.latency = 100;
        this.bandwidth = 5 * 1024 * 1024; // 5 Mbps
        this.packetLoss = 0.01;
    }
  }

  getCurrentState() {
    return {
      type: this.currentState,
      latency: this.latency,
      bandwidth: this.bandwidth,
      packetLoss: this.packetLoss
    };
  }

  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }

  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) return;
    this.eventListeners[event] = this.eventListeners[event].filter(cb => cb !== callback);
  }

  _dispatchEvent(event, data) {
    const listeners = this.eventListeners[event] || [];
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (e) {
        console.error(`事件处理器错误: ${e.message}`, e);
      }
    });
  }
}

module.exports = {
  NetworkMonitor,
  NETWORK_STATES
}; 