<script setup lang="ts">
import { ref, reactive, computed } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, MagicStick, Check, Refresh } from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";
import { message } from "@/utils/message";
import {
  analyzeDecoration,
  applyAiConfig,
  refineAiConfig
} from "@/api/mall/decoration";
import type { AiAnalysisResult, DecorationTheme } from "@/api/mall/types/decoration";

defineOptions({
  name: "AiDesign"
});

const router = useRouter();

// 用户输入
const userPrompt = ref("");
const refinePrompt = ref("");

// 加载状态
const analyzing = ref(false);
const applying = ref(false);
const refining = ref(false);

// AI分析结果
const analysisResult = ref<AiAnalysisResult | null>(null);

// 当前会话ID
const currentSessionId = ref("");

// 对话历史
const chatHistory = ref<Array<{ role: "user" | "ai"; content: string }>>([]);

// 返回
const goBack = () => {
  router.push("/mall/decoration");
};

// AI分析
const handleAnalyze = async () => {
  if (!userPrompt.value.trim()) {
    message("请输入您的装修需求描述", { type: "warning" });
    return;
  }

  analyzing.value = true;
  chatHistory.value.push({ role: "user", content: userPrompt.value });

  try {
    const res = await analyzeDecoration(userPrompt.value);
    if (res.code === 200 && res.data.success) {
      analysisResult.value = res.data;
      currentSessionId.value = res.data.sessionId || "";
      chatHistory.value.push({
        role: "ai",
        content: res.data.aiResponse || "分析完成，请查看推荐结果。"
      });
      message("分析完成", { type: "success" });
    } else {
      message(res.data?.message || res.msg || "分析失败", { type: "error" });
      chatHistory.value.push({
        role: "ai",
        content: "抱歉，分析过程中出现问题，请重试。"
      });
    }
  } catch (error) {
    message("AI分析失败，请稍后重试", { type: "error" });
    chatHistory.value.push({
      role: "ai",
      content: "服务暂时不可用，请稍后重试。"
    });
  } finally {
    analyzing.value = false;
    userPrompt.value = "";
  }
};

// 微调
const handleRefine = async () => {
  if (!refinePrompt.value.trim()) {
    message("请输入您的调整需求", { type: "warning" });
    return;
  }

  if (!currentSessionId.value) {
    message("请先进行初始分析", { type: "warning" });
    return;
  }

  refining.value = true;
  chatHistory.value.push({ role: "user", content: refinePrompt.value });

  try {
    const res = await refineAiConfig(currentSessionId.value, refinePrompt.value);
    if (res.code === 200 && res.data.success) {
      analysisResult.value = res.data;
      chatHistory.value.push({
        role: "ai",
        content: res.data.aiResponse || "已根据您的需求调整配置。"
      });
      message("调整完成", { type: "success" });
    } else {
      message(res.data?.message || res.msg || "调整失败", { type: "error" });
    }
  } catch (error) {
    message("调整失败，请稍后重试", { type: "error" });
  } finally {
    refining.value = false;
    refinePrompt.value = "";
  }
};

// 应用配置
const handleApply = async () => {
  if (!currentSessionId.value) {
    message("请先进行AI分析", { type: "warning" });
    return;
  }

  try {
    await ElMessageBox.confirm(
      "确定要应用当前AI生成的装修配置吗？",
      "应用确认",
      {
        confirmButtonText: "确定应用",
        cancelButtonText: "取消",
        type: "info"
      }
    );

    applying.value = true;
    const res = await applyAiConfig(currentSessionId.value);
    if (res.code === 200 && res.data) {
      message("配置已应用成功！", { type: "success" });
      // 重置状态
      analysisResult.value = null;
      currentSessionId.value = "";
      chatHistory.value = [];
    } else {
      message(res.msg || "应用失败", { type: "error" });
    }
  } catch (error: any) {
    if (error !== "cancel") {
      message("应用失败，请稍后重试", { type: "error" });
    }
  } finally {
    applying.value = false;
  }
};

// 重新开始
const handleReset = () => {
  analysisResult.value = null;
  currentSessionId.value = "";
  chatHistory.value = [];
  userPrompt.value = "";
  refinePrompt.value = "";
};

// 解析配色
const parseColorConfig = (theme: DecorationTheme | undefined) => {
  if (!theme?.colorConfig) return {};
  try {
    return JSON.parse(theme.colorConfig);
  } catch {
    return {};
  }
};

// 风格名称
const getStyleName = (style: string | undefined) => {
  const map: Record<string, string> = {
    food: "食品餐饮",
    retail: "零售百货",
    beauty: "美妆护肤",
    other: "综合"
  };
  return map[style || ""] || "综合";
};

// 色调名称
const getColorToneName = (tone: string | undefined) => {
  const map: Record<string, string> = {
    green: "自然绿",
    gold: "尊贵金",
    blue: "科技蓝",
    orange: "活力橙",
    pink: "甜美粉",
    neutral: "中性色"
  };
  return map[tone || ""] || "中性色";
};
</script>

<template>
  <div class="ai-design-container">
    <!-- 顶部导航 -->
    <el-card shadow="never" class="mb-4">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
          <span class="text-lg font-medium">AI智能装修</span>
        </div>
        <div class="flex gap-2">
          <el-button :icon="Refresh" @click="handleReset">重新开始</el-button>
          <el-button
            type="primary"
            :icon="Check"
            :loading="applying"
            :disabled="!currentSessionId"
            @click="handleApply"
          >
            应用配置
          </el-button>
        </div>
      </div>
    </el-card>

    <div class="content-wrapper">
      <!-- 左侧对话区 -->
      <div class="chat-panel">
        <el-card shadow="never" class="chat-card">
          <template #header>
            <span class="font-medium">与AI对话</span>
          </template>

          <!-- 对话历史 -->
          <div class="chat-history">
            <div
              v-for="(msg, index) in chatHistory"
              :key="index"
              :class="['chat-message', msg.role]"
            >
              <div class="message-avatar">
                {{ msg.role === "user" ? "我" : "AI" }}
              </div>
              <div class="message-content">{{ msg.content }}</div>
            </div>

            <el-empty
              v-if="chatHistory.length === 0"
              description="描述您的店铺特点和装修需求，AI将为您生成定制化的装修方案"
              :image-size="80"
            />
          </div>

          <!-- 输入区 -->
          <div class="chat-input">
            <el-input
              v-if="!currentSessionId"
              v-model="userPrompt"
              type="textarea"
              :rows="3"
              placeholder="例如：我是一家生鲜水果店，希望页面风格清新自然，突出产品新鲜度..."
              :disabled="analyzing"
              @keyup.enter.ctrl="handleAnalyze"
            />
            <el-input
              v-else
              v-model="refinePrompt"
              type="textarea"
              :rows="3"
              placeholder="输入您的调整需求，例如：颜色再深一点、添加限时秒杀模块..."
              :disabled="refining"
              @keyup.enter.ctrl="handleRefine"
            />

            <div class="input-actions">
              <span class="hint">Ctrl + Enter 发送</span>
              <el-button
                v-if="!currentSessionId"
                type="primary"
                :icon="MagicStick"
                :loading="analyzing"
                @click="handleAnalyze"
              >
                开始分析
              </el-button>
              <el-button
                v-else
                type="primary"
                :loading="refining"
                @click="handleRefine"
              >
                发送调整
              </el-button>
            </div>
          </div>
        </el-card>
      </div>

      <!-- 右侧结果区 -->
      <div class="result-panel">
        <el-card v-if="analysisResult" shadow="never">
          <template #header>
            <span class="font-medium">分析结果</span>
          </template>

          <!-- 基本信息 -->
          <div class="result-section">
            <div class="section-title">行业分析</div>
            <div class="info-grid">
              <div class="info-item">
                <span class="label">识别行业</span>
                <span class="value">{{ getStyleName(analysisResult.industry) }}</span>
              </div>
              <div class="info-item">
                <span class="label">推荐风格</span>
                <span class="value">{{ analysisResult.style }}</span>
              </div>
              <div class="info-item">
                <span class="label">推荐色调</span>
                <span class="value">{{ getColorToneName(analysisResult.colorTone) }}</span>
              </div>
              <div class="info-item">
                <span class="label">置信度</span>
                <el-progress
                  :percentage="(analysisResult.confidence || 0) * 100"
                  :stroke-width="8"
                  style="width: 100px"
                />
              </div>
            </div>
          </div>

          <!-- 推荐主题 -->
          <div v-if="analysisResult.bestMatchTheme" class="result-section">
            <div class="section-title">推荐主题</div>
            <div class="theme-preview-card">
              <div
                class="theme-color-bar"
                :style="{
                  background: `linear-gradient(90deg, ${parseColorConfig(analysisResult.bestMatchTheme).primaryColor}, ${parseColorConfig(analysisResult.bestMatchTheme).secondaryColor})`
                }"
              />
              <div class="theme-detail">
                <div class="theme-name">{{ analysisResult.bestMatchTheme.name }}</div>
                <div class="theme-desc">{{ analysisResult.bestMatchTheme.description }}</div>
              </div>
            </div>
          </div>

          <!-- 关键词 -->
          <div v-if="analysisResult.keywords?.length" class="result-section">
            <div class="section-title">识别关键词</div>
            <div class="keywords">
              <el-tag
                v-for="keyword in analysisResult.keywords"
                :key="keyword"
                size="small"
                class="keyword-tag"
              >
                {{ keyword }}
              </el-tag>
            </div>
          </div>

          <!-- 模块配置 -->
          <div v-if="analysisResult.recommendedModules?.length" class="result-section">
            <div class="section-title">推荐模块配置</div>
            <div class="module-list">
              <div
                v-for="module in analysisResult.recommendedModules"
                :key="module.moduleCode"
                :class="['module-item', { disabled: !module.enabled }]"
              >
                <el-checkbox v-model="module.enabled" disabled>
                  {{ module.moduleName }}
                </el-checkbox>
              </div>
            </div>
          </div>
        </el-card>

        <el-empty
          v-else
          description="AI分析结果将在这里展示"
          class="empty-result"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.ai-design-container {
  padding: 20px;
  height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
}

.mb-4 {
  margin-bottom: 16px;
}

.content-wrapper {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.chat-panel {
  flex: 1;
  min-width: 0;
}

.chat-card {
  height: 100%;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
}

.chat-history {
  flex: 1;
  overflow-y: auto;
  padding: 16px 0;
  min-height: 200px;
}

.chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;

  &.user {
    flex-direction: row-reverse;

    .message-avatar {
      background: var(--el-color-primary);
      color: #fff;
    }

    .message-content {
      background: var(--el-color-primary-light-9);
      border-radius: 12px 0 12px 12px;
    }
  }

  &.ai {
    .message-avatar {
      background: #52c41a;
      color: #fff;
    }

    .message-content {
      background: #f5f5f5;
      border-radius: 0 12px 12px 12px;
    }
  }
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.chat-input {
  border-top: 1px solid #eee;
  padding-top: 16px;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;

  .hint {
    color: #999;
    font-size: 12px;
  }
}

.result-panel {
  width: 400px;
  flex-shrink: 0;
}

.result-section {
  margin-bottom: 20px;

  &:last-child {
    margin-bottom: 0;
  }
}

.section-title {
  font-weight: 500;
  margin-bottom: 12px;
  color: #333;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .label {
    color: #999;
    font-size: 12px;
  }

  .value {
    font-weight: 500;
  }
}

.theme-preview-card {
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.theme-color-bar {
  height: 40px;
}

.theme-detail {
  padding: 12px;
}

.theme-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.theme-desc {
  color: #666;
  font-size: 13px;
}

.keywords {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.keyword-tag {
  border-radius: 12px;
}

.module-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.module-item {
  padding: 8px 12px;
  background: #f9f9f9;
  border-radius: 6px;

  &.disabled {
    opacity: 0.5;
  }
}

.empty-result {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
