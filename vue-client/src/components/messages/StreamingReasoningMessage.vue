<template>
  <div class="message assistant">
    <div class="message-row">
      <MessageAvatar type="assistant" />
      <div class="message-container typing-container">
        <div
          class="streaming-reasoning-container"
          v-if="content && content.trim().length > 0"
        >
          <div class="reasoning-header">
            推理中
          </div>
          <pre class="reasoning-content">{{ content }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import MessageAvatar from './MessageAvatar.vue';

const props = defineProps<{
  content: string;
}>();
</script>

<style scoped>
@import '../../assets/styles/message.css';
@import '../../assets/styles/reasoning.css';
</style> 