import {
  LogLevel,
  LogEntry,
  LoggerOptions,
  LoggerChain,
  OutputHandler,
} from './types';
import { parseLogLevel, createConsoleHandler } from './utils';

/**
 * Main Logger class
 */
export class Logger {
  private level: LogLevel;
  private handler: OutputHandler;
  private enableTimestamp: boolean;
  private defaultContext?: Record<string, unknown>;
  private defaultPrefix?: string;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ? parseLogLevel(options.level) : LogLevel.INFO;
    this.handler = options.handler || createConsoleHandler();
    this.enableTimestamp =
      options.enableTimestamp !== undefined ? options.enableTimestamp : true;
    this.defaultContext = options.defaultContext;
    this.defaultPrefix = options.defaultPrefix;
  }

  /**
   * Set the minimum log level
   */
  setLevel(level: LogLevel | keyof typeof LogLevel): void {
    this.level = parseLogLevel(level);
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level;
  }

  /**
   * Set a custom output handler
   */
  setHandler(handler: OutputHandler): void {
    this.handler = handler;
  }

  /**
   * Set default context that will be included in all logs
   */
  setDefaultContext(context: Record<string, unknown>): void {
    this.defaultContext = context;
  }

  /**
   * Set default prefix for all log messages
   */
  setDefaultPrefix(prefix: string): void {
    this.defaultPrefix = prefix;
  }

  /**
   * Create a chainable logger instance
   */
  chain(): LoggerChain {
    return new LoggerChainBuilder(this);
  }

  /**
   * Log at trace level
   */
  trace(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.TRACE, message, context);
  }

  /**
   * Log at debug level
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log at info level
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log at warn level
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log at error level
   */
  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (level < this.level) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: this.enableTimestamp ? Date.now() : 0,
      prefix: this.defaultPrefix,
    };

    // Merge default context with provided context
    if (this.defaultContext || context) {
      entry.context = {
        ...this.defaultContext,
        ...context,
      };
    }

    this.handler(entry);
  }

  /**
   * Create a chainable logger with initial context
   */
  withContext(context: Record<string, unknown>): LoggerChain {
    return new LoggerChainBuilder(this).withContext(context);
  }

  /**
   * Create a chainable logger with initial prefix
   */
  withPrefix(prefix: string): LoggerChain {
    return new LoggerChainBuilder(this).withPrefix(prefix);
  }
}

/**
 * Chainable logger builder
 */
class LoggerChainBuilder implements LoggerChain {
  private logger: Logger;
  private context?: Record<string, unknown>;
  private metadata?: Record<string, unknown>;
  private errorObj?: Error;
  private prefix?: string;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  withContext(context: Record<string, unknown>): LoggerChain {
    this.context = {
      ...this.context,
      ...context,
    };
    return this;
  }

  withMetadata(metadata: Record<string, unknown>): LoggerChain {
    this.metadata = {
      ...this.metadata,
      ...metadata,
    };
    return this;
  }

  withError(error: Error): LoggerChain {
    this.errorObj = error;
    return this;
  }

  withPrefix(prefix: string): LoggerChain {
    this.prefix = prefix;
    return this;
  }

  private createEntry(level: LogLevel, message: string): LogEntry {
    const entry: LogEntry = {
      level,
      message,
      timestamp: this.logger['enableTimestamp'] ? Date.now() : 0,
      prefix: this.prefix || this.logger['defaultPrefix'],
    };

    // Merge contexts
    const defaultContext = this.logger['defaultContext'];
    if (defaultContext || this.context) {
      entry.context = {
        ...defaultContext,
        ...this.context,
      };
    }

    if (this.metadata) {
      entry.metadata = this.metadata;
    }

    if (this.errorObj) {
      entry.error = this.errorObj;
    }

    return entry;
  }

  private log(level: LogLevel, message: string): void {
    if (level < this.logger.getLevel()) {
      return;
    }

    const entry = this.createEntry(level, message);
    this.logger['handler'](entry);
  }

  trace(message: string): void {
    this.log(LogLevel.TRACE, message);
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }
}
