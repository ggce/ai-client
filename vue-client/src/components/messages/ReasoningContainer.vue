<template>
  <div
    class="reasoning-container"
    :class="{ 'collapsed': props.isCollapsed }"
    @click="toggleCollapse"
  >
    <div class="reasoning-header">
      推理过程
      <span class="toggle-icon" :class="{ 'rotated': !props.isCollapsed }">▶</span>
    </div>
    <div 
      class="content-outer"
      :style="{ height: containerHeight }"
    >
      <div 
        class="content-wrapper" 
        ref="contentWrapper"
        :class="{ 'hidden': props.isCollapsed }"
      >
        <pre class="reasoning-content">{{ props.content }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref, watch, onMounted, computed } from 'vue';

const props = defineProps<{
  content: string;
  isCollapsed: boolean;
}>();

const emit = defineEmits(['toggle']);
const contentWrapper = ref<HTMLElement | null>(null);
const contentHeight = ref(0);

function toggleCollapse() {
  emit('toggle');
}

// 处理内容变化时重新计算高度
onMounted(() => {
  // 初始化高度
  updateContentHeight();
});

// 内容变化时更新高度
watch([() => props.content, () => props.isCollapsed], () => {
  updateContentHeight();
}, { flush: 'post' });

// 计算容器高度
const containerHeight = computed(() => {
  if (props.isCollapsed) {
    return '0px';
  }
  return contentHeight.value + 'px';
});

// 更新内容高度
function updateContentHeight() {
  if (!contentWrapper.value) return;
  
  // 如果处于收起状态，不计算高度
  if (props.isCollapsed) {
    contentHeight.value = 0;
    return;
  }

  // 确保计算正确的高度
  setTimeout(() => {
    if (contentWrapper.value) {
      contentHeight.value = contentWrapper.value.scrollHeight;
    }
  }, 0);
}
</script>

<style scoped>
@import '../../assets/styles/reasoning.css';

.content-outer {
  position: relative;
  overflow: hidden;
  transition: height 0.35s cubic-bezier(0.33, 1, 0.68, 1);
  height: auto;
}

.content-wrapper {
  opacity: 1;
  transition: opacity 0.25s ease;
}

.content-wrapper.hidden {
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

.toggle-icon {
  display: inline-block;
  transition: transform 0.25s cubic-bezier(0.33, 1, 0.68, 1);
}

.toggle-icon.rotated {
  transform: rotate(90deg);
}

.reasoning-container.collapsed {
  cursor: pointer;
}

.reasoning-content {
  scroll-behavior: smooth;
}

/* 自定义滚动条样式 */
.reasoning-content::-webkit-scrollbar {
  width: 6px;
}

.reasoning-content::-webkit-scrollbar-track {
  background: transparent;
}

.reasoning-content::-webkit-scrollbar-thumb {
  background-color: rgba(100, 149, 237, 0.15); /* 非常淡的蓝色，与推理容器主题色相近 */
  border-radius: 6px;
}

.reasoning-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(100, 149, 237, 0.25);
}
</style> 