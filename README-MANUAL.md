# DeepSeek客户端 - 手动配置指南

## 项目结构

这个项目使用了手动配置的Electron+Vue集成方案，而不是使用已废弃的electron-vue框架。项目结构如下：

```
/
├── src/                     # 主要源代码
│   ├── electron/            # Electron主进程代码
│   │   ├── main.ts          # 主进程入口
│   │   └── preload.ts       # 预加载脚本
│   ├── providers/           # AI提供商客户端
│   └── ...                  # 其他源代码
├── vue-client/              # Vue前端应用
│   ├── src/                 # Vue源代码
│   ├── dist/                # Vue构建输出（构建后生成）
│   └── ...                  # Vue项目配置文件
├── dist/                    # TypeScript编译输出
├── build.js                 # 构建脚本
├── package.json             # 项目配置
└── tsconfig.json            # TypeScript配置
```

## 开发工作流程

### 安装依赖

首先安装项目依赖：

```bash
# 安装根项目依赖
npm install

# 安装Vue客户端依赖
cd vue-client
npm install
cd ..
```

### 开发模式

这个项目提供了几种开发模式：

1. **完整开发模式** - 同时运行Vue开发服务器和Electron应用：

```bash
npm run dev
```

2. **仅Vue开发** - 如果你只想开发前端：

```bash
npm run dev:vue-only
```

3. **仅Electron开发** - 如果你只想开发后端：

```bash
npm run dev:electron-only
```

### 生产构建

构建生产版本：

```bash
# 构建Vue和Electron
npm run build

# 或者分步构建
npm run vue:build   # 先构建Vue
npm run electron:build  # 然后构建Electron
```

## 项目配置

1. **Vue配置**：在`vue-client/vite.config.ts`中
2. **Electron配置**：在`src/electron/main.ts`中
3. **TypeScript配置**：在`tsconfig.json`中
4. **构建流程**：在`build.js`中

## 技术栈

- Electron - 桌面应用框架
- Vue 3 - 前端框架
- TypeScript - 类型安全的JavaScript
- Express - 用于API服务
- Vite - 前端构建工具

## 优势

与使用electron-vue框架相比，这种手动配置方式有以下优势：

1. 更好的可维护性 - 不依赖已废弃的框架
2. 灵活性 - 可以独立更新各个组件
3. 现代化 - 使用最新的工具和库
4. 简单明了 - 构建流程透明且可自定义 