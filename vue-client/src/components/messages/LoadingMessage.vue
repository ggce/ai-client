<template>
  <div class="message assistant">
    <div class="message-row">
      <MessageAvatar type="assistant" />
      <div class="message-container typing-container">
        <div class="typing-indicator">
          <span class="typing-text">正在处理您的请求</span>
          <span class="typing-dots">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import MessageAvatar from './MessageAvatar.vue';
</script>

<style scoped>
@import '../../assets/styles/message.css';
</style> 