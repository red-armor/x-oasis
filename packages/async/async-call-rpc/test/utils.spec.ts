import { expect, describe, test } from 'vitest';
import {
  makeRequest,
  makeSuccessResponse,
  makeErrorResponse,
  ErrorResponseInvalidRequest,
  ErrorResponseMethodNotFound,
  ErrorResponseInvalidParams,
  ErrorResponseInternalError,
  jsonrpc,
} from '../src/utils/jsonrpc';

/**
 * Test suite for JSONRPC utility functions
 * Covers: request/response creation, error responses
 */
describe('JSONRPC Utils', () => {
  describe('makeRequest', () => {
    test('should create request with required fields', () => {
      const request = makeRequest('req-1', 'testMethod', []);

      expect(request.jsonrpc).toBe('2.0');
      expect(request.id).toBe('req-1');
      expect(request.method).toBe('testMethod');
      expect(request.params).toEqual([]);
    });

    test('should create request with multiple params', () => {
      const params = ['arg1', 'arg2', { key: 'value' }];
      const request = makeRequest('req-1', 'method', params);

      expect(request.params).toEqual(params);
    });

    test('should create request with object params', () => {
      const params = { x: 10, y: 20 };
      const request = makeRequest('req-1', 'method', params);

      expect(request.params).toEqual(params);
    });

    test('should include remoteStack when provided', () => {
      const stack = 'Error: test\n  at func';
      const request = makeRequest('req-1', 'method', [], stack);

      expect(request.remoteStack).toBe(stack);
    });

    test('should exclude remoteStack when empty', () => {
      const request = makeRequest('req-1', 'method', [], '');

      expect(request.remoteStack).toBeUndefined();
    });

    test('should handle numeric ID', () => {
      const request = makeRequest(123, 'method', []);

      expect(request.id).toBe(123);
    });

    test('should handle null ID', () => {
      const request = makeRequest(null, 'method', []);

      expect(request.id).toBeUndefined();
    });
  });

  describe('makeSuccessResponse', () => {
    test('should create success response', () => {
      const response = makeSuccessResponse('req-1', 'result value');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect(response.result).toBe('result value');
    });

    test('should handle various result types', () => {
      expect(makeSuccessResponse('1', 42).result).toBe(42);
      expect(makeSuccessResponse('2', true).result).toBe(true);
      expect(makeSuccessResponse('3', null).result).toBeNull();
      expect(makeSuccessResponse('4', { a: 1 }).result).toEqual({ a: 1 });
      expect(makeSuccessResponse('5', [1, 2, 3]).result).toEqual([1, 2, 3]);
    });

    test('should handle undefined result', () => {
      const response = makeSuccessResponse('req-1', undefined);

      expect(response.result).toBeUndefined();
    });

    test('should handle null ID in response', () => {
      const response = makeSuccessResponse(null, 'result');

      expect(response.id).toBeUndefined();
    });
  });

  describe('makeErrorResponse', () => {
    test('should create error response with code and message', () => {
      const response = makeErrorResponse('req-1', -32600, 'Invalid Request');

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe('req-1');
      expect(response.error.code).toBe(-32600);
      expect(response.error.message).toBe('Invalid Request');
    });

    test('should include error data when provided', () => {
      const errorData = { custom: 'data' };
      const response = makeErrorResponse(
        'req-1',
        -32603,
        'Internal error',
        errorData
      );

      expect(response.error.data).toEqual(errorData);
    });

    test('should exclude error data when undefined', () => {
      const response = makeErrorResponse('req-1', -32603, 'Internal error');

      expect(response.error.data).toBeUndefined();
    });

    test('should normalize code to integer', () => {
      const response = makeErrorResponse('req-1', -32600.5, 'Test');

      expect(response.error.code).toBe(-32600);
      expect(Number.isInteger(response.error.code)).toBe(true);
    });

    test('should handle NaN code', () => {
      const response = makeErrorResponse('req-1', NaN, 'Test');

      expect(response.error.code).toBe(-1);
    });
  });

  describe('Predefined Error Responses', () => {
    test('ErrorResponseInvalidRequest', () => {
      const response = ErrorResponseInvalidRequest('req-1');

      expect(response.error.code).toBe(-32600);
      expect(response.error.message).toBe('Invalid Request');
      expect(response.id).toBe('req-1');
    });

    test('ErrorResponseMethodNotFound', () => {
      const response = ErrorResponseMethodNotFound('req-2');

      expect(response.error.code).toBe(-32601);
      expect(response.error.message).toBe('Method not found');
      expect(response.id).toBe('req-2');
    });

    test('ErrorResponseInvalidParams', () => {
      const response = ErrorResponseInvalidParams('req-3');

      expect(response.error.code).toBe(-32602);
      expect(response.error.message).toBe('Invalid params');
      expect(response.id).toBe('req-3');
    });

    test('ErrorResponseInternalError', () => {
      const response = ErrorResponseInternalError('req-4');

      expect(response.error.code).toBe(-32603);
      expect(response.error.message).toBe('Internal error');
      expect(response.id).toBe('req-4');
    });
  });

  describe('JSONRPC Version', () => {
    test('should use correct JSONRPC version', () => {
      expect(jsonrpc).toBe('2.0');
    });

    test('all responses should use correct version', () => {
      const request = makeRequest('1', 'method', []);
      const successResponse = makeSuccessResponse('1', 'result');
      const errorResponse = makeErrorResponse('1', -32600, 'Invalid');

      expect(request.jsonrpc).toBe('2.0');
      expect(successResponse.jsonrpc).toBe('2.0');
      expect(errorResponse.jsonrpc).toBe('2.0');
    });
  });
});
