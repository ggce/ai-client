<template>
  <div class="message tool">
    <div class="message-row">
      <MessageAvatar type="tool" />
      <div class="message-container">
        <!-- 工具内容区域，添加可折叠功能 -->
        <div
          class="tool-content-container"
          :class="{ 'collapsed': !isExpanded, 'has-error': isToolError(content) }"
        >
          <div class="tool-header-row">
            <div class="message-content" v-html="toolPreview"></div>
            <div class="toggle-indicator" @click="toggleExpand">
              <span class="toggle-text">{{ isExpanded ? '收起' : '展开详情' }}</span>
              <span class="toggle-icon">{{ isExpanded ? '▲' : '▼' }}</span>
            </div>
          </div>
        </div>

        <!-- 展开后的工具内容 -->
        <div
          v-if="isExpanded"
          class="tool-expanded-content"
          :class="{ 'error-content': isToolError(content) }"
          v-html="toolExpandedContent"
          @click.stop
        ></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, ref, computed } from 'vue';
import MessageAvatar from './MessageAvatar.vue';

const props = defineProps<{
  content: string;
}>();

// 添加工具消息展开/折叠状态
const isExpanded = ref(false);

// 添加工具消息的展开/折叠函数
const toggleExpand = () => {
  // 防止事件冒泡
  event?.stopPropagation();
  isExpanded.value = !isExpanded.value;
};

// 工具结果预览（只显示第一行）
const toolPreview = computed(() => {
  if (!props.content) return "";

  try {
    // 尝试解析JSON
    const parsed = JSON.parse(props.content);
    
    // 处理工具错误消息
    if (parsed.errorMessage) {
      const errorMessage = parsed.errorMessage.toString();
      const firstLine = errorMessage.split('\n')[0] || "错误信息";
      // 添加更明显的错误样式和图标
      return `<div class="tool-preview tool-error-preview">
        ${firstLine}${errorMessage.includes('\n') ? '...' : ''}
      </div>`;
    }
    
    // 处理常见工具消息格式
    if (parsed.content && Array.isArray(parsed.content) && parsed.content.length > 0) {
      if (parsed.content[0].type === 'text' && parsed.content[0].text) {
        const firstLine = parsed.content[0].text.split('\n')[0] || "工具结果";
        return `<div class="tool-preview">${firstLine}${parsed.content[0].text.includes('\n') ? '...' : ''}</div>`;
      }
      return `<div class="tool-preview">工具返回了 ${parsed.content.length} 项内容</div>`;
    }
    
    // 处理普通结果
    if (parsed.result) {
      const resultStr = parsed.result.toString();
      const firstLine = resultStr.split('\n')[0] || "工具结果";
      return `<div class="tool-preview">${firstLine}${resultStr.includes('\n') ? '...' : ''}</div>`;
    }
    
    return `<div class="tool-preview">点击查看完整结果</div>`;
  } catch (e) {
    // JSON解析失败，尝试获取第一行
    const firstLine = props.content.split('\n')[0] || "工具结果";
    return `<div class="tool-preview">${firstLine}${props.content.includes('\n') ? '...' : ''}</div>`;
  }
});

// 完整工具内容
const toolExpandedContent = computed(() => {
  if (!props.content) return "";

  try {
    // 尝试解析JSON
    const parsed = JSON.parse(props.content);
    
    // 处理工具错误消息
    if (parsed.errorMessage) {
      return `<div class="tool-error">
        <div class="tool-error-header">
          <div class="tool-error-title">
            工具调用失败
          </div>
        </div>
        <div class="tool-error-content">
          <div class="tool-error-message">${parsed.errorMessage}</div>
        </div>
      </div>`;
    }
    
    // 处理常见工具消息格式：content数组包含不同类型的内容
    if (parsed.content && Array.isArray(parsed.content)) {
      return parsed.content.map((item: { type: string; text?: string; url?: string; image?: string; }) => {
        if (item.type === 'text') {
          // 将换行符转换为HTML换行
          return `<div class="tool-text">${item.text?.replace(/\n/g, '<br>')}</div>`;
        } else if (item.type === 'image' && item.url) {
          return `<div class="tool-image"><img src="${item.url}" alt="工具生成的图片" /></div>`;
        } else if (item.type === 'url') {
          return `<div class="tool-url"><a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.url}</a></div>`;
        } else {
          // 处理其他类型
          return `<div class="tool-item">${JSON.stringify(item)}</div>`;
        }
      }).join('');
    }
    
    // 格式化参数
    if (parsed.result) {
      return `<div class="tool-result">${parsed.result}</div>`;
    }
    
    // 如果不是预期格式，则美化显示JSON
    return `<pre class="tool-json">${JSON.stringify(parsed, null, 2)}</pre>`;
  } catch (e) {
    // JSON解析失败，按原样返回内容
    console.error("Tool message JSON parse error:", e);
    return `<div class="tool-text">${props.content}</div>`;
  }
});

// 检查工具消息是否包含错误
const isToolError = (content: string): boolean => {
  try {
    const parsed = JSON.parse(content);
    return !!parsed.errorMessage;
  } catch (e) {
    return false;
  }
};
</script>

<style scoped>
@import '../../assets/styles/message.css';
@import '../../assets/styles/tool-message.css';

/* 自定义样式，使工具消息预览和展开按钮在同一行 */
.tool-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.tool-header-row .message-content {
  flex: 1;
}

.tool-header-row .toggle-indicator {
  margin-top: 0;
  margin-left: 12px;
  white-space: nowrap;
}
</style> 