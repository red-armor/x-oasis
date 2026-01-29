/**
 * Log levels in order of severity
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  SILENT = 5,
}

/**
 * Log entry data structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  error?: Error;
  prefix?: string;
}

/**
 * Output handler function type
 */
export type OutputHandler = (entry: LogEntry) => void;

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /**
   * Minimum log level to output (default: LogLevel.INFO)
   */
  level?: LogLevel | keyof typeof LogLevel;

  /**
   * Custom output handler (default: console)
   */
  handler?: OutputHandler;

  /**
   * Enable timestamps in log entries (default: true)
   */
  enableTimestamp?: boolean;

  /**
   * Default context that will be included in all logs
   */
  defaultContext?: Record<string, unknown>;

  /**
   * Default prefix for all log messages
   */
  defaultPrefix?: string;
}

/**
 * Chainable logger interface
 */
export interface LoggerChain {
  /**
   * Add context data that will be included in this log entry
   */
  withContext(context: Record<string, unknown>): LoggerChain;

  /**
   * Add metadata that will be included in this log entry
   */
  withMetadata(metadata: Record<string, unknown>): LoggerChain;

  /**
   * Add an error object to this log entry
   */
  withError(error: Error): LoggerChain;

  /**
   * Add a prefix to this log message
   */
  withPrefix(prefix: string): LoggerChain;

  /**
   * Log at trace level
   */
  trace(message: string): void;

  /**
   * Log at debug level
   */
  debug(message: string): void;

  /**
   * Log at info level
   */
  info(message: string): void;

  /**
   * Log at warn level
   */
  warn(message: string): void;

  /**
   * Log at error level
   */
  error(message: string): void;
}
