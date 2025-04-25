<template>
  <!-- 工具调用中 -->
  <ToolPromptMessage
    v-if="isToolPromptMessage(message)"
    :content="message"
    :show-streaming-indicator="true"
    @tool-click="(toolName) => emit('tool-click', toolName)"
  />
  <template v-else>
    <div class="message assistant streaming">
      <div class="message-row">
        <MessageAvatar type="assistant" />
        <div class="message-container">
          <!-- 先显示推理，再显示回答，保持顺序一致 -->
          <ReasoningContainer
            v-if="reasoningContent && reasoningContent.trim().length > 0"
            :content="reasoningContent"
            :is-collapsed="false"
            is-streaming
          />
          <!-- 回答中 -->
          <div v-else class="message-content" v-html="formattedMessage"></div>
          <div class="streaming-indicator">
            <span class="dot"></span>
            <span class="dot"></span>
            <span class="dot"></span>
          </div>
        </div>
      </div>
    </div>
  </template>
</template>

<script setup lang="ts">
import { defineProps, computed } from "vue";
import MessageAvatar from "./MessageAvatar.vue";
import ReasoningContainer from "./ReasoningContainer.vue";
import ToolPromptMessage from "./ToolPromptMessage.vue";
import MarkdownIt from "markdown-it";

const props = defineProps<{
  message: string;
  reasoningContent?: string;
}>();

const emit = defineEmits(["tool-click"]);

// 初始化markdown解析器
const md = new MarkdownIt({
  breaks: true,
  linkify: true,
  typographer: true,
});

// 检查消息是否为工具调用提示
const isToolPromptMessage = (content: string): boolean => {
  return content.startsWith("#useTool<toolName>");
};

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
</style> 