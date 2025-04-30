import { OpenAI } from 'openai';
import { Message } from './types';
import logger from './logger';
import { FileLoader } from './utils/fileLoader';

/**
 * 对话历史摘要服务
 * 当对话历史变得太长时，将较早的消息总结为一个摘要
 */
export class HistorySummarizer {
  private openai: OpenAI;
  private loggerPrefix = 'HistorySummarizer';
  private summaryPrompt: string;

  /**
   * 创建历史摘要器实例
   * @param apiKey OpenAI API密钥
   * @param model 使用的摘要模型，默认为gpt-3.5-turbo
   * @param baseURL 可选的自定义API URL
   */
  constructor(
    private apiKey: string,
    private model: string = 'gpt-3.5-turbo',
    baseURL?: string
  ) {
    this.openai = new OpenAI({
      apiKey: this.apiKey,
      baseURL: baseURL,
    });
    
    // 使用FileLoader读取提示模板
    this.summaryPrompt = FileLoader.loadFile('prompts/summary.md');
    
    logger.log(this.loggerPrefix, `历史摘要器初始化完成，使用模型: ${this.model}`);
  }

  /**
   * 更新摘要器使用的模型
   * @param model 新的模型名称
   */
  public updateModel(model: string): void {
    if (model && model !== this.model) {
      this.model = model;
      logger.log(this.loggerPrefix, `摘要器模型已更新为: ${this.model}`);
    }
  }

  /**
   * 生成对话历史的摘要
   * @param history 对话历史消息数组
   * @param maxTokens 生成摘要的最大token数，默认200
   * @param temperature 生成摘要的温度参数，默认0.2
   * @returns 生成的摘要文本
   */
  public async summarizeHistory(
    history: Message[],
    maxTokens: number = 4096,
    temperature: number = 0.2
  ): Promise<string> {
    try {
      // 拼接历史对话
      let historyText = '';
      for (const msg of history) {
        // 不展示的系统消息忽略
        if (msg.role === 'system' && !msg.isShow) {
          continue;
        }
        
        // 对于不同角色使用不同的前缀
        const prefix = 
          msg.role === 'user' ? '用户: ' : 
          msg.role === 'assistant' ? 'AI: ' :
          msg.role === 'system' ? '系统: ' :
          msg.role === 'tool' ? '工具: ' : '';
        
        historyText += `${prefix}${msg.content}\n`;
      }

      // 使用从文件读取的提示模板，替换变量
      const prompt = this.summaryPrompt.replace('${messages}', historyText);

      logger.log(this.loggerPrefix, `开始生成摘要，历史长度: ${history.length}条消息，使用模型: ${this.model}`);

      // 调用OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: temperature,
      });

      const summary = completion.choices[0].message.content || '';
      logger.log(this.loggerPrefix, `摘要生成成功，长度: ${summary.length || 0}字符`);
      
      return summary || '无法生成摘要';
    } catch (error) {
      logger.error(this.loggerPrefix, `摘要生成失败: ${error}`);
      throw new Error(`摘要生成失败: ${error}`);
    }
  }

  /**
   * 将历史消息压缩为一个摘要
   * 保留最近的n条消息，其余的生成摘要
   * @param history 完整的对话历史
   * @param keepRecentMessages 保留的最近消息数量
   * @returns 压缩后的消息数组，包含一条系统摘要消息和最近的几条消息
   */
  public async compressHistory(
    history: Message[],
    keepRecentMessages: number = 4
  ): Promise<Message[]> {
    // 如果消息太少，不需要压缩
    if (history.length <= keepRecentMessages) {
      return [...history];
    }

    try {
      // 分离要保留的最近消息和要总结的较早消息
      const recentMessages = history.slice(-keepRecentMessages);
      const olderMessages = history.slice(0, history.length - keepRecentMessages);

      // 生成较早消息的摘要
      const summary = await this.summarizeHistory(olderMessages);

      // 构建新的消息数组，包含一个系统摘要消息和最近的消息
      const compressedHistory: Message[] = [
        { role: 'system', content: `对话摘要: ${summary}` },
        ...recentMessages
      ];

      logger.log(
        this.loggerPrefix, 
        `历史压缩成功: ${history.length}条消息 -> ${compressedHistory.length}条消息`
      );

      return compressedHistory;
    } catch (error) {
      logger.error(this.loggerPrefix, `历史压缩失败: ${error}`);
      // 如果压缩失败，返回原始历史
      return [...history];
    }
  }
}

/**
 * 创建历史摘要器的工厂函数
 */
export function createHistorySummarizer(
  apiKey: string, 
  model: string = 'gpt-3.5-turbo',
  baseURL?: string
): HistorySummarizer {
  return new HistorySummarizer(apiKey, model, baseURL);
} 