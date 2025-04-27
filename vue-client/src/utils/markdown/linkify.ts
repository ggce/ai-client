import MarkdownIt from 'markdown-it';

// 定义匹配对象接口，用于linkify插件
export interface LinkMatch {
  url: string;
  text: string;
  index: number;
  lastIndex: number;
  raw: string;
  schema?: string | undefined;
}

/**
 * 增强MarkdownIt的链接识别，处理中文标点符号
 * @param md MarkdownIt实例
 */
export function setupLinkify(md: MarkdownIt): void {
  if (!md.linkify) return;
  
  // 保存原始方法引用
  const originalLinkify = md.linkify.set;
  
  if (!originalLinkify) return;
  
  // 重写set方法
  md.linkify.set = function(this: any, ...args: any): any {
    const result = originalLinkify.apply(this, args);
    
    // 添加自定义规则，检测链接后跟的中文标点
    md.linkify.tlds('.。，,：:；;！!？?）)）】]', false); // 设置这些字符不作为TLD
    
    // 保存原始匹配函数
    const defaultLinkMatch = md.linkify.match;
    if (defaultLinkMatch) {
      // 重写匹配函数
      const originalMatch = defaultLinkMatch;
      md.linkify.match = function(text: string): any {
        const matches = originalMatch.call(md.linkify, text);
        
        if (!matches || matches.length === 0) return matches;
        
        // 修正每个匹配的链接，排除末尾的中文标点
        return matches.map((match: LinkMatch) => {
          // 检查链接末尾是否有中文标点
          const urlEnd = match.text.match(/[.。，,：:；;！!？?）)）】]]+$/);
          if (urlEnd) {
            // 获取匹配到的标点符号
            const punctuation = urlEnd[0];
            // 从链接中移除标点符号
            match.url = match.url.slice(0, -punctuation.length);
            match.text = match.text.slice(0, -punctuation.length);
          }
          return match;
        });
      };
    }
    
    return result;
  };
}

/**
 * 配置Markdown实例使链接在新标签页中打开
 * @param md MarkdownIt实例
 */
export function setupExternalLinks(md: MarkdownIt): void {
  md.renderer.rules.link_open = (tokens: any[], idx: number, options: any, env: any, self: any) => {
    // Add target="_blank" and rel="noopener noreferrer" to all links
    const token = tokens[idx];
    const aIndex = token.attrIndex('target');
    
    if (aIndex < 0) {
      token.attrPush(['target', '_blank']);
      token.attrPush(['rel', 'noopener noreferrer']);
    } else if (token.attrs) {
      token.attrs[aIndex][1] = '_blank';
      
      const relIndex = token.attrIndex('rel');
      if (relIndex < 0) {
        token.attrPush(['rel', 'noopener noreferrer']);
      }
    }
    
    // Return default renderer result
    return self.renderToken(tokens, idx, options);
  };
}

/**
 * 创建配置好的MarkdownIt实例
 * @returns 配置好的MarkdownIt实例
 */
export function createMarkdownRenderer(): MarkdownIt {
  const md = new MarkdownIt({
    breaks: true,
    linkify: true,
    typographer: true,
  });
  
  setupLinkify(md);
  setupExternalLinks(md);
  
  return md;
}