/**
 * 食品溯源系统 - 区块链验证组件
 * 提供数据上链、验证和可视化功能
 */

// UPDATED CODE: 使用ES模块方式导出，移除自执行函数
// 配置
const config = {
    chainName: '食品溯源链',
    algorithm: 'SHA-256', // 哈希算法
    difficulty: 4, // 工作量证明难度（前导0的个数）
    blockTime: 5000, // 模拟出块时间（毫秒）
    enabled: true // 是否启用区块链功能
};

// 简化的区块结构
class Block {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash();
        this.nonce = 0;
    }
    
    // 计算区块哈希
    calculateHash() {
        // 在实际应用中应使用真正的加密库如crypto-js
        return hashData(
            this.index + 
            this.timestamp + 
            JSON.stringify(this.data) + 
            this.previousHash + 
            this.nonce
        );
    }
    
    // 工作量证明
    mineBlock(difficulty) {
        const target = Array(difficulty + 1).join('0');
        
        while (this.hash.substring(0, difficulty) !== target) {
            this.nonce++;
            this.hash = this.calculateHash();
        }
        
        console.log(`区块 #${this.index} 已挖掘: ${this.hash}`);
    }
}

// 简化的区块链
class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
        this.difficulty = config.difficulty;
        this.pendingTransactions = [];
    }
    
    // 创建创世区块
    createGenesisBlock() {
        return new Block(0, Date.now(), { 
            message: "创世区块", 
            system: "食品溯源系统", 
            version: "1.0.0" 
        }, "0");
    }
    
    // 获取最新区块
    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }
    
    // 添加新交易到待处理队列
    addTransaction(transaction) {
        // 验证交易结构
        if (!transaction.traceId || !transaction.data) {
            throw new Error('交易缺少必要字段');
        }
        
        // 添加交易到待处理队列
        this.pendingTransactions.push({
            ...transaction,
            timestamp: Date.now(),
            status: 'pending'
        });
        
        return this.pendingTransactions.length - 1;
    }
    
    // 挖掘待处理交易（创建新区块）
    minePendingTransactions() {
        if (this.pendingTransactions.length === 0) {
            console.log('没有待处理交易，跳过挖矿');
            return null;
        }
        
        // 创建新区块
        const block = new Block(
            this.chain.length,
            Date.now(),
            this.pendingTransactions,
            this.getLatestBlock().hash
        );
        
        // 挖矿（工作量证明）
        block.mineBlock(this.difficulty);
        
        // 将新区块添加到链上
        this.chain.push(block);
        
        // 清空待处理交易并返回新区块
        const processedTransactions = [...this.pendingTransactions];
        this.pendingTransactions = [];
        
        return {
            block,
            transactions: processedTransactions
        };
    }
    
    // 验证链的完整性
    isChainValid() {
        for (let i = 1; i < this.chain.length; i++) {
            const currentBlock = this.chain[i];
            const previousBlock = this.chain[i - 1];
            
            // 验证当前区块的哈希是否正确
            if (currentBlock.hash !== currentBlock.calculateHash()) {
                console.log(`区块 #${currentBlock.index} 哈希无效`);
                return false;
            }
            
            // 验证当前区块的previousHash是否指向前一个区块的哈希
            if (currentBlock.previousHash !== previousBlock.hash) {
                console.log(`区块 #${currentBlock.index} 与前一个区块的链接无效`);
                return false;
            }
        }
        
        return true;
    }
    
    // 查找溯源记录的所有交易
    findTraceTransactions(traceId) {
        const transactions = [];
        
        // 搜索所有区块
        for (const block of this.chain) {
            if (Array.isArray(block.data)) {
                // 找到该traceId的所有交易
                const found = block.data.filter(tx => tx.traceId === traceId);
                if (found.length > 0) {
                    transactions.push(...found.map(tx => ({
                        ...tx,
                        blockIndex: block.index,
                        blockHash: block.hash,
                        verified: true
                    })));
                }
            }
        }
        
        // 搜索待处理交易
        const pendingTx = this.pendingTransactions.filter(tx => tx.traceId === traceId);
        if (pendingTx.length > 0) {
            transactions.push(...pendingTx.map(tx => ({
                ...tx,
                verified: false,
                status: 'pending'
            })));
        }
        
        return transactions;
    }
    
    // 获取溯源记录的验证状态
    getTraceVerificationStatus(traceId) {
        const transactions = this.findTraceTransactions(traceId);
        
        if (transactions.length === 0) {
            return {
                status: 'not_found',
                message: '未找到该溯源记录的区块链证明',
                verified: false
            };
        }
        
        const verifiedTx = transactions.filter(tx => tx.verified);
        const pendingTx = transactions.filter(tx => !tx.verified);
        
        return {
            status: verifiedTx.length > 0 ? 'verified' : 'pending',
            message: verifiedTx.length > 0 
                ? `已上链验证，共有${verifiedTx.length}条记录` 
                : '正在等待区块确认',
            verified: verifiedTx.length > 0,
            verifiedCount: verifiedTx.length,
            pendingCount: pendingTx.length,
            latestBlock: verifiedTx.length > 0 
                ? Math.max(...verifiedTx.map(tx => tx.blockIndex)) 
                : null,
            transactions: transactions
        };
    }
}

// 本地存储模拟
const storage = {
    save: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('区块链数据保存失败:', e);
            return false;
        }
    },
    load: function(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('区块链数据加载失败:', e);
            return null;
        }
    }
};

// 简化的哈希函数（实际应用中使用真正的加密库）
function hashData(data) {
    let hash = 0;
    const str = String(data);
    
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }
    
    // 转换为16进制字符串并填充0
    let hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    
    // 扩展哈希长度，模拟SHA-256
    while (hexHash.length < 64) {
        hexHash += hashData(hexHash + Math.random()).slice(0, 8);
    }
    
    return hexHash;
}

// 区块链实例
let blockchain = null;

// 挖矿定时器
let miningTimer = null;

// 初始化区块链
function initBlockchain() {
    if (!config.enabled) return null;
    
    // 尝试从本地存储加载区块链
    const savedChain = storage.load('trace_blockchain');
    
    if (savedChain) {
        try {
            blockchain = new Blockchain();
            blockchain.chain = savedChain.chain;
            blockchain.pendingTransactions = savedChain.pendingTransactions || [];
            blockchain.difficulty = savedChain.difficulty || config.difficulty;
            
            console.log(`已加载区块链，当前长度: ${blockchain.chain.length} 个区块`);
        } catch (e) {
            console.error('区块链数据加载失败，创建新链:', e);
            blockchain = new Blockchain();
        }
    } else {
        console.log('未找到现有区块链，创建新链');
        blockchain = new Blockchain();
    }
    
    // 开始定时挖矿
    startMining();
    
    return blockchain;
}

// 开始定时挖矿
function startMining() {
    if (miningTimer) clearInterval(miningTimer);
    
    miningTimer = setInterval(() => {
        if (blockchain.pendingTransactions.length > 0) {
            console.log(`开始挖矿，处理 ${blockchain.pendingTransactions.length} 个待处理交易...`);
            
            const result = blockchain.minePendingTransactions();
            
            // 保存区块链到本地存储
            storage.save('trace_blockchain', {
                chain: blockchain.chain,
                pendingTransactions: blockchain.pendingTransactions,
                difficulty: blockchain.difficulty
            });
            
            console.log(`区块 #${result.block.index} 已添加到链上`);
            
            // 如果有UI回调，通知UI更新
            notifyBlockMined(result);
        }
    }, config.blockTime);
}

// 停止挖矿
function stopMining() {
    if (miningTimer) {
        clearInterval(miningTimer);
        miningTimer = null;
    }
}

// 提交溯源数据到区块链
function submitTraceData(traceId, data) {
    if (!config.enabled || !blockchain) return { success: false, error: 'blockchain_disabled' };
    
    try {
        // 准备交易数据
        const transaction = {
            traceId,
            data,
            timestamp: Date.now(),
            operation: 'create_trace',
            signature: hashData(JSON.stringify(data) + traceId + Date.now())
        };
        
        // 添加到待处理交易
        const txIndex = blockchain.addTransaction(transaction);
        
        return { 
            success: true, 
            message: '溯源数据已提交到区块链，等待确认',
            transactionIndex: txIndex
        };
    } catch (e) {
        console.error('提交溯源数据到区块链失败:', e);
        return { success: false, error: e.message };
    }
}

// 更新溯源数据
function updateTraceData(traceId, data, operation = 'update_trace') {
    if (!config.enabled || !blockchain) return { success: false, error: 'blockchain_disabled' };
    
    try {
        // 准备交易数据
        const transaction = {
            traceId,
            data,
            timestamp: Date.now(),
            operation,
            signature: hashData(JSON.stringify(data) + traceId + operation + Date.now())
        };
        
        // 添加到待处理交易
        const txIndex = blockchain.addTransaction(transaction);
        
        return { 
            success: true, 
            message: '溯源数据更新已提交到区块链，等待确认',
            transactionIndex: txIndex
        };
    } catch (e) {
        console.error('更新溯源数据失败:', e);
        return { success: false, error: e.message };
    }
}

// 验证溯源记录
function verifyTrace(traceId) {
    if (!config.enabled || !blockchain) {
        return { 
            verified: false, 
            status: 'blockchain_disabled',
            message: '区块链功能未启用'
        };
    }
    
    return blockchain.getTraceVerificationStatus(traceId);
}

// 获取溯源记录的区块链证明
function getTraceProof(traceId) {
    if (!config.enabled || !blockchain) {
        return { 
            success: false, 
            error: 'blockchain_disabled'
        };
    }
    
    const transactions = blockchain.findTraceTransactions(traceId);
    
    if (transactions.length === 0) {
        return {
            success: false,
            error: 'trace_not_found',
            message: '未找到该溯源记录的区块链证明'
        };
    }
    
    // 构建区块链证明数据
    const verifiedTx = transactions.filter(tx => tx.verified);
    const blockIndexes = [...new Set(verifiedTx.map(tx => tx.blockIndex))];
    
    // 获取相关区块
    const blocks = blockIndexes.map(index => blockchain.chain[index]);
    
    return {
        success: true,
        trace: {
            id: traceId,
            transactionCount: transactions.length,
            verifiedCount: verifiedTx.length,
            pendingCount: transactions.length - verifiedTx.length,
            firstVerified: verifiedTx.length > 0 ? new Date(verifiedTx[0].timestamp).toISOString() : null,
            lastVerified: verifiedTx.length > 0 ? new Date(verifiedTx[verifiedTx.length - 1].timestamp).toISOString() : null
        },
        blocks: blocks.map(block => ({
            index: block.index,
            timestamp: block.timestamp,
            hash: block.hash,
            previousHash: block.previousHash,
            transactionCount: Array.isArray(block.data) ? block.data.length : 0
        })),
        chainInfo: {
            name: config.chainName,
            length: blockchain.chain.length,
            algorithm: config.algorithm,
            isValid: blockchain.isChainValid()
        }
    };
}

// 创建区块链验证标记UI
function createVerificationBadge(traceId, targetElement) {
    if (!targetElement || !config.enabled) return null;
    
    const verificationStatus = verifyTrace(traceId);
    const badgeElement = document.createElement('div');
    
    if (verificationStatus.verified) {
        badgeElement.className = 'blockchain-verified';
        badgeElement.innerHTML = `
            <i class="fas fa-shield-alt"></i>
            <span>区块链验证</span>
        `;
        badgeElement.title = `此溯源记录已上链确认: ${verificationStatus.message}`;
    } else {
        badgeElement.className = 'blockchain-pending';
        badgeElement.innerHTML = `
            <i class="fas fa-clock"></i>
            <span>待上链确认</span>
        `;
        badgeElement.title = `此溯源记录待上链确认: ${verificationStatus.message}`;
    }
    
    // 添加点击事件显示详情
    badgeElement.addEventListener('click', function(e) {
        e.preventDefault();
        showVerificationDetails(traceId);
    });
    
    // 添加到目标元素
    targetElement.appendChild(badgeElement);
    
    return badgeElement;
}

// 显示验证详情
function showVerificationDetails(traceId) {
    const proof = getTraceProof(traceId);
    
    if (!proof.success) {
        alert(`无法获取验证详情: ${proof.message || proof.error}`);
        return;
    }
    
    // 创建模态框显示验证详情
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 overflow-auto max-h-[90vh]">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-medium text-gray-900">区块链验证详情</h3>
                <button type="button" class="text-gray-400 hover:text-gray-500" id="close-verification">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="space-y-4">
                <div class="bg-blue-50 p-4 rounded-lg">
                    <h4 class="font-medium text-blue-800 mb-2">溯源记录信息</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="text-gray-600">ID:</div>
                        <div>${proof.trace.id}</div>
                        <div class="text-gray-600">交易数量:</div>
                        <div>${proof.trace.transactionCount}</div>
                        <div class="text-gray-600">已确认:</div>
                        <div>${proof.trace.verifiedCount}</div>
                        <div class="text-gray-600">待确认:</div>
                        <div>${proof.trace.pendingCount}</div>
                        <div class="text-gray-600">首次上链时间:</div>
                        <div>${proof.trace.firstVerified || '尚未上链'}</div>
                    </div>
                </div>
                
                <div>
                    <h4 class="font-medium text-gray-800 mb-2">区块信息</h4>
                    <div class="space-y-2">
                        ${proof.blocks.map(block => `
                            <div class="border border-gray-200 rounded-lg p-3">
                                <div class="flex justify-between mb-2">
                                    <span class="font-medium">区块 #${block.index}</span>
                                    <span class="text-xs text-gray-500">${new Date(block.timestamp).toLocaleString()}</span>
                                </div>
                                <div class="text-xs font-mono bg-gray-100 p-2 rounded mb-2 overflow-x-auto">
                                    <div><span class="text-gray-600">Hash:</span> ${block.hash}</div>
                                    <div><span class="text-gray-600">Previous:</span> ${block.previousHash}</div>
                                </div>
                                <div class="text-xs text-gray-600">
                                    包含 ${block.transactionCount} 条交易
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="bg-gray-50 p-4 rounded-lg">
                    <h4 class="font-medium text-gray-800 mb-2">区块链信息</h4>
                    <div class="grid grid-cols-2 gap-2 text-sm">
                        <div class="text-gray-600">名称:</div>
                        <div>${proof.chainInfo.name}</div>
                        <div class="text-gray-600">长度:</div>
                        <div>${proof.chainInfo.length} 个区块</div>
                        <div class="text-gray-600">算法:</div>
                        <div>${proof.chainInfo.algorithm}</div>
                        <div class="text-gray-600">链完整性:</div>
                        <div>${proof.chainInfo.isValid ? '有效' : '无效'}</div>
                    </div>
                </div>
            </div>
            
            <div class="mt-6 flex justify-end">
                <button type="button" class="px-4 py-2 bg-blue-500 text-white rounded-md text-sm font-medium hover:bg-blue-600 transition-colors" id="download-proof">
                    <i class="fas fa-download mr-1"></i> 下载证明
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 关闭按钮事件
    const closeButton = document.getElementById('close-verification');
    closeButton.addEventListener('click', function() {
        document.body.removeChild(modal);
    });
    
    // 下载证明按钮事件
    const downloadButton = document.getElementById('download-proof');
    downloadButton.addEventListener('click', function() {
        const proofData = JSON.stringify(proof, null, 2);
        const blob = new Blob([proofData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `blockchain-proof-${traceId}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
    });
}

// 通知区块已挖掘（可用于更新UI）
function notifyBlockMined(result) {
    // 创建区块挖掘通知
    if (result && result.block) {
        if (window.TraceOfflineManager && typeof TraceOfflineManager.showNotification === 'function') {
            TraceOfflineManager.showNotification(
                `区块 #${result.block.index} 已成功创建，包含 ${result.transactions.length} 条交易`,
                'success',
                5000
            );
        }
        
        console.log(`区块 #${result.block.index} 已挖掘，包含 ${result.transactions.length} 条交易`);
        
        // 触发自定义事件
        const event = new CustomEvent('blockMined', { detail: result });
        document.dispatchEvent(event);
    }
}

// UPDATED CODE: 将所有函数和类导出为一个对象
export const TraceBlockchain = {
    // 公开配置
    config,
    
    // 主要功能
    init: initBlockchain,
    startMining,
    stopMining,
    submitTraceData,
    updateTraceData,
    verifyTrace,
    getTraceProof,
    createVerificationBadge,
    showVerificationDetails
};

// 在文档加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    if (config.enabled) {
        initBlockchain();
    }
}); 