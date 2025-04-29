<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="tool-call-dialog-overlay" @click="close">
      <div class="tool-call-dialog" @click.stop>
        <div class="tool-call-dialog-header">
          <h3>工具调用结果</h3>
          <button class="close-button" @click="close">&times;</button>
        </div>
        <div class="tool-call-dialog-content">
          <div class="tool-result" v-html="toolResult"></div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

const props = defineProps<{
  visible: boolean;
  toolResult: string;
}>();

const emit = defineEmits(['update:visible']);

const close = () => {
  emit('update:visible', false);
};
</script>

<style scoped>
.tool-call-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.tool-call-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12),
              0 2px 8px rgba(0, 0, 0, 0.08);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  transform-origin: center;
}

.tool-call-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(to right, #f8f8ff, #ffffff);
  border-radius: 12px 12px 0 0;
}

.tool-call-dialog-header h3 {
  margin: 0;
  font-size: 1.1em;
  color: #333;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.5em;
  cursor: pointer;
  color: #666;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.2s ease;
  line-height: 1;
}

.close-button:hover {
  color: #333;
  background-color: rgba(0, 0, 0, 0.05);
}

.tool-call-dialog-content {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
  min-height: 100px;
  max-height: calc(80vh - 100px);
}

.tool-result {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  white-space: pre-wrap;
  font-size: 0.9em;
  line-height: 1.6;
  color: #333;
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #eee;
}

/* 动画相关样式 */
.dialog-fade-enter-active {
  transition: all 0.3s ease-out;
}

.dialog-fade-leave-active {
  transition: all 0.2s ease-in;
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

.dialog-fade-enter-to,
.dialog-fade-leave-from {
  opacity: 1;
  transform: scale(1);
}

.dialog-fade-enter-from .tool-call-dialog,
.dialog-fade-leave-to .tool-call-dialog {
  opacity: 0;
  transform: scale(0.98);
}
</style> 