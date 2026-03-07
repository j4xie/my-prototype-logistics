/**
 * AI装修对话助手
 * 通过自然语言对话推荐/应用店铺主题
 */
const app = getApp()
const api = require('../../../utils/api')
const ossUpload = require('../../../utils/oss')
const { THEME_COLORS: THEMES } = require('../../../utils/themes')

// Session 过期时间: 7 天
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
// 消息 ID 计数器
let msgIdCounter = 0

Page({
  data: {
    messages: [],
    inputText: '',
    isTyping: false,
    scrollToMessage: '',
    sessionId: '',
    quickQuestions: [
      '帮我设计一个火锅店首页',
      '推荐一个适合食品生鲜的主题',
      '去掉分类导航，加个促销图',
      '商品改成3列布局'
    ],
    // 图片上传目标选择
    showUploadMenu: false,
    // 编辑卡状态
    editCardData: null,
    editCardModuleType: '',
    editCardTitle: '',
    editCardContent: '',
    editCardImageUrl: '',
    // 版本历史面板
    showVersionPanel: false,
    versionList: [],
    // 预览面板
    showPreview: false,
    previewModules: [],
    previewCssVars: '',
    moduleIconMap: {
      header: 'apps', notice_bar: 'notice', banner: 'picfill',
      category_grid: 'apps', quick_actions: 'flashlightopen',
      product_scroll: 'cart', product_grid: 'shopfill',
      text_image: 'picfill', image_ad: 'picfill', ai_float: 'service',
      video: 'videofill', countdown: 'timefill', coupon: 'ticketfill',
      announcement: 'noticefill', new_arrivals: 'newsfill'
    },
    moduleNameMap: {
      header: '导航栏', notice_bar: '通知栏', banner: '轮播图',
      category_grid: '分类导航', quick_actions: '快捷入口',
      product_scroll: '热销商品', product_grid: '商品网格',
      text_image: '图文', image_ad: '广告图', ai_float: 'AI按钮',
      video: '视频', countdown: '倒计时', coupon: '优惠券',
      announcement: '公告', new_arrivals: '新品推荐'
    }
  },

  onLoad() {
    // 获取商户ID (多租户隔离)
    const merchantId = app.globalData.merchantId || null
    this.setData({ merchantId })

    // Session TTL: 从 sessionId 中提取创建时间，过期则重新生成
    const savedSessionId = wx.getStorageSync('decorationChatSessionId')
    let sessionId = savedSessionId
    if (savedSessionId) {
      const ts = parseInt(savedSessionId.split('_')[1])
      if (!ts || Date.now() - ts > SESSION_TTL_MS) {
        sessionId = null // 已过期
      }
    }
    if (!sessionId) {
      sessionId = 'dchat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      wx.setStorageSync('decorationChatSessionId', sessionId)
    }
    this.setData({ sessionId })

    // Load cached history
    const history = wx.getStorageSync('decorationChatHistory') || []
    if (history.length > 0) {
      this.setData({ messages: history })
      this.scrollToBottom()
    }
  },

  onInputChange(e) {
    this.setData({ inputText: e.detail.value })
  },

  sendMessage() {
    const text = this.data.inputText.trim()
    if (!text || this.data.isTyping) return

    this.setData({ inputText: '' })
    this.askQuestion(text)
  },

  askQuickQuestion(e) {
    const question = e.currentTarget.dataset.question
    this.askQuestion(question)
  },

  async askQuestion(question) {
    // Add user message
    const userMessage = {
      id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
      sender: 'user',
      text: question,
      timeStr: this.formatTime(new Date())
    }

    const messages = [...this.data.messages, userMessage]
    this.setData({ messages, isTyping: true })
    this.scrollToBottom()

    try {
      const res = await api.decorationChat({
        message: question,
        sessionId: this.data.sessionId,
        merchantId: this.data.merchantId
      })

      if (res.code === 200 && res.data) {
        const data = res.data

        // Update sessionId if returned
        if (data.sessionId) {
          this.setData({ sessionId: data.sessionId })
          wx.setStorageSync('decorationChatSessionId', data.sessionId)
        }

        // Build AI message
        const aiMessage = {
          id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
          sender: 'ai',
          text: data.reply || '收到您的请求',
          timeStr: this.formatTime(new Date()),
          action: data.action,
          applied: data.applied || false
        }

        // Attach theme card if theme recommended/applied
        if (data.themeCode && data.themeConfig) {
          const themeInfo = THEMES[data.themeCode] || {}
          aiMessage.themeCard = {
            code: data.themeCode,
            name: data.themeName || themeInfo.name || data.themeCode,
            primaryColor: data.themeConfig.primaryColor || themeInfo.primaryColor,
            secondaryColor: data.themeConfig.secondaryColor || themeInfo.secondaryColor,
            backgroundColor: data.themeConfig.backgroundColor || themeInfo.backgroundColor,
            accentColor: data.themeConfig.accentColor || themeInfo.accentColor,
            borderColor: data.themeConfig.borderColor || themeInfo.borderColor,
            themeConfig: data.themeConfig
          }
        }

        // Attach template card
        if (data.templateCard) {
          const moduleNameMap = {
            header: '导航栏', notice_bar: '通知栏', banner: '轮播图',
            category_grid: '分类导航', quick_actions: '快捷入口',
            product_scroll: '热销商品', product_grid: '商品网格',
            text_image: '图文', image_ad: '广告图', ai_float: 'AI按钮',
            video: '视频', countdown: '倒计时', coupon: '优惠券',
            announcement: '公告', new_arrivals: '新品推荐'
          }
          const modules = data.templateCard.modules || []
          aiMessage.templateCard = {
            ...data.templateCard,
            code: data.templateCode,
            moduleNames: modules.filter(m => m.visible !== false).map(m => moduleNameMap[m.type] || m.type)
          }
        }

        // Attach module change card
        if (data.moduleChange) {
          const actionTextMap = {
            add: '添加模块', remove: '移除模块', update: '更新模块',
            toggle: '切换显示', reorder: '调整顺序'
          }
          aiMessage.moduleChange = {
            ...data.moduleChange,
            actionText: actionTextMap[data.moduleChange.action] || data.moduleChange.action,
            detail: data.moduleChange.moduleType || ''
          }

          // Show edit card for editable module types when added
          const editableTypes = ['text_image', 'image_ad', 'video', 'countdown', 'product_grid', 'announcement']
          if (data.moduleChange.action === 'add' && editableTypes.includes(data.moduleChange.moduleType)) {
            const mType = data.moduleChange.moduleType
            const nameMap = {
              text_image: '图文', image_ad: '广告图', video: '视频',
              countdown: '倒计时', product_grid: '商品网格', announcement: '公告'
            }
            const editCard = { moduleName: nameMap[mType] || mType, moduleType: mType }

            if (mType === 'text_image') {
              Object.assign(editCard, { showTitle: true, showContent: true, title: '', content: '', imageUrl: '' })
            } else if (mType === 'image_ad') {
              Object.assign(editCard, { showTitle: true, title: '', imageUrl: '' })
            } else if (mType === 'video') {
              Object.assign(editCard, { showTitle: true, title: '', videoUrl: '', posterUrl: '', autoplay: false, loop: false })
            } else if (mType === 'countdown') {
              Object.assign(editCard, { showTitle: true, title: '限时特惠', subtitle: '', endDate: '', endTimeStr: '' })
            } else if (mType === 'product_grid') {
              Object.assign(editCard, { showTitle: true, title: '精选商品', columns: 2, showPrice: true, showSales: false })
            } else if (mType === 'announcement') {
              Object.assign(editCard, { showTitle: false, announcementContent: '' })
            }

            aiMessage.editCard = editCard
            this.showEditCard(mType, editCard)
          }
        }

        // Attach AI generated image card
        if (data.imageGenerated && data.generatedImageUrl) {
          aiMessage.imageCard = {
            imageUrl: data.generatedImageUrl,
            prompt: data.imagePrompt || '',
            target: data.imageTarget || '',
            applied: data.imageApplied || false
          }
        } else if (data.imageGenerated === false && data.imageError) {
          aiMessage.imageError = data.imageError
        }

        // Applied text for template
        if (data.applied && data.templateCode) {
          aiMessage.appliedText = '模板已成功应用'
        }

        const newMessages = [...this.data.messages, aiMessage]
        this.setData({ messages: newMessages, isTyping: false })
        this.scrollToBottom()
        this.saveHistory()

        // Auto-refresh preview if modules/theme/template changed
        const hasChange = data.action && data.action !== 'none' && data.action !== 'chat'
        if (hasChange && this.data.showPreview) {
          this.refreshPreview()
        }
      } else {
        this.addErrorMessage('AI助手暂时不可用，请稍后重试')
      }
    } catch (error) {
      console.error('装修Chat请求失败:', error)
      this.addErrorMessage('网络连接失败，请检查网络后重试')
    }
  },

  addErrorMessage(text) {
    const errorMessage = {
      id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
      sender: 'ai',
      text: text,
      timeStr: this.formatTime(new Date())
    }
    const newMessages = [...this.data.messages, errorMessage]
    this.setData({ messages: newMessages, isTyping: false })
    this.scrollToBottom()
  },

  // Apply template from card button
  async applyTemplateFromChat(e) {
    const template = e.currentTarget.dataset.template
    if (!template || !template.code) return

    wx.showLoading({ title: '应用模板中...' })

    try {
      await api.request('/weixin/api/ma/decoration/template/apply', 'post', {
        templateCode: template.code,
        merchantId: this.data.merchantId
      }, false)

      wx.hideLoading()
      wx.showToast({ title: '模板已应用', icon: 'success' })

      const appliedMessage = {
        id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
        sender: 'ai',
        text: '「' + template.name + '」模板已成功应用！返回首页即可查看效果。',
        timeStr: this.formatTime(new Date()),
        applied: true,
        appliedText: '模板已成功应用'
      }
      const newMessages = [...this.data.messages, appliedMessage]
      this.setData({ messages: newMessages })
      this.scrollToBottom()
      this.saveHistory()

      // Auto-refresh preview
      if (this.data.showPreview) {
        this.refreshPreview()
      }
    } catch (error) {
      wx.hideLoading()
      console.error('应用模板失败:', error)
      wx.showToast({ title: '应用失败', icon: 'none' })
    }
  },

  // Apply theme from card button
  async applyThemeFromChat(e) {
    const theme = e.currentTarget.dataset.theme
    if (!theme || !theme.code) return

    wx.showLoading({ title: '应用中...' })

    try {
      // Call apply via chat message
      const res = await api.decorationChat({
        message: '应用' + theme.name + '主题',
        sessionId: this.data.sessionId,
        merchantId: this.data.merchantId
      })

      wx.hideLoading()

      if (res.code === 200 && res.data && res.data.applied) {
        wx.showToast({ title: '主题已应用', icon: 'success' })

        // Add applied confirmation to messages
        const appliedMessage = {
          id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
          sender: 'ai',
          text: '「' + theme.name + '」主题已成功应用到您的店铺！返回首页即可查看效果。',
          timeStr: this.formatTime(new Date()),
          applied: true
        }
        const newMessages = [...this.data.messages, appliedMessage]
        this.setData({ messages: newMessages })
        this.scrollToBottom()
        this.saveHistory()
      } else {
        // Fallback: use savePageConfig API directly
        try {
          const configData = {
            themeCode: theme.code,
            themeConfig: theme.themeConfig,
            pageType: 'home',
            merchantId: this.data.merchantId
          }
          await api.request('/weixin/api/ma/decoration/page-config', 'post', configData, false)
          wx.showToast({ title: '主题已应用', icon: 'success' })

          const appliedMessage = {
            id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
            sender: 'ai',
            text: '「' + theme.name + '」主题已成功应用！',
            timeStr: this.formatTime(new Date()),
            applied: true
          }
          const newMessages = [...this.data.messages, appliedMessage]
          this.setData({ messages: newMessages })
          this.scrollToBottom()
          this.saveHistory()
        } catch (fallbackErr) {
          console.error('Fallback应用失败:', fallbackErr)
          wx.showToast({ title: '应用失败，请重试', icon: 'none' })
        }
      }
    } catch (error) {
      wx.hideLoading()
      console.error('应用主题失败:', error)
      wx.showToast({ title: '应用失败', icon: 'none' })
    }
  },

  saveHistory() {
    const messages = this.data.messages.slice(-30)
    wx.setStorageSync('decorationChatHistory', messages)
  },

  scrollToBottom() {
    setTimeout(() => {
      this.setData({ scrollToMessage: 'msg-bottom' })
    }, 100)
  },

  formatTime(date) {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return hours + ':' + minutes
  },

  clearChat() {
    if (this.data.messages.length === 0) {
      wx.showToast({ title: '暂无对话记录', icon: 'none' })
      return
    }

    wx.showModal({
      title: '清空对话',
      content: '确认清空所有对话记录？',
      success: (res) => {
        if (res.confirm) {
          const newSessionId = 'dchat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
          this.setData({
            messages: [],
            sessionId: newSessionId
          })
          wx.removeStorageSync('decorationChatHistory')
          wx.setStorageSync('decorationChatSessionId', newSessionId)
          wx.showToast({ title: '已清空', icon: 'success' })
        }
      }
    })
  },

  // ========== 图片上传 ==========

  toggleUploadMenu() {
    this.setData({ showUploadMenu: !this.data.showUploadMenu })
  },

  async uploadImageForModule(e) {
    const target = e.currentTarget.dataset.target // banner / image_ad / text_image
    this.setData({ showUploadMenu: false })

    try {
      const count = target === 'banner' ? 5 : 1
      const urls = await ossUpload.chooseAndUpload({ count, type: 'decoration' })

      if (urls.length === 0) return

      // Send as chat message so backend handles the update
      const urlText = urls.join(',')
      let instruction = ''
      if (target === 'banner') {
        instruction = '设置轮播图图片：' + urlText
      } else if (target === 'image_ad') {
        instruction = '设置广告图图片：' + urlText
      } else {
        instruction = '设置图文图片：' + urlText
      }

      wx.showToast({ title: '图片已上传', icon: 'success' })
      this.askQuestion(instruction)
    } catch (error) {
      if (error.message && error.message.includes('取消')) return
      console.error('图片上传失败:', error)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  async uploadVideoForModule() {
    this.setData({ showUploadMenu: false })

    try {
      const urls = await ossUpload.chooseAndUpload({
        count: 1,
        type: 'decoration',
        mediaType: 'video'
      })

      if (urls.length === 0) return

      const instruction = '设置视频模块视频：' + urls[0]
      wx.showToast({ title: '视频已上传', icon: 'success' })
      this.askQuestion(instruction)
    } catch (error) {
      if (error.message && error.message.includes('取消')) return
      console.error('视频上传失败:', error)
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  // ========== 编辑卡 ==========

  showEditCard(moduleType, props) {
    const p = props || {}
    this.setData({
      editCardData: p,
      editCardModuleType: moduleType,
      editCardTitle: p.title || '',
      editCardContent: p.content || '',
      editCardImageUrl: p.imageUrl || ''
    })
  },

  onEditCardInput(e) {
    const field = e.currentTarget.dataset.field
    // For title/content/imageUrl, update component-level data (used by text_image/image_ad)
    const topLevelFields = { title: 'editCardTitle', content: 'editCardContent', imageUrl: 'editCardImageUrl' }
    if (topLevelFields[field]) {
      this.setData({ [topLevelFields[field]]: e.detail.value })
    }
    // Also update the message editCard object (used by all module types)
    const msgs = this.data.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].editCard) {
        const key = 'messages[' + i + '].editCard.' + field
        this.setData({ [key]: e.detail.value })
        break
      }
    }
  },

  async changeEditImage() {
    try {
      const urls = await ossUpload.chooseAndUpload({ count: 1, type: 'decoration' })
      if (urls.length > 0) {
        this.setData({ editCardImageUrl: urls[0] })
      }
    } catch (error) {
      if (error.message && error.message.includes('取消')) return
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  applyEditCard() {
    const mType = this.data.editCardModuleType
    const title = this.data.editCardTitle
    const content = this.data.editCardContent
    const imageUrl = this.data.editCardImageUrl
    const nameMap = {
      text_image: '图文', image_ad: '广告图', video: '视频',
      countdown: '倒计时', product_grid: '商品网格', announcement: '公告'
    }
    const moduleName = nameMap[mType] || mType

    let instruction = '更新' + moduleName + '模块：'

    if (mType === 'text_image' || mType === 'image_ad') {
      if (title) instruction += '标题=' + title + ' '
      if (content) instruction += '内容=' + content + ' '
      if (imageUrl) instruction += '图片=' + imageUrl
    } else if (mType === 'video') {
      // Read from last message's editCard data
      const lastMsg = this._getEditCardMessage()
      if (title) instruction += '标题=' + title + ' '
      if (lastMsg) {
        if (lastMsg.editCard.videoUrl) instruction += '视频=' + lastMsg.editCard.videoUrl + ' '
        if (lastMsg.editCard.posterUrl) instruction += '封面=' + lastMsg.editCard.posterUrl + ' '
        instruction += '自动播放=' + (lastMsg.editCard.autoplay ? '是' : '否') + ' '
        instruction += '循环=' + (lastMsg.editCard.loop ? '是' : '否')
      }
    } else if (mType === 'countdown') {
      const lastMsg = this._getEditCardMessage()
      if (title) instruction += '标题=' + title + ' '
      if (lastMsg) {
        if (lastMsg.editCard.subtitle) instruction += '副标题=' + lastMsg.editCard.subtitle + ' '
        if (lastMsg.editCard.endDate) {
          const endStr = lastMsg.editCard.endDate + (lastMsg.editCard.endTimeStr ? ' ' + lastMsg.editCard.endTimeStr : ' 23:59')
          instruction += '结束时间=' + endStr
        }
      }
    } else if (mType === 'product_grid') {
      const lastMsg = this._getEditCardMessage()
      if (title) instruction += '标题=' + title + ' '
      if (lastMsg) {
        instruction += '列数=' + (lastMsg.editCard.columns || 2) + ' '
        instruction += '显示价格=' + (lastMsg.editCard.showPrice !== false ? '是' : '否') + ' '
        instruction += '显示销量=' + (lastMsg.editCard.showSales ? '是' : '否')
      }
    } else if (mType === 'announcement') {
      const lastMsg = this._getEditCardMessage()
      if (lastMsg && lastMsg.editCard.announcementContent) {
        instruction += '内容=' + lastMsg.editCard.announcementContent
      }
    }

    this.setData({ editCardData: null, editCardModuleType: '' })
    this.askQuestion(instruction.trim())
  },

  // Helper: find the message containing the active editCard
  _getEditCardMessage() {
    const msgs = this.data.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].editCard) return msgs[i]
    }
    return null
  },

  // Toggle switch fields in edit card (autoplay, loop, showPrice, showSales)
  toggleEditSwitch(e) {
    const field = e.currentTarget.dataset.field
    const msgs = this.data.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].editCard) {
        const key = 'messages[' + i + '].editCard.' + field
        this.setData({ [key]: !msgs[i].editCard[field] })
        break
      }
    }
  },

  // Date picker change for edit card
  onEditDateChange(e) {
    const field = e.currentTarget.dataset.field
    const msgs = this.data.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].editCard) {
        const key = 'messages[' + i + '].editCard.' + field
        this.setData({ [key]: e.detail.value })
        break
      }
    }
  },

  // Time picker change for edit card
  onEditTimeChange(e) {
    const field = e.currentTarget.dataset.field
    const msgs = this.data.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].editCard) {
        const key = 'messages[' + i + '].editCard.' + field
        this.setData({ [key]: e.detail.value })
        break
      }
    }
  },

  // Set columns for product_grid edit card
  setEditColumns(e) {
    const columns = parseInt(e.currentTarget.dataset.columns)
    const msgs = this.data.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].editCard) {
        const key = 'messages[' + i + '].editCard.columns'
        this.setData({ [key]: columns })
        break
      }
    }
  },

  cancelEditCard() {
    this.setData({
      editCardData: null,
      editCardModuleType: '',
      editCardTitle: '',
      editCardContent: '',
      editCardImageUrl: ''
    })
  },

  // ========== 预览面板 ==========

  togglePreview() {
    if (this.data.showPreview) {
      this.setData({ showPreview: false })
    } else {
      this.refreshPreview()
    }
  },

  async refreshPreview() {
    wx.showLoading({ title: '刷新预览...' })
    try {
      const res = await api.getDecorationConfig('home', this.data.merchantId)
      wx.hideLoading()

      if (res.data) {
        let modules = res.data.modules || []
        modules = modules.sort((a, b) => (a.order || 0) - (b.order || 0))
        const theme = res.data.theme || {}
        const vars = []
        if (theme.primaryColor) vars.push('--preview-primary:' + theme.primaryColor)
        if (theme.backgroundColor) vars.push('--preview-bg:' + theme.backgroundColor)

        this.setData({
          showPreview: true,
          previewModules: modules,
          previewCssVars: vars.join(';')
        })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '刷新失败', icon: 'none' })
    }
  },

  closePreview() {
    this.setData({ showPreview: false })
  },

  goToHomePreview() {
    this.setData({ showPreview: false })
    wx.switchTab({ url: '/pages/home/index' })
  },

  goBack() {
    wx.navigateBack()
  },

  // ========== 版本历史 ==========

  async showVersionHistory() {
    wx.showLoading({ title: '加载中...' })
    try {
      const res = await api.getDecorationVersions(this.data.merchantId)
      wx.hideLoading()
      this.setData({
        showVersionPanel: true,
        versionList: (res.data || []).map(v => ({
          ...v,
          createTime: v.createTime ? v.createTime.replace('T', ' ').substring(0, 16) : ''
        }))
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  closeVersionPanel() {
    this.setData({ showVersionPanel: false })
  },

  rollbackVersion(e) {
    const { id, no } = e.currentTarget.dataset
    wx.showModal({
      title: '回滚确认',
      content: '确认回滚到版本 v' + no + '？当前配置将被覆盖。',
      success: async (res) => {
        if (!res.confirm) return
        wx.showLoading({ title: '回滚中...' })
        try {
          const result = await api.rollbackDecorationVersion(id, this.data.merchantId)
          wx.hideLoading()
          if (result.data && result.data.success) {
            wx.showToast({ title: '已回滚到 v' + no, icon: 'success' })
            this.setData({ showVersionPanel: false })
            // 刷新预览
            if (this.data.showPreview) this.refreshPreview()
            // 添加回滚消息到聊天
            const rollbackMsg = {
              id: 'msg_' + Date.now() + '_' + (++msgIdCounter),
              sender: 'ai',
              text: '已回滚到版本 v' + no + '，页面配置已恢复。',
              timeStr: this.formatTime(new Date()),
              applied: true,
              appliedText: '版本已回滚'
            }
            this.setData({ messages: [...this.data.messages, rollbackMsg] })
            this.scrollToBottom()
            this.saveHistory()
          } else {
            wx.showToast({ title: result.msg || '回滚失败', icon: 'none' })
          }
        } catch (error) {
          wx.hideLoading()
          wx.showToast({ title: '回滚失败', icon: 'none' })
        }
      }
    })
  },

  onShareAppMessage() {
    return {
      title: 'AI装修助手 - 一句话装修你的店铺',
      path: '/pages/merchant-center/decoration-chat/index'
    }
  }
})