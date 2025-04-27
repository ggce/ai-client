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
import { defineProps, computed, ref, onMounted } from 'vue';
import MessageAvatar from './MessageAvatar.vue';
import MessageActions from './MessageActions.vue';
import ReasoningContainer from './ReasoningContainer.vue';
import { createMarkdownRenderer } from '../../utils/markdown';
import NotificationUtil from '@/utils/notification';

const props = defineProps<{
  content: string;
  reasoningContent?: string;
  index: number;
  totalLength?: number;
}>();

// 添加一个消息中正在被查看的推理内容的索引
const expandedReasoningIndex = ref<number | null>(null);

// 是否通知过
const isNotifyed = ref(false);

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

// 是否是问题
function isQuestion(text: string = '') {
  const questionKeywords: string[] = [
    "请问",
    "请提供",
    "请指示",
    "请告诉",
    "请告知",
    "您能否",
    "您有什么",
    "您有没有",
    "我可以怎样",
    "我希望了解",
  ];
  return text.endsWith("？") || text.endsWith("?") || questionKeywords.some(keyword => text.includes(keyword));;
}

onMounted(() => {
  // AI提出问题
  if (
    props.totalLength === props.index + 1 &&  // 最后一个消息
    !isNotifyed.value &&  // 未通知过
    isQuestion(props.content)  // 是问题
  ) {
    // 提示
    NotificationUtil.info('等待您的进一步指示', props.content);
    // 设置通知过
    isNotifyed.value = true;
  }
})
</script>

<style scoped>
@import '../../assets/styles/message.css';
</style> 