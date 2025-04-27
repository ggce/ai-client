/**
 * 通知工具类
 * 通过与electron通信，调用electron的Notification组件完成应用通知发送
 */

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  silent?: boolean;
  urgency?: 'normal' | 'critical' | 'low';
  timeoutType?: 'default' | 'never';
  actions?: Array<{
    type: string;
    text: string;
  }>;
  closeButtonText?: string;
}

declare global {
  interface Window {
    electronAPI?: {
      sendNotification?: (options: NotificationOptions) => Promise<void>;
      [key: string]: any;
    };
  }
}

/**
 * 通知工具类
 */
export class NotificationUtil {
  /**
   * 发送系统通知
   * @param title 通知标题
   * @param body 通知内容
   * @param options 其他通知选项
   * @returns 成功返回true，失败返回false
   */
  static async send(
    title: string,
    body: string,
    options: Omit<NotificationOptions, 'title' | 'body'> = {}
  ): Promise<boolean> {
    try {
      // 如果在Electron环境中
      if (window.electronAPI && window.electronAPI.sendNotification) {
        await window.electronAPI.sendNotification({
          title,
          body,
          ...options
        });
        return true;
      } else {
        // 降级处理：如果不在Electron环境或API不可用，使用浏览器通知API
        if ('Notification' in window) {
          // 检查通知权限
          if (Notification.permission === 'granted') {
            new Notification(title, {
              body,
              icon: options.icon
            });
            return true;
          } else if (Notification.permission !== 'denied') {
            // 请求权限
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              new Notification(title, {
                body,
                icon: options.icon
              });
              return true;
            }
          }
        }
        // 无法显示通知，打印到控制台
        console.warn('无法显示通知：', title, body);
        return false;
      }
    } catch (error) {
      console.error('发送通知失败：', error);
      return false;
    }
  }

  /**
   * 发送成功通知
   * @param title 通知标题
   * @param message 通知内容
   * @param options 其他通知选项
   */
  static async success(
    title: string,
    message: string,
    options: Omit<NotificationOptions, 'title' | 'body'> = {}
  ): Promise<boolean> {
    return this.send(title, message, options);
  }

  /**
   * 发送错误通知
   * @param title 通知标题
   * @param message 通知内容
   * @param options 其他通知选项
   */
  static async error(
    title: string,
    message: string,
    options: Omit<NotificationOptions, 'title' | 'body'> = {}
  ): Promise<boolean> {
    return this.send(title, message, {
      urgency: 'critical',
      ...options
    });
  }

  /**
   * 发送警告通知
   * @param title 通知标题
   * @param message 通知内容
   * @param options 其他通知选项
   */
  static async warning(
    title: string,
    message: string,
    options: Omit<NotificationOptions, 'title' | 'body'> = {}
  ): Promise<boolean> {
    return this.send(title, message, options);
  }

  /**
   * 发送信息通知
   * @param title 通知标题
   * @param message 通知内容
   * @param options 其他通知选项
   */
  static async info(
    title: string,
    message: string,
    options: Omit<NotificationOptions, 'title' | 'body'> = {}
  ): Promise<boolean> {
    return this.send(title, message, {
      urgency: 'low',
      ...options
    });
  }
}

export default NotificationUtil;