# @x-oasis/log

A friendly, browser-compatible logging library with a fluent API for specifying log messages, metadata, context, and errors.

## Features

- 🎯 **Simple API** - Easy to use with a clean, chainable interface
- 🌐 **Browser Compatible** - Works seamlessly in browser environments
- 📊 **Multiple Log Levels** - Support for trace, debug, info, warn, and error levels
- 🔗 **Chainable API** - Fluent interface for building log entries
- 📝 **Context & Metadata** - Attach contextual data and metadata to logs
- 🎨 **Customizable** - Configurable log levels and custom output handlers
- ⚡ **Lightweight** - Small bundle size with zero dependencies

## Installation

```bash
npm install @x-oasis/log
```

## Quick Start

### Basic Usage

```typescript
import { Logger, LogLevel } from '@x-oasis/log';

// Create a logger instance
const logger = new Logger({
  level: LogLevel.INFO, // Only log info, warn, and error
});

// Simple logging
logger.info('User logged in');
logger.warn('Deprecated API used');
logger.error('Failed to process request');
```

### Using the Default Logger

```typescript
import { log } from '@x-oasis/log';

// Use the default logger instance
log.info('Application started');
log.debug('Debug information');
log.error('An error occurred');
```

### Chainable API

The chainable API allows you to build log entries with context, metadata, errors, and prefixes:

```typescript
import { Logger } from '@x-oasis/log';

const logger = new Logger();

// Chain multiple operations
logger
  .chain()
  .withContext({ userId: '123', sessionId: 'abc' })
  .withMetadata({ duration: 150, status: 'success' })
  .withPrefix('[API]')
  .info('Request completed');

// With error
const error = new Error('Validation failed');
logger
  .chain()
  .withError(error)
  .withContext({ field: 'email' })
  .error('Validation error');
```

### Context and Metadata

Context and metadata help you attach additional information to your logs:

```typescript
const logger = new Logger();

// Context: persistent data that describes the environment
logger.setDefaultContext({
  app: 'my-app',
  version: '1.0.0',
  environment: 'production',
});

// Metadata: specific data for individual log entries
logger
  .chain()
  .withContext({ requestId: 'req-123' })
  .withMetadata({ responseTime: 45, statusCode: 200 })
  .info('HTTP request completed');
```

### Setting Log Levels

Control which logs are output based on severity:

```typescript
import { Logger, LogLevel } from '@x-oasis/log';

const logger = new Logger();

// Set minimum log level (only warn and error will be logged)
logger.setLevel(LogLevel.WARN);

// Or use string
logger.setLevel('DEBUG');

// Available levels (from most to least verbose):
// LogLevel.TRACE (0)
// LogLevel.DEBUG (1)
// LogLevel.INFO (2)
// LogLevel.WARN (3)
// LogLevel.ERROR (4)
// LogLevel.SILENT (5)
```

### Custom Output Handler

Replace the default console output with your own handler:

```typescript
import { Logger, LogLevel, LogEntry } from '@x-oasis/log';

const logger = new Logger({
  handler: (entry: LogEntry) => {
    // Send to your logging service
    fetch('/api/logs', {
      method: 'POST',
      body: JSON.stringify({
        level: entry.level,
        message: entry.message,
        timestamp: entry.timestamp,
        context: entry.context,
        metadata: entry.metadata,
        error: entry.error ? {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        } : undefined,
      }),
    });
  },
});

logger.info('This will be sent to your API');
```

### Default Prefix

Add a prefix to all log messages:

```typescript
const logger = new Logger({
  defaultPrefix: '[MY-APP]',
});

logger.info('Application started');
// Output: [MY-APP] Application started
```

### Convenience Methods

Use the `withContext` and `withPrefix` methods for quick setup:

```typescript
const logger = new Logger();

// Create a logger with context
logger
  .withContext({ userId: '123' })
  .info('User action');

// Create a logger with prefix
logger
  .withPrefix('[MODULE]')
  .warn('Warning message');
```

## API Reference

### Logger

#### Constructor Options

```typescript
interface LoggerOptions {
  level?: LogLevel | keyof typeof LogLevel; // Default: LogLevel.INFO
  handler?: OutputHandler; // Default: console handler
  enableTimestamp?: boolean; // Default: true
  defaultContext?: Record<string, unknown>; // Default: undefined
  defaultPrefix?: string; // Default: undefined
}
```

#### Methods

- `setLevel(level: LogLevel | keyof typeof LogLevel): void` - Set minimum log level
- `getLevel(): LogLevel` - Get current log level
- `setHandler(handler: OutputHandler): void` - Set custom output handler
- `setDefaultContext(context: Record<string, unknown>): void` - Set default context
- `setDefaultPrefix(prefix: string): void` - Set default prefix
- `chain(): LoggerChain` - Create a chainable logger instance
- `withContext(context: Record<string, unknown>): LoggerChain` - Create chainable logger with context
- `withPrefix(prefix: string): LoggerChain` - Create chainable logger with prefix
- `trace(message: string, context?: Record<string, unknown>): void`
- `debug(message: string, context?: Record<string, unknown>): void`
- `info(message: string, context?: Record<string, unknown>): void`
- `warn(message: string, context?: Record<string, unknown>): void`
- `error(message: string, context?: Record<string, unknown>): void`

### LoggerChain

Chainable interface for building log entries:

- `withContext(context: Record<string, unknown>): LoggerChain`
- `withMetadata(metadata: Record<string, unknown>): LoggerChain`
- `withError(error: Error): LoggerChain`
- `withPrefix(prefix: string): LoggerChain`
- `trace(message: string): void`
- `debug(message: string): void`
- `info(message: string): void`
- `warn(message: string): void`
- `error(message: string): void`

## Examples

### Example 1: API Request Logging

```typescript
import { Logger } from '@x-oasis/log';

const logger = new Logger({
  defaultContext: {
    service: 'api',
    version: '1.0.0',
  },
});

function handleRequest(req: Request) {
  const requestId = generateRequestId();
  
  logger
    .chain()
    .withContext({ requestId, method: req.method, path: req.path })
    .withMetadata({ timestamp: Date.now() })
    .info('Request received');

  try {
    const result = await processRequest(req);
    
    logger
      .chain()
      .withContext({ requestId })
      .withMetadata({ duration: result.duration, statusCode: 200 })
      .info('Request completed');
    
    return result;
  } catch (error) {
    logger
      .chain()
      .withContext({ requestId })
      .withError(error as Error)
      .error('Request failed');
    
    throw error;
  }
}
```

### Example 2: Form Validation

```typescript
import { Logger } from '@x-oasis/log';

const logger = new Logger({
  level: 'WARN', // Only log warnings and errors
});

function validateEmail(email: string) {
  if (!email.includes('@')) {
    logger
      .chain()
      .withContext({ field: 'email', value: email })
      .withMetadata({ validation: 'format' })
      .warn('Invalid email format');
    
    return false;
  }
  
  return true;
}
```

### Example 3: Error Tracking

```typescript
import { Logger, LogLevel } from '@x-oasis/log';

const logger = new Logger({
  handler: (entry) => {
    // Send errors to error tracking service
    if (entry.level >= LogLevel.ERROR && entry.error) {
      errorTrackingService.captureException(entry.error, {
        context: entry.context,
        metadata: entry.metadata,
      });
    }
    
    // Also log to console
    console.error(entry);
  },
});

try {
  riskyOperation();
} catch (error) {
  logger
    .chain()
    .withError(error as Error)
    .withContext({ operation: 'riskyOperation' })
    .error('Operation failed');
}
```

## Browser Compatibility

This library is designed to work in all modern browsers. It uses standard browser APIs and has no dependencies.

## TypeScript Support

Full TypeScript support with comprehensive type definitions included.

## License

ISC
