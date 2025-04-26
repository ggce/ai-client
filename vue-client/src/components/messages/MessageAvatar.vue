<template>
  <div v-if="type === 'assistant'" class="avatar ai-avatar" :class="{ 'loading': isLoading }">
    <img src="/assets/logo.png" alt="AI" class="ai-logo" />
    <div v-show="isLoading" class="loading-indicator" :class="statusClass">{{ statusText }}</div>
  </div>
  <div v-if="type === 'system'" class="avatar system-avatar">
    <div class="system-logo">系统</div>
  </div>
  <div v-if="type === 'user'" class="avatar user-avatar">
    <div class="user-logo">用户</div>
  </div>
  <div v-if="type === 'tool'" class="avatar tool-avatar">
    <div class="tool-logo">工具</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  type: 'user' | 'assistant' | 'system' | 'tool';
  isLoading?: boolean;
  status?: 'thinking' | 'calling' | 'answering';
}>();

// 根据状态显示不同的文本
const statusText = computed(() => {
  switch (props.status) {
    case 'thinking': return '推理中';
    case 'calling': return '调用中';
    case 'answering': return '回答中';
    default: return '思考中';
  }
});

// 根据状态使用不同的样式类
const statusClass = computed(() => {
  return props.status ? `status-${props.status}` : '';
});
</script>

<style scoped>
@import '../../assets/styles/message.css';

.ai-avatar {
  position: relative;
  overflow: visible;
}

.loading-indicator {
  position: absolute;
  bottom: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 9px;
  background-color: rgba(65, 137, 230, 0.75);
  color: white;
  padding: 1px 5px;
  border-radius: 8px;
  white-space: nowrap;
  font-weight: 500;
  letter-spacing: 0.3px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  pointer-events: none;
  z-index: 1;
}

/* 不同状态的样式 */
.status-thinking {
  background-color: rgba(65, 137, 230, 0.75); /* 蓝色 - 推理 */
}

.status-calling {
  background-color: rgba(76, 175, 80, 0.75); /* 绿色 - 调用工具 */
}

.status-answering {
  background-color: rgba(156, 39, 176, 0.75); /* 紫色 - 回答 */
}

.loading .ai-logo {
  animation: subtle-bounce 2s ease-in-out infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.2;
  }
  50% {
    transform: scale(1.1);
    opacity: 0.6;
  }
  100% {
    transform: scale(1);
    opacity: 0.2;
  }
}

@keyframes subtle-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-2px);
  }
}
</style> 