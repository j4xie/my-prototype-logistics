/**
 * AI智能问答页面
 * 集成LLM服务，支持商品智能推荐
 */
const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    messages: [],
    inputText: '',
    isTyping: false,
    scrollToMessage: '',
    sessionId: '',  // AI会话ID
    historyLoaded: false, // 标记历史是否已加载
    // 当前产品上下文 (从商品详情页跳转时传入)
    currentProduct: null,  // { id, name }
    quickQuestions: [
      '推荐一些热门商品',
      '有什么新上架的产品？',
      '如何查看产品的溯源信息？',
      '阶梯价格是如何计算的？'
    ],
    // 产品相关的快捷问题模板
    productQuickQuestions: [
      '这个产品有什么特点？',
      '价格是多少？有优惠吗？',
      '有溯源信息吗？',
      '库存充足吗？'
    ]
  },

  onLoad(options) {
    // 清空旧格式的缓存数据（修复字段映射问题后的一次性清理）
    const cacheVersion = wx.getStorageSync('aiChatCacheVersion')
    if (cacheVersion !== 'v2') {
      wx.removeStorageSync('aiChatHistory')
      wx.setStorageSync('aiChatCacheVersion', 'v2')
      console.log('[AI Chat] 已清理旧版本缓存')
    }

    // 尝试恢复之前的会话ID，否则生成新的
    const savedSessionId = wx.getStorageSync('aiChatSessionId')
    const sessionId = savedSessionId || this.generateSessionId()
    
    this.setData({ sessionId })
    
    // 保存会话ID到本地
    if (!savedSessionId) {
      wx.setStorageSync('aiChatSessionId', sessionId)
    }

    // 检查是否有产品上下文 (从商品详情页跳转)
    if (options.productId) {
      const productId = options.productId
      const productName = options.productName ? decodeURIComponent(options.productName) : ''

      this.setData({
        currentProduct: { id: productId, name: productName },
        // 使用产品相关的快捷问题
        quickQuestions: this.data.productQuickQuestions
      })

      console.log('[AI Chat] 产品上下文:', productId, productName)

      // 如果有产品名称，自动填充询问该产品的问题
      if (productName) {
        this.setData({
          inputText: '请介绍一下「' + productName + '」这个产品'
        })
      }
    }
    // 检查是否有预设问题或来自搜索的关键词
    else if (options.keyword) {
      const keyword = decodeURIComponent(options.keyword)
      this.setData({
        inputText: '帮我找一下' + keyword + '相关的商品'
      })
      // 延迟自动发送
      setTimeout(() => {
        this.sendMessage()
      }, 500)
    } else if (options.question) {
      this.askQuestion(decodeURIComponent(options.question))
    }
  },

  // 生成会话ID
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
  },

  // 清除产品上下文 (用户点击关闭按钮时)
  clearProductContext() {
    this.setData({
      currentProduct: null,
      inputText: '',
      // 恢复默认快捷问题
      quickQuestions: [
        '推荐一些热门商品',
        '有什么新上架的产品？',
        '如何查看产品的溯源信息？',
        '阶梯价格是如何计算的？'
      ]
    })
  },

  onShow() {
    // 检查登录状态 - AI聊天页需要登录才能访问
    const wxUser = app.globalData.wxUser
    if (!wxUser || !wxUser.id) {
      wx.showToast({
        title: '请先登录',
        icon: 'none',
        duration: 1500
      })
      setTimeout(() => {
        wx.navigateTo({
          url: '/pages/auth/login/index'
        })
      }, 500)
      return
    }

    // 加载历史消息（仅首次加载时）
    if (!this.data.historyLoaded) {
      this.loadHistory()
    }
  },

  // 加载历史消息（优先从服务器获取，失败则从本地缓存）
  async loadHistory() {
    const { sessionId } = this.data
    
    // 优先尝试从服务器获取会话历史
    try {
      const res = await api.getAiSessionHistory(sessionId)
      if (res.code === 200 && res.data && res.data.length > 0) {
        // 转换服务端数据格式 - 每条AiDemandRecord包含用户消息和AI回复，需要拆分为两条消息
        const messages = []
        res.data.forEach(item => {
          // 用户消息
          if (item.userMessage) {
            messages.push({
              id: `${item.id}_user`,
              sender: 'user',
              text: item.userMessage,
              sources: [],
              products: [],
              timeStr: item.createTime ? this.formatServerTime(item.createTime) : this.formatTime(new Date())
            })
          }
          // AI回复
          if (item.aiResponse) {
            messages.push({
              id: `${item.id}_ai`,
              sender: 'ai',
              text: item.aiResponse,
              sources: [],
              products: [],
              timeStr: item.createTime ? this.formatServerTime(item.createTime) : this.formatTime(new Date())
            })
          }
        })
        
        this.setData({ 
          messages, 
          historyLoaded: true 
        })
        this.scrollToBottom()
        
        // 同步到本地缓存
        wx.setStorageSync('aiChatHistory', messages)
        return
      }
    } catch (error) {
      console.log('从服务器加载历史失败，使用本地缓存:', error)
    }
    
    // 降级：从本地缓存加载
    const history = wx.getStorageSync('aiChatHistory') || []
    if (history.length > 0) {
      this.setData({ 
        messages: history,
        historyLoaded: true
      })
      this.scrollToBottom()
    } else {
      this.setData({ historyLoaded: true })
    }
  },

  // 格式化服务端时间
  formatServerTime(timeStr) {
    try {
      const date = new Date(timeStr)
      return this.formatTime(date)
    } catch (e) {
      return timeStr
    }
  },

  // 保存历史消息
  saveHistory() {
    // 只保存最近50条消息
    const messages = this.data.messages.slice(-50)
    wx.setStorageSync('aiChatHistory', messages)
  },

  // 输入变化
  onInputChange(e) {
    this.setData({ inputText: e.detail.value })
  },

  // 发送消息
  sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || this.data.isTyping) return

    this.setData({ inputText: '' })
    this.askQuestion(text)
  },

  // 快捷问题
  askQuickQuestion(e) {
    const question = e.currentTarget.dataset.question
    this.askQuestion(question)
  },

  // 发送问题
  async askQuestion(question) {
    // 添加用户消息
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: question,
      sources: [],
      products: [],
      timeStr: this.formatTime(new Date())
    }

    const messages = [...this.data.messages, userMessage]
    this.setData({
      messages,
      isTyping: true
    })

    this.scrollToBottom()
    this.saveHistory()

    try {
      // 调用AI API
      const res = await this.callAIService(question)

      const fullText = res.response || res.answer || '抱歉，我暂时无法回答这个问题。'

      // 先添加空消息 (显示loading)
      const aiMessage = {
        id: Date.now(),
        sender: 'ai',
        text: '',  // 初始为空，通过流式显示逐步填充
        sources: res.sources || [],
        products: res.products || [],
        keywords: res.keywords || [],
        timeStr: this.formatTime(new Date()),
        isStreaming: true  // 标记正在流式显示
      }

      const newMessages = [...this.data.messages, aiMessage]
      const messageIndex = newMessages.length - 1
      this.setData({
        messages: newMessages,
        isTyping: false
      })

      // 模拟流式显示 (借鉴白垩纪App 3字符/20ms效果)
      this.simulateStreamDisplay(messageIndex, fullText, res)

    } catch (error) {
      console.error('AI回复失败:', error)

      // 添加错误消息
      const errorMessage = {
        id: Date.now(),
        sender: 'ai',
        text: '抱歉，AI服务暂时不可用，请稍后重试。',
        sources: [],
        products: [],
        timeStr: this.formatTime(new Date())
      }

      const newMessages = [...this.data.messages, errorMessage]
      this.setData({
        messages: newMessages,
        isTyping: false
      })

      this.scrollToBottom()
    }
  },

  // 模拟流式显示AI回复 (借鉴白垩纪App 3字符/20ms效果)
  simulateStreamDisplay(messageIndex, fullText, resData) {
    let currentIndex = 0
    const chunkSize = 3  // 每次显示3个字符
    const interval = 20  // 20ms间隔

    const timer = setInterval(() => {
      if (currentIndex >= fullText.length) {
        clearInterval(timer)
        // 显示完成，更新状态
        const messages = this.data.messages
        if (messages[messageIndex]) {
          messages[messageIndex].isStreaming = false
          this.setData({ messages })
          this.saveHistory()
        }
        return
      }

      currentIndex += chunkSize
      const messages = this.data.messages
      if (messages[messageIndex]) {
        messages[messageIndex].text = fullText.substring(0, currentIndex)
        this.setData({ messages })
      }

      // 滚动到底部
      this.scrollToBottom()
    }, interval)
  },

  // 调用AI服务
  async callAIService(question) {
    try {
      // 构建请求数据
      const requestData = {
        message: question,
        sessionId: this.data.sessionId
      }

      // 如果有产品上下文，传递给后端 (从商品详情页跳转时)
      const currentProduct = this.data.currentProduct
      if (currentProduct && currentProduct.id) {
        requestData.productId = currentProduct.id
        requestData.productName = currentProduct.name || ''
        console.log('[AI Chat] 发送产品上下文:', currentProduct)
      }

      // 使用统一的 api.js 调用AI接口
      const res = await api.aiChat(requestData)

      if (res.code === 200 && res.data) {
        // 更新sessionId（如果后端返回了新的）
        if (res.data.sessionId) {
          this.setData({
            sessionId: res.data.sessionId
          })
          // 同步保存到本地
          wx.setStorageSync('aiChatSessionId', res.data.sessionId)
        }
        return res.data
      }

      // API调用失败，使用本地回复
      return this.getLocalResponse(question)
    } catch (error) {
      console.error('AI API调用失败:', error)
      // 降级到本地回复
      return this.getLocalResponse(question)
    }
  },

  // 本地回复（作为备用）
  getLocalResponse(question) {
    const responses = {
      '如何查看产品的溯源信息？': {
        response: '您可以通过以下方式查看产品溯源信息：\n\n1. 扫描产品包装上的溯源二维码\n2. 在首页点击"扫码溯源"功能\n3. 在商品详情页点击"查看溯源"按钮\n\n溯源信息包含产地、生产日期、质检报告、运输轨迹等完整信息。',
        sources: ['溯源系统', '产品文档'],
        products: []
      },
      '阶梯价格是如何计算的？': {
        response: '阶梯定价是根据采购数量给予的批发优惠：\n\n• 1-49件：原价\n• 50-99件：享9.5折\n• 100-499件：享9折\n• 500件以上：享8.5折\n\n系统会自动计算当前购买量对应的阶梯价格，在购物车和结算页面显示。',
        sources: ['价格政策', '会员权益'],
        products: []
      }
    }

    return responses[question] || {
      response: `感谢您的提问！关于"${question}"的问题，我已记录下来。\n\n您可以：\n1. 查看商品详情页的"常见问题"部分\n2. 联系在线客服获取帮助\n3. 拨打客服热线 400-123-4567`,
      sources: ['智能助手'],
      products: []
    }
  },

  // 跳转到商品详情
  goToProduct(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/goods/goods-detail/index?id=' + id
    })
  },

  // 加入购物车 (新增 - 借鉴白垩纪App快捷操作设计)
  addToCart(e) {
    const product = e.currentTarget.dataset.product
    // 如果商品有规格，跳转详情页选规格
    if (product.hasSpec || product.specType === 1) {
      wx.navigateTo({
        url: '/pages/goods/goods-detail/index?id=' + product.id + '&action=addCart'
      })
    } else {
      // 无规格直接加购物车
      this.doAddToCart(product.id, product.skuId || product.id, 1)
    }
  },

  // 立即购买 (新增)
  buyNow(e) {
    const product = e.currentTarget.dataset.product
    wx.navigateTo({
      url: '/pages/goods/goods-detail/index?id=' + product.id + '&action=buyNow'
    })
  },

  // 直接加购物车API
  doAddToCart(spuId, skuId, quantity) {
    api.shoppingCartAdd({
      spuId: spuId,
      skuId: skuId,
      quantity: quantity
    }).then(res => {
      if (res.code === 200) {
        wx.showToast({
          title: '已加入购物车',
          icon: 'success'
        })
      }
    }).catch(err => {
      console.error('加入购物车失败:', err)
      wx.showToast({
        title: '加入购物车失败',
        icon: 'none'
      })
    })
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      this.setData({
        scrollToMessage: 'msg-bottom'
      })
    }, 100)
  },

  // 格式化时间
  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  },

  // 查看历史记录
  goHistory() {
    wx.navigateTo({
      url: '/pages/ai-rag/history/index'
    })
  },

  // 清空对话
  clearChat() {
    if (this.data.messages.length === 0) {
      wx.showToast({
        title: '暂无对话记录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '清空对话',
      content: '确认清空所有对话记录？',
      success: (res) => {
        if (res.confirm) {
          const oldSessionId = this.data.sessionId

          // 1. 清空服务端历史 (新增 - 借鉴白垩纪App)
          api.clearAiSessionHistory(oldSessionId).catch(err => {
            console.log('清空服务端历史失败:', err)
          })

          // 2. 生成新的会话ID
          const newSessionId = this.generateSessionId()

          // 3. 清空本地消息和缓存
          this.setData({
            messages: [],
            sessionId: newSessionId,
            historyLoaded: true
          })

          // 清除本地缓存并保存新会话ID
          wx.removeStorageSync('aiChatHistory')
          wx.setStorageSync('aiChatSessionId', newSessionId)

          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'AI智能问答 - 溯源商城',
      path: '/pages/ai-rag/chat/index'
    }
  }
})
