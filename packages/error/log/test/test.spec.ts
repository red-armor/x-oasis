import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Logger, LogLevel } from '../src';
// import { log } from '../src';

describe('Logger', () => {
  let mockHandler: ReturnType<typeof vi.fn>;
  let logger: Logger;

  beforeEach(() => {
    mockHandler = vi.fn();
    logger = new Logger({
      handler: mockHandler,
      enableTimestamp: false,
    });
  });

  describe('Basic logging', () => {
    it('should log at trace level', () => {
      logger.setLevel(LogLevel.TRACE);
      logger.trace('test message');

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.TRACE,
          message: 'test message',
        })
      );
    });

    it('should log at debug level', () => {
      logger.setLevel(LogLevel.DEBUG);
      logger.debug('test message');

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.DEBUG,
          message: 'test message',
        })
      );
    });

    it('should log at info level', () => {
      logger.info('test message');

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.INFO,
          message: 'test message',
        })
      );
    });

    it('should log at warn level', () => {
      logger.warn('test message');

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.WARN,
          message: 'test message',
        })
      );
    });

    it('should log at error level', () => {
      logger.error('test message');

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          level: LogLevel.ERROR,
          message: 'test message',
        })
      );
    });
  });

  describe('Log level filtering', () => {
    it('should not log messages below the set level', () => {
      logger.setLevel(LogLevel.WARN);
      logger.trace('trace message');
      logger.debug('debug message');
      logger.info('info message');

      expect(mockHandler).not.toHaveBeenCalled();

      logger.warn('warn message');
      logger.error('error message');

      expect(mockHandler).toHaveBeenCalledTimes(2);
    });

    it('should log all messages when level is TRACE', () => {
      logger.setLevel(LogLevel.TRACE);
      logger.trace('trace');
      logger.debug('debug');
      logger.info('info');
      logger.warn('warn');
      logger.error('error');

      expect(mockHandler).toHaveBeenCalledTimes(5);
    });
  });

  describe('Context support', () => {
    it('should include context in log entries', () => {
      logger.info('test message', { userId: '123', action: 'login' });

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            userId: '123',
            action: 'login',
          },
        })
      );
    });

    it('should merge default context with provided context', () => {
      logger.setDefaultContext({ app: 'my-app', version: '1.0.0' });
      logger.info('test message', { userId: '123' });

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            app: 'my-app',
            version: '1.0.0',
            userId: '123',
          },
        })
      );
    });
  });

  describe('Chainable API', () => {
    it('should support chaining with context', () => {
      logger
        .chain()
        .withContext({ userId: '123' })
        .withContext({ action: 'login' })
        .info('User logged in');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: {
            userId: '123',
            action: 'login',
          },
          message: 'User logged in',
        })
      );
    });

    it('should support chaining with metadata', () => {
      logger
        .chain()
        .withMetadata({ duration: 150, status: 'success' })
        .info('Request completed');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            duration: 150,
            status: 'success',
          },
          message: 'Request completed',
        })
      );
    });

    it('should support chaining with error', () => {
      const error = new Error('Something went wrong');
      logger.chain().withError(error).error('Operation failed');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          message: 'Operation failed',
        })
      );
    });

    it('should support chaining with prefix', () => {
      logger.chain().withPrefix('[API]').info('Request received');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: '[API]',
          message: 'Request received',
        })
      );
    });

    it('should support complex chaining', () => {
      const error = new Error('Validation failed');
      logger
        .chain()
        .withContext({ userId: '123' })
        .withMetadata({ field: 'email', value: 'invalid' })
        .withError(error)
        .withPrefix('[VALIDATION]')
        .warn('Validation error');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { userId: '123' },
          metadata: { field: 'email', value: 'invalid' },
          error,
          prefix: '[VALIDATION]',
          message: 'Validation error',
        })
      );
    });
  });

  describe('withContext and withPrefix methods', () => {
    it('should create chainable logger with context', () => {
      logger.withContext({ userId: '123' }).info('User action');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: { userId: '123' },
        })
      );
    });

    it('should create chainable logger with prefix', () => {
      logger.withPrefix('[APP]').info('Application started');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: '[APP]',
        })
      );
    });
  });

  describe('Default prefix', () => {
    it('should include default prefix in all logs', () => {
      logger.setDefaultPrefix('[MY-APP]');
      logger.info('Test message');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: '[MY-APP]',
        })
      );
    });

    it('should allow overriding default prefix with chain prefix', () => {
      logger.setDefaultPrefix('[DEFAULT]');
      logger.chain().withPrefix('[OVERRIDE]').info('Test message');

      expect(mockHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          prefix: '[OVERRIDE]',
        })
      );
    });
  });

  describe('Timestamp', () => {
    it('should include timestamp when enabled', () => {
      const loggerWithTimestamp = new Logger({
        handler: mockHandler,
        enableTimestamp: true,
      });
      loggerWithTimestamp.info('test');

      const call = mockHandler.mock.calls[0][0];
      expect(call.timestamp).toBeGreaterThan(0);
    });

    it('should not include timestamp when disabled', () => {
      logger.info('test');

      const call = mockHandler.mock.calls[0][0];
      expect(call.timestamp).toBe(0);
    });
  });

  describe('Log level string parsing', () => {
    it('should accept log level as string', () => {
      logger.setLevel('DEBUG');
      logger.setLevel('WARN');
      logger.setLevel('ERROR');

      expect(logger.getLevel()).toBe(LogLevel.ERROR);
    });

    it('should default to INFO for invalid string', () => {
      logger.setLevel('INVALID' as any);
      expect(logger.getLevel()).toBe(LogLevel.INFO);
    });
  });
});

// describe('Default logger (log)', () => {
//   it('should provide convenience methods', () => {
//     const originalConsole = console.info;
//     const mockConsole = vi.fn();
//     console.info = mockConsole;

//     try {
//       log.info('test message');
//       expect(mockConsole).toHaveBeenCalled();
//     } finally {
//       console.info = originalConsole;
//     }
//   });

//   it('should support setLevel', () => {
//     expect(() => log.setLevel(LogLevel.DEBUG)).not.toThrow();
//   });

//   it('should support withContext', () => {
//     const chain = log.withContext({ test: 'value' });
//     expect(chain).toBeDefined();
//   });

//   it('should support withPrefix', () => {
//     const chain = log.withPrefix('[TEST]');
//     expect(chain).toBeDefined();
//   });

//   it('should support chain', () => {
//     const chain = log.chain();
//     expect(chain).toBeDefined();
//   });
// });
