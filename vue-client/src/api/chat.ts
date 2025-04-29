import axios from 'axios'
import { objToQueryStr } from '@/utils';
import { 
  ChatRequestConfig, 
  ChatRequest, 
  ChatResponse, 
  SessionConfig, 
  SessionMessage, 
  Session, 
  MessageOptions, 
  MessageResponse, 
  MessageCallbackParams 
} from '../types';

/**
 * 创建新会话
 */
export const createSession = async (provider?: string, summary?: string): Promise<string> => {
  try {
    const response = await axios.post<string>('/api/sessions', { provider, summary })
    return response.data
  } catch (error) {
    console.error('创建会话失败:', error)
    throw error
  }
}

/**
 * 获取会话列表
 */
export const listSessionIds = async (provider?: string): Promise<string[]> => {
  try {
    console.log('开始获取会话:');
    const url = provider ? `/api/sessionIds?provider=${provider}` : '/api/sessionIds';
    const response = await axios.get<string[]>(url);
    console.log('获取会话列表成功:', response.data);
    return response.data
  } catch (error) {
    console.error('获取会话列表失败:', error)
    throw error
  }
}

/**
 * 获取会话历史
 */
export const getSessionMessages = async (sessionId: string): Promise<SessionMessage[]> => {
  try {
    const response = await axios.get<SessionMessage[]>(`/api/sessions/${sessionId}`)
    return response.data
  } catch (error) {
    console.error('获取会话历史失败:', error)
    throw error
  }
}

/**
 * 发送流式消息到会话
 */
export async function sendStreamingSessionMessage(
  sessionId: string,
  message?: string,
  selectedTools?: string[] | undefined,
  options?: MessageOptions
): Promise<{
  controller: AbortController;
  onMessage: (callback: (params: MessageCallbackParams) => void) => void;
  onError: (callback: (error: string) => void) => void;
  onComplete: (callback: () => void) => void;
}> {
  const controller = new AbortController();
  let eventSource: EventSource | null = null;

  // 存储回调函数
  const messageCallbacks: ((params: MessageCallbackParams) => void)[] = [];
  const errorCallbacks: ((error: string) => void)[] = [];
  const completeCallbacks: (() => void)[] = [];

  try {
    // 第一步：发送POST请求获取requestId
    const prepareResponse = await fetch(`/api/sessions/${sessionId}/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, selectedTools, options }),
      signal: controller.signal // 添加abort信号
    });

    if (!prepareResponse.ok) {
      throw new Error(`流式请求失败: ${prepareResponse.status}`);
    }

    const prepareData = await prepareResponse.json();
    const requestId = prepareData.requestId;

    if (!requestId) {
      throw new Error('服务器没有返回有效的请求ID');
    }

    // 设置中止事件监听器
    controller.signal.addEventListener('abort', () => {
      console.log('请求被用户中止，关闭SSE连接');
      if (eventSource) {
        eventSource.close();
      }
    });

    // 第二步：建立SSE连接获取流式数据
    eventSource = new EventSource(`/api/sessions/${sessionId}/messages/stream${objToQueryStr({
      requestId,
    })}`);
    
    // 错误处理
    eventSource.onerror = (error) => {
      console.error('SSE连接错误:', error);
      // 通知所有错误回调
      errorCallbacks.forEach(callback => callback('流式连接错误'));
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
    
    // 消息处理
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // 检查错误
        if (data.error) {
          errorCallbacks.forEach(callback => callback(data.error));
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          return;
        }
        
        // 检查完成信号
        if (data.done) {
          completeCallbacks.forEach(callback => callback());
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          return;
        }
        
        // 处理内容、推理内容、工具
        const content = data.content || '';
        const reasoningContent = data.reasoningContent || '';
        const toolCall = data.toolCall || undefined;
        const isMessageUpdate = data.isMessageUpdate || false;
        
        // 通知所有消息回调
        messageCallbacks.forEach(callback => callback({
          content,
          reasoningContent,
          toolCall,
          isMessageUpdate
        }));
      } catch (error) {
        console.error('处理SSE消息错误:', error);
      }
    };
    
    // 返回控制对象
    return {
      controller,
      onMessage: (callback) => {
        messageCallbacks.push(callback);
      },
      onError: (callback) => {
        errorCallbacks.push(callback);
      },
      onComplete: (callback) => {
        completeCallbacks.push(callback);
      }
    };
  } catch (error) {
    console.error('初始化流式请求失败:', error);
    throw error;
  }
}

/**
 * 删除会话
 */
export const deleteSession = async (sessionId: string): Promise<boolean> => {
  try {
    const response = await axios.delete(`/api/sessions/${sessionId}`)
    return response.data.success || false
  } catch (error) {
    console.error('删除会话失败:', error)
    throw error
  }
}