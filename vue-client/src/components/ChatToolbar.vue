<template>
  <div class="chat-toolbar">
    <button class="toolbar-button" @click="showMessages" title="查看消息记录">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
      </svg>
      <span class="button-text">查看消息记录</span>
    </button>
    <div v-if="isDialogOpen" class="messages-dialog-overlay" @click="closeDialog">
      <div class="messages-dialog" @click.stop>
        <div class="dialog-header">
          <h2>会话消息记录</h2>
          <div class="header-actions">
            <button v-if="messages && messages.length > 0" class="action-button" @click="copyToClipboard">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              复制
            </button>
            <button class="close-button" @click="closeDialog">×</button>
          </div>
        </div>
        <div class="dialog-content">
          <div v-if="!messages || messages.length === 0" class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span>当前会话没有消息记录</span>
          </div>
          <div v-else class="json-container">
            <pre class="json-content" ref="jsonContent">{{ formattedJson }}</pre>
            <div v-if="copySuccess" class="copy-success">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              已复制到剪贴板
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { SessionMessage } from '../api/chat';

// 定义组件参数
const props = defineProps<{
  messages: SessionMessage[]
}>();

const isDialogOpen = ref(false);
const copySuccess = ref(false);
const jsonContent = ref<HTMLElement | null>(null);

// 格式化角色名称
const formatRole = (role: string): string => {
  switch (role) {
    case 'user': return '用户';
    case 'assistant': return 'AI';
    case 'system': return '系统';
    case 'tool': return '工具';
    default: return role;
  }
};

// 格式化为美观的JSON
const formattedJson = computed(() => {
  if (!props.messages || props.messages.length === 0) return '';
  
  // 深拷贝消息数组，避免修改原始数据
  const messages = JSON.parse(JSON.stringify(props.messages));
  
  return JSON.stringify(messages, null, 2);
});

// 复制到剪贴板
const copyToClipboard = async () => {
  if (!formattedJson.value) return;
  
  try {
    await navigator.clipboard.writeText(formattedJson.value);
    copySuccess.value = true;
    
    // 3秒后隐藏成功提示
    setTimeout(() => {
      copySuccess.value = false;
    }, 3000);
  } catch (err) {
    console.error('复制失败:', err);
    // 回退方案：创建文本区域并复制
    const textArea = document.createElement('textarea');
    textArea.value = formattedJson.value;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    copySuccess.value = true;
    
    setTimeout(() => {
      copySuccess.value = false;
    }, 3000);
  }
};

// 显示消息记录对话框
const showMessages = () => {
  isDialogOpen.value = true;
};

// 关闭对话框
const closeDialog = () => {
  isDialogOpen.value = false;
};
</script>

<style scoped>
.chat-toolbar {
  display: flex;
  justify-content: flex-end;
  z-index: 10;
  width: 100%;
  height: 0;
  position: relative;
  border: none;
  background: transparent;
}

.toolbar-button {
  position: fixed;
  right: 30px;
  bottom: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4f94eb, #3b78e7);
  border: none;
  color: white;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 2px 10px rgba(59, 120, 231, 0.3), 0 6px 16px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  padding: 0;
  z-index: 100;
}

.toolbar-button:hover {
  background: linear-gradient(135deg, #5aa0ff, #4a86f5);
  box-shadow: 0 5px 12px rgba(59, 120, 231, 0.4), 0 8px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px) scale(1.05);
}

.toolbar-button:active {
  transform: translateY(0);
  box-shadow: 0 3px 6px rgba(59, 120, 231, 0.3);
}

.toolbar-button svg {
  width: 18px;
  height: 18px;
  color: white;
  transition: transform 0.3s ease;
}

.toolbar-button:hover svg {
  transform: scale(1.1);
}

.button-text {
  position: absolute;
  bottom: 50px;
  right: 0;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.2s ease;
  pointer-events: none;
  white-space: nowrap;
}

.toolbar-button .button-text {
  position: fixed;
  bottom: 150px;
  right: 14px;
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  opacity: 0;
  transform: translateY(10px);
}

.toolbar-button:hover .button-text {
  opacity: 1;
  transform: translateY(0);
}

.messages-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.65);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.2s ease-out;
  backdrop-filter: blur(4px);
}

.messages-dialog {
  background-color: white;
  border-radius: 16px;
  width: 85%;
  max-width: 850px;
  height: 85%;
  max-height: 650px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 15px 35px rgba(0, 0, 0, 0.25);
  animation: slideIn 0.3s cubic-bezier(0.19, 1, 0.22, 1);
  overflow: hidden;
  border: none;
}

.dialog-header {
  padding: 18px 24px;
  background: linear-gradient(to right, #f8fafc, #eef2f7);
  border-bottom: 1px solid #e8edf3;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background-color: #4a86f5;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 6px rgba(74, 134, 245, 0.3);
}

.action-button:hover {
  background-color: #3b78e7;
  box-shadow: 0 4px 8px rgba(74, 134, 245, 0.4);
  transform: translateY(-1px);
}

.action-button svg {
  color: white;
}

.dialog-header h2 {
  margin: 0;
  font-size: 20px;
  color: #1a202c;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  font-size: 26px;
  cursor: pointer;
  color: #9aa5b4;
  transition: all 0.2s ease;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.close-button:hover {
  color: #4a5568;
  background-color: rgba(0, 0, 0, 0.05);
  transform: rotate(90deg);
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  background-color: #171c2c;
  position: relative;
}

.empty-state {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #94a3b8;
  gap: 16px;
  background: linear-gradient(135deg, #1a1f2e, #141824);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
}

@keyframes gradientBG {
  0% { background-position: 0% 50% }
  50% { background-position: 100% 50% }
  100% { background-position: 0% 50% }
}

.empty-state svg {
  color: #475569;
  width: 60px;
  height: 60px;
  opacity: 0.8;
}

.empty-state span {
  font-size: 16px;
  font-weight: 500;
}

.json-container {
  position: relative;
  height: 100%;
  overflow: auto;
}

.json-content {
  margin: 0;
  padding: 30px 35px;
  background-color: #1a1f2e;
  color: #e2e8f0;
  font-family: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  min-height: 100%;
  border-radius: 0;
  counter-reset: line;
  tab-size: 2;
}

.copy-success {
  position: absolute;
  top: 20px;
  right: 20px;
  background-color: #10b981;
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  box-shadow: 0 8px 16px rgba(16, 185, 129, 0.2);
  animation: fadeInOut 3s ease-in-out;
  font-weight: 500;
}

.copy-success svg {
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.1));
}

/* JSON语法高亮 - 通过CSS变量控制颜色 */
.json-content {
  --json-key: #79b8ff;
  --json-string: #ffab70;
  --json-number: #56d364;
  --json-boolean: #ff7b72;
  --json-null: #ff7b72;
  --json-bracket: #c9d1d9;
}

/* 使用伪元素选择器模拟简单的语法高亮 */
.json-content ::v-deep(.json-key) { color: var(--json-key); }
.json-content ::v-deep(.json-string) { color: var(--json-string); }
.json-content ::v-deep(.json-number) { color: var(--json-number); }
.json-content ::v-deep(.json-boolean) { color: var(--json-boolean); }
.json-content ::v-deep(.json-null) { color: var(--json-null); }
.json-content ::v-deep(.json-bracket) { color: var(--json-bracket); }

/* Scrollbar style */
.dialog-content::-webkit-scrollbar,
.json-container::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}

.dialog-content::-webkit-scrollbar-track,
.json-container::-webkit-scrollbar-track {
  background-color: #1a1f2e;
  border-radius: 0;
}

.dialog-content::-webkit-scrollbar-thumb,
.json-container::-webkit-scrollbar-thumb {
  background-color: #2d3748;
  border-radius: 5px;
  border: 2px solid #1a1f2e;
}

.dialog-content::-webkit-scrollbar-thumb:hover,
.json-container::-webkit-scrollbar-thumb:hover {
  background-color: #4a5568;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { transform: translateY(40px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-10px); }
  10% { opacity: 1; transform: translateY(0); }
  90% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
}

.toolbar-label {
  font-size: 11px;
}

.toolbar-card-title {
  font-size: 12px;
}

.toolbar-card-info {
  font-size: 13px;
}

.provider-title {
  font-size: 18px;
}

.provider-description {
  font-size: 24px;
}

.model-name {
  font-size: 15px;
}

.option-label {
  font-size: 15px;
}

.token-display {
  font-size: 13px;
}

.expand-button {
  font-size: 11px;
}

.form-group label {
  font-size: 12px;
}

.model-option {
  font-size: 13px;
}

.slider-label {
  font-size: 13px;
}
</style>