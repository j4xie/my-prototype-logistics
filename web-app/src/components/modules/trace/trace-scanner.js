/**
 * @module traceScanner
 * @description 食品溯源系统 - 扫码识别组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 扫描配置
const scannerConfig = {
  enabled: true,
  supportedFormats: ['qr', 'barcode', 'datamatrix'],
  preferFrontCamera: false,
  scanInterval: 500, // 毫秒
  highlightScanResult: true,
  beepOnSuccess: true,
  vibrateOnSuccess: true,
  autostart: false,
  timeout: 30000, // 扫描超时时间（毫秒）
  constraintsVideo: {
    facingMode: 'environment' // 默认使用后置摄像头
  }
};

// 扫描器状态
let scannerState = {
  initialized: false,
  scanning: false,
  lastScan: null,
  activeCamera: null,
  availableCameras: [],
  errorMessage: null
};

// 当前解码器实例
let decoder = null;

// 视频元素
let videoElement = null;

// 扫描区域画布
let canvasElement = null;
let canvasContext = null;

// 回调函数
let successCallback = null;
let errorCallback = null;

/**
 * 扫码识别模块
 */
const traceScanner = {
  /**
   * 初始化扫码组件
   * @param {Object} options - 配置选项
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init(options = {}) {
    try {
      // 合并配置
      Object.assign(scannerConfig, options);
      
      // 检查浏览器兼容性
      if (!this.checkBrowserCompatibility()) {
        throw new Error('当前浏览器不支持扫描功能');
      }
      
      // 获取可用相机列表
      await this.getAvailableCameras();
      
      scannerState.initialized = true;
      console.log('扫码组件初始化成功');
      
      return true;
    } catch (error) {
      console.error('扫码组件初始化失败:', error);
      scannerState.errorMessage = error.message;
      return false;
    }
  },
  
  /**
   * 检查浏览器兼容性
   * @returns {boolean} 是否兼容
   */
  checkBrowserCompatibility() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  },
  
  /**
   * 获取可用相机列表
   * @returns {Promise<Array>} 相机列表
   */
  async getAvailableCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error('浏览器不支持相机枚举');
      }
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      scannerState.availableCameras = cameras.map(camera => ({
        id: camera.deviceId,
        label: camera.label || `相机 ${camera.deviceId.substring(0, 4)}...`
      }));
      
      return scannerState.availableCameras;
    } catch (error) {
      console.error('获取相机列表失败:', error);
      scannerState.errorMessage = error.message;
      return [];
    }
  },
  
  /**
   * 创建扫描UI
   * @param {string} containerId - 容器元素ID
   * @returns {Object} 扫描器DOM元素
   */
  createScannerUI(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`找不到指定的容器: ${containerId}`);
    }
    
    // 创建扫描器容器
    const scannerContainer = document.createElement('div');
    scannerContainer.className = 'trace-scanner-container';
    scannerContainer.style.cssText = 'position: relative; width: 100%; height: 100%;';
    
    // 创建视频元素
    videoElement = document.createElement('video');
    videoElement.className = 'trace-scanner-video';
    videoElement.setAttribute('playsinline', 'true'); // 在iOS上必须
    videoElement.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
    
    // 创建扫描区域画布
    canvasElement = document.createElement('canvas');
    canvasElement.className = 'trace-scanner-canvas';
    canvasElement.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%;';
    canvasContext = canvasElement.getContext('2d');
    
    // 创建扫描框
    const scanFrame = document.createElement('div');
    scanFrame.className = 'trace-scanner-frame';
    scanFrame.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 80%;
      height: 60%;
      border: 2px solid #ffffff;
      border-radius: 10px;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    `;
    
    // 创建角落标记
    const corners = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    corners.forEach(corner => {
      const cornerEl = document.createElement('div');
      cornerEl.className = `trace-scanner-corner ${corner}`;
      
      const [vertical, horizontal] = corner.split('-');
      cornerEl.style.cssText = `
        position: absolute;
        width: 20px;
        height: 20px;
        border-${vertical}: 4px solid #2196F3;
        border-${horizontal}: 4px solid #2196F3;
        ${vertical}: -2px;
        ${horizontal}: -2px;
      `;
      
      scanFrame.appendChild(cornerEl);
    });
    
    // 创建扫描线
    const scanLine = document.createElement('div');
    scanLine.className = 'trace-scanner-line';
    scanLine.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(to right, transparent, #2196F3, transparent);
      animation: scan-line 2s infinite linear;
    `;
    
    // 添加样式
    const style = document.createElement('style');
    style.textContent = `
      @keyframes scan-line {
        0% { top: 5%; }
        50% { top: 95%; }
        100% { top: 5%; }
      }
    `;
    document.head.appendChild(style);
    
    // 创建控制按钮
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'trace-scanner-controls';
    controlsContainer.style.cssText = `
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      gap: 20px;
    `;
    
    // 切换相机按钮
    const switchCameraBtn = document.createElement('button');
    switchCameraBtn.className = 'trace-scanner-btn switch-camera';
    switchCameraBtn.textContent = '切换相机';
    switchCameraBtn.style.cssText = `
      background: rgba(33, 150, 243, 0.7);
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
    `;
    switchCameraBtn.onclick = () => this.switchCamera();
    
    // 关闭扫描按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'trace-scanner-btn close';
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = `
      background: rgba(244, 67, 54, 0.7);
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
    `;
    closeBtn.onclick = () => this.stopScanner();
    
    // 组装UI
    scanFrame.appendChild(scanLine);
    controlsContainer.appendChild(switchCameraBtn);
    controlsContainer.appendChild(closeBtn);
    
    scannerContainer.appendChild(videoElement);
    scannerContainer.appendChild(canvasElement);
    scannerContainer.appendChild(scanFrame);
    scannerContainer.appendChild(controlsContainer);
    
    container.innerHTML = '';
    container.appendChild(scannerContainer);
    
    return {
      container: scannerContainer,
      video: videoElement,
      canvas: canvasElement,
      frame: scanFrame,
      controls: controlsContainer
    };
  },
  
  /**
   * 开始扫描
   * @param {string} containerId - 容器元素ID
   * @param {Function} onSuccess - 成功回调
   * @param {Function} onError - 错误回调
   */
  startScanner(containerId, onSuccess, onError) {
    if (!scannerState.initialized) {
      if (onError) onError(new Error('扫码组件未初始化'));
      return;
    }
    
    successCallback = onSuccess;
    errorCallback = onError;
    
    try {
      // 创建UI
      this.createScannerUI(containerId);
      
      // 加载相机
      this.startCamera();
      
    } catch (error) {
      console.error('启动扫描器失败:', error);
      if (errorCallback) errorCallback(error);
    }
  },
  
  /**
   * 启动相机
   */
  async startCamera() {
    try {
      // 停止任何现有流
      if (videoElement.srcObject) {
        const tracks = videoElement.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
      
      // 设置相机约束
      const constraints = {
        video: {
          ...scannerConfig.constraintsVideo
        },
        audio: false
      };
      
      // 如果有指定相机，使用指定相机
      if (scannerState.activeCamera) {
        constraints.video.deviceId = { exact: scannerState.activeCamera.id };
      } else if (scannerConfig.preferFrontCamera) {
        constraints.video.facingMode = 'user';
      }
      
      // 获取媒体流
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = stream;
      
      // 更新活动相机信息
      const videoTrack = stream.getVideoTracks()[0];
      scannerState.activeCamera = {
        id: videoTrack.getSettings().deviceId,
        label: videoTrack.label
      };
      
      // 视频准备好后开始扫描
      videoElement.onloadedmetadata = () => {
        videoElement.play();
        scannerState.scanning = true;
        
        // 设置画布尺寸匹配视频
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;
        
        // 开始扫描循环
        this.scanFrame();
      };
      
    } catch (error) {
      console.error('启动相机失败:', error);
      scannerState.errorMessage = error.message;
      if (errorCallback) errorCallback(error);
    }
  },
  
  /**
   * 扫描帧
   */
  scanFrame() {
    if (!scannerState.scanning) return;
    
    try {
      // 检查视频是否准备好
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        // 绘制视频帧到画布
        canvasContext.drawImage(
          videoElement,
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        // 获取图像数据
        const imageData = canvasContext.getImageData(
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        // 解码图像
        this.decodeImage(imageData);
      }
      
      // 计划下一帧
      setTimeout(() => this.scanFrame(), scannerConfig.scanInterval);
      
    } catch (error) {
      console.error('扫描帧失败:', error);
      scannerState.errorMessage = error.message;
    }
  },
  
  /**
   * 解码图像
   * @param {ImageData} imageData - 图像数据
   */
  decodeImage(imageData) {
    // 在实际项目中，这里会集成具体的解码库，例如jsQR、zxing-js或quagga
    // 目前使用模拟实现
    
    // TODO: 集成实际的解码库
    // 模拟解码成功（仅作演示）
    if (Math.random() < 0.005) { // 小概率模拟扫描成功
      const mockResult = {
        text: `TRACE-${Math.floor(Math.random() * 1000000)}`,
        format: scannerConfig.supportedFormats[
          Math.floor(Math.random() * scannerConfig.supportedFormats.length)
        ]
      };
      
      this.onScanSuccess(mockResult);
    }
  },
  
  /**
   * 扫描成功处理
   * @param {Object} result - 扫描结果
   */
  onScanSuccess(result) {
    // 更新状态
    scannerState.lastScan = {
      content: result.text,
      format: result.format,
      timestamp: Date.now()
    };
    
    // 高亮扫描结果
    if (scannerConfig.highlightScanResult) {
      this.highlightResult(result);
    }
    
    // 播放成功音效
    if (scannerConfig.beepOnSuccess) {
      this.playBeep();
    }
    
    // 震动
    if (scannerConfig.vibrateOnSuccess && navigator.vibrate) {
      navigator.vibrate(300);
    }
    
    // 回调
    if (successCallback) {
      successCallback(scannerState.lastScan);
    }
    
    // 自动停止扫描
    this.stopScanner();
  },
  
  /**
   * 高亮扫描结果
   * @param {Object} result - 扫描结果
   */
  highlightResult(result) {
    // 在实际实现中，这里会绘制出码的位置
    // 现在仅作简单的视觉反馈
    canvasContext.strokeStyle = '#00FF00';
    canvasContext.lineWidth = 5;
    
    // 绘制一个框来模拟高亮效果
    const centerX = canvasElement.width / 2;
    const centerY = canvasElement.height / 2;
    const size = Math.min(canvasElement.width, canvasElement.height) * 0.6;
    
    canvasContext.strokeRect(
      centerX - size/2,
      centerY - size/2,
      size,
      size
    );
  },
  
  /**
   * 播放提示音
   */
  playBeep() {
    const beep = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI5LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAAeAAAmTgAICg0PERMWGBodHyEkJikrLjAzNTg6PUBCRUhKTVBSVVdaXF9iZGdpbG9xdHZ5fH6BhIaJjI6RlJaZnJ6hpKaprK6xtLa5vL7BxMbJzM7R09bY293g4uXn6uzu8fP29/r9AAAAFExhdmM1OC41NC4xMDAAAAAAAAAAAAAAAP/7kGQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEluZm8AAAAPAAAAHgAAJk4ACAoNDxETFhgaHR8hJCYpKy4wMzU4Oj1AQkVISlNQUlVXWlxfYmRnaWxvcXR2eXx+gYSGiYyOkZSWmZyeoaSmqayusbS2uby+wcTGyczO0dPW2Nrd4OLl5+rs7vHz9vf6/QAAAERhdGF4/+xAxAAAgEABn/AAA4CQACAwAABgIAAAMDc3NwACAAAADAzMwAAAAADMzMAAADem9S116nUdQBhGkYBbBTBQDBUAwMAUDDlAwJAsE0DAbA5HAaA2JQ8HwKhKMiuJxGGYWfBnLxcL4uGwmi2XTAYjcWBaUTckhYGheGAg9VMpQxkWDUXTKYRcLhYAACiR0UjiajQajibjcXQuLQxOJwLA0FAIKguEwrEAtkMjC0Ow1CwUIYwGIvIYQhoKAYWA0MBzCpBKYvEYoFAACEzF40EAUCkOTMYi4TDGTxKJRRLhYKJSPJmOA0FU0HIaCKXCmMQ+IhQKpFLRSPJlLZhIZeJYwiBqFU1lM0mQAEECBrKZLlRVMAAJAAARQAAVBIRk4YCuG48IEcOhVQgLRmS+n+RRfChAe0zSdBR9yiKvBGLkzRyZJdC9fJZFLRaC0AySTqzLtChYrZdAYrZlEoVLQVReSYaEwXgaWpcEsvQyWIZEoZDQeCYOQ0GoumQzl08lopDQQS4URiN5lFZFicLB0VsrFxeP4tnc6ms7iYsHQXCkrMwnM8mo0Gg5i4WCgVlBYIRESyETQvFxGPRWMzMWDwVi4ZC6ZRKLBeGIziQYyqVyGRhSAwqIAmFYnmk3GgrFAtKp0SxKIRMUCuZCgUlIuJBNKBKGpCGYnmY2l0tlAtEIohVDk6AQrJhcMJjK5kF5OLxgQTcWj4aT4Wi+fEg7OBrOKDJJpPhlOySZkM0GotGoylUsCyWxQKRlNJuORWMhkLhwNZtMxQKRgNBYGpLJxoMJMKRYKpFIAvFIwJpVNpQMhvKxNMJXKQrEkhGQomlLMRSNBIMxWFJrLRYUlsvGQuGBDLxiTzEiCcYzMZDAYCgUCoSDkXjAYCyRRWNiCcDIYjEai8YDIXDQZjcYkYwE8pEYpi6bDAZDgajgeTMdE5SN6IfjEmlQxFA2IqSklQzm4SZg');
    beep.play();
  },
  
  /**
   * 切换相机
   */
  async switchCamera() {
    if (scannerState.availableCameras.length <= 1) {
      if (traceUI && traceUI.showToast) {
        traceUI.showToast('没有其他可用相机', 'info', 2000);
      }
      return;
    }
    
    // 找到当前相机的索引
    const currentIndex = scannerState.availableCameras.findIndex(
      camera => camera.id === scannerState.activeCamera.id
    );
    
    // 切换到下一个相机
    const nextIndex = (currentIndex + 1) % scannerState.availableCameras.length;
    scannerState.activeCamera = scannerState.availableCameras[nextIndex];
    
    // 重启相机
    await this.startCamera();
  },
  
  /**
   * 停止扫描器
   */
  stopScanner() {
    scannerState.scanning = false;
    
    // 停止视频流
    if (videoElement && videoElement.srcObject) {
      const tracks = videoElement.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoElement.srcObject = null;
    }
    
    // 清除视频元素
    videoElement = null;
    canvasElement = null;
    canvasContext = null;
  },
  
  /**
   * 获取扫描结果
   * @returns {Object|null} 最后的扫描结果
   */
  getLastScanResult() {
    return scannerState.lastScan;
  },
  
  /**
   * 解析溯源码
   * @param {string} code - 溯源码
   * @returns {Object} 解析结果
   */
  parseTraceCode(code) {
    try {
      // 检查是否是JSON格式
      if (code.startsWith('{') && code.endsWith('}')) {
        return JSON.parse(code);
      }
      
      // 检查是否是URL格式
      if (code.startsWith('http')) {
        const url = new URL(code);
        const params = {};
        
        // 解析查询参数
        for (const [key, value] of url.searchParams) {
          params[key] = value;
        }
        
        return {
          type: 'url',
          url: code,
          baseUrl: `${url.protocol}//${url.host}${url.pathname}`,
          params
        };
      }
      
      // 检查是否是特定格式的溯源码
      if (code.startsWith('TRACE-')) {
        const parts = code.split('-');
        
        return {
          type: 'trace',
          id: parts[1],
          additionalData: parts.slice(2)
        };
      }
      
      // 其他格式
      return {
        type: 'unknown',
        raw: code
      };
    } catch (error) {
      console.error('解析溯源码失败:', error);
      return {
        type: 'error',
        raw: code,
        error: error.message
      };
    }
  },
  
  /**
   * 获取扫描器状态
   * @returns {Object} 扫描器状态
   */
  getStatus() {
    return { ...scannerState };
  }
};

// 导出模块
window.traceScanner = traceScanner;

// 如果定义了模块系统，也通过模块系统导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = traceScanner;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return traceScanner; });
} 