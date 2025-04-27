<template>
  <div class="message assistant">
    <div class="message-row message-row-assistant">
      <MessageAvatar type="assistant" />
      <div class="message-container ai-message-container">
        <!-- 显示推理内容区域 (仅当有推理内容时) -->
        <ReasoningContainer 
          v-if="reasoningContent"
          :content="reasoningContent"
          :is-collapsed="expandedReasoningIndex !== index"
          @toggle="toggleReasoning"
        />

        <!-- 普通消息内容显示 -->
        <div
          v-if="!isToolPromptMessage(content)"
          class="message-content"
          v-html="formattedContent"
        ></div>
      </div>

      <!-- 消息操作栏 -->
      <MessageActions 
        v-if="!isToolPromptMessage(content)"
        :content="content"
        :index="index"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed, ref } from 'vue';
import MessageAvatar from './MessageAvatar.vue';
import MessageActions from './MessageActions.vue';
import ReasoningContainer from './ReasoningContainer.vue';
import { createMarkdownRenderer } from '../../utils/markdown';

const props = defineProps<{
  content: string;
  reasoningContent?: string;
  index: number;
}>();

// 添加一个消息中正在被查看的推理内容的索引
const expandedReasoningIndex = ref<number | null>(null);

// 修改toggleReasoning函数使其更可靠
const toggleReasoning = () => {
  // 防止事件冒泡
  event?.stopPropagation();
  
  if (expandedReasoningIndex.value === props.index) {
    expandedReasoningIndex.value = null; // 折叠
  } else {
    expandedReasoningIndex.value = props.index; // 展开
  }
};

// 检查消息是否为工具调用提示
const isToolPromptMessage = (content: string): boolean => {
  return content.startsWith('#useTool<toolName>');
};

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