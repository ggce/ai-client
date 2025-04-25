<template>
  <div class="message-actions">
    <button
      class="copy-button"
      @click="copyToClipboard(content, index)"
      @mouseenter="hoveredButton = index"
      @mouseleave="hoveredButton = null"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path
          d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        ></path>
      </svg>
      <span v-if="hoveredButton === index" class="hover-tooltip">复制</span>
      <span v-if="copiedIndex === index" class="copy-tooltip">已复制</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref } from 'vue';

const props = defineProps<{
  content: string;
  index: number;
}>();

// 记录当前鼠标悬浮的按钮索引
const hoveredButton = ref<number | null>(null);
// 记录当前复制的消息索引，用于显示复制成功提示
const copiedIndex = ref<number | null>(null);

// 复制内容到剪贴板
const copyToClipboard = (text: string, index?: number) => {
  if (text) {
    // 复制原始Markdown文本，这样用户可以保留格式
    navigator.clipboard
      .writeText(text)
      .then(() => {
        // 复制成功，显示提示
        if (index !== undefined) {
          copiedIndex.value = index;
        }
        // 2秒后自动隐藏提示
        setTimeout(() => {
          copiedIndex.value = null;
        }, 2000);
      })
      .catch((err) => {
        console.error("复制失败:", err);
      });
  }
};
</script>

<style scoped>
@import '../../assets/styles/message.css';
</style> 