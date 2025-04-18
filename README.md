# Deepseek V3 客户端

这是一个用TypeScript编写的客户端，用于连接Deepseek V3模型，并支持多云协议(MCP)。

## 功能特性

- 支持Deepseek V3模型API
- 多云协议(MCP)支持，便于切换不同的AI提供商
- 内置错误处理和重试机制
- 类型安全的API接口

## 安装

```bash
npm install
```

## 配置

复制`.env.example`文件并重命名为`.env`，然后填入您的API密钥:

```bash
cp .env.example .env
```

## 使用

### 开发模式

```bash
npm run dev
```

### 构建项目

```bash
npm run build
```

### 运行构建后的项目

```bash
npm start
```

## 示例

```typescript
import { DeepseekClient } from './path-to-client';

// 初始化客户端
const client = new DeepseekClient();

// 使用Deepseek V3模型
async function main() {
  const response = await client.chat.completions.create({
    model: "deepseek-v3",
    messages: [
      {
        role: "user",
        content: "你好，请介绍一下自己"
      }
    ]
  });
  
  console.log(response.choices[0].message.content);
}

main().catch(console.error);
```

## AI提供商切换器使用

```typescript
import { AIProviderSwitcher } from './path-to-ai-provider-switcher';

// 初始化AI提供商切换器
const providerSwitcher = new AIProviderSwitcher({
  defaultProvider: 'deepseek',
  providers: ['deepseek', 'openai']
});

// 使用AI提供商切换器
async function main() {
  // 使用默认提供商
  const response = await providerSwitcher.completions({
    messages: [
      {
        role: "user",
        content: "你好，请介绍一下自己"
      }
    ]
  });
  
  console.log(response.choices[0].message.content);
  
  // 显式指定提供商
  const openaiResponse = await providerSwitcher.completions({
    provider: 'openai',
    model: 'gpt-4',
    messages: [
      {
        role: "user",
        content: "你好，请介绍一下自己"
      }
    ]
  });
}

main().catch(console.error);
``` 