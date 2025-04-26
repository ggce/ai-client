import { createApp, App } from 'vue'
import TipsComponent from '../components/Tips.vue'

// 定义Tips组件实例的类型
interface TipsExpose {
  show: (message: string, type: 'info' | 'success' | 'warning' | 'error', duration: number) => { close: () => void };
  hide: () => void;
}

// 创建tips实例
const createTips = () => {
  // 创建容器元素
  const container = document.createElement('div')
  document.body.appendChild(container)
  
  // 创建应用实例
  const app = createApp(TipsComponent)
  
  // 挂载应用
  const vm = app.mount(container) as unknown as TipsExpose
  
  return {
    // 暴露Tips组件的show方法
    show: (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', duration = 3000) => {
      try {
        return vm.show(message, type, duration)
      } catch (error) {
        console.error('调用Tips组件show方法失败:', error)
        return { close: () => {} }
      }
    },
    
    // 暴露Tips组件的hide方法
    hide: () => {
      try {
        vm.hide()
      } catch (error) {
        console.error('调用Tips组件hide方法失败:', error)
      }
    },
    
    // 销毁应用实例和DOM元素
    destroy: () => {
      try {
        app.unmount()
        if (container.parentNode) {
          container.parentNode.removeChild(container)
        }
      } catch (error) {
        console.error('销毁Tips实例失败:', error)
      }
    }
  }
}

// 单例模式，确保只创建一个实例
let tipsInstance: ReturnType<typeof createTips> | null = null

interface TipsOptions {
  duration?: number;
  onClose?: () => void;
}

/**
 * 获取全局Tips实例
 * 优先使用全局注册的实例，如果不存在则返回null
 */
const getGlobalTipsInstance = (): TipsExpose | null => {
  try {
    // 首先从全局变量获取
    if (window.__GLOBAL_TIPS_INSTANCE__) {
      return window.__GLOBAL_TIPS_INSTANCE__ as TipsExpose;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export const tips = {
  /**
   * 显示提示信息
   * @param message 提示内容
   * @param type 提示类型: info, success, warning, error
   * @param options 配置选项或持续时间
   */
  show(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', options?: TipsOptions | number) {
    // 解析配置参数
    let duration = 3000;
    let onClose: (() => void) | undefined = undefined;
    
    if (typeof options === 'number') {
      duration = options;
    } else if (options && typeof options === 'object') {
      duration = options.duration ?? 3000;
      onClose = options.onClose;
    }
    
    try {
      // 获取全局实例
      const instance = getGlobalTipsInstance();
      
      if (!instance) {
        // 如果无法获取实例，回退到使用原生alert
        if (type === 'error') {
          alert(`错误: ${message}`);
        } else if (type === 'warning') {
          alert(`警告: ${message}`);
        } else {
          alert(message);
        }
        return { close: () => {} };
      }
      
      // 调用组件的show方法
      const result = instance.show(message, type, duration);
      
      // 如果提供了onClose回调，则在持续时间结束后调用
      if (onClose && duration > 0) {
        setTimeout(onClose, duration);
      }
      
      return result;
    } catch (error) {
      alert(`提示: ${message}`);
      return { close: () => {} };
    }
  },
  
  /**
   * 显示错误提示
   */
  error(message: string, options?: TipsOptions | number) {
    return this.show(message, 'error', options);
  },
  
  /**
   * 显示成功提示
   */
  success(message: string, options?: TipsOptions | number) {
    return this.show(message, 'success', options);
  },
  
  /**
   * 显示警告提示
   */
  warning(message: string, options?: TipsOptions | number) {
    return this.show(message, 'warning', options);
  },
  
  /**
   * 显示信息提示
   */
  info(message: string, options?: TipsOptions | number) {
    return this.show(message, 'info', options);
  },
  
  /**
   * 处理API错误并显示错误提示
   * @param error 错误对象
   * @param fallbackMessage 后备错误信息
   */
  handleApiError(error: any, fallbackMessage = '操作失败，请稍后重试') {
    // 尝试从错误对象中提取错误信息
    let errorMessage = fallbackMessage;
    
    if (error?.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    this.error(errorMessage);
    return errorMessage;
  },
  
  /**
   * 显示加载提示，返回控制对象
   * @param message 加载提示信息
   */
  loading(message: string = '加载中...') {
    try {
      // 获取全局实例
      const instance = getGlobalTipsInstance();
      
      if (!instance) {
        console.log(`加载中: ${message}`);
        return {
          close: () => {},
          success: (msg: string) => { this.success(msg); },
          error: (msg: string) => { this.error(msg); }
        };
      }
      
      // 显示一个不会自动关闭的提示
      const { close } = instance.show(message, 'info', 0);
      
      // 返回控制对象
      return {
        // 关闭加载提示
        close: () => {
          close();
        },
        
        // 关闭加载提示并显示成功提示
        success: (msg: string, duration = 3000) => {
          close();
          this.success(msg, duration);
        },
        
        // 关闭加载提示并显示错误提示
        error: (msg: string, duration = 3000) => {
          close();
          this.error(msg, duration);
        }
      };
    } catch (error) {
      return {
        close: () => {},
        success: (msg: string) => { this.success(msg); },
        error: (msg: string) => { this.error(msg); }
      };
    }
  }
}

// 在应用卸载时清理资源
window.addEventListener('beforeunload', () => {
  if (tipsInstance) {
    tipsInstance.destroy()
    tipsInstance = null
  }
}) 