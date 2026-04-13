<script setup lang="ts">
import type { ChatTurn } from '@/types/restaurant-chat';

defineProps<{
  turn: ChatTurn;
}>();
</script>

<template>
  <div class="chat-bubble" :class="`bubble-${turn.role}`">
    <div v-if="turn.role === 'ai'" class="bubble-avatar">&#8478;</div>
    <div class="bubble-body">
      <div v-if="turn.role === 'ai' && turn.toolName" class="bubble-label">
        &#9658; {{ turn.toolName }}
      </div>
      <div class="bubble-content">{{ turn.content }}</div>
      <slot name="sections" />
      <slot name="followups" />
      <div v-if="turn.error" class="bubble-error">{{ turn.error }}</div>
    </div>
  </div>
</template>

<style scoped>
.chat-bubble {
  display: flex;
  gap: 10px;
  margin-bottom: 18px;
}
.bubble-user {
  justify-content: flex-end;
}
.bubble-user .bubble-body {
  background: #2d4a3e;
  color: #faf7f0;
  max-width: 72%;
  padding: 12px 16px;
  border-radius: 14px 14px 4px 14px;
  font-family: 'Noto Serif SC', serif;
}
.bubble-ai {
  justify-content: flex-start;
}
.bubble-ai .bubble-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #fefcf6;
  border: 1px solid #c9a66b;
  color: #a68449;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Playfair Display', serif;
  font-weight: 900;
  font-size: 16px;
  flex-shrink: 0;
}
.bubble-ai .bubble-body {
  flex: 1;
  background: #fefcf6;
  border: 1px solid #d4cdb8;
  border-left: 4px solid #c9a66b;
  border-radius: 4px 14px 14px 14px;
  padding: 16px 20px;
}
.bubble-label {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1.5px;
  color: #a68449;
  text-transform: uppercase;
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e8e1cc;
}
.bubble-content {
  font-family: 'Noto Serif SC', serif;
  font-size: 14px;
  line-height: 1.7;
  color: #3d3d3d;
}
.bubble-error {
  color: #8b1a1a;
  font-size: 12px;
  margin-top: 6px;
}
</style>
