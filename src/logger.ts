/**
 * Logger utility for consistent logging throughout the application
 * Supports different log levels with color differentiation
 */

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  // Log colors
  log: {
    module: '\x1b[36m', // Cyan for module name
    content: '\x1b[0m'  // Normal for content
  },
  // Warning colors
  warn: {
    module: '\x1b[33m', // Yellow for module name
    content: '\x1b[33m' // Yellow for content
  },
  // Error colors
  error: {
    module: '\x1b[31m', // Red for module name
    content: '\x1b[31m' // Red for content
  }
};

/**
 * Logger class with methods for different log levels
 */
class Logger {
  /**
   * Log information messages
   * @param module - Name of the module (e.g., 'MCPClient', 'API', etc.)
   * @param content - Content to log (can be any type)
   */
  public log(module: string, content: any): void {
    console.log(
      `${colors.log.module}[${module}]${colors.reset} => `,
      content
    );
  }

  /**
   * Log warning messages
   * @param module - Name of the module
   * @param content - Warning content to log
   */
  public warn(module: string, content: any): void {
    console.warn(
      `${colors.warn.module}[${module}]${colors.reset} => `,
      content
    );
  }

  /**
   * Log error messages
   * @param module - Name of the module
   * @param content - Error content to log
   */
  public error(module: string, content: any): void {
    console.error(
      `${colors.error.module}[${module}]${colors.reset} => `,
      content
    );
  }
}

// Export a singleton instance
export default new Logger(); 