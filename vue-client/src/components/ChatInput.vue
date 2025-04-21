<template>
  <div class="input-area">
    <div class="textarea-container">
      <textarea 
        v-model="messageInput" 
        placeholder="输入您的问题..." 
        rows="3"
        @keydown.enter.exact.prevent="handleEnterKey"
        :disabled="disabled"
      ></textarea>
    </div>
    <button 
      @click="handleSend" 
      :disabled="!canSend || disabled"
      class="send-button"
      :class="{ 'active': canSend && !disabled }"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"></line>
        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits, defineProps } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const messageInput = ref('')

const emit = defineEmits<{
  send: [message: string]
}>()

const canSend = computed(() => messageInput.value.trim() !== '')

const handleSend = () => {
  if (!canSend.value || props.disabled) return
  
  const message = messageInput.value.trim()
  emit('send', message)
  messageInput.value = ''
}

const handleEnterKey = (event: KeyboardEvent) => {
  // 仅在未按下shift键的情况下按Enter发送
  if (!event.shiftKey) {
    handleSend()
  }
}
</script>

<style scoped>
.input-area {
  display: flex;
  align-items: center;
  padding: 0;
  background-color: white;
}

.textarea-container {
  flex: 1;
  position: relative;
}

textarea {
  width: 100%;
  height: auto;
  min-height: 50px;
  border: 1px solid #e5e5e5;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  outline: none;
  background-color: #fafafa;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

textarea:focus {
  border-color: #1a73e8;
  background-color: white;
}

textarea::placeholder {
  color: #999;
}

.send-button {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
  width: 46px;
  height: 46px;
  background-color: #1a73e8;
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.send-button:hover {
  background-color: #1666d0;
}

.send-button:active {
  background-color: #1356b0;
}

.send-button.active {
  background-color: #1a73e8;
}

.send-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}
</style> 