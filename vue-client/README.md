# AI聊天客户端 - Vue3版本

这是使用Vue3框架重构的AI聊天客户端，支持多种AI模型，包括Deepseek和OpenAI。

## 项目结构

```
vue-client/
├── src/
│   ├── api/             # API请求
│   ├── assets/          # 静态资源
│   ├── components/      # 可复用组件
│   ├── router/          # 路由配置
│   ├── store/           # 状态管理
│   ├── views/           # 页面组件
│   ├── App.vue          # 根组件
│   ├── env.d.ts         # 类型声明
│   └── main.ts          # 入口文件
├── index.html           # HTML模板
├── package.json         # 项目依赖
├── tsconfig.json        # TypeScript配置
├── vite.config.ts       # Vite配置
└── README.md            # 项目说明
```

## 主要功能

- 支持多种AI模型切换（Deepseek/OpenAI）
- 聊天界面，支持发送和接收消息
- 设置界面，可配置API密钥和模型参数
- 支持侧边栏折叠/展开
- 响应式布局设计

## 组件拆分

项目将原本的单一HTML/JS/CSS结构拆分为多个Vue组件：

- `Sidebar.vue` - 侧边栏组件
- `MessageList.vue` - 消息列表组件
- `ChatInput.vue` - 聊天输入组件
- `ChatView.vue` - 聊天视图
- `SettingsView.vue` - 设置视图

## 开发指南

### 安装依赖

```bash
cd vue-client
npm install
```

### 启动开发服务器

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

## 后端服务

后端服务保持原有Express实现，但端口修改为3001，避免与Vue开发服务器(3000)冲突。

启动后端服务：

```bash
npm run web-ui
```

## 技术栈

- Vue 3
- TypeScript
- Vue Router
- Pinia (状态管理)
- Axios (HTTP请求)
- Vite (构建工具) 