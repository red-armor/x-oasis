import { Logger } from './logger';
import { LogLevel } from './types';

export { Logger, LogLevel };
export type {
  LogEntry,
  LoggerOptions,
  LoggerChain,
  OutputHandler,
} from './types';

/**
 * Default logger instance
 */
export const defaultLogger = new Logger();

/**
 * Convenience methods using the default logger
 */
export const log = {
  trace: (message: string, context?: Record<string, unknown>) =>
    defaultLogger.trace(message, context),
  debug: (message: string, context?: Record<string, unknown>) =>
    defaultLogger.debug(message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    defaultLogger.info(message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    defaultLogger.warn(message, context),
  error: (message: string, context?: Record<string, unknown>) =>
    defaultLogger.error(message, context),
  setLevel: (level: LogLevel | keyof typeof LogLevel) =>
    defaultLogger.setLevel(level),
  withContext: (context: Record<string, unknown>) =>
    defaultLogger.withContext(context),
  withPrefix: (prefix: string) => defaultLogger.withPrefix(prefix),
  chain: () => defaultLogger.chain(),
};

export default Logger;
