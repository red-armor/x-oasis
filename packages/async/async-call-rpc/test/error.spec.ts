import { expect, describe, test } from 'vitest';
import { RPCError, JSONRPCErrorCode } from '../src/error';

/**
 * Test suite for Error handling
 * Covers: RPCError class and error codes
 */
describe('Error Handling', () => {
  describe('JSONRPCErrorCode', () => {
    test('should have ParseError code', () => {
      expect(JSONRPCErrorCode.ParseError).toBe(-32700);
    });

    test('should have InvalidRequest code', () => {
      expect(JSONRPCErrorCode.InvalidRequest).toBe(-32600);
    });

    test('should have MethodNotFound code', () => {
      expect(JSONRPCErrorCode.MethodNotFound).toBe(-32601);
    });

    test('should have InvalidParams code', () => {
      expect(JSONRPCErrorCode.InvalidParams).toBe(-32602);
    });

    test('should have InternalError code', () => {
      expect(JSONRPCErrorCode.InternalError).toBe(-32603);
    });

    test('should have ServerErrorStart code', () => {
      expect(JSONRPCErrorCode.ServerErrorStart).toBe(-32000);
    });

    test('should have ServerErrorEnd code', () => {
      expect(JSONRPCErrorCode.ServerErrorEnd).toBe(-32099);
    });
  });

  describe('RPCError', () => {
    test('should create error with message and code', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
      });
      expect(error.message).toBe('Test error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
    });

    test('should be instanceof Error', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
      });
      expect(error instanceof Error).toBe(true);
    });

    test('should have stack trace', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
      });
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('RPCError');
    });

    test('should create error with MethodNotFound code', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.MethodNotFound,
        message: 'Method not found',
      });
      expect(error.code).toBe(-32601);
    });

    test('should create error with custom code', () => {
      const error = new RPCError({
        code: -32050,
        message: 'Custom error',
      });
      expect(error.code).toBe(-32050);
    });

    test('should have proper error name', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test',
      });
      expect(error.name).toBe('RPCError');
    });

    test('should include data in error', () => {
      const errorData = { details: 'some details' };
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
        data: errorData,
      });
      expect(error.data).toEqual(errorData);
    });

    test('should preserve stack from cause error', () => {
      const causeError = new Error('Original error');
      const originalStack = causeError.stack!;

      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Wrapped error',
        cause: causeError,
      });

      expect(error.stack).toBe(originalStack);
    });

    test('should create error with cause', () => {
      const cause = new Error('Root cause');
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
        cause,
      });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
    });

    test('should convert to JSON', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
        data: { custom: 'data' },
      });

      const json = error.toJSON();
      expect(json.code).toBe(JSONRPCErrorCode.InternalError);
      expect(json.message).toBe('Test error');
      expect(json.data).toEqual({ custom: 'data' });
    });

    test('should convert to JSON without data', () => {
      const error = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Test error',
      });

      const json = error.toJSON();
      expect(json.code).toBe(JSONRPCErrorCode.InternalError);
      expect(json.message).toBe('Test error');
      expect(json.data).toBeUndefined();
    });
  });

  describe('RPCError.fromUnknown', () => {
    test('should return same error if already RPCError', () => {
      const originalError = new RPCError({
        code: JSONRPCErrorCode.InternalError,
        message: 'Already RPC error',
      });

      const result = RPCError.fromUnknown(originalError);
      expect(result).toBe(originalError);
    });

    test('should wrap Error instance', () => {
      const cause = new Error('Some error');
      const error = RPCError.fromUnknown(cause);

      expect(error).toBeInstanceOf(RPCError);
      expect(error.message).toBe('Some error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
      expect(error.data).toHaveProperty('type', 'Error');
    });

    test('should wrap Error with custom code', () => {
      const cause = new Error('Some error');
      const error = RPCError.fromUnknown(
        cause,
        JSONRPCErrorCode.MethodNotFound
      );

      expect(error.code).toBe(JSONRPCErrorCode.MethodNotFound);
    });

    test('should wrap string as error message', () => {
      const error = RPCError.fromUnknown('String error');

      expect(error).toBeInstanceOf(RPCError);
      expect(error.message).toBe('String error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
    });

    test('should wrap unknown values', () => {
      const unknownValue = { foo: 'bar' };
      const error = RPCError.fromUnknown(unknownValue);

      expect(error).toBeInstanceOf(RPCError);
      expect(error.message).toBe('Unknown error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
      expect(error.data).toEqual(unknownValue);
    });

    test('should wrap null as unknown error', () => {
      const error = RPCError.fromUnknown(null);

      expect(error).toBeInstanceOf(RPCError);
      expect(error.message).toBe('Unknown error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
      expect(error.data).toBeNull();
    });

    test('should wrap undefined as unknown error', () => {
      const error = RPCError.fromUnknown(undefined);

      expect(error).toBeInstanceOf(RPCError);
      expect(error.message).toBe('Unknown error');
      expect(error.code).toBe(JSONRPCErrorCode.InternalError);
      expect(error.data).toBeUndefined();
    });
  });
});
