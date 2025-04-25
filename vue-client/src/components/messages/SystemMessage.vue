<template>
  <div class="message system">
    <div class="message-row">
      <MessageAvatar type="system" />
      <div class="message-container">
        <div class="message-content" v-html="formattedContent"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import MessageAvatar from './MessageAvatar.vue';
import MarkdownIt from 'markdown-it';

const props = defineProps<{
  content: string;
}>();

// 初始化markdown解析器
const md = new MarkdownIt({
  breaks: true,
  linkify: true,
  typographer: true,
});

// 格式化消息
const formattedContent = computed(() => {
  if (!props.content) return "";
  return md.render(props.content);
});
</script>

<style scoped>
@import '../../assets/styles/message.css';
</style> 