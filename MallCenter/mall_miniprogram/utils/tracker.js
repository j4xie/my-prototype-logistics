/**
 * 用户行为追踪工具类
 *
 * 设计原则（融合行业最佳实践）:
 * 1. 即时性优先（抖音）: 关键行为立即上报，非关键行为批量上报
 * 2. 多维度采集（淘宝）: 行为类型 + 停留时长 + 滚动深度 + 来源渠道
 * 3. 会话管理（小红书）: 基于session的行为序列，便于序列化建模
 *
 * 行为权重设计（参考抖音）:
 * | 行为类型 | 权重 | 上报策略 |
 * |---------|------|---------|
 * | purchase（购买） | 10 | 即时 |
 * | cart_add（加购） | 5 | 即时 |
 * | favorite（收藏） | 4 | 即时 |
 * | view（浏览>10s） | 3 | 即时 |
 * | view（浏览<10s） | 1 | 批量 |
 * | search（搜索） | 3 | 即时 |
 * | click（点击） | 1 | 批量 |
 */

const api = require('./api')

// 配置
const CONFIG = {
  batchInterval: 5000,       // 批量上报间隔(ms)
  maxQueueSize: 20,          // 队列最大长度
  maxOfflineQueueSize: 100,  // P0修复: 离线队列最大长度，防止内存溢出
  viewThreshold: 10000,      // 有效浏览时长阈值(ms) - 10秒
  exposureTTL: 30 * 60 * 1000,  // P1修复: 曝光记录过期时间(ms) - 30分钟
  offlineStorageKey: 'tracker_offline_queue',  // 离线缓存key
  sessionStorageKey: 'tracker_session_id',     // 会话ID缓存key
  exposedStorageKey: 'tracker_exposed_map',    // 曝光去重缓存key (改为Map)
}

// 事件队列（用于批量上报）
let eventQueue = []

// P1修复: 曝光去重Map (productId -> timestamp)，支持过期机制
let exposedMap = new Map()

// 会话ID
let sessionId = null

// 批量上报定时器ID
let batchTimerId = null

// 是否已初始化
let initialized = false

/**
 * 生成会话ID
 * 格式: session_时间戳_随机数
 */
function generateSessionId() {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substr(2, 8)
  return `session_${timestamp}_${random}`
}

/**
 * 获取微信用户ID
 */
function getWxUserId() {
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.wxUser) {
      return app.globalData.wxUser.id || app.globalData.wxUser.openId
    }
  } catch (e) {
    console.warn('[Tracker] 获取wxUserId失败:', e)
  }
  return null
}

/**
 * 获取设备类型
 */
function getDeviceType() {
  try {
    const systemInfo = wx.getSystemInfoSync()
    return systemInfo.platform || 'unknown'
  } catch (e) {
    return 'unknown'
  }
}

/**
 * 从本地存储加载离线队列
 * P0修复: 限制离线队列大小，防止内存溢出
 */
function loadOfflineQueue() {
  try {
    const data = wx.getStorageSync(CONFIG.offlineStorageKey)
    if (data) {
      let queue = JSON.parse(data)
      // P0修复: 限制队列大小，只保留最新的事件
      if (queue.length > CONFIG.maxOfflineQueueSize) {
        console.warn('[Tracker] 离线队列超限，截断:', queue.length, '->', CONFIG.maxOfflineQueueSize)
        queue = queue.slice(-CONFIG.maxOfflineQueueSize)
      }
      eventQueue = queue
      console.log('[Tracker] 加载离线队列:', eventQueue.length, '条')
    }
  } catch (e) {
    console.warn('[Tracker] 加载离线队列失败:', e)
  }
}

/**
 * 保存队列到本地存储（离线缓存）
 * P0修复: 限制保存的队列大小
 */
function saveQueueToStorage() {
  try {
    // P0修复: 只保存最新的事件，防止存储膨胀
    let queueToSave = eventQueue
    if (eventQueue.length > CONFIG.maxOfflineQueueSize) {
      queueToSave = eventQueue.slice(-CONFIG.maxOfflineQueueSize)
    }
    wx.setStorageSync(CONFIG.offlineStorageKey, JSON.stringify(queueToSave))
  } catch (e) {
    console.warn('[Tracker] 保存离线队列失败:', e)
  }
}

/**
 * P1修复: 加载曝光去重Map，并清理过期记录
 */
function loadExposedMap() {
  try {
    const data = wx.getStorageSync(CONFIG.exposedStorageKey)
    if (data) {
      const parsed = JSON.parse(data)
      const now = Date.now()
      // 过滤掉过期的记录
      exposedMap = new Map()
      Object.keys(parsed).forEach(id => {
        const timestamp = parsed[id]
        if (now - timestamp < CONFIG.exposureTTL) {
          exposedMap.set(id, timestamp)
        }
      })
      console.log('[Tracker] 加载曝光Map:', exposedMap.size, '条有效记录')
    }
  } catch (e) {
    console.warn('[Tracker] 加载曝光Map失败:', e)
  }
}

/**
 * P1修复: 保存曝光去重Map
 */
function saveExposedMap() {
  try {
    const now = Date.now()
    const obj = {}
    // 只保留未过期的记录，最多1000条
    let count = 0
    exposedMap.forEach((timestamp, id) => {
      if (now - timestamp < CONFIG.exposureTTL && count < 1000) {
        obj[id] = timestamp
        count++
      }
    })
    wx.setStorageSync(CONFIG.exposedStorageKey, JSON.stringify(obj))
  } catch (e) {
    console.warn('[Tracker] 保存曝光Map失败:', e)
  }
}

/**
 * 立即上报单个事件
 */
async function sendImmediately(event) {
  const wxUserId = getWxUserId()
  if (!wxUserId) {
    console.warn('[Tracker] 用户未登录，事件暂存队列')
    addToQueue(event)
    return
  }

  const fullEvent = {
    wxUserId,
    sessionId,
    deviceType: getDeviceType(),
    eventTime: new Date().toISOString(),
    ...event
  }

  try {
    await api.trackBehavior(fullEvent)
    console.log('[Tracker] 即时上报成功:', event.eventType)
  } catch (e) {
    console.warn('[Tracker] 即时上报失败，加入队列:', e)
    addToQueue(event)
  }
}

/**
 * 添加事件到队列
 */
function addToQueue(event) {
  const fullEvent = {
    sessionId,
    deviceType: getDeviceType(),
    eventTime: new Date().toISOString(),
    ...event
  }

  eventQueue.push(fullEvent)

  // 超过最大长度，立即上报
  if (eventQueue.length >= CONFIG.maxQueueSize) {
    flushQueue()
  } else {
    saveQueueToStorage()
  }
}

/**
 * 批量上报队列中的事件
 */
async function flushQueue() {
  if (eventQueue.length === 0) {
    return
  }

  const wxUserId = getWxUserId()
  if (!wxUserId) {
    console.warn('[Tracker] 用户未登录，保留队列')
    saveQueueToStorage()
    return
  }

  const eventsToSend = [...eventQueue]
  eventQueue = []

  // 为每个事件添加 wxUserId
  const fullEvents = eventsToSend.map(e => ({
    ...e,
    wxUserId
  }))

  try {
    await api.trackBehaviorBatch({ events: fullEvents, sessionId })
    console.log('[Tracker] 批量上报成功:', fullEvents.length, '条')
    // 清除本地存储
    wx.removeStorageSync(CONFIG.offlineStorageKey)
  } catch (e) {
    console.warn('[Tracker] 批量上报失败，恢复队列:', e)
    // 失败时恢复队列
    eventQueue = [...eventsToSend, ...eventQueue]
    saveQueueToStorage()
  }
}

/**
 * 启动批量上报定时器
 */
function startBatchTimer() {
  if (batchTimerId) {
    clearInterval(batchTimerId)
  }
  batchTimerId = setInterval(() => {
    flushQueue()
  }, CONFIG.batchInterval)
}

/**
 * 停止批量上报定时器
 */
function stopBatchTimer() {
  if (batchTimerId) {
    clearInterval(batchTimerId)
    batchTimerId = null
  }
}

// ========== 公开方法 ==========

const tracker = {
  /**
   * 初始化追踪器（在 app.js onLaunch 中调用）
   */
  init() {
    if (initialized) {
      return
    }

    // 生成或恢复会话ID
    try {
      const storedSession = wx.getStorageSync(CONFIG.sessionStorageKey)
      if (storedSession) {
        sessionId = storedSession
      } else {
        sessionId = generateSessionId()
        wx.setStorageSync(CONFIG.sessionStorageKey, sessionId)
      }
    } catch (e) {
      sessionId = generateSessionId()
    }

    // 加载离线数据
    loadOfflineQueue()
    loadExposedMap()  // P1修复: 使用Map支持过期

    // 启动批量上报定时器
    startBatchTimer()

    initialized = true
    console.log('[Tracker] 初始化完成, sessionId:', sessionId)
  },

  /**
   * 恢复追踪（App onShow 时调用）
   */
  resume() {
    startBatchTimer()
    console.log('[Tracker] 恢复追踪')
  },

  /**
   * 暂停追踪（App onHide 时调用）
   */
  pause() {
    stopBatchTimer()
    console.log('[Tracker] 暂停追踪')
  },

  /**
   * 立即上报所有队列事件（App onHide 或页面切换时调用）
   */
  flush() {
    flushQueue()
    saveExposedMap()  // P1修复: 使用Map
  },

  /**
   * 追踪商品浏览（带停留时长统计）
   * @param {Object} options
   * @param {string} options.productId - 商品ID
   * @param {string} options.productName - 商品名称
   * @param {number} options.duration - 停留时长(ms)
   * @param {number} options.scrollDepth - 滚动深度(0-100)
   * @param {string} options.source - 来源页面
   */
  trackView({ productId, productName, duration = 0, scrollDepth = 0, source = '' }) {
    const isValidView = duration >= CONFIG.viewThreshold

    const event = {
      eventType: 'view',
      targetType: 'product',
      targetId: productId,
      targetName: productName,
      eventData: JSON.stringify({
        duration,
        scrollDepth,
        source,
        isValid: isValidView
      })
    }

    if (isValidView) {
      // 有效浏览（>10秒）即时上报
      sendImmediately(event)
    } else {
      // 无效浏览批量上报
      addToQueue(event)
    }
  },

  /**
   * 追踪搜索行为
   * @param {Object} options
   * @param {string} options.keyword - 搜索关键词
   * @param {number} options.resultCount - 搜索结果数量
   */
  trackSearch({ keyword, resultCount = 0 }) {
    sendImmediately({
      eventType: 'search',
      targetType: 'keyword',
      targetId: keyword,
      targetName: keyword,
      eventData: JSON.stringify({ resultCount })
    })
  },

  /**
   * 追踪加购行为
   * @param {Object} options
   * @param {string} options.productId - 商品ID
   * @param {string} options.productName - 商品名称
   * @param {number} options.quantity - 数量
   * @param {string} options.source - 来源页面
   */
  trackCartAdd({ productId, productName, quantity = 1, source = '' }) {
    sendImmediately({
      eventType: 'cart_add',
      targetType: 'product',
      targetId: productId,
      targetName: productName,
      eventData: JSON.stringify({ quantity, source })
    })
  },

  /**
   * 追踪购买行为
   * @param {Object} options
   * @param {string} options.orderId - 订单ID
   * @param {Array} options.products - 商品列表 [{productId, productName, quantity, price}]
   * @param {number} options.totalAmount - 订单金额
   */
  trackPurchase({ orderId, products = [], totalAmount = 0 }) {
    sendImmediately({
      eventType: 'purchase',
      targetType: 'order',
      targetId: orderId,
      targetName: `订单${orderId}`,
      eventData: JSON.stringify({ products, totalAmount })
    })
  },

  /**
   * 追踪收藏行为
   * @param {Object} options
   * @param {string} options.productId - 商品ID
   * @param {string} options.productName - 商品名称
   * @param {boolean} options.isFavorite - 是否收藏（取消收藏为false）
   */
  trackFavorite({ productId, productName, isFavorite = true }) {
    sendImmediately({
      eventType: isFavorite ? 'favorite' : 'unfavorite',
      targetType: 'product',
      targetId: productId,
      targetName: productName,
      eventData: JSON.stringify({ isFavorite })
    })
  },

  /**
   * 追踪点击行为（批量上报）
   * @param {Object} options
   * @param {string} options.targetType - 目标类型 (product/category/banner/button)
   * @param {string} options.targetId - 目标ID
   * @param {string} options.targetName - 目标名称
   * @param {string} options.position - 位置信息
   */
  trackClick({ targetType, targetId, targetName = '', position = '' }) {
    addToQueue({
      eventType: 'click',
      targetType,
      targetId,
      targetName,
      eventData: JSON.stringify({ position })
    })
  },

  /**
   * P1修复: 追踪曝光行为（去重，支持过期）
   * @param {Array<string>} productIds - 商品ID列表
   * @param {string} source - 曝光来源 (home/category/search/recommend)
   */
  trackExposure(productIds, source = '') {
    const now = Date.now()

    // 过滤已曝光且未过期的商品
    const newExposures = productIds.filter(id => {
      const timestamp = exposedMap.get(id)
      if (!timestamp) return true  // 从未曝光
      // 已过期，视为新曝光
      return (now - timestamp) >= CONFIG.exposureTTL
    })

    if (newExposures.length === 0) {
      return
    }

    // 记录已曝光（带时间戳）
    newExposures.forEach(id => exposedMap.set(id, now))

    // P2修复: 每10次曝光才保存一次，减少I/O
    if (exposedMap.size % 10 === 0) {
      saveExposedMap()
    }

    // 批量上报
    addToQueue({
      eventType: 'exposure',
      targetType: 'product_list',
      targetId: newExposures.join(','),
      eventData: JSON.stringify({
        productIds: newExposures,
        source,
        count: newExposures.length
      })
    })
  },

  /**
   * 追踪页面访问
   * @param {Object} options
   * @param {string} options.pagePath - 页面路径
   * @param {string} options.pageTitle - 页面标题
   * @param {Object} options.query - 页面参数
   */
  trackPageView({ pagePath, pageTitle = '', query = {} }) {
    addToQueue({
      eventType: 'page_view',
      targetType: 'page',
      targetId: pagePath,
      targetName: pageTitle,
      eventData: JSON.stringify({ query })
    })
  },

  /**
   * 追踪分享行为
   * @param {Object} options
   * @param {string} options.targetType - 分享目标类型 (product/page)
   * @param {string} options.targetId - 目标ID
   * @param {string} options.targetName - 目标名称
   * @param {string} options.shareType - 分享类型 (friend/timeline/qrcode)
   */
  trackShare({ targetType, targetId, targetName = '', shareType = 'friend' }) {
    sendImmediately({
      eventType: 'share',
      targetType,
      targetId,
      targetName,
      eventData: JSON.stringify({ shareType })
    })
  },

  /**
   * 清除当前会话曝光记录（用于下拉刷新场景）
   */
  clearExposures() {
    exposedMap.clear()  // P1修复: 使用Map
    try {
      wx.removeStorageSync(CONFIG.exposedStorageKey)
    } catch (e) {
      // ignore
    }
  },

  /**
   * 重置会话（用于用户登出时）
   */
  resetSession() {
    sessionId = generateSessionId()
    try {
      wx.setStorageSync(CONFIG.sessionStorageKey, sessionId)
    } catch (e) {
      // ignore
    }
    this.clearExposures()
    eventQueue = []
    try {
      wx.removeStorageSync(CONFIG.offlineStorageKey)
    } catch (e) {
      // ignore
    }
    console.log('[Tracker] 会话已重置, 新sessionId:', sessionId)
  },

  /**
   * 获取当前会话ID
   */
  getSessionId() {
    return sessionId
  }
}

module.exports = tracker
