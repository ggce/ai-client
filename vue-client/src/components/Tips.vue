<template>
  <Teleport to="body">
    <TransitionGroup name="tips-fade" tag="div" class="tips-container-group">
      <div
        v-if="visible"
        :key="uniqueKey"
        class="tips-container"
        :class="[`tips-${type}`]"
      >
        <div class="tips-content">
          <div class="tips-icon-wrapper" :class="[`tips-icon-${type}`]">
            <svg v-if="type === 'error'" class="tips-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 9L9 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M9 9L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else-if="type === 'warning'" class="tips-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 16H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else-if="type === 'success'" class="tips-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else class="tips-svg-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 16V12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M12 8H12.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="tips-message">{{ message }}</span>
          <div class="tips-close" @click="hide">
            <svg class="tips-close-icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="tips-progress" :style="{ animationDuration: `${duration}ms` }"></div>
      </div>
    </TransitionGroup>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const visible = ref(false)
const message = ref('')
const type = ref<'info' | 'success' | 'warning' | 'error'>('info')
const duration = ref(3000)
const uniqueKey = ref(Date.now())
let timer: number | null = null

/**
 * 显示提示信息
 * @param msg 提示内容
 * @param msgType 提示类型
 * @param tipsDuration 显示持续时间
 * @returns 包含close方法的对象
 */
const show = (
  msg: string, 
  msgType: 'info' | 'success' | 'warning' | 'error' = 'info', 
  tipsDuration = 3000
) => {
  // 清除之前的计时器
  if (timer) {
    clearTimeout(timer)
  }
  
  // 设置消息内容和类型
  message.value = msg
  type.value = msgType
  duration.value = tipsDuration
  uniqueKey.value = Date.now()
  visible.value = true
  
  // 设置自动关闭
  if (tipsDuration > 0) {
    timer = window.setTimeout(() => {
      hide()
    }, tipsDuration)
  }
  
  return {
    close: hide
  }
}

/**
 * 隐藏提示信息
 */
const hide = () => {
  visible.value = false
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

// 显式导出方法，确保外部可以正确访问
defineExpose({
  show,
  hide
})
</script>

<style scoped>
.tips-container-group {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  width: max-content;
  max-width: 90%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  pointer-events: none;
}

/* 确保每个提示的宽度保持一致 */
.tips-container-group > div {
  width: 100%;
  position: relative;
}

.tips-container {
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
  background-color: #fff;
  width: 280px; /* 固定宽度 */
  pointer-events: auto;
  transform-origin: top center;
  backdrop-filter: blur(4px);
}

.tips-container.tips-error {
  background-color: #fff6f6;
  border-left: 3px solid #ff4d4f;
  box-shadow: 0 4px 12px rgba(255, 77, 79, 0.08);
}

.tips-container.tips-warning {
  background-color: #fffcee;
  border-left: 3px solid #faad14;
  box-shadow: 0 4px 12px rgba(250, 173, 20, 0.08);
}

.tips-container.tips-success {
  background-color: #f8fff6;
  border-left: 3px solid #52c41a;
  box-shadow: 0 4px 12px rgba(82, 196, 26, 0.08);
}

.tips-container.tips-info {
  background-color: #f0f8ff;
  border-left: 3px solid #1890ff;
  box-shadow: 0 4px 12px rgba(24, 144, 255, 0.08);
}

.tips-content {
  display: flex;
  align-items: center;
  padding: 10px;
}

.tips-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 14px;
  flex-shrink: 0;
  opacity: 0.9;
}

.tips-svg-icon {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
}

.tips-icon-error {
  color: #ff4d4f;
}

.tips-icon-warning {
  color: #faad14;
}

.tips-icon-success {
  color: #52c41a;
}

.tips-icon-info {
  color: #1890ff;
}

.tips-message {
  flex: 1;
  font-size: 12px;
  line-height: 1.5;
  color: #444;
  word-break: break-word;
  padding-right: 14px;
  font-weight: 500;
}

.tips-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  cursor: pointer;
  color: #999;
  transition: all 0.2s ease;
  flex-shrink: 0;
  opacity: 0.8;
  border-radius: 50%;
}

.tips-close:hover {
  color: #444;
  background-color: rgba(0, 0, 0, 0.05);
  opacity: 1;
}

.tips-close-icon {
  width: 100%;
  height: 100%;
}

.tips-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  width: 100%;
  background-color: rgba(0, 0, 0, 0.08);
  transform-origin: left;
  animation: tips-progress-animation linear forwards;
}

.tips-error .tips-progress {
  background-color: rgba(255, 77, 79, 0.3);
}

.tips-warning .tips-progress {
  background-color: rgba(250, 173, 20, 0.3);
}

.tips-success .tips-progress {
  background-color: rgba(82, 196, 26, 0.3);
}

.tips-info .tips-progress {
  background-color: rgba(24, 144, 255, 0.3);
}

@keyframes tips-progress-animation {
  0% {
    transform: scaleX(1);
  }
  100% {
    transform: scaleX(0);
  }
}

/* Top to bottom animation - fixing size issues */
.tips-fade-enter-active,
.tips-fade-leave-active {
  position: absolute;
  left: 50%;
  width: 280px; /* 确保动画期间宽度固定 */
}

.tips-fade-enter-active {
  animation: tips-slide-in 0.3s ease forwards;
}

.tips-fade-leave-active {
  animation: tips-slide-out 0.3s ease forwards;
}

.tips-fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -30px);
}

.tips-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -30px);
}

@keyframes tips-slide-in {
  0% {
    opacity: 0;
    transform: translate(-50%, -30px);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@keyframes tips-slide-out {
  0% {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -30px);
  }
}

/* 响应式样式 */
@media (max-width: 576px) {
  .tips-container,
  .tips-fade-enter-active,
  .tips-fade-leave-active {
    width: 260px; /* 移动端固定宽度 */
  }
  
  .tips-content {
    padding: 8px 16px;
  }
  
  .tips-message {
    font-size: 14px;
  }
}
</style> 