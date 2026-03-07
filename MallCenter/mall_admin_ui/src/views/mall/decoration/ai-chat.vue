<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import { ArrowLeft, Promotion, View } from "@element-plus/icons-vue";
import { message } from "@/utils/message";
import { decorationAiChat, getPageConfig } from "@/api/mall/decoration";

defineOptions({ name: "AiChat" });

const router = useRouter();
const route = useRoute();

const merchantId = computed(() =>
  route.query.merchantId ? Number(route.query.merchantId) : undefined
);

const merchantName = computed(
  () => (route.query.merchantName as string) || `商户 #${merchantId.value}`
);

// Chat state
const inputMessage = ref("");
const sending = ref(false);
const sessionId = ref("");
const chatListRef = ref<HTMLElement>();

interface ChatMessage {
  role: "user" | "ai";
  content: string;
  modules?: any[];
  action?: string;
  timestamp: number;
}
const messages = ref<ChatMessage[]>([]);

// Preview
const showPreview = ref(false);
const previewModules = ref<any[]>([]);
const loadingPreview = ref(false);

const goBack = () => router.push("/mall/merchant/decoration");

const goToVersions = () => {
  router.push(
    `/mall/merchant/decoration/versions?merchantId=${merchantId.value}&merchantName=${encodeURIComponent(merchantName.value)}`
  );
};

const scrollToBottom = () => {
  nextTick(() => {
    if (chatListRef.value) {
      chatListRef.value.scrollTop = chatListRef.value.scrollHeight;
    }
  });
};

const sendMessage = async () => {
  if (!inputMessage.value.trim() || sending.value) return;
  if (!merchantId.value) {
    message("缺少商户ID", { type: "warning" });
    return;
  }

  const userMsg = inputMessage.value.trim();
  messages.value.push({
    role: "user",
    content: userMsg,
    timestamp: Date.now()
  });
  inputMessage.value = "";
  scrollToBottom();

  sending.value = true;
  try {
    const res = await decorationAiChat({
      message: userMsg,
      sessionId: sessionId.value || undefined,
      merchantId: merchantId.value
    });
    if (res.code === 200 && res.data) {
      const data = res.data;
      if (data.sessionId) sessionId.value = data.sessionId;

      messages.value.push({
        role: "ai",
        content: data.response || data.aiResponse || "操作完成",
        modules: data.modules,
        action: data.action,
        timestamp: Date.now()
      });
    } else {
      messages.value.push({
        role: "ai",
        content: res.msg || "操作失败，请重试",
        timestamp: Date.now()
      });
    }
  } catch {
    messages.value.push({
      role: "ai",
      content: "服务暂时不可用，请稍后重试。",
      timestamp: Date.now()
    });
  } finally {
    sending.value = false;
    scrollToBottom();
  }
};

const loadPreview = async () => {
  if (!merchantId.value) return;
  loadingPreview.value = true;
  showPreview.value = true;
  try {
    const res = await getPageConfig(merchantId.value, "home");
    if (res.code === 200 && res.data) {
      const config = res.data;
      previewModules.value = config.modulesConfig
        ? JSON.parse(
            typeof config.modulesConfig === "string"
              ? config.modulesConfig
              : JSON.stringify(config.modulesConfig)
          )
        : [];
    }
  } catch {
    message("获取预览数据失败", { type: "error" });
  } finally {
    loadingPreview.value = false;
  }
};

const moduleTypeNames: Record<string, string> = {
  banner: "轮播图",
  search: "搜索栏",
  category_grid: "分类导航",
  product_grid: "商品列表",
  text_image: "图文模块",
  image_ad: "广告图",
  announcement: "公告",
  countdown: "倒计时",
  coupon: "优惠券",
  video: "视频",
  new_arrivals: "新品推荐"
};

const moduleTypeIcons: Record<string, string> = {
  banner: "ep/picture",
  search: "ep/search",
  category_grid: "ep/grid",
  product_grid: "ep/goods",
  text_image: "ep/document",
  image_ad: "ep/picture-filled",
  announcement: "ep/bell",
  countdown: "ep/timer",
  coupon: "ep/ticket",
  video: "ep/video-camera",
  new_arrivals: "ep/star"
};

// Quick actions
const quickActions = [
  "帮我设计一个简约风格的首页",
  "添加一个轮播图模块",
  "换一个暖色调的主题",
  "加一个优惠券模块",
  "删除公告模块",
  "查看当前所有模块"
];

const useQuickAction = (action: string) => {
  inputMessage.value = action;
  sendMessage();
};

onMounted(() => {
  messages.value.push({
    role: "ai",
    content: `你好！我是${merchantName.value}的AI装修助手。你可以告诉我想要什么样的店铺风格，我来帮你设计。\n\n例如："帮我设计一个简约清新的首页" 或 "添加一个轮播图模块"`,
    timestamp: Date.now()
  });
});
</script>

<template>
  <div class="ai-chat-container">
    <!-- Header -->
    <div class="chat-header">
      <el-button :icon="ArrowLeft" text @click="goBack">返回</el-button>
      <div class="header-title">
        <span class="title">AI对话装修</span>
        <el-tag size="small" type="info">{{ merchantName }}</el-tag>
      </div>
      <div class="header-actions">
        <el-button :icon="View" @click="loadPreview">预览</el-button>
        <el-button @click="goToVersions">版本历史</el-button>
      </div>
    </div>

    <div class="chat-body">
      <!-- Messages -->
      <div ref="chatListRef" class="chat-messages">
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          :class="['message', msg.role]"
        >
          <div class="message-avatar">
            <el-avatar
              :size="32"
              :style="{
                backgroundColor: msg.role === 'user' ? '#409eff' : '#67c23a'
              }"
            >
              {{ msg.role === "user" ? "我" : "AI" }}
            </el-avatar>
          </div>
          <div class="message-content">
            <div class="message-text" v-html="msg.content.replace(/\n/g, '<br>')" />
            <!-- Module cards -->
            <div v-if="msg.modules && msg.modules.length" class="module-cards">
              <div
                v-for="(mod, mi) in msg.modules"
                :key="mi"
                class="module-card"
              >
                <span class="module-type">{{
                  moduleTypeNames[mod.type] || mod.type
                }}</span>
                <span v-if="mod.props?.title" class="module-title">{{
                  mod.props.title
                }}</span>
              </div>
            </div>
            <el-tag
              v-if="msg.action"
              size="small"
              :type="msg.action.includes('add') ? 'success' : msg.action.includes('delete') ? 'danger' : 'warning'"
              class="action-tag"
            >
              {{ msg.action }}
            </el-tag>
          </div>
        </div>
        <div v-if="sending" class="message ai">
          <div class="message-avatar">
            <el-avatar :size="32" style="background-color: #67c23a">AI</el-avatar>
          </div>
          <div class="message-content">
            <div class="typing-indicator">
              <span /><span /><span />
            </div>
          </div>
        </div>
      </div>

      <!-- Quick actions -->
      <div v-if="messages.length <= 1" class="quick-actions">
        <el-button
          v-for="action in quickActions"
          :key="action"
          size="small"
          round
          @click="useQuickAction(action)"
        >
          {{ action }}
        </el-button>
      </div>

      <!-- Input -->
      <div class="chat-input">
        <el-input
          v-model="inputMessage"
          placeholder="输入装修需求，如：帮我设计一个简约风格的首页"
          :disabled="sending"
          @keyup.enter="sendMessage"
        >
          <template #append>
            <el-button
              :icon="Promotion"
              :loading="sending"
              type="primary"
              @click="sendMessage"
            >
              发送
            </el-button>
          </template>
        </el-input>
      </div>
    </div>

    <!-- Preview drawer -->
    <el-drawer v-model="showPreview" title="首页模块预览" size="360px">
      <div v-loading="loadingPreview" class="preview-panel">
        <div
          v-for="(mod, idx) in previewModules"
          :key="idx"
          class="preview-module"
          :class="{ hidden: mod.visible === false }"
        >
          <div class="preview-module-header">
            <span class="module-index">#{{ idx + 1 }}</span>
            <span class="module-type-name">{{
              moduleTypeNames[mod.type] || mod.type
            }}</span>
            <el-tag v-if="mod.visible === false" size="small" type="info">
              隐藏
            </el-tag>
          </div>
          <div v-if="mod.props?.title" class="preview-module-title">
            {{ mod.props.title }}
          </div>
        </div>
        <el-empty v-if="!previewModules.length && !loadingPreview" description="暂无模块配置" />
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.ai-chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  background: #f5f7fa;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-title .title {
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.chat-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  max-width: 80%;
}

.message.user {
  flex-direction: row-reverse;
  margin-left: auto;
}

.message-content {
  background: #fff;
  border-radius: 12px;
  padding: 12px 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.message.user .message-content {
  background: #409eff;
  color: #fff;
}

.message-text {
  font-size: 14px;
  line-height: 1.6;
}

.module-cards {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.module-card {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #f0f9eb;
  border-radius: 6px;
  font-size: 12px;
}

.action-tag {
  margin-top: 8px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  background: #c0c4cc;
  border-radius: 50%;
  animation: typing 1.2s infinite ease-in-out;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.4;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

.quick-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 20px 12px;
}

.chat-input {
  padding: 16px 20px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
}

.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-module {
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #fff;
}

.preview-module.hidden {
  opacity: 0.5;
}

.preview-module-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.module-index {
  color: #909399;
  font-size: 12px;
}

.module-type-name {
  font-weight: 500;
}

.preview-module-title {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}
</style>
