<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="tool-call-dialog-overlay" @click="close">
        <Transition name="zoom">
          <div v-show="visible" class="tool-call-dialog" @click.stop>
            <div class="tool-call-dialog-header">
              <h3>工具调用结果</h3>
              <div class="header-actions">
                <button class="action-btn copy-btn" @click="copyResult" :class="{ 'copied': isCopied }">
                  <span class="btn-text">{{ isCopied ? '已复制' : '复制' }}</span>
                </button>
                <button class="close-btn" @click="close">×</button>
              </div>
            </div>
            <div class="tool-call-dialog-body">
              <div class="tool-result" v-html="formattedResult"></div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed, ref } from 'vue';

const props = defineProps<{
  visible: boolean;
  toolResult: string;
}>();

const emit = defineEmits(['update:visible']);
const isCopied = ref(false);

const close = () => {
  emit('update:visible', false);
};

// 复制结果
const copyResult = async () => {
  try {
    // 尝试解析并格式化 JSON，如果失败则使用原始内容
    const textToCopy = (() => {
      try {
        const obj = JSON.parse(props.toolResult);
        return JSON.stringify(obj, null, 2);
      } catch {
        return props.toolResult;
      }
    })();

    await navigator.clipboard.writeText(textToCopy);
    
    // 显示复制成功状态
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  } catch (err) {
    console.error('Failed to copy:', err);
  }
};

// 格式化工具调用结果
const formattedResult = computed(() => {
  try {
    // 尝试解析JSON
    const resultObj = JSON.parse(props.toolResult);
    
    // 使用语法高亮格式化JSON
    const formattedJson = JSON.stringify(resultObj, null, 2)
      .replace(/\n/g, '<br>')
      .replace(/\s{2}/g, '&nbsp;&nbsp;')
      .replace(/({|}|\[|\])/g, '<span class="tool-syntax-bracket">$1</span>')
      .replace(/"([^"]+)":/g, '<span class="tool-syntax-key">"$1"</span>:')
      .replace(/: (".*?")(?=,|\n|$)/g, ': <span class="tool-syntax-string">$1</span>')
      .replace(/: (true|false|null|\d+(?:\.\d+)?)/g, ': <span class="tool-syntax-value">$1</span>');
    
    return formattedJson;
  } catch (e) {
    // 如果不是JSON或解析失败，直接返回原始内容
    return props.toolResult;
  }
});
</script>

<style scoped>
.tool-call-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.tool-call-dialog {
  background-color: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
  position: relative;
  border: 1px solid rgba(124, 98, 194, 0.2);
}

.tool-call-dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #eee;
  background-color: #F7F5FF;
  position: sticky;
  top: 0;
  z-index: 1;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-call-dialog-header h3 {
  margin: 0;
  font-size: 1.25em;
  color: #5D4DB3;
  font-weight: 600;
}

.action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 0.9em;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  background: none;
  color: #666;
}

.copy-btn {
  background-color: #F0EDFF;
  border-color: #E6E4F0;
  color: #5D4DB3;
}

.copy-btn:hover {
  background-color: #E6E4F0;
}

.copy-btn.copied {
  background-color: #E8F5E9;
  border-color: #C8E6C9;
  color: #2E7D32;
}

.btn-text {
  font-weight: 500;
  font-size: 13px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.8em;
  cursor: pointer;
  color: #888;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: rgba(0, 0, 0, 0.05);
  color: #333;
}

.tool-call-dialog-body {
  padding: 24px;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

.tool-result {
  line-height: 1.6;
  color: #333;
  font-size: 0.95em;
  white-space: pre-wrap;
  overflow-x: auto;
  background-color: #FCFCFF;
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #E6E4F0;
}

/* 语法高亮样式 */
:deep(.tool-syntax-bracket) {
  color: #0366d6;
  font-weight: 600;
}

:deep(.tool-syntax-key) {
  color: #7c62c2;
  font-weight: 500;
}

:deep(.tool-syntax-string) {
  color: #2e7d32;
}

:deep(.tool-syntax-value) {
  color: #e65100;
  font-weight: 500;
}

/* 过渡动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.zoom-enter-active,
.zoom-leave-active {
  transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), 
              opacity 0.3s ease;
}

.zoom-enter-from,
.zoom-leave-to {
  transform: scale(0.95);
  opacity: 0;
}
</style> 