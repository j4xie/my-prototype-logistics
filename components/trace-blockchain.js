/**
 * @module traceBlockchain
 * @description 食品溯源系统 - 区块链溯源组件
 * @version 1.0.0
 * @author 食品溯源系统开发团队
 */

// 区块链配置
const blockchainConfig = {
  enabled: true,
  provider: 'ethereum', // 区块链提供商: ethereum, hyperledger, custom
  networkUrl: '', // 区块链网络地址，用于以太坊等公链
  contractAddress: '', // 智能合约地址
  apiKey: '', // API密钥（如适用）
  gasLimit: 3000000, // 燃料限制（仅以太坊）
  retryAttempts: 3, // 重试次数
  timeout: 30000, // 超时时间（毫秒）
  cacheEnabled: true, // 是否启用缓存
  cacheExpiry: 3600 // 缓存过期时间（秒）
};

// 区块链记录缓存
const recordsCache = {};

// 交易队列
const transactionQueue = [];

// 连接状态
let connectionStatus = {
  connected: false,
  provider: null,
  network: null,
  error: null,
  lastConnectAttempt: null
};

/**
 * 区块链溯源模块
 */
const traceBlockchain = {
  /**
   * 初始化区块链组件
   * @param {Object} options - 配置选项
   * @returns {Promise<boolean>} 初始化是否成功
   */
  async init(options = {}) {
    // 合并配置
    Object.assign(blockchainConfig, options);
    
    if (!blockchainConfig.enabled) {
      console.log('区块链功能已禁用');
      return false;
    }
    
    // 加载区块链提供商
    try {
      await this.loadProvider();
      return connectionStatus.connected;
    } catch (error) {
      console.error('区块链初始化失败:', error);
      connectionStatus.error = error.message;
      return false;
    }
  },
  
  /**
   * 加载区块链提供商
   * @returns {Promise<void>}
   */
  async loadProvider() {
    connectionStatus.lastConnectAttempt = Date.now();
    
    try {
      switch (blockchainConfig.provider) {
        case 'ethereum':
          await this.loadEthereumProvider();
          break;
        case 'hyperledger':
          await this.loadHyperledgerProvider();
          break;
        case 'custom':
          await this.loadCustomProvider();
          break;
        default:
          throw new Error(`不支持的区块链提供商: ${blockchainConfig.provider}`);
      }
      
      connectionStatus.connected = true;
      
    } catch (error) {
      connectionStatus.connected = false;
      connectionStatus.error = error.message;
      throw error;
    }
  },
  
  /**
   * 加载以太坊提供商
   * @returns {Promise<void>}
   */
  async loadEthereumProvider() {
    // 检查是否有Web3或ethers库
    if (typeof window.Web3 === 'undefined' && typeof window.ethers === 'undefined') {
      await this.loadScript('https://cdn.ethers.io/lib/ethers-5.0.umd.min.js');
    }
    
    // 优先使用ethers.js
    if (typeof window.ethers !== 'undefined') {
      try {
        let provider;
        
        // 使用指定的网络URL
        if (blockchainConfig.networkUrl) {
          provider = new ethers.providers.JsonRpcProvider(blockchainConfig.networkUrl);
        } 
        // 否则尝试连接MetaMask
        else if (window.ethereum) {
          provider = new ethers.providers.Web3Provider(window.ethereum);
          // 请求用户授权
          await window.ethereum.request({ method: 'eth_requestAccounts' });
        } else {
          throw new Error('未找到以太坊提供商');
        }
        
        // 获取网络信息
        const network = await provider.getNetwork();
        
        // 保存提供商和网络信息
        connectionStatus.provider = provider;
        connectionStatus.network = {
          name: network.name,
          chainId: network.chainId
        };
        
        // 如果有合约地址，创建合约实例
        if (blockchainConfig.contractAddress) {
          // 食品溯源智能合约ABI
          const foodTraceABI = [
            "function registerProduct(string productId, string metadata) public returns (bool)",
            "function addTraceRecord(string productId, string recordType, string metadata) public returns (bool)",
            "function getProduct(string productId) public view returns (string)",
            "function getTraceHistory(string productId) public view returns (string[])",
            "function verifyProduct(string productId, string metadata) public view returns (bool)"
          ];
          
          // 创建合约实例
          this.contract = new ethers.Contract(
            blockchainConfig.contractAddress,
            foodTraceABI,
            provider.getSigner()
          );
        }
        
      } catch (error) {
        console.error('以太坊提供商加载失败:', error);
        throw error;
      }
    } else if (typeof window.Web3 !== 'undefined') {
      // Web3回退选项
      try {
        let web3;
        
        if (window.ethereum) {
          web3 = new Web3(window.ethereum);
          await window.ethereum.enable();
        } else if (window.web3) {
          web3 = new Web3(window.web3.currentProvider);
        } else if (blockchainConfig.networkUrl) {
          web3 = new Web3(new Web3.providers.HttpProvider(blockchainConfig.networkUrl));
        } else {
          throw new Error('未找到Web3提供商');
        }
        
        // 保存提供商信息
        connectionStatus.provider = web3;
        connectionStatus.network = {
          name: await web3.eth.net.getNetworkType(),
          chainId: await web3.eth.getChainId()
        };
        
        // 如果有合约地址，创建合约实例
        if (blockchainConfig.contractAddress) {
          // 简化的ABI
          const abi = [/* 合约ABI */];
          this.contract = new web3.eth.Contract(abi, blockchainConfig.contractAddress);
        }
        
      } catch (error) {
        console.error('Web3提供商加载失败:', error);
        throw error;
      }
    } else {
      throw new Error('缺少以太坊库支持');
    }
  },
  
  /**
   * 加载Hyperledger Fabric提供商
   * @returns {Promise<void>}
   */
  async loadHyperledgerProvider() {
    // Hyperledger Fabric通常通过REST API与后端通信
    // 这里实现一个简单的HTTP客户端来与Fabric网关通信
    connectionStatus.provider = {
      type: 'hyperledger',
      baseUrl: blockchainConfig.networkUrl || '/api/blockchain',
      
      async request(endpoint, method = 'GET', data = null) {
        const url = this.baseUrl + endpoint;
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json'
          }
        };
        
        if (blockchainConfig.apiKey) {
          options.headers['X-API-Key'] = blockchainConfig.apiKey;
        }
        
        if (data) {
          options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`Hyperledger请求失败: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
      }
    };
    
    // 测试连接
    try {
      const status = await connectionStatus.provider.request('/status');
      connectionStatus.network = {
        name: status.network || 'hyperledger',
        version: status.version,
        peers: status.peers
      };
    } catch (error) {
      console.error('Hyperledger连接测试失败:', error);
      throw new Error('无法连接到Hyperledger网络');
    }
  },
  
  /**
   * 加载自定义区块链提供商
   * @returns {Promise<void>}
   */
  async loadCustomProvider() {
    // 自定义区块链实现，可以根据项目需求定制
    if (!blockchainConfig.networkUrl) {
      throw new Error('自定义区块链需要指定networkUrl');
    }
    
    // 简单的HTTP客户端
    connectionStatus.provider = {
      type: 'custom',
      baseUrl: blockchainConfig.networkUrl,
      
      async request(endpoint, method = 'GET', data = null) {
        const url = this.baseUrl + endpoint;
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json'
          }
        };
        
        if (blockchainConfig.apiKey) {
          options.headers['Authorization'] = `Bearer ${blockchainConfig.apiKey}`;
        }
        
        if (data) {
          options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`区块链请求失败: ${response.status} ${response.statusText}`);
        }
        
        return response.json();
      }
    };
    
    // 测试连接
    try {
      const status = await connectionStatus.provider.request('/status');
      connectionStatus.network = status;
    } catch (error) {
      console.error('自定义区块链连接测试失败:', error);
      throw new Error('无法连接到自定义区块链网络');
    }
  },
  
  /**
   * 加载外部脚本
   * @param {string} url - 脚本URL
   * @returns {Promise<void>}
   */
  loadScript(url) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = url;
      script.async = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`加载脚本失败: ${url}`));
      
      document.head.appendChild(script);
    });
  },
  
  /**
   * 获取连接状态
   * @returns {Object} 连接状态对象
   */
  getConnectionStatus() {
    return { ...connectionStatus };
  },
  
  /**
   * 重新连接区块链
   * @returns {Promise<boolean>} 是否重连成功
   */
  async reconnect() {
    try {
      await this.loadProvider();
      return connectionStatus.connected;
    } catch (error) {
      console.error('区块链重连失败:', error);
            return false;
        }
    },
  
  /**
   * 注册产品信息到区块链
   * @param {string} productId - 产品ID
   * @param {Object} productData - 产品数据
   * @returns {Promise<Object>} 交易结果
   */
  async registerProduct(productId, productData) {
    if (!connectionStatus.connected) {
      throw new Error('区块链未连接');
    }
    
    // 转换产品数据为JSON字符串
    const metadata = JSON.stringify(productData);
    
    try {
      let result;
      
      // 根据不同的区块链提供商执行注册
      switch (blockchainConfig.provider) {
        case 'ethereum':
          result = await this.registerProductEthereum(productId, metadata);
          break;
        case 'hyperledger':
        case 'custom':
          result = await this.registerProductREST(productId, metadata);
          break;
        default:
          throw new Error(`不支持的区块链提供商: ${blockchainConfig.provider}`);
      }
      
      console.log(`产品已注册到区块链: ${productId}`, result);
      return result;
      
    } catch (error) {
      console.error(`产品注册失败: ${productId}`, error);
      throw error;
    }
  },
  
  /**
   * 在以太坊上注册产品
   * @param {string} productId - 产品ID
   * @param {string} metadata - 产品元数据JSON字符串
   * @returns {Promise<Object>} 交易结果
   */
  async registerProductEthereum(productId, metadata) {
    if (!this.contract) {
      throw new Error('未初始化智能合约');
    }
    
    const tx = await this.contract.registerProduct(productId, metadata, {
      gasLimit: blockchainConfig.gasLimit
    });
    
    // 等待交易确认
    const receipt = await tx.wait();
    
    return {
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now()
    };
  },
  
  /**
   * 通过REST API注册产品
   * @param {string} productId - 产品ID
   * @param {string} metadata - 产品元数据JSON字符串
   * @returns {Promise<Object>} 交易结果
   */
  async registerProductREST(productId, metadata) {
    const provider = connectionStatus.provider;
    
    const response = await provider.request('/products', 'POST', {
      productId,
      metadata
    });
    
    return response;
  },
  
  /**
   * 添加追溯记录
   * @param {string} productId - 产品ID
   * @param {string} recordType - 记录类型（如"生产"、"加工"、"运输"、"销售"等）
   * @param {Object} recordData - 记录数据
   * @returns {Promise<Object>} 交易结果
   */
  async addTraceRecord(productId, recordType, recordData) {
    if (!connectionStatus.connected) {
      throw new Error('区块链未连接');
    }
    
    // 添加时间戳
    recordData.timestamp = recordData.timestamp || Date.now();
    
    // 转换记录数据为JSON字符串
    const metadata = JSON.stringify(recordData);
    
    try {
      let result;
      
      // 根据不同的区块链提供商执行
      switch (blockchainConfig.provider) {
        case 'ethereum':
          result = await this.addTraceRecordEthereum(productId, recordType, metadata);
          break;
        case 'hyperledger':
        case 'custom':
          result = await this.addTraceRecordREST(productId, recordType, metadata);
          break;
        default:
          throw new Error(`不支持的区块链提供商: ${blockchainConfig.provider}`);
      }
      
      console.log(`已添加追溯记录: ${productId} - ${recordType}`, result);
      
      // 清除缓存
      if (recordsCache[productId]) {
        delete recordsCache[productId];
      }
      
      return result;
      
    } catch (error) {
      console.error(`添加追溯记录失败: ${productId}`, error);
      
      // 如果遇到临时错误，添加到队列中稍后重试
      if (error.message.includes('网络') || error.message.includes('超时')) {
        this.queueTransaction({
          type: 'addTraceRecord',
          productId,
          recordType,
          recordData
        });
      }
      
      throw error;
    }
  },
  
  /**
   * 在以太坊上添加追溯记录
   * @param {string} productId - 产品ID
   * @param {string} recordType - 记录类型
   * @param {string} metadata - 记录元数据JSON字符串
   * @returns {Promise<Object>} 交易结果
   */
  async addTraceRecordEthereum(productId, recordType, metadata) {
    if (!this.contract) {
      throw new Error('未初始化智能合约');
    }
    
    const tx = await this.contract.addTraceRecord(productId, recordType, metadata, {
      gasLimit: blockchainConfig.gasLimit
    });
    
    // 等待交易确认
    const receipt = await tx.wait();
        
        return { 
            success: true, 
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber,
      timestamp: Date.now()
    };
  },
  
  /**
   * 通过REST API添加追溯记录
   * @param {string} productId - 产品ID
   * @param {string} recordType - 记录类型
   * @param {string} metadata - 记录元数据JSON字符串
   * @returns {Promise<Object>} 交易结果
   */
  async addTraceRecordREST(productId, recordType, metadata) {
    const provider = connectionStatus.provider;
    
    const response = await provider.request(`/products/${productId}/records`, 'POST', {
      recordType,
      metadata
    });
    
    return response;
  },
  
  /**
   * 获取产品追溯历史
   * @param {string} productId - 产品ID
   * @param {boolean} [useCache=true] - 是否使用缓存
   * @returns {Promise<Array>} 追溯记录数组
   */
  async getTraceHistory(productId, useCache = true) {
    if (!connectionStatus.connected) {
      throw new Error('区块链未连接');
    }
    
    // 检查缓存
    if (useCache && blockchainConfig.cacheEnabled && recordsCache[productId]) {
      const cacheEntry = recordsCache[productId];
      
      // 检查缓存是否过期
      if (Date.now() - cacheEntry.timestamp < blockchainConfig.cacheExpiry * 1000) {
        return cacheEntry.data;
      }
    }
    
    try {
      let history;
      
      // 根据不同的区块链提供商执行查询
      switch (blockchainConfig.provider) {
        case 'ethereum':
          history = await this.getTraceHistoryEthereum(productId);
          break;
        case 'hyperledger':
        case 'custom':
          history = await this.getTraceHistoryREST(productId);
          break;
        default:
          throw new Error(`不支持的区块链提供商: ${blockchainConfig.provider}`);
      }
      
      // 更新缓存
      if (blockchainConfig.cacheEnabled) {
        recordsCache[productId] = {
          data: history,
          timestamp: Date.now()
        };
      }
      
      return history;
      
    } catch (error) {
      console.error(`获取追溯历史失败: ${productId}`, error);
      throw error;
    }
  },
  
  /**
   * 从以太坊获取追溯历史
   * @param {string} productId - 产品ID
   * @returns {Promise<Array>} 追溯记录数组
   */
  async getTraceHistoryEthereum(productId) {
    if (!this.contract) {
      throw new Error('未初始化智能合约');
    }
    
    // 获取原始历史数据（字符串数组）
    const rawHistory = await this.contract.getTraceHistory(productId);
    
    // 解析每条记录
    return rawHistory.map(item => {
      try {
        return JSON.parse(item);
      } catch (e) {
        return { data: item, parseError: true };
      }
    });
  },
  
  /**
   * 通过REST API获取追溯历史
   * @param {string} productId - 产品ID
   * @returns {Promise<Array>} 追溯记录数组
   */
  async getTraceHistoryREST(productId) {
    const provider = connectionStatus.provider;
    
    const response = await provider.request(`/products/${productId}/history`, 'GET');
    
    return response.history || [];
  },
  
  /**
   * 验证产品真实性
   * @param {string} productId - 产品ID
   * @param {Object} verificationData - 验证数据
   * @returns {Promise<Object>} 验证结果
   */
  async verifyProduct(productId, verificationData) {
    if (!connectionStatus.connected) {
      throw new Error('区块链未连接');
    }
    
    try {
      let result;
      
      // 根据不同的区块链提供商执行验证
      switch (blockchainConfig.provider) {
        case 'ethereum':
          result = await this.verifyProductEthereum(productId, verificationData);
          break;
        case 'hyperledger':
        case 'custom':
          result = await this.verifyProductREST(productId, verificationData);
          break;
        default:
          throw new Error(`不支持的区块链提供商: ${blockchainConfig.provider}`);
      }
      
      return result;
      
    } catch (error) {
      console.error(`产品验证失败: ${productId}`, error);
      throw error;
    }
  },
  
  /**
   * 在以太坊上验证产品
   * @param {string} productId - 产品ID
   * @param {Object} verificationData - 验证数据
   * @returns {Promise<Object>} 验证结果
   */
  async verifyProductEthereum(productId, verificationData) {
    if (!this.contract) {
      throw new Error('未初始化智能合约');
    }
    
    const metadata = JSON.stringify(verificationData);
    
    // 调用智能合约验证方法
    const isVerified = await this.contract.verifyProduct(productId, metadata);
    
    return {
      verified: isVerified,
      productId,
      timestamp: Date.now()
    };
  },
  
  /**
   * 通过REST API验证产品
   * @param {string} productId - 产品ID
   * @param {Object} verificationData - 验证数据
   * @returns {Promise<Object>} 验证结果
   */
  async verifyProductREST(productId, verificationData) {
    const provider = connectionStatus.provider;
    
    const response = await provider.request(`/products/${productId}/verify`, 'POST', verificationData);
    
    return response;
  },
  
  /**
   * 将交易加入队列（用于失败重试）
   * @param {Object} transaction - 交易对象
   */
  queueTransaction(transaction) {
    transaction.addedAt = Date.now();
    transaction.attempts = 0;
    
    transactionQueue.push(transaction);
    
    // 如果队列中只有一个交易，启动处理
    if (transactionQueue.length === 1) {
      this.processTransactionQueue();
    }
  },
  
  /**
   * 处理交易队列
   */
  async processTransactionQueue() {
    if (transactionQueue.length === 0) {
      return;
    }
    
    // 获取队列中的第一个交易
    const transaction = transactionQueue[0];
    
    // 已经尝试次数过多，从队列中移除
    if (transaction.attempts >= blockchainConfig.retryAttempts) {
      console.error('交易重试次数过多，放弃执行:', transaction);
      transactionQueue.shift();
      
      // 处理下一个交易
      this.processTransactionQueue();
      return;
    }
    
    // 增加尝试次数
    transaction.attempts++;
    
    try {
      // 根据交易类型执行相应操作
      switch (transaction.type) {
        case 'addTraceRecord':
          await this.addTraceRecord(
            transaction.productId,
            transaction.recordType,
            transaction.recordData
          );
          break;
        case 'registerProduct':
          await this.registerProduct(
            transaction.productId,
            transaction.productData
          );
          break;
        default:
          console.error('未知的交易类型:', transaction.type);
      }
      
      // 交易成功，从队列中移除
      transactionQueue.shift();
      
    } catch (error) {
      console.error(`队列交易执行失败 (${transaction.attempts}/${blockchainConfig.retryAttempts}):`, error);
      
      // 延迟重试
      setTimeout(() => {
        this.processTransactionQueue();
      }, 5000 * transaction.attempts); // 每次重试间隔增加
      
        return;
    }
    
    // 处理下一个交易
    this.processTransactionQueue();
  },
  
  /**
   * 清除数据缓存
   */
  clearCache() {
    Object.keys(recordsCache).forEach(key => {
      delete recordsCache[key];
    });
  },
  
  /**
   * 获取区块链事件（交易历史）
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 事件数组
   */
  async getEvents(filters = {}) {
    if (!connectionStatus.connected) {
      throw new Error('区块链未连接');
    }
    
    try {
      let events;
      
      // 根据不同的区块链提供商执行查询
      switch (blockchainConfig.provider) {
        case 'ethereum':
          events = await this.getEventsEthereum(filters);
          break;
        case 'hyperledger':
        case 'custom':
          events = await this.getEventsREST(filters);
          break;
        default:
          throw new Error(`不支持的区块链提供商: ${blockchainConfig.provider}`);
      }
      
      return events;
      
    } catch (error) {
      console.error('获取区块链事件失败:', error);
      throw error;
    }
  },
  
  /**
   * 从以太坊获取事件
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 事件数组
   */
  async getEventsEthereum(filters = {}) {
    if (!this.contract) {
      throw new Error('未初始化智能合约');
    }
    
    // 构建过滤器
    const filterOptions = {};
    
    if (filters.fromBlock) {
      filterOptions.fromBlock = filters.fromBlock;
    }
    
    if (filters.toBlock) {
      filterOptions.toBlock = filters.toBlock;
    }
    
    // 获取所有事件
    const events = await this.contract.queryFilter('*', filterOptions.fromBlock, filterOptions.toBlock);
    
    // 格式化事件数据
    return events.map(event => ({
      transactionHash: event.transactionHash,
      blockNumber: event.blockNumber,
      event: event.event,
      args: event.args,
      timestamp: Date.now() // 注意：区块链事件本身不包含时间戳，这里使用当前时间
    }));
  },
  
  /**
   * 通过REST API获取事件
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array>} 事件数组
   */
  async getEventsREST(filters = {}) {
    const provider = connectionStatus.provider;
    
    const queryParams = new URLSearchParams();
    
    if (filters.fromBlock) {
      queryParams.append('fromBlock', filters.fromBlock);
    }
    
    if (filters.toBlock) {
      queryParams.append('toBlock', filters.toBlock);
    }
    
    if (filters.eventType) {
      queryParams.append('eventType', filters.eventType);
    }
    
    if (filters.productId) {
      queryParams.append('productId', filters.productId);
    }
    
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    
    const response = await provider.request(`/events${queryString}`, 'GET');
    
    return response.events || [];
  }
};

// 导出模块
window.traceBlockchain = traceBlockchain;

// 如果定义了模块系统，也通过模块系统导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = traceBlockchain;
} else if (typeof define === 'function' && define.amd) {
  define([], function() { return traceBlockchain; });
} 