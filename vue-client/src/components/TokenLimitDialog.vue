<template>
  <transition name="fade">
    <div v-if="show" class="token-limit-dialog-overlay">
      <transition name="fade-scale">
        <div v-if="show" class="token-limit-dialog">
          <button class="close-btn" @click="handleCancel" aria-label="关闭弹窗">×</button>
          <h2>Luna提醒您</h2>
          <p>您当前会话已达到单次会话长度限制，您可以选择创建新会话以继续，以下是您本次会话摘要：</p>
          <div class="token-limit-info" v-if="data && data.summary">
            <span class="summary-icon">📝</span>
            <div class="summary-block">
              <p class="summary-title">会话摘要：</p>
              <div class="summary-content">{{ data.summary }}</div>
            </div>
          </div>
          <div class="token-limit-actions">
            <button class="primary-button" @click="handleCreateNew">创建新会话</button>
            <button class="secondary-button" @click="handleCancel">取消</button>
          </div>
          <div class="token-limit-hint">
            新会话将包含上一会话的摘要作为背景上下文，帮助Luna理解先前交流内容
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script>
export default {
  name: 'TokenLimitDialog',
  props: {
    show: {
      type: Boolean,
      default: false
    },
    data: {
      type: Object,
      default: () => ({})
    }
  },
  emits: ['create-session-by-summary', 'cancel'],
  methods: {
    handleCreateNew() {
      this.$emit('create-session-by-summary');
    },
    handleCancel() {
      this.$emit('cancel');
    }
  }
}
</script>

<style scoped>
.fade-scale-enter-active, .fade-scale-leave-active {
  transition: opacity 0.28s cubic-bezier(.4,0,.2,1), transform 0.28s cubic-bezier(.4,0,.2,1);
}
.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.token-limit-dialog-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(30, 34, 44, 0.38);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
  transition: opacity 0.28s cubic-bezier(.4,0,.2,1);
}

.token-limit-dialog-overlay.fade-enter-from,
.token-limit-dialog-overlay.fade-leave-to {
  opacity: 0;
}

.token-limit-dialog-overlay.fade-enter-active,
.token-limit-dialog-overlay.fade-leave-active {
  transition: opacity 0.28s cubic-bezier(.4,0,.2,1);
}

.token-limit-dialog {
  background: #fff;
  border-radius: 16px;
  padding: 28px 22px 18px 22px;
  width: 720px;
  max-width: 98vw;
  box-shadow: 0 8px 32px rgba(0,0,0,0.13), 0 1.5px 6px rgba(33,150,243,0.07);
  position: relative;
  font-size: 12px;
  font-family: inherit;
  transform-origin: center;
  transition: transform 0.28s cubic-bezier(.4,0,.2,1), opacity 0.28s cubic-bezier(.4,0,.2,1);
}

.token-limit-dialog.fade-enter-from,
.token-limit-dialog.fade-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

.token-limit-dialog.fade-enter-active,
.token-limit-dialog.fade-leave-active {
  transition: transform 0.28s cubic-bezier(.4,0,.2,1), opacity 0.28s cubic-bezier(.4,0,.2,1);
}

.token-limit-dialog h2 {
  margin: 0 0 5px 0;
  color: #1a1a1a;
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: 0.1px;
}

.token-limit-dialog p {
  color: #555;
  margin: 0 0 12px 0;
  font-size: 0.85rem;
}

.token-limit-info {
  margin: 12px 0 8px 0;
  padding: 9px 10px;
  background: linear-gradient(90deg, #e3f2fd 0%, #f7fafc 100%);
  border-left: 3px solid #1976d2;
  border-radius: 7px;
  display: flex;
  align-items: flex-start;
  gap: 7px;
  font-size: 0.85rem;
}

.summary-icon {
  font-size: 1.08rem;
  margin-right: 3px;
  margin-top: 1px;
}

.summary-title {
  font-weight: 600;
  color: #1976d2;
  margin-bottom: 3px;
  font-size: 0.85rem;
}

.summary-block {
  max-width: 100%;
  max-height: 350px;
  min-width: 0;
  word-break: break-all;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.summary-content {
  max-width: 100%;
  min-width: 0;
  word-break: break-all;
  overflow-y: auto;
  color: #222;
  font-size: 0.85rem;
  line-height: 1.6;
  white-space: pre-line;
  max-height: 400px;
  padding-right: 2px;
  scrollbar-width: thin;
  scrollbar-color: #90caf9 #e3f2fd;
}
.summary-content::-webkit-scrollbar {
  width: 6px;
  background: #e3f2fd;
  border-radius: 4px;
}
.summary-content::-webkit-scrollbar-thumb {
  background: #90caf9;
  border-radius: 4px;
}

.token-limit-actions {
  display: flex;
  gap: 10px;
  margin-top: 12px;
}

button {
  padding: 7px 20px;
  border-radius: 16px;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background 0.18s, box-shadow 0.18s, color 0.18s;
  box-shadow: 0 1.5px 6px rgba(33,150,243,0.07);
}

.primary-button {
  background: #1976d2;
  color: #fff;
  box-shadow: 0 2px 8px rgba(33,150,243,0.10);
}
.primary-button:hover {
  background: #2196f3;
  box-shadow: 0 4px 16px rgba(33,150,243,0.15);
  color: #fff;
}

.secondary-button {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #e0e0e0;
}
.secondary-button:hover {
  background: #e0e0e0;
  color: #222;
}

.token-limit-hint {
  margin-top: 10px;
  font-size: 0.91rem;
  color: #888;
  padding: 7px 8px;
  background: #f8fafb;
  border-radius: 5px;
  text-align: left;
}

.close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  font-size: 1.05rem;
  color: #bbb;
  cursor: pointer;
  transition: color 0.18s;
  padding: 2px 6px;
  border-radius: 50%;
}
.close-btn:hover {
  color: #666;
  background: #f0f0f0;
}
</style> 