<script setup lang="ts"></script>

<template>
  <div class="typing-wrap">
    <div class="typing-avatar">&#8478;</div>
    <div class="typing-bubble">
      <span></span><span></span><span></span>
    </div>
  </div>
</template>

<style scoped>
.typing-wrap {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 18px;
}
.typing-avatar {
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
}
.typing-bubble {
  background: #fefcf6;
  border: 1px solid #d4cdb8;
  border-radius: 14px;
  padding: 14px 20px;
  display: flex;
  gap: 5px;
}
.typing-bubble span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c9a66b;
  animation: typing 1.2s infinite;
}
.typing-bubble span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-bubble span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-4px);
  }
}
</style>
