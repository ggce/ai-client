<template>
  <div class="message user">
    <div class="message-row message-row-user">
      <MessageAvatar type="user" />
      <div class="message-container">
        <div class="message-content" v-html="formattedContent"></div>
      </div>

      <!-- 消息操作栏 -->
      <MessageActions 
        :content="props.content"
        :index="0"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import MessageAvatar from './MessageAvatar.vue';
import MessageActions from './MessageActions.vue';
import { createMarkdownRenderer } from '../../utils/markdown';

const props = defineProps<{
  content: string;
}>();

// 初始化markdown解析器
const md = createMarkdownRenderer();

// 格式化消息
const formattedContent = computed(() => {
  if (!props.content) return "";
  return md.render(props.content);
});
</script>

<style scoped>
@import '../../assets/styles/message.css';
</style> 