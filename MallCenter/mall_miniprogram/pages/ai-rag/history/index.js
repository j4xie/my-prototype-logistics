/**
 * AI咨询历史页面
 */
const app = getApp()

Page({
  data: {
    searchText: '',
    historyList: [],
    filteredList: []
  },

  onShow() {
    this.loadHistory()
  },

  // 加载历史记录
  loadHistory() {
    const chatHistory = wx.getStorageSync('aiChatHistory') || []

    // 按对话分组整理
    const conversations = this.groupConversations(chatHistory)

    this.setData({
      historyList: conversations,
      filteredList: conversations
    })
  },

  // 将消息分组为对话
  groupConversations(messages) {
    if (messages.length === 0) return []

    const conversations = []
    let currentConv = null

    messages.forEach((msg, index) => {
      if (msg.sender === 'user') {
        // 用户消息开始新对话
        if (currentConv) {
          conversations.push(currentConv)
        }
        currentConv = {
          id: msg.id,
          question: msg.text,
          answer: '',
          messageCount: 1,
          dateStr: this.formatDate(new Date(msg.id)),
          messages: [msg]
        }
      } else if (msg.sender === 'ai' && currentConv) {
        // AI回复添加到当前对话
        currentConv.answer = msg.text.substring(0, 50) + (msg.text.length > 50 ? '...' : '')
        currentConv.messageCount++
        currentConv.messages.push(msg)
      }
    })

    // 添加最后一个对话
    if (currentConv) {
      conversations.push(currentConv)
    }

    // 按时间倒序
    return conversations.reverse()
  },

  // 格式化日期
  formatDate(date) {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)

    if (date >= today) {
      return '今天 ' + this.formatTime(date)
    } else if (date >= yesterday) {
      return '昨天 ' + this.formatTime(date)
    } else {
      const month = (date.getMonth() + 1).toString().padStart(2, '0')
      const day = date.getDate().toString().padStart(2, '0')
      return `${month}-${day} ${this.formatTime(date)}`
    }
  },

  // 格式化时间
  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  },

  // 搜索
  onSearch(e) {
    const searchText = e.detail.value.trim().toLowerCase()
    this.setData({ searchText })

    if (!searchText) {
      this.setData({ filteredList: this.data.historyList })
      return
    }

    const filtered = this.data.historyList.filter(item => {
      return item.question.toLowerCase().includes(searchText) ||
             item.answer.toLowerCase().includes(searchText)
    })

    this.setData({ filteredList: filtered })
  },

  // 清除搜索
  clearSearch() {
    this.setData({
      searchText: '',
      filteredList: this.data.historyList
    })
  },

  // 跳转到对话
  goToChat(e) {
    // 直接跳转到AI聊天页面
    wx.navigateTo({
      url: '/pages/ai-rag/chat/index'
    })
  },

  // 开始新对话
  goNewChat() {
    wx.navigateTo({
      url: '/pages/ai-rag/chat/index'
    })
  },

  // 清空所有历史
  clearAllHistory() {
    wx.showModal({
      title: '清空历史',
      content: '确认清空所有咨询历史记录？此操作不可恢复。',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('aiChatHistory')
          this.setData({
            historyList: [],
            filteredList: []
          })
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  }
})
