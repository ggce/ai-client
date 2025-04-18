import fs from 'fs';
import path from 'path';
import os from 'os';

// 定义配置数据结构
interface StoreSchema {
  config: {
    providers: {
      openai: {
        apiKey: string;
        model: string;
      };
      deepseek: {
        apiKey: string;
        model: string;
      };
    };
    currentProvider: string;
    sidebarCollapsed: boolean;
  };
}

// 存储文件路径
const configDir = path.join(os.homedir(), '.mcp-client');
const configPath = path.join(configDir, 'config.json');

// 确保配置目录存在
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// 默认配置
const defaultConfig: StoreSchema = {
  config: {
    providers: {
      openai: {
        apiKey: '',
        model: 'gpt-3.5-turbo'
      },
      deepseek: {
        apiKey: '',
        model: 'deepseek-chat'
      }
    },
    currentProvider: 'deepseek',
    sidebarCollapsed: true
  }
};

// 自定义存储类
class FileStore {
  private data: StoreSchema;

  constructor() {
    this.data = this.loadFromFile();
  }

  private loadFromFile(): StoreSchema {
    try {
      if (fs.existsSync(configPath)) {
        const fileContent = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error('Failed to load config from file:', error);
    }
    return defaultConfig;
  }

  private saveToFile(): void {
    try {
      fs.writeFileSync(configPath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save config to file:', error);
    }
  }

  get(key: string): any {
    return this.data[key as keyof StoreSchema];
  }

  set(key: string, value: any): void {
    this.data[key as keyof StoreSchema] = value;
    this.saveToFile();
  }
}

// 创建存储实例
const store = new FileStore();

// 类型安全的getter和setter
export const getConfig = (): StoreSchema['config'] => {
  return store.get('config');
};

export const setConfig = (config: StoreSchema['config']): void => {
  store.set('config', config);
};

export default store; 