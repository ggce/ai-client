import axios from 'axios'

export interface ChatRequestConfig {
  apiKey: string
  baseUrl?: string
}

export interface ChatRequest {
  message: string
  provider: string
  model: string
  config: ChatRequestConfig
  stream?: boolean
  conversationHistory?: Array<{ type: 'user' | 'ai' | 'system', content: string }>
}

export interface ChatResponse {
  reply: string
  reasoningContent?: string
}

export const sendChatRequest = async (request: ChatRequest): Promise<ChatResponse> => {
  try {
    const response = await axios.post<ChatResponse>('/api/chat', request)
    return response.data
  } catch (error) {
    console.error('聊天请求失败:', error)
    throw error
  }
}

// 添加流式请求API，兼容DeepSeek-V3
export const sendStreamingChatRequest = (
  request: ChatRequest, 
  onChunk: (chunk: string, reasoningChunk?: string) => void,
  onComplete: () => void,
  onError: (error: unknown) => void
): () => void => {
  // 使用 fetch API 和 SSE 实现流式请求
  const fetchController = new AbortController();
  const signal = fetchController.signal;
  
  // 连接状态管理
  let isFinished = false;
  
  // 重试逻辑
  const maxRetries = 3;
  let retryCount = 0;
  let lastEventTime = Date.now();
  
  const performRequest = (shouldRetry = true) => {
    if (isFinished) return;
    
    console.log(`发起流式请求${retryCount > 0 ? ` (重试 #${retryCount})` : ''}`);
    
    // 使用fetch进行流式请求
    fetch('/api/chat/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        ...request,
        stream: true // 明确标记为流式请求
      }),
      signal: signal
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Stream request failed with status ${response.status}`);
      }
      
      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }
      
      // 创建流读取器
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // 活跃连接检测
      const heartbeatCheckInterval = setInterval(() => {
        // 如果超过30秒没有收到数据，可能是连接出现问题
        const idleTime = Date.now() - lastEventTime;
        if (idleTime > 30000 && !isFinished) {
          console.warn(`流式连接空闲时间过长: ${idleTime}ms，正在重新检查连接状态`);
          clearInterval(heartbeatCheckInterval);
          
          // 如果支持重试且未达到最大重试次数，则重试
          if (shouldRetry && retryCount < maxRetries) {
            console.log(`尝试重新建立连接 (${retryCount + 1}/${maxRetries})`);
            retryCount++;
            reader.cancel().catch(console.error);
            performRequest();
          } else if (!isFinished) {
            onError(new Error('Stream connection timed out'));
            cleanUp();
          }
        }
      }, 5000);
      
      // 处理流读取
      function readStream(): Promise<void> {
        if (isFinished) {
          clearInterval(heartbeatCheckInterval);
          return Promise.resolve();
        }
        
        return reader.read().then(({ done, value }) => {
          // 更新最后事件时间
          lastEventTime = Date.now();
          
          if (done) {
            clearInterval(heartbeatCheckInterval);
            if (!isFinished) {
              console.log('前端收到完成信号 [DONE]');
              onComplete();
              isFinished = true;
            }
            return;
          }
          
          // 解码数据
          const text = decoder.decode(value, { stream: true });
          
          // 处理服务器发送的事件数据
          const lines = text.split('\n\n');
          
          for (const line of lines) {
            if (isFinished) break;
            
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              // 直接在控制台打印收到的数据
              console.log('前端收到SSE数据:', data);
              
              if (data === '[DONE]') {
                clearInterval(heartbeatCheckInterval);
                if (!isFinished) {
                  console.log('前端收到完成信号 [DONE]');
                  onComplete();
                  isFinished = true;
                }
                return;
              }
              
              try {
                const parsed = JSON.parse(data);
                
                // 添加详细调试日志
                console.log('解析后的流式数据:', JSON.stringify(parsed, null, 2));
                
                // 检查错误
                if (parsed.error) {
                  clearInterval(heartbeatCheckInterval);
                  console.error('流式响应报错:', parsed.error);
                  onError(new Error(parsed.error));
                  isFinished = true;
                  return;
                }
                
                // 处理不同AI提供商的响应格式
                let content = '';
                let reasoningContent = '';
                
                // 最优先检查推理内容
                let hasReasoningContent = false;
                
                // 1. 先检查根级别的reasoning_content字段
                if (parsed.reasoning_content !== undefined) {
                  reasoningContent = parsed.reasoning_content;
                  console.log('【前端】发现根级别推理内容，长度:', reasoningContent.length, '字符');
                  hasReasoningContent = true;
                  
                  // 立即发送推理内容，不等待其他内容
                  if (!isFinished) {
                    console.log('【前端】立即更新推理内容到UI');
                    onChunk('', reasoningContent);
                    // 防止重复处理
                    reasoningContent = '';
                  }
                }
                
                // 2. 再检查常规内容
                if (parsed.choices?.[0]?.delta?.content !== undefined) {
                  content = parsed.choices[0].delta.content;
                  
                  // 还要检查是否有嵌套的推理内容
                  if (parsed.choices?.[0]?.delta?.reasoning_content !== undefined) {
                    reasoningContent = parsed.choices[0].delta.reasoning_content;
                    console.log('【前端】检测到嵌套推理内容，长度:', reasoningContent.length);
                    hasReasoningContent = true;
                  }
                } 
                else if (parsed.content !== undefined) {
                  content = parsed.content;
                }
                
                // 如果有常规内容，或者有推理内容但前面没处理过，则发送到UI
                if ((content || (reasoningContent && !hasReasoningContent)) && !isFinished) {
                  console.log('【前端】发送到UI - 内容长度:', content.length, '推理长度:', reasoningContent.length);
                  onChunk(content, reasoningContent);
                }
              } catch (error) {
                console.error('解析流数据失败:', error, '原始数据:', data);
              }
            }
          }
          
          // 继续读取流
          if (!isFinished) {
            return readStream();
          }
        }).catch(error => {
          clearInterval(heartbeatCheckInterval);
          
          // 如果是由于调用了abort()导致的错误，不需要报告
          if (error.name === 'AbortError' || isFinished) {
            return;
          }
          
          console.error('流读取错误:', error);
          
          // 如果支持重试且未达到最大重试次数，则重试
          if (shouldRetry && retryCount < maxRetries) {
            console.log(`连接中断，尝试重新连接 (${retryCount + 1}/${maxRetries})`);
            retryCount++;
            performRequest();
          } else if (!isFinished) {
            onError(error);
            isFinished = true;
          }
        });
      }
      
      // 开始读取流
      readStream();
    })
    .catch(error => {
      // 如果是由于调用了abort()导致的错误，不需要报告
      if (error.name === 'AbortError' || isFinished) {
        return;
      }
      
      console.error('流式连接建立失败:', error);
      
      // 如果支持重试且未达到最大重试次数，则重试
      if (shouldRetry && retryCount < maxRetries) {
        console.log(`连接失败，尝试重新连接 (${retryCount + 1}/${maxRetries})`);
        retryCount++;
        setTimeout(() => performRequest(), 1000); // 延迟1秒后重试
      } else if (!isFinished) {
        onError(error);
        isFinished = true;
      }
    });
  };
  
  // 开始请求
  performRequest();
  
  // 清理函数
  const cleanUp = () => {
    if (!isFinished) {
      isFinished = true;
      fetchController.abort();
    }
  };
  
  // 返回用于清理的函数
  return cleanUp;
}