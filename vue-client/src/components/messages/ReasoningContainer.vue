<template>
  <div
    class="reasoning-container"
    :class="{ 'collapsed': isCollapsed }"
    @click="toggleCollapse"
  >
    <div class="reasoning-header">
      推理过程
      <span class="toggle-icon" :class="{ 'rotated': !isCollapsed }">▶</span>
    </div>
    <div 
      class="content-outer"
      :style="{ height: containerHeight }"
    >
      <div 
        class="content-wrapper" 
        ref="contentWrapper"
        :class="{ 'hidden': isCollapsed }"
      >
        <pre class="reasoning-content">{{ content }}</pre>
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
  transition: height 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
  height: auto;
}

.content-wrapper {
  opacity: 1;
  transition: opacity 0.2s ease;
}

.content-wrapper.hidden {
  opacity: 0;
}

.toggle-icon {
  display: inline-block;
  transition: transform 0.2s ease;
}

.toggle-icon.rotated {
  transform: rotate(90deg);
}

.reasoning-container.collapsed {
  cursor: pointer;
}
</style> 