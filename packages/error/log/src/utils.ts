import { LogLevel, LogEntry } from './types';

/**
 * Convert log level string to LogLevel enum
 */
export function parseLogLevel(
  level: LogLevel | keyof typeof LogLevel
): LogLevel {
  if (typeof level === 'number') {
    return level;
  }
  return LogLevel[level] ?? LogLevel.INFO;
}

/**
 * Get log level name
 */
export function getLogLevelName(level: LogLevel): string {
  return LogLevel[level] ?? 'UNKNOWN';
}

/**
 * Default console output handler
 */
export function createConsoleHandler(): (entry: LogEntry) => void {
  const consoleMethods: Record<number, typeof console.log> = {
    [LogLevel.TRACE]: console.trace || console.debug,
    [LogLevel.DEBUG]: console.debug,
    [LogLevel.INFO]: console.info,
    [LogLevel.WARN]: console.warn,
    [LogLevel.ERROR]: console.error,
  };

  return (entry) => {
    const method = consoleMethods[entry.level] || console.log;
    const parts: unknown[] = [];

    // Add prefix if present
    if (entry.prefix) {
      parts.push(entry.prefix);
    }

    // Add message
    parts.push(entry.message);

    // Add context if present
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push('\nContext:', entry.context);
    }

    // Add metadata if present
    if (entry.metadata && Object.keys(entry.metadata).length > 0) {
      parts.push('\nMetadata:', entry.metadata);
    }

    // Add error if present
    if (entry.error) {
      parts.push('\nError:', entry.error);
    }

    method(...parts);
  };
}
