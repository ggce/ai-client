<template>
  <!-- 标准流式回答模式 -->
  <div class="message assistant streaming">
    <div class="message-row">
      <MessageAvatar type="assistant" :is-loading="true" :status="status" />
      <div class="message-container">
        <!-- 先显示推理，再显示回答，保持顺序一致 -->
        <ReasoningContainer
          v-if="reasoningContent && reasoningContent.trim().length > 0"
          :content="reasoningContent"
          :is-collapsed="isCollapsedReasoning"
        />
        <!-- 回答中 -->
        <div class="message-content" v-html="formattedMessage"></div>
        <div class="streaming-indicator">
          <span class="dot"></span>
          <span class="dot"></span>
          <span class="dot"></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed, ref, watch } from "vue";
import MessageAvatar from "./MessageAvatar.vue";
import ReasoningContainer from "./ReasoningContainer.vue";
import MarkdownIt from "markdown-it";

const props = defineProps<{
  message?: string;
  reasoningContent?: string;
  toolCalls?: any[];
}>();

const isCollapsedReasoning = ref(false);

// 状态
const status = computed(() => {
  if (props.reasoningContent && !props.message) {
    return 'thinking'
  }
  return 'answering'
})

watch([() => props.message, () => props.toolCalls], () => {
  // 如果消息、工具不为空，则收起推理内容
  if (
    props.message ||
    (props.toolCalls && props.toolCalls.length > 0)
  ) {
    setTimeout(() => {
      isCollapsedReasoning.value = true;
    }, 1000);
  }
})

// 初始化markdown解析器
const md = new MarkdownIt({
  breaks: true,
  linkify: true,
  typographer: true,
});

// Configure md to add target="_blank" to all links
md.renderer.rules.link_open = (
  tokens: any[],
  idx: number,
  options: any,
  env: any,
  self: any
) => {
  // Add target="_blank" and rel="noopener noreferrer" to all links
  const token = tokens[idx];
  const aIndex = token.attrIndex("target");

  if (aIndex < 0) {
    token.attrPush(["target", "_blank"]);
    token.attrPush(["rel", "noopener noreferrer"]);
  } else if (token.attrs) {
    token.attrs[aIndex][1] = "_blank";

    const relIndex = token.attrIndex("rel");
    if (relIndex < 0) {
      token.attrPush(["rel", "noopener noreferrer"]);
    }
  }

  // Return default renderer result
  return self.renderToken(tokens, idx, options);
};

// 格式化消息
const formattedMessage = computed(() => {
  if (!props.message) return "";
  return md.render(props.message);
});
</script>

<style scoped>
@import "../../assets/styles/message.css";
@import "../../assets/styles/reasoning.css";

.typing-container {
  min-height: 40px;
}

/* 纯推理模式特定样式 */
.streaming-reasoning-container {
  margin-top: 0;
  margin-bottom: 12px;
  padding: 10px;
  border-radius: 8px;
  background-color: #f0f8ff;
  min-height: 20px;
  border: 1px solid #6495ed;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  position: relative;
  transition: all 0.3s ease;
}

.reasoning-header {
  font-weight: bold;
  color: #4169e1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.reasoning-content {
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.9em;
  color: #333;
  background-color: transparent;
  border: none;
  margin: 0;
  padding: 0;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 300px;
  min-height: 20px;
  scroll-behavior: smooth;
  transition: max-height 0.3s ease;
}
</style> 