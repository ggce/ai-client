# 在Electron中使用Vue应用

本项目包含两种UI实现：
1. 原始的EJS模板（位于`src/views/index.ejs`）
2. 新的Vue3组件化应用（位于`vue-client/`目录）

以下说明如何在Electron环境中使用新的Vue应用。

## 开发流程

### 方法1：开发过程中分开运行

在开发过程中，你可以同时运行Vue开发服务器和Electron，便于调试：

1. 启动Vue开发服务器:
```bash
npm run vue:dev
```

2. 在另一个终端启动API后端服务:
```bash
npm run web-ui
```

这样Vue开发服务器会在`http://localhost:3000`运行，后端API服务会在`http://localhost:3001`运行，并且已经正确配置了代理。

### 方法2：在Electron中使用构建后的Vue应用

如果要在Electron中预览完整应用：

1. 构建Vue应用并运行Electron：
```bash
npm run electron:vue
```

这个命令会先构建Vue应用，然后启动Electron应用，Electron会加载构建后的Vue应用。

## 生产构建

要创建完整的生产构建：

```bash
# 1. 构建Vue应用
npm run vue:build

# 2. 构建Electron应用
npm run electron:build
```

这会生成包含Vue界面的Electron应用。

## 注意事项

1. 后端API服务运行在端口3001上，而Vue开发服务器运行在端口3000上。
2. Electron配置为优先加载Vue应用，如果找不到Vue构建，会回退到原来的EJS模板。
3. 确保Vue路由使用的是`history`模式，在Electron中使用时已配置正确的回退路由处理。

## 技术细节

- Electron加载的是构建后的Vue应用（`vue-client/dist/index.html`）
- API请求从Vue应用代理到Electron内置的Express服务器
- 配置数据存储在Electron的用户数据目录
- 所有网络请求都通过Electron的Express服务器处理，确保了应用的安全性 