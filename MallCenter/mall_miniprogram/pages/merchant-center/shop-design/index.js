/**
 * 店铺装修 - 主页面
 * 功能：主题选择、AI推荐、预览效果
 */
const app = getApp()
const api = require('../../../utils/api')

Page({
  data: {
    loading: true,
    // 当前主题配置
    currentTheme: null,
    // 可选主题列表
    themes: [],
    // 当前选中的主题ID
    selectedThemeId: null,
    // AI推荐输入
    aiPrompt: '',
    aiLoading: false,
    aiResult: null,
    // 预览模式
    showPreview: false,
    previewStyle: '',
    // 素材展示区域
    recommendedImages: [],
    layouts: [],
    componentStyles: [],
    selectedLayout: null,
    selectedStyle: null,

    // ========== 引导式装修向导 ==========
    showGuideWizard: false,
    guideStep: 1,
    guideSessionId: null,
    guideData: {
      industry: '',
      industryName: '',
      style: '',
      styleName: '',
      themeCode: '',
      themeName: '',
      selectedTheme: null,
      productDesc: ''
    },
    guidePreviewStyle: '',
    canProceed: false,
    applyingConfig: false,

    // 行业选项
    industryOptions: [
      { code: 'fresh_food', name: '生鲜水果', icon: 'cuIcon-emoji' },
      { code: 'seafood', name: '海鲜水产', icon: 'cuIcon-like' },
      { code: 'bakery', name: '甜品烘焙', icon: 'cuIcon-favorfill' },
      { code: 'gift', name: '高端礼品', icon: 'cuIcon-present' },
      { code: 'baby', name: '母婴用品', icon: 'cuIcon-peoplefill' },
      { code: 'cosmetics', name: '美妆护肤', icon: 'cuIcon-skin' },
      { code: 'digital', name: '数码电器', icon: 'cuIcon-computer' },
      { code: 'general', name: '综合零售', icon: 'cuIcon-shop' }
    ],

    // 风格选项（根据行业动态调整）
    styleOptions: [],
    // 推荐主题列表
    recommendedThemes: [],

    // AI图片生成
    generatingImage: false,
    generatedImages: [],
    selectedImageIndex: -1
  },

  onLoad() {
    this.loadCurrentConfig()
    this.loadThemes()
  },

  /**
   * 加载当前店铺配置
   */
  async loadCurrentConfig() {
    try {
      const merchantId = app.globalData.merchantId
      const res = await api.getDecorationConfig('home', merchantId)
      if (res.data && res.data.theme) {
        this.setData({
          currentTheme: res.data.theme,
          selectedThemeId: res.data.themeId
        })
      }
    } catch (err) {
      console.error('加载当前配置失败:', err)
    }
  },

  /**
   * 加载可用主题列表
   */
  async loadThemes() {
    this.setData({ loading: true })
    try {
      // 调用后端API获取主题列表
      const res = await this.fetchThemes()
      if (res && res.length > 0) {
        this.setData({ themes: res })
      } else {
        // 使用默认主题
        this.setData({ themes: this.getDefaultThemes() })
      }
    } catch (err) {
      console.error('加载主题列表失败:', err)
      this.setData({ themes: this.getDefaultThemes() })
    } finally {
      this.setData({ loading: false })
    }
  },

  /**
   * 从后端获取主题
   */
  async fetchThemes() {
    return new Promise((resolve, reject) => {
      const config = app.globalData.config
      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/themes',
        method: 'GET',
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            resolve(res.data.data || [])
          } else {
            resolve([])
          }
        },
        fail: (err) => {
          reject(err)
        }
      })
    })
  },

  /**
   * 15套行业主题配置（完整版）
   * 基于2025年UI设计趋势研究
   */
  getDefaultThemes() {
    return [
      // === 食品生鲜类 ===
      {
        id: 1, code: 'fresh_green', name: '清新绿',
        description: '自然清新，适合生鲜蔬果、有机食品',
        slogan: '新鲜直达，品质生活',
        primaryColor: '#52c41a', secondaryColor: '#389e0d',
        previewBg: 'linear-gradient(135deg, #52c41a, #389e0d)',
        industries: ['food', 'organic', 'vegetable', 'fruit']
      },
      {
        id: 2, code: 'ocean_blue', name: '海洋蓝',
        description: '清爽海洋风，适合海鲜水产、进口食品',
        slogan: '深海臻选，鲜活到家',
        primaryColor: '#1890ff', secondaryColor: '#096dd9',
        previewBg: 'linear-gradient(135deg, #1890ff, #096dd9)',
        industries: ['seafood', 'import', 'frozen']
      },
      {
        id: 3, code: 'farm_green', name: '田园绿',
        description: '淳朴自然，适合农产品、土特产',
        slogan: '田间直送，原味乡土',
        primaryColor: '#7CB305', secondaryColor: '#5B8C00',
        previewBg: 'linear-gradient(135deg, #7CB305, #5B8C00)',
        industries: ['farm', 'specialty', 'grain']
      },
      // === 高端奢侈类 ===
      {
        id: 4, code: 'classic_gold', name: '经典金',
        description: '尊贵大气，适合高端礼品、奢侈品',
        slogan: '臻选品质，尊享生活',
        primaryColor: '#D4AF37', secondaryColor: '#B8860B',
        previewBg: 'linear-gradient(135deg, #D4AF37, #B8860B)',
        industries: ['gift', 'jewelry', 'wine', 'tea']
      },
      {
        id: 5, code: 'tea_brown', name: '茶韵棕',
        description: '古朴雅致，适合茶叶、咖啡、传统糕点',
        slogan: '一盏茶香，品味人生',
        primaryColor: '#8B4513', secondaryColor: '#6D4C41',
        previewBg: 'linear-gradient(135deg, #8B4513, #6D4C41)',
        industries: ['tea', 'coffee', 'pastry']
      },
      // === 母婴甜品类 ===
      {
        id: 6, code: 'baby_warm', name: '母婴暖',
        description: '柔和温暖，适合母婴用品、儿童玩具',
        slogan: '用心呵护，陪伴成长',
        primaryColor: '#F4C2C2', secondaryColor: '#EE96AA',
        previewBg: 'linear-gradient(135deg, #F4C2C2, #FFB6C1)',
        industries: ['baby', 'mother', 'children', 'toy']
      },
      {
        id: 7, code: 'sweet_pink', name: '甜美粉',
        description: '温馨甜美，适合甜品烘焙、少女风',
        slogan: '甜蜜时光，幸福味道',
        primaryColor: '#eb2f96', secondaryColor: '#c41d7f',
        previewBg: 'linear-gradient(135deg, #eb2f96, #c41d7f)',
        industries: ['bakery', 'dessert', 'girl', 'gift']
      },
      // === 美妆时尚类 ===
      {
        id: 8, code: 'beauty_purple', name: '美妆紫',
        description: '优雅浪漫，适合美妆护肤、时尚配饰',
        slogan: '美丽绽放，自信由我',
        primaryColor: '#722ED1', secondaryColor: '#531DAB',
        previewBg: 'linear-gradient(135deg, #722ED1, #531DAB)',
        industries: ['cosmetics', 'skincare', 'fashion', 'perfume']
      },
      {
        id: 9, code: 'dark_night', name: '深夜黑',
        description: '酷炫潮流，适合潮牌服饰、电竞周边',
        slogan: '释放自我，潮流不息',
        primaryColor: '#FAAD14', secondaryColor: '#D48806',
        previewBg: 'linear-gradient(135deg, #1a1a1a, #333333)',
        industries: ['fashion', 'streetwear', 'gaming', 'nightlife']
      },
      // === 科技家居类 ===
      {
        id: 10, code: 'tech_blue', name: '科技蓝',
        description: '科技感十足，适合数码产品、智能家电',
        slogan: '智能生活，触手可及',
        primaryColor: '#2F54EB', secondaryColor: '#1D39C4',
        previewBg: 'linear-gradient(135deg, #2F54EB, #1D39C4)',
        industries: ['digital', 'electronic', 'smart', 'appliance']
      },
      {
        id: 11, code: 'natural_wood', name: '自然木',
        description: '质朴自然，适合家居家具、手工艺品',
        slogan: '匠心之作，温暖家居',
        primaryColor: '#A0522D', secondaryColor: '#8B4513',
        previewBg: 'linear-gradient(135deg, #A0522D, #8B4513)',
        industries: ['furniture', 'home', 'craft', 'wood']
      },
      // === 促销节日类 ===
      {
        id: 12, code: 'dopamine_orange', name: '活力橙',
        description: '热情活力，适合促销活动、快消品',
        slogan: '活力满满，惊喜不断',
        primaryColor: '#fa8c16', secondaryColor: '#d46b08',
        previewBg: 'linear-gradient(135deg, #fa8c16, #d46b08)',
        industries: ['snack', 'beverage', 'fashion', 'promotion']
      },
      {
        id: 13, code: 'festival_red', name: '节日红',
        description: '喜庆热烈，适合节日促销、喜庆礼品',
        slogan: '喜迎佳节，好礼相送',
        primaryColor: '#CF1322', secondaryColor: '#A8071A',
        previewBg: 'linear-gradient(135deg, #CF1322, #A8071A)',
        industries: ['festival', 'gift', 'specialty', 'newyear']
      },
      // === 健康服务类 ===
      {
        id: 14, code: 'medical_blue', name: '医疗蓝',
        description: '专业可信，适合保健品、健康服务',
        slogan: '专业守护，健康生活',
        primaryColor: '#13C2C2', secondaryColor: '#08979C',
        previewBg: 'linear-gradient(135deg, #13C2C2, #08979C)',
        industries: ['health', 'supplement', 'medical', 'wellness']
      },
      // === 通用极简类 ===
      {
        id: 15, code: 'minimal_white', name: '简约白',
        description: '简洁明了，适合追求极简风格的各类店铺',
        slogan: '简约不简单',
        primaryColor: '#333333', secondaryColor: '#666666',
        previewBg: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
        industries: ['general', 'retail', 'service']
      }
    ]
  },

  /**
   * 选择主题
   */
  selectTheme(e) {
    const theme = e.currentTarget.dataset.theme
    this.setData({
      selectedThemeId: theme.id,
      previewStyle: this.generatePreviewStyle(theme)
    })

    // 加载该主题的素材资源
    this.loadThemeAssets(theme.code)

    // 显示预览
    this.setData({ showPreview: true })
  },

  /**
   * 加载主题相关素材资源
   * @param {string} themeCode - 主题代码
   */
  async loadThemeAssets(themeCode) {
    if (!themeCode) return

    try {
      const config = app.globalData.config
      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/theme/' + themeCode + '/assets',
        method: 'GET',
        header: {
          'third-session': app.globalData.thirdSession || ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            const data = res.data.data || {}
            this.setData({
              recommendedImages: data.images || [],
              layouts: data.layouts || [],
              componentStyles: data.componentStyles || []
            })
          } else {
            // 清空素材数据
            this.setData({
              recommendedImages: [],
              layouts: [],
              componentStyles: []
            })
          }
        },
        fail: () => {
          // 清空素材数据
          this.setData({
            recommendedImages: [],
            layouts: [],
            componentStyles: []
          })
        }
      })
    } catch (err) {
      console.error('加载主题素材失败:', err)
    }
  },

  /**
   * 选择推荐图片
   */
  onImageSelect(e) {
    const image = e.currentTarget.dataset.image
    if (!image) return

    // 预览图片
    wx.previewImage({
      current: image.url,
      urls: this.data.recommendedImages.map(img => img.url)
    })
  },

  /**
   * 选择布局
   */
  onLayoutSelect(e) {
    const layout = e.currentTarget.dataset.layout
    if (!layout) return

    this.setData({ selectedLayout: layout })
    wx.showToast({
      title: '已选择 ' + layout.name,
      icon: 'none'
    })
  },

  /**
   * 选择组件样式
   */
  onStyleSelect(e) {
    const style = e.currentTarget.dataset.style
    if (!style) return

    this.setData({ selectedStyle: style })
    wx.showToast({
      title: '已选择 ' + style.styleName,
      icon: 'none'
    })
  },

  /**
   * 生成预览样式
   */
  generatePreviewStyle(theme) {
    if (!theme) return ''
    return `--primary-gold: ${theme.primaryColor}; --primary-color: ${theme.primaryColor}; --border-gold: ${theme.primaryColor}; --accent-color: ${theme.primaryColor};`
  },

  /**
   * 应用选中的主题
   */
  async applyTheme() {
    const selectedId = this.data.selectedThemeId
    if (!selectedId) {
      wx.showToast({ title: '请选择主题', icon: 'none' })
      return
    }

    const theme = this.data.themes.find(t => t.id === selectedId)
    if (!theme) return

    wx.showLoading({ title: '应用中...' })
    try {
      // 调用后端API保存配置
      const merchantId = app.globalData.merchantId
      await this.saveThemeConfig(merchantId, theme)

      wx.hideLoading()
      wx.showToast({ title: '主题已应用', icon: 'success' })

      // 关闭预览
      this.setData({ showPreview: false })

      // 更新当前主题
      this.setData({ currentTheme: theme })
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '应用失败', icon: 'none' })
      console.error('应用主题失败:', err)
    }
  },

  /**
   * 保存主题配置到后端
   */
  async saveThemeConfig(merchantId, theme) {
    return new Promise((resolve, reject) => {
      const config = app.globalData.config
      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/page-config',
        method: 'POST',
        data: {
          merchantId: merchantId,
          pageType: 'home',
          themeCode: theme.code,
          themeConfig: JSON.stringify({
            primaryColor: theme.primaryColor,
            secondaryColor: theme.secondaryColor
          })
        },
        header: {
          'content-type': 'application/json',
          'third-session': app.globalData.thirdSession || ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            resolve(res.data)
          } else {
            reject(new Error(res.data.msg || '保存失败'))
          }
        },
        fail: reject
      })
    })
  },

  /**
   * 关闭预览
   */
  closePreview() {
    this.setData({ showPreview: false })
  },

  /**
   * AI推荐 - 输入处理
   */
  onAiPromptInput(e) {
    this.setData({ aiPrompt: e.detail.value })
  },

  /**
   * AI推荐 - 提交分析
   */
  async submitAiAnalysis() {
    const prompt = this.data.aiPrompt.trim()
    if (!prompt) {
      wx.showToast({ title: '请输入店铺描述', icon: 'none' })
      return
    }

    this.setData({ aiLoading: true, aiResult: null })
    try {
      const result = await this.analyzeWithAi(prompt)
      if (result && result.recommendedTheme) {
        // 找到推荐的主题
        const theme = this.data.themes.find(t =>
          t.code === result.recommendedTheme || t.name === result.recommendedTheme
        )
        this.setData({
          aiResult: {
            ...result,
            matchedTheme: theme
          }
        })

        if (theme) {
          wx.showToast({ title: '找到推荐主题', icon: 'success' })
        }
      } else {
        this.setData({
          aiResult: { message: result.message || '分析完成，暂无匹配主题' }
        })
      }
    } catch (err) {
      console.error('AI分析失败:', err)
      wx.showToast({ title: '分析失败，请重试', icon: 'none' })
    } finally {
      this.setData({ aiLoading: false })
    }
  },

  /**
   * 调用AI分析接口
   */
  async analyzeWithAi(prompt) {
    return new Promise((resolve, reject) => {
      const config = app.globalData.config
      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/ai/analyze',
        method: 'POST',
        data: { prompt: prompt },
        header: {
          'content-type': 'application/json',
          'third-session': app.globalData.thirdSession || ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            resolve(res.data.data)
          } else {
            // 简单的本地匹配降级
            resolve(this.localMatch(prompt))
          }
        },
        fail: () => {
          // 本地匹配降级
          resolve(this.localMatch(prompt))
        }
      })
    })
  },

  /**
   * 本地简单匹配（API失败时的降级方案）
   */
  localMatch(prompt) {
    const keywords = {
      '生鲜': 'fresh_green',
      '水果': 'fresh_green',
      '蔬菜': 'fresh_green',
      '有机': 'fresh_green',
      '海鲜': 'ocean_blue',
      '水产': 'ocean_blue',
      '高端': 'classic_gold',
      '奢华': 'classic_gold',
      '礼品': 'classic_gold',
      '甜品': 'sweet_pink',
      '蛋糕': 'sweet_pink',
      '烘焙': 'sweet_pink',
      '促销': 'dopamine_orange',
      '活动': 'dopamine_orange',
      '简约': 'minimal_white',
      '清爽': 'ocean_blue'
    }

    for (const [kw, themeCode] of Object.entries(keywords)) {
      if (prompt.includes(kw)) {
        return {
          recommendedTheme: themeCode,
          reason: `根据"${kw}"关键词推荐`,
          confidence: 0.7
        }
      }
    }

    // 默认推荐清新绿
    return {
      recommendedTheme: 'fresh_green',
      reason: '默认推荐清新绿主题',
      confidence: 0.5
    }
  },

  /**
   * 应用AI推荐的主题
   */
  applyAiRecommendation() {
    const aiResult = this.data.aiResult
    if (aiResult && aiResult.matchedTheme) {
      this.setData({
        selectedThemeId: aiResult.matchedTheme.id,
        previewStyle: this.generatePreviewStyle(aiResult.matchedTheme),
        showPreview: true
      })
    }
  },

  // ==================== 引导式装修向导 ====================

  /**
   * 开始引导式装修流程
   */
  startGuideFlow() {
    // 重置引导数据
    this.setData({
      showGuideWizard: true,
      guideStep: 1,
      guideSessionId: null,
      guideData: {
        industry: '',
        industryName: '',
        style: '',
        styleName: '',
        themeCode: '',
        themeName: '',
        selectedTheme: null,
        productDesc: ''
      },
      guidePreviewStyle: '',
      canProceed: false,
      styleOptions: [],
      recommendedThemes: [],
      generatedImages: [],
      selectedImageIndex: -1
    })

    // 调用后端开始会话
    this.startGuideSession()
  },

  /**
   * 开始引导会话（调用后端API）
   */
  async startGuideSession() {
    try {
      const config = app.globalData.config
      const merchantId = app.globalData.merchantId
      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/ai/guide/start',
        method: 'POST',
        data: { merchantId: merchantId },
        header: {
          'content-type': 'application/json',
          'third-session': app.globalData.thirdSession || ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            this.setData({
              guideSessionId: res.data.data.sessionId
            })
          }
        }
      })
    } catch (err) {
      console.error('开始引导会话失败:', err)
    }
  },

  /**
   * 关闭引导向导
   */
  closeGuideWizard() {
    wx.showModal({
      title: '确认退出',
      content: '退出后当前进度将不会保存，确定退出吗？',
      confirmText: '确定退出',
      cancelText: '继续装修',
      success: (res) => {
        if (res.confirm) {
          this.setData({ showGuideWizard: false })
        }
      }
    })
  },

  /**
   * 选择行业
   */
  selectIndustry(e) {
    const industry = e.currentTarget.dataset.industry
    if (!industry) return

    this.setData({
      'guideData.industry': industry.code,
      'guideData.industryName': industry.name,
      canProceed: true
    })

    // 根据行业获取推荐风格
    this.loadStyleOptions(industry.code)
  },

  /**
   * 根据行业加载风格选项
   */
  loadStyleOptions(industryCode) {
    // 行业-风格映射（本地规则匹配，无需API调用）
    const styleMapping = {
      fresh_food: [
        { code: 'fresh', name: '清新自然', description: '绿色健康，传递新鲜感', previewBg: 'linear-gradient(135deg, #52c41a, #389e0d)' },
        { code: 'organic', name: '有机田园', description: '质朴自然，强调产地直供', previewBg: 'linear-gradient(135deg, #7CB305, #5B8C00)' },
        { code: 'minimal', name: '简约现代', description: '干净利落，突出商品本身', previewBg: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)' }
      ],
      seafood: [
        { code: 'ocean', name: '海洋清爽', description: '蓝色海洋风，鲜活直达', previewBg: 'linear-gradient(135deg, #1890ff, #096dd9)' },
        { code: 'fresh', name: '清新自然', description: '清新明亮，突出新鲜', previewBg: 'linear-gradient(135deg, #13C2C2, #08979C)' },
        { code: 'premium', name: '高端品质', description: '深色大气，强调品质', previewBg: 'linear-gradient(135deg, #1a1a1a, #333333)' }
      ],
      bakery: [
        { code: 'sweet', name: '甜美温馨', description: '粉色浪漫，甜蜜氛围', previewBg: 'linear-gradient(135deg, #eb2f96, #c41d7f)' },
        { code: 'warm', name: '温暖治愈', description: '暖色调，家的味道', previewBg: 'linear-gradient(135deg, #F4C2C2, #FFB6C1)' },
        { code: 'elegant', name: '优雅精致', description: '简约高级，品味之选', previewBg: 'linear-gradient(135deg, #722ED1, #531DAB)' }
      ],
      gift: [
        { code: 'luxury', name: '奢华尊贵', description: '金色高贵，彰显品位', previewBg: 'linear-gradient(135deg, #D4AF37, #B8860B)' },
        { code: 'festival', name: '喜庆节日', description: '红色喜庆，节日氛围', previewBg: 'linear-gradient(135deg, #CF1322, #A8071A)' },
        { code: 'classic', name: '经典大气', description: '沉稳大气，值得信赖', previewBg: 'linear-gradient(135deg, #8B4513, #6D4C41)' }
      ],
      baby: [
        { code: 'warm', name: '温馨呵护', description: '柔和色调，呵护成长', previewBg: 'linear-gradient(135deg, #F4C2C2, #FFB6C1)' },
        { code: 'playful', name: '活泼可爱', description: '明快色彩，充满童趣', previewBg: 'linear-gradient(135deg, #fa8c16, #d46b08)' },
        { code: 'pure', name: '纯净安心', description: '清新纯净，安全放心', previewBg: 'linear-gradient(135deg, #13C2C2, #08979C)' }
      ],
      cosmetics: [
        { code: 'elegant', name: '优雅浪漫', description: '紫色浪漫，美丽绽放', previewBg: 'linear-gradient(135deg, #722ED1, #531DAB)' },
        { code: 'trendy', name: '潮流时尚', description: '深色酷炫，引领潮流', previewBg: 'linear-gradient(135deg, #1a1a1a, #333333)' },
        { code: 'natural', name: '自然清新', description: '绿色健康，天然护肤', previewBg: 'linear-gradient(135deg, #52c41a, #389e0d)' }
      ],
      digital: [
        { code: 'tech', name: '科技感', description: '蓝色科技，智能未来', previewBg: 'linear-gradient(135deg, #2F54EB, #1D39C4)' },
        { code: 'dark', name: '暗黑酷炫', description: '深色背景，突出产品', previewBg: 'linear-gradient(135deg, #1a1a1a, #333333)' },
        { code: 'minimal', name: '简约专业', description: '简洁明了，专业可靠', previewBg: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)' }
      ],
      general: [
        { code: 'fresh', name: '清新绿色', description: '通用百搭，清新自然', previewBg: 'linear-gradient(135deg, #52c41a, #389e0d)' },
        { code: 'warm', name: '活力橙色', description: '热情活力，吸引眼球', previewBg: 'linear-gradient(135deg, #fa8c16, #d46b08)' },
        { code: 'minimal', name: '简约白色', description: '干净简洁，通用性强', previewBg: 'linear-gradient(135deg, #f5f5f5, #e0e0e0)' }
      ]
    }

    const styles = styleMapping[industryCode] || styleMapping.general
    this.setData({ styleOptions: styles })
  },

  /**
   * 选择风格
   */
  selectStyle(e) {
    const style = e.currentTarget.dataset.style
    if (!style) return

    this.setData({
      'guideData.style': style.code,
      'guideData.styleName': style.name,
      canProceed: true
    })
  },

  /**
   * 上一步
   */
  guidePrevStep() {
    const step = this.data.guideStep
    if (step > 1) {
      this.setData({
        guideStep: step - 1,
        canProceed: true  // 返回上一步时一定可以继续
      })
    }
  },

  /**
   * 下一步
   */
  guideNextStep() {
    const step = this.data.guideStep
    const guideData = this.data.guideData

    if (step === 1 && !guideData.industry) {
      wx.showToast({ title: '请选择行业类型', icon: 'none' })
      return
    }

    if (step === 2 && !guideData.style) {
      wx.showToast({ title: '请选择视觉风格', icon: 'none' })
      return
    }

    if (step === 3 && !guideData.themeCode) {
      wx.showToast({ title: '请选择主题', icon: 'none' })
      return
    }

    // 进入下一步
    if (step < 4) {
      this.setData({ guideStep: step + 1 })
      this.onStepChange(step + 1)
    }
  },

  /**
   * 步骤变化时的处理
   */
  onStepChange(newStep) {
    const guideData = this.data.guideData

    if (newStep === 2) {
      // 进入第2步：检查是否已选择风格
      this.setData({ canProceed: !!guideData.style })
    } else if (newStep === 3) {
      // 进入第3步：根据行业+风格推荐主题
      this.loadRecommendedThemes()
      this.setData({ canProceed: !!guideData.themeCode })
    } else if (newStep === 4) {
      // 进入第4步：确认配置，一定可以完成
      this.setData({ canProceed: true })
      // 生成预览样式
      if (guideData.selectedTheme) {
        this.setData({
          guidePreviewStyle: this.generatePreviewStyle(guideData.selectedTheme)
        })
      }
    }
  },

  /**
   * 根据行业+风格推荐主题
   */
  loadRecommendedThemes() {
    const guideData = this.data.guideData
    const allThemes = this.data.themes

    // 行业+风格 -> 主题映射
    const themeMapping = {
      'fresh_food_fresh': ['fresh_green', 'farm_green'],
      'fresh_food_organic': ['farm_green', 'fresh_green'],
      'fresh_food_minimal': ['minimal_white', 'fresh_green'],
      'seafood_ocean': ['ocean_blue', 'medical_blue'],
      'seafood_fresh': ['medical_blue', 'ocean_blue'],
      'seafood_premium': ['dark_night', 'classic_gold'],
      'bakery_sweet': ['sweet_pink', 'baby_warm'],
      'bakery_warm': ['baby_warm', 'sweet_pink'],
      'bakery_elegant': ['beauty_purple', 'sweet_pink'],
      'gift_luxury': ['classic_gold', 'tea_brown'],
      'gift_festival': ['festival_red', 'classic_gold'],
      'gift_classic': ['tea_brown', 'classic_gold'],
      'baby_warm': ['baby_warm', 'sweet_pink'],
      'baby_playful': ['dopamine_orange', 'baby_warm'],
      'baby_pure': ['medical_blue', 'baby_warm'],
      'cosmetics_elegant': ['beauty_purple', 'sweet_pink'],
      'cosmetics_trendy': ['dark_night', 'beauty_purple'],
      'cosmetics_natural': ['fresh_green', 'medical_blue'],
      'digital_tech': ['tech_blue', 'ocean_blue'],
      'digital_dark': ['dark_night', 'tech_blue'],
      'digital_minimal': ['minimal_white', 'tech_blue'],
      'general_fresh': ['fresh_green', 'farm_green'],
      'general_warm': ['dopamine_orange', 'festival_red'],
      'general_minimal': ['minimal_white', 'fresh_green']
    }

    const key = guideData.industry + '_' + guideData.style
    const themeCodes = themeMapping[key] || ['fresh_green', 'minimal_white']

    // 从完整主题列表中找出推荐主题
    const recommended = []
    for (const code of themeCodes) {
      const theme = allThemes.find(t => t.code === code)
      if (theme) {
        recommended.push(theme)
      }
    }

    // 如果推荐不足3个，补充默认主题
    if (recommended.length < 3) {
      const defaults = ['fresh_green', 'minimal_white', 'dopamine_orange']
      for (const code of defaults) {
        if (recommended.length >= 3) break
        if (!recommended.find(t => t.code === code)) {
          const theme = allThemes.find(t => t.code === code)
          if (theme) recommended.push(theme)
        }
      }
    }

    this.setData({
      recommendedThemes: recommended,
      // 默认选中第一个推荐
      'guideData.themeCode': recommended[0]?.code || '',
      'guideData.themeName': recommended[0]?.name || '',
      'guideData.selectedTheme': recommended[0] || null,
      canProceed: recommended.length > 0
    })
  },

  /**
   * 选择引导流程中的主题
   */
  selectGuideTheme(e) {
    const theme = e.currentTarget.dataset.theme
    if (!theme) return

    this.setData({
      'guideData.themeCode': theme.code,
      'guideData.themeName': theme.name,
      'guideData.selectedTheme': theme,
      canProceed: true
    })
  },

  /**
   * 输入产品描述（用于AI图片生成）
   */
  onProductInput(e) {
    this.setData({
      'guideData.productDesc': e.detail.value
    })
  },

  /**
   * 生成AI图片
   */
  async generateAiImage() {
    const productDesc = this.data.guideData.productDesc.trim()
    if (!productDesc) {
      wx.showToast({ title: '请输入产品描述', icon: 'none' })
      return
    }

    this.setData({ generatingImage: true })

    try {
      const config = app.globalData.config
      const guideData = this.data.guideData

      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/ai/generate-image',
        method: 'POST',
        data: {
          sessionId: this.data.guideSessionId,
          industry: guideData.industry,
          style: guideData.style,
          productDescription: productDesc,
          imageType: 'banner'
        },
        header: {
          'content-type': 'application/json',
          'third-session': app.globalData.thirdSession || ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            const images = res.data.data.images || []
            this.setData({
              generatedImages: images,
              selectedImageIndex: images.length > 0 ? 0 : -1
            })
            if (images.length > 0) {
              wx.showToast({ title: '图片生成成功', icon: 'success' })
            }
          } else {
            wx.showToast({ title: res.data.msg || '生成失败', icon: 'none' })
          }
        },
        fail: () => {
          wx.showToast({ title: '网络错误', icon: 'none' })
        },
        complete: () => {
          this.setData({ generatingImage: false })
        }
      })
    } catch (err) {
      console.error('生成AI图片失败:', err)
      this.setData({ generatingImage: false })
      wx.showToast({ title: '生成失败', icon: 'none' })
    }
  },

  /**
   * 选择生成的图片
   */
  selectGeneratedImage(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ selectedImageIndex: index })
  },

  /**
   * 完成引导流程并应用配置
   */
  async finishGuideFlow() {
    const guideData = this.data.guideData
    if (!guideData.selectedTheme) {
      wx.showToast({ title: '请选择主题', icon: 'none' })
      return
    }

    this.setData({ applyingConfig: true })

    try {
      const config = app.globalData.config
      const merchantId = app.globalData.merchantId
      const selectedImage = this.data.selectedImageIndex >= 0
        ? this.data.generatedImages[this.data.selectedImageIndex]
        : null

      // 调用后端保存配置
      wx.request({
        url: config.basePath + '/weixin/api/ma/decoration/ai/guide/finish',
        method: 'POST',
        data: {
          sessionId: this.data.guideSessionId,
          merchantId: merchantId,
          industry: guideData.industry,
          style: guideData.style,
          themeCode: guideData.themeCode,
          selectedImageUrl: selectedImage?.url || null
        },
        header: {
          'content-type': 'application/json',
          'third-session': app.globalData.thirdSession || ''
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 200) {
            // 更新当前主题
            this.setData({
              currentTheme: guideData.selectedTheme,
              selectedThemeId: guideData.selectedTheme.id,
              showGuideWizard: false
            })
            wx.showToast({ title: '装修配置已应用', icon: 'success' })
          } else {
            // 即使后端保存失败，也本地应用主题
            this.applyThemeLocally(guideData.selectedTheme)
          }
        },
        fail: () => {
          // 网络失败时本地应用
          this.applyThemeLocally(guideData.selectedTheme)
        },
        complete: () => {
          this.setData({ applyingConfig: false })
        }
      })
    } catch (err) {
      console.error('完成引导流程失败:', err)
      this.setData({ applyingConfig: false })
      // 降级：本地应用主题
      this.applyThemeLocally(this.data.guideData.selectedTheme)
    }
  },

  /**
   * 本地应用主题（降级方案）
   */
  applyThemeLocally(theme) {
    if (!theme) return

    this.setData({
      currentTheme: theme,
      selectedThemeId: theme.id,
      showGuideWizard: false
    })
    wx.showToast({ title: '主题已应用（本地）', icon: 'success' })
  }
})
