<template>
  <div v-if="type === 'assistant'" class="avatar ai-avatar">
    <img src="/assets/logo.png" alt="AI" class="ai-logo" />
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
defineProps<{
  type: 'user' | 'assistant' | 'system' | 'tool';
}>();
</script>

<style scoped>
@import '../../assets/styles/message.css';
</style> 