import * as fs from 'fs';
import * as path from 'path';
import logger from '../logger';

export class FileLoader {
  private static loggerPrefix = 'FileLoader';

  /**
   * 从多个可能的路径中读取文件内容
   * @param relativePath 相对于src或dist的文件路径，例如 'prompts/summary.md'
   * @param defaultContent 可选的默认内容，当文件不存在时返回
   * @returns 文件内容
   */
  public static loadFile(relativePath: string, defaultContent?: string): string {
    try {
      // 尝试多个可能的路径
      const possiblePaths = [
        path.join(process.cwd(), 'src', relativePath),    // 开发环境源码路径
        path.join(process.cwd(), 'dist', relativePath),   // 生产环境编译路径
        path.join(__dirname, '..', '..', 'src', relativePath),  // 开发环境相对路径
        path.join(__dirname, '..', relativePath),         // 生产环境相对路径
      ];

      let fileContent = '';
      for (const filePath of possiblePaths) {
        if (fs.existsSync(filePath)) {
          fileContent = fs.readFileSync(filePath, 'utf-8');
          logger.log(this.loggerPrefix, `成功从 ${filePath} 读取文件`);
          return fileContent;
        }
      }

      if (defaultContent !== undefined) {
        logger.warn(this.loggerPrefix, `未找到文件 ${relativePath}，使用默认内容`);
        return defaultContent;
      }

      throw new Error(`找不到文件: ${relativePath}`);
    } catch (error) {
      if (defaultContent !== undefined) {
        logger.error(this.loggerPrefix, `读取文件失败: ${error}, 使用默认内容`);
        return defaultContent;
      }
      throw error;
    }
  }

  /**
   * 确保文件所在的目录存在，如果不存在则创建
   * @param filePath 文件完整路径
   */
  public static ensureDirectoryExistence(filePath: string): void {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
      return;
    }
    this.ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
  }

  /**
   * 保存文件内容
   * @param relativePath 相对于src的文件路径
   * @param content 文件内容
   */
  public static saveFile(relativePath: string, content: string): void {
    try {
      const filePath = path.join(process.cwd(), 'src', relativePath);
      this.ensureDirectoryExistence(filePath);
      fs.writeFileSync(filePath, content, 'utf-8');
      logger.log(this.loggerPrefix, `成功保存文件到 ${filePath}`);
    } catch (error) {
      logger.error(this.loggerPrefix, `保存文件失败: ${error}`);
      throw error;
    }
  }
} 