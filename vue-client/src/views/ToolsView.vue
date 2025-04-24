<template>
  <div class="panel">
    <header class="compact-header">
      <h1>可用工具 <small>AI助手可调用的工具和服务</small></h1>
    </header>
    
    <main>
      <div class="tools-container">
        <div class="tools-header">
          <div class="tools-search">
            <input 
              type="text" 
              v-model="searchQuery"
              placeholder="搜索工具..."
              class="search-input"
            />
          </div>
        </div>
        
        <div class="tools-grid" v-if="filteredTools.length > 0">
          <div 
            v-for="(tool, index) in filteredTools" 
            :key="index" 
            class="tool-card"
          >
            <div class="tool-header" @click="openToolModal(tool)">
              <div class="tool-icon" :style="{ backgroundColor: getToolColor(tool.name) }">
                {{ getToolInitial(tool.name) }}
              </div>
              <div class="tool-title">
                <h3>{{ formatToolName(tool.name) }}</h3>
                <p class="tool-description">{{ tool.description }}</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="empty-state" v-else>
          <div class="empty-icon">🔍</div>
          <p>没有找到匹配的工具</p>
        </div>

        <!-- 工具详情弹窗 -->
        <div class="tool-modal" v-if="selectedTool" @click.self="closeToolModal">
          <div class="modal-content">
            <div class="modal-header">
              <div class="tool-icon-large" :style="{ backgroundColor: getToolColor(selectedTool.name) }">
                {{ getToolInitial(selectedTool.name) }}
              </div>
              <div class="modal-title">
                <h2>{{ formatToolName(selectedTool.name) }}</h2>
                <p>{{ selectedTool.description }}</p>
              </div>
              <button class="close-button" @click="closeToolModal">&times;</button>
            </div>

            <div class="modal-body">
              <div class="tool-methods">
                <div 
                  v-for="(method, methodIndex) in selectedTool.methods" 
                  :key="methodIndex" 
                  class="method-item"
                >
                  <div class="method-header">
                    <span class="method-name">{{ formatMethodName(method.name) }}</span>
                    <span class="method-tag">方法</span>
                  </div>
                  <p class="method-description">{{ method.description }}</p>
                  
                  <div class="method-params" v-if="method.parameters && method.parameters.length > 0">
                    <h4>参数:</h4>
                    <div class="param-list">
                      <div v-for="(param, paramIndex) in method.parameters" :key="paramIndex" class="param-item">
                        <span class="param-name">{{ param.name }}</span>
                        <span class="param-type">{{ param.type }}</span>
                        <span class="param-required" v-if="param.required">必填</span>
                        <p class="param-description">{{ param.description }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface ToolParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
}

interface ToolMethod {
  name: string;
  description: string;
  parameters: ToolParameter[];
}

interface Tool {
  name: string;
  description: string;
  methods: ToolMethod[];
}

interface MCPRawTool {
  name: string;
  description: string;
  parameters: {
    properties: Record<string, any>;
    required?: string[];
    [key: string]: any;
  };
}

// 初始空工具列表
const tools = ref<Tool[]>([]);
const filteredTools = ref<Tool[]>([]);
const selectedTool = ref<Tool | null>(null);
const isLoading = ref(true);
const error = ref<string | null>(null);

// 添加搜索查询
const searchQuery = ref('');

// 获取工具列表
const fetchTools = async () => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // 从后端 API 获取工具列表
    const response = await fetch('/api/tools');
    
    if (!response.ok) {
      throw new Error(`获取工具列表失败: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json() as MCPRawTool[];
    
    // 处理工具数据结构
    // 这里我们需要将后端提供的 MCP 工具数据转换为我们的工具列表格式
    const formattedTools: Tool[] = [];
    const toolsByPrefix: Record<string, Tool> = {};
    
    // 对工具进行分组
    data.forEach((tool: MCPRawTool) => {
      // 从工具名称中提取前缀
      const parts = tool.name.split('_SERVERKEYTONAME_');
      const serverKey = parts[0]; // 服务器键名
      const actualName = parts[1] || tool.name; // 实际工具名
      
      // 初始化该前缀的分组
      if (!toolsByPrefix[serverKey]) {
        toolsByPrefix[serverKey] = {
          name: `mcp_${serverKey}`,
          description: `包含 0 个可用方法`,
          methods: []
        };
      }
      
      // 处理参数
      const parameters: ToolParameter[] = [];
      if (tool.parameters && tool.parameters.properties) {
        Object.keys(tool.parameters.properties).forEach(paramName => {
          const paramInfo = tool.parameters.properties[paramName];
          const isRequired = tool.parameters.required && 
                             tool.parameters.required.includes(paramName);
          
          parameters.push({
            name: paramName,
            type: paramInfo.type || '未知',
            description: paramInfo.description || '无描述',
            required: isRequired || false
          });
        });
      }
      
      // 添加工具作为方法
      toolsByPrefix[serverKey].methods.push({
        name: actualName,
        description: tool.description || '无描述',
        parameters: parameters
      });
      
      // 更新描述，显示工具数量
      toolsByPrefix[serverKey].description = `包含 ${toolsByPrefix[serverKey].methods.length} 个可用方法`;
    });
    
    // 将分组转换为数组
    Object.values(toolsByPrefix).forEach(groupedTool => {
      formattedTools.push(groupedTool);
    });
    
    tools.value = formattedTools;
    filteredTools.value = [...tools.value];
    isLoading.value = false;
  } catch (err) {
    console.error('获取工具列表失败:', err);
    error.value = '获取工具列表失败，请稍后重试';
    isLoading.value = false;
    
    filteredTools.value = [];
  }
};

// 格式化工具名称
const formatToolName = (name: string): string => {
  if (!name) return '';
  
  // 移除前缀
  let displayName = name.replace(/^mcp_/, '');
  
  // 替换下划线为空格并首字母大写
  return displayName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// 格式化方法名称
const formatMethodName = (name: string): string => {
  if (!name) return '';
  
  // 替换下划线为空格
  return name.replace(/_/g, ' ');
};

// 获取工具名称的首字母
const getToolInitial = (name: string): string => {
  const formattedName = formatToolName(name);
  return formattedName.charAt(0).toUpperCase();
};

// 根据工具名称生成颜色
const getToolColor = (name: string): string => {
  const colors = [
    '#4285F4', // 蓝色
    '#EA4335', // 红色
    '#FBBC05', // 黄色
    '#34A853', // 绿色
    '#8952E6', // 紫色
    '#00ACC1', // 青色
    '#F6511D', // 橙色
    '#7A5195'  // 梅红色
  ];
  
  // 使用工具名称生成一个数字并选择颜色
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
};

// 打开工具详情弹窗
const openToolModal = (tool: Tool) => {
  selectedTool.value = tool;
  document.body.style.overflow = 'hidden'; // 防止背景滚动
};

// 关闭工具详情弹窗
const closeToolModal = () => {
  selectedTool.value = null;
  document.body.style.overflow = '';
};

// 监听搜索查询变化，过滤工具
watch(searchQuery, (newQuery) => {
  if (!newQuery.trim()) {
    filteredTools.value = [...tools.value];
    return;
  }
  
  const query = newQuery.toLowerCase().trim();
  filteredTools.value = tools.value.filter(tool => 
    tool.name.toLowerCase().includes(query) || 
    tool.description.toLowerCase().includes(query) ||
    tool.methods.some(method => 
      method.name.toLowerCase().includes(query) || 
      method.description.toLowerCase().includes(query)
    )
  );
});

// 初始化时获取工具列表
onMounted(() => {
  fetchTools();
});
</script>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.compact-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e5e7eb;
  background-color: white;
}

.compact-header h1 {
  font-size: 20px;
  margin: 0;
  color: #1f2937;
  font-weight: 600;
}

.compact-header h1 small {
  font-size: 1rem;
  color: #6b7280;
  font-weight: normal;
  margin-left: 8px;
}

main {
  flex: 1;
  overflow: auto;
  background-color: #f9fafb;
}

.tools-container {
  max-width: 1200px;
  margin: 20px auto;
  padding: 0 24px;
  height: 100%;
}

.tools-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
}

.tools-search {
  flex: 1;
}

.search-input {
  width: 100%;
  padding: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}

.tools-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-top: 20px;
}

.tool-card {
  background-color: white;
  border-radius: 10px;
  overflow: hidden;
  transition: all 0.25s ease;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid #f0f0f0;
  position: relative;
}

.tool-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 5px 12px rgba(0, 0, 0, 0.08);
}

.tool-card::after {
  display: none;
}

.tool-header {
  display: flex;
  align-items: center;
  padding: 12px;
  background-color: white;
  border-bottom: 1px solid #f3f4f6;
}

.tool-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: 600;
  color: white;
  margin-right: 10px;
  flex-shrink: 0;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

.tool-title {
  flex: 1;
}

.tool-title h3 {
  margin: 0 0 4px 0;
  font-size: 0.9rem;
  color: #111827;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-description {
  margin: 0;
  font-size: 0.75rem;
  color: #6b7280;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
}

/* 工具详情弹窗样式 */
.tool-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(17, 24, 39, 0.65);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.25s ease-out;
  backdrop-filter: blur(2px);
}

.modal-content {
  background-color: white;
  border-radius: 16px;
  width: 85%;
  max-width: 850px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  border: 1px solid rgba(229, 231, 235, 0.8);
}

.modal-header {
  display: flex;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #e5e7eb;
  position: sticky;
  top: 0;
  background-color: white;
  z-index: 10;
}

.tool-icon-large {
  width: 46px;
  height: 46px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: 600;
  color: white;
  margin-right: 16px;
  flex-shrink: 0;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.modal-title {
  flex: 1;
}

.modal-title h2 {
  margin: 0 0 6px 0;
  font-size: 1.3rem;
  color: #111827;
  font-weight: 600;
  line-height: 1.2;
}

.modal-title p {
  margin: 0;
  color: #4b5563;
  font-size: 0.9rem;
  line-height: 1.4;
}

.close-button {
  background: none;
  border: none;
  font-size: 1.8rem;
  color: #9ca3af;
  cursor: pointer;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  transition: all 0.2s;
  margin-left: 10px;
}

.close-button:hover {
  background-color: #f3f4f6;
  color: #1f2937;
}

.modal-body {
  padding: 22px;
}

.tool-methods {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.method-item {
  background-color: #f9fafb;
  border-radius: 10px;
  padding: 16px;
  border-left: 4px solid #4285F4;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 0.2s;
  margin-bottom: 14px;
}

.method-item:hover {
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.method-header {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.method-name {
  font-weight: 600;
  font-size: 1rem;
  margin-right: 10px;
  color: #1f2937;
}

.method-tag {
  font-size: 0.65rem;
  background-color: #e0e7ff;
  color: #4338ca;
  padding: 2px 8px;
  border-radius: 20px;
  text-transform: uppercase;
  font-weight: 500;
  letter-spacing: 0.5px;
}

.method-description {
  margin: 0 0 14px 0;
  font-size: 0.85rem;
  color: #4b5563;
  line-height: 1.5;
}

.method-params h4 {
  margin: 0 0 10px 0;
  font-size: 0.8rem;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  font-weight: 600;
}

.param-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.param-item {
  padding: 10px 14px;
  background-color: #f3f4f6;
  border-radius: 6px;
  transition: all 0.2s;
  border: 1px solid #e5e7eb;
  margin-bottom: 8px;
}

.param-item:hover {
  background-color: #eef2ff;
  border-color: #ddd6fe;
}

.param-name {
  font-weight: 600;
  font-size: 0.85rem;
  color: #4338ca;
}

.param-type {
  font-size: 0.7rem;
  color: #6b7280;
  margin-left: 6px;
  background-color: #e5e7eb;
  padding: 1px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.param-required {
  font-size: 0.65rem;
  color: #ef4444;
  margin-left: 6px;
  font-weight: 500;
  background-color: #fee2e2;
  padding: 1px 6px;
  border-radius: 4px;
}

.param-description {
  margin: 6px 0 0 0;
  font-size: 0.8rem;
  color: #4b5563;
  line-height: 1.4;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #6b7280;
}

.empty-icon {
  font-size: 3.5rem;
  margin-bottom: 24px;
  opacity: 0.4;
}

.empty-state p {
  font-size: 1.1rem;
  font-weight: 500;
}

/* 弹窗动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from { 
    opacity: 0;
    transform: translateY(-30px) scale(0.98);
  }
  to { 
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 响应式调整 */
@media (max-width: 1400px) {
  .tools-grid {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 1100px) {
  .tools-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .tools-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 500px) {
  .tools-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .tool-card:hover {
    transform: none;
  }
  
  .modal-content {
    width: 95%;
    max-height: 95vh;
    border-radius: 12px;
  }
  
  .modal-header {
    padding: 16px 20px;
  }
  
  .modal-body {
    padding: 16px 20px;
  }
  
  .tool-icon-large {
    width: 44px;
    height: 44px;
    font-size: 1.3rem;
  }
  
  .modal-title h2 {
    font-size: 1.2rem;
  }
  
  .method-item {
    padding: 16px;
  }
}
</style> 