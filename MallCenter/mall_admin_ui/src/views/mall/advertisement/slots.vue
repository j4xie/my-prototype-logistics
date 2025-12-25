<!--
  广告位配置页
-->
<template>
  <div class="app-container ad-slots">
    <el-card class="box-card">
      <template #header>
        <div class="card-header">
          <span>广告位配置</span>
          <el-button type="primary" size="small" @click="handleSave" :loading="saving">
            保存配置
          </el-button>
        </div>
      </template>

      <el-tabs v-model="activeSlot" class="slot-tabs">
        <!-- 启动广告配置 -->
        <el-tab-pane label="启动广告" name="splash_ad">
          <div class="slot-config">
            <div class="slot-preview">
              <div class="phone-mockup">
                <div class="splash-preview">
                  <div class="splash-image" v-if="splashConfig.enabled">
                    <el-icon size="48" color="#909399"><Picture /></el-icon>
                    <p>启动广告</p>
                  </div>
                  <div class="splash-disabled" v-else>
                    <el-icon size="32" color="#C0C4CC"><VideoPlay /></el-icon>
                    <p>已禁用</p>
                  </div>
                  <div class="skip-btn" v-if="splashConfig.enabled">
                    {{ splashConfig.skipDelay }}s 跳过
                  </div>
                </div>
              </div>
            </div>
            <div class="slot-settings">
              <el-form label-width="120px">
                <el-form-item label="启用启动广告">
                  <el-switch v-model="splashConfig.enabled" />
                </el-form-item>
                <el-form-item label="展示时长(秒)">
                  <el-input-number v-model="splashConfig.duration" :min="3" :max="10" />
                </el-form-item>
                <el-form-item label="跳过延迟(秒)">
                  <el-input-number v-model="splashConfig.skipDelay" :min="0" :max="5" />
                  <div class="form-tip">0 表示立即可跳过</div>
                </el-form-item>
                <el-form-item label="每日展示上限">
                  <el-input-number v-model="splashConfig.dailyLimit" :min="0" :max="10" />
                  <div class="form-tip">0 表示不限制</div>
                </el-form-item>
                <el-form-item label="支持视频">
                  <el-switch v-model="splashConfig.videoEnabled" />
                </el-form-item>
              </el-form>
            </div>
          </div>
        </el-tab-pane>

        <!-- 首页Banner配置 -->
        <el-tab-pane label="首页Banner" name="home_banner">
          <div class="slot-config">
            <div class="slot-preview">
              <div class="phone-mockup">
                <div class="banner-preview">
                  <div class="banner-slides" :style="{ height: bannerConfig.height + 'px' }">
                    <div class="slide" v-for="i in 3" :key="i">
                      <el-icon size="24" color="#909399"><Picture /></el-icon>
                    </div>
                  </div>
                  <div class="dots">
                    <span v-for="i in Math.min(bannerConfig.maxCount, 5)" :key="i" :class="{ active: i === 1 }"></span>
                  </div>
                </div>
              </div>
            </div>
            <div class="slot-settings">
              <el-form label-width="120px">
                <el-form-item label="启用Banner">
                  <el-switch v-model="bannerConfig.enabled" />
                </el-form-item>
                <el-form-item label="最大数量">
                  <el-input-number v-model="bannerConfig.maxCount" :min="1" :max="10" />
                </el-form-item>
                <el-form-item label="Banner高度">
                  <el-input-number v-model="bannerConfig.height" :min="100" :max="300" :step="10" />
                  <span class="form-unit">px</span>
                </el-form-item>
                <el-form-item label="自动轮播">
                  <el-switch v-model="bannerConfig.autoPlay" />
                </el-form-item>
                <el-form-item label="轮播间隔(秒)" v-if="bannerConfig.autoPlay">
                  <el-input-number v-model="bannerConfig.interval" :min="2" :max="10" />
                </el-form-item>
                <el-form-item label="指示器样式">
                  <el-radio-group v-model="bannerConfig.indicatorStyle">
                    <el-radio label="dots">圆点</el-radio>
                    <el-radio label="number">数字</el-radio>
                    <el-radio label="none">无</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-form>
            </div>
          </div>
        </el-tab-pane>

        <!-- 详情页底部广告配置 -->
        <el-tab-pane label="详情页底部" name="detail_bottom">
          <div class="slot-config">
            <div class="slot-preview">
              <div class="phone-mockup">
                <div class="detail-preview">
                  <div class="content-area">
                    <div class="mock-line" style="width: 80%"></div>
                    <div class="mock-line" style="width: 60%"></div>
                    <div class="mock-line" style="width: 70%"></div>
                  </div>
                  <div class="bottom-ad" v-if="detailBottomConfig.enabled">
                    <el-icon size="20" color="#909399"><Picture /></el-icon>
                    <span>底部广告</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="slot-settings">
              <el-form label-width="120px">
                <el-form-item label="启用底部广告">
                  <el-switch v-model="detailBottomConfig.enabled" />
                </el-form-item>
                <el-form-item label="广告高度">
                  <el-input-number v-model="detailBottomConfig.height" :min="50" :max="150" :step="10" />
                  <span class="form-unit">px</span>
                </el-form-item>
                <el-form-item label="最大数量">
                  <el-input-number v-model="detailBottomConfig.maxCount" :min="1" :max="3" />
                </el-form-item>
                <el-form-item label="显示关闭按钮">
                  <el-switch v-model="detailBottomConfig.closeable" />
                </el-form-item>
              </el-form>
            </div>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 广告位统计 -->
    <el-card class="box-card" style="margin-top: 20px">
      <template #header>
        <span>广告位统计</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="8" v-for="slot in slotStats" :key="slot.type">
          <div class="stat-card" :class="slot.type">
            <div class="stat-icon">
              <el-icon size="32"><component :is="slot.icon" /></el-icon>
            </div>
            <div class="stat-info">
              <div class="stat-title">{{ slot.label }}</div>
              <div class="stat-numbers">
                <span class="number">{{ slot.activeCount }}</span>
                <span class="label">上线中</span>
                <span class="divider">/</span>
                <span class="number">{{ slot.totalCount }}</span>
                <span class="label">总数</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<script setup name="AdSlots">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Picture, VideoPlay, Monitor, Cellphone, Promotion } from '@element-plus/icons-vue'
import { getPage } from '@/api/mall/advertisement'

// 当前选中的广告位
const activeSlot = ref('splash_ad')
const saving = ref(false)

// 启动广告配置
const splashConfig = reactive({
  enabled: true,
  duration: 5,
  skipDelay: 3,
  dailyLimit: 3,
  videoEnabled: true
})

// 首页Banner配置
const bannerConfig = reactive({
  enabled: true,
  maxCount: 5,
  height: 180,
  autoPlay: true,
  interval: 4,
  indicatorStyle: 'dots'
})

// 详情页底部广告配置
const detailBottomConfig = reactive({
  enabled: true,
  height: 80,
  maxCount: 1,
  closeable: true
})

// 广告位统计
const slotStats = ref([
  { type: 'splash_ad', label: '启动广告', icon: 'Monitor', activeCount: 0, totalCount: 0 },
  { type: 'home_banner', label: '首页Banner', icon: 'Cellphone', activeCount: 0, totalCount: 0 },
  { type: 'detail_bottom', label: '详情页底部', icon: 'Promotion', activeCount: 0, totalCount: 0 }
])

// 加载统计数据
const loadStats = async () => {
  try {
    // 分别获取各类型广告数量
    for (const slot of slotStats.value) {
      const res = await getPage({ type: slot.type, current: 1, size: 1 })
      slot.totalCount = res.data?.total || 0

      const activeRes = await getPage({ type: slot.type, status: 1, current: 1, size: 1 })
      slot.activeCount = activeRes.data?.total || 0
    }
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 保存配置
const handleSave = async () => {
  saving.value = true
  try {
    // TODO: 调用后端保存配置接口
    // await saveAdSlotConfig({
    //   splash_ad: splashConfig,
    //   home_banner: bannerConfig,
    //   detail_bottom: detailBottomConfig
    // })
    await new Promise(resolve => setTimeout(resolve, 500))
    ElMessage.success('配置保存成功')
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存配置失败')
  } finally {
    saving.value = false
  }
}

// 初始化
onMounted(() => {
  loadStats()
})
</script>

<style lang="scss" scoped>
.ad-slots {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .slot-tabs {
    .slot-config {
      display: flex;
      gap: 40px;
      padding: 20px 0;
    }

    .slot-preview {
      flex-shrink: 0;
    }

    .slot-settings {
      flex: 1;
      max-width: 400px;
    }
  }

  .phone-mockup {
    width: 200px;
    height: 360px;
    border: 8px solid #333;
    border-radius: 24px;
    background: #f5f5f5;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      top: 8px;
      left: 50%;
      transform: translateX(-50%);
      width: 60px;
      height: 6px;
      background: #333;
      border-radius: 3px;
    }
  }

  .splash-preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    .splash-image, .splash-disabled {
      text-align: center;
      color: #fff;
      p {
        margin-top: 10px;
        font-size: 14px;
      }
    }

    .splash-disabled {
      opacity: 0.5;
    }

    .skip-btn {
      position: absolute;
      top: 30px;
      right: 10px;
      background: rgba(0, 0, 0, 0.3);
      color: #fff;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
    }
  }

  .banner-preview {
    padding: 30px 10px 10px;

    .banner-slides {
      background: linear-gradient(135deg, #74b9ff 0%, #a29bfe 100%);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .dots {
      display: flex;
      justify-content: center;
      gap: 6px;
      margin-top: 10px;

      span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ddd;

        &.active {
          background: #409eff;
          width: 12px;
          border-radius: 3px;
        }
      }
    }
  }

  .detail-preview {
    height: 100%;
    display: flex;
    flex-direction: column;
    padding-top: 30px;

    .content-area {
      flex: 1;
      padding: 15px;

      .mock-line {
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
        margin-bottom: 10px;
      }
    }

    .bottom-ad {
      height: 60px;
      background: linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: #666;
      font-size: 12px;
    }
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .form-unit {
    margin-left: 8px;
    color: #909399;
  }

  .stat-card {
    display: flex;
    align-items: center;
    padding: 20px;
    background: #f5f7fa;
    border-radius: 8px;
    gap: 16px;

    &.splash_ad {
      background: linear-gradient(135deg, #667eea20 0%, #764ba220 100%);
      .stat-icon { color: #667eea; }
    }

    &.home_banner {
      background: linear-gradient(135deg, #74b9ff20 0%, #a29bfe20 100%);
      .stat-icon { color: #74b9ff; }
    }

    &.detail_bottom {
      background: linear-gradient(135deg, #ffecd220 0%, #fcb69f20 100%);
      .stat-icon { color: #fcb69f; }
    }

    .stat-info {
      .stat-title {
        font-size: 14px;
        color: #606266;
        margin-bottom: 8px;
      }

      .stat-numbers {
        .number {
          font-size: 20px;
          font-weight: bold;
          color: #303133;
        }

        .label {
          font-size: 12px;
          color: #909399;
          margin-left: 4px;
        }

        .divider {
          margin: 0 8px;
          color: #dcdfe6;
        }
      }
    }
  }
}
</style>
