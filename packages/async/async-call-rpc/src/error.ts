/* eslint-disable no-param-reassign */

/**
 * JSONRPC Error Response Detail
 * Based on JSONRPC 2.0 specification
 */
export interface ErrorResponseDetail<Error = unknown> {
  readonly code: number;
  readonly message: string;
  readonly data?: Error;
}

/**
 * JSONRPC Request/Response ID type
 * Can be string, number, null, or undefined (for notifications)
 */
export type ID = string | number | null | undefined;

/**
 * JSONRPC Error Response
 * Based on JSONRPC 2.0 specification
 */
export interface ErrorResponse<Error = unknown> {
  readonly jsonrpc: '2.0';
  readonly id?: ID;
  readonly error: ErrorResponseDetail<Error>;
}

/**
 * Standard JSONRPC 2.0 Error Codes
 * Based on JSONRPC 2.0 specification section 5.1
 */
export enum JSONRPCErrorCode {
  /**
   * Parse error (-32700)
   * Invalid JSON was received by the server.
   * An error occurred on the server while parsing the JSON text.
   */
  ParseError = -32700,

  /**
   * Invalid Request (-32600)
   * The JSON sent is not a valid Request object.
   */
  InvalidRequest = -32600,

  /**
   * Method not found (-32601)
   * The method does not exist / is not available.
   */
  MethodNotFound = -32601,

  /**
   * Invalid params (-32602)
   * Invalid method parameter(s).
   */
  InvalidParams = -32602,

  /**
   * Internal error (-32603)
   * Internal JSON-RPC error.
   */
  InternalError = -32603,

  /**
   * Server error (-32000 to -32099)
   * Reserved for implementation-defined server-errors.
   * The remainder of the space is available for application defined errors.
   */
  ServerErrorStart = -32000,
  ServerErrorEnd = -32099,
}

/**
 * Create a JSONRPC error response object
 * This function is kept for backward compatibility.
 * For new code, prefer using functions from utils/jsonrpc.ts
 */
export const makeErrorResponse = <T>(
  id: ID,
  code: number,
  message: string,
  data?: T
): ErrorResponse<T> => {
  if (id === undefined) id = null;
  code = Math.floor(code);
  if (Number.isNaN(code)) code = -1;
  const x: ErrorResponse<T> = {
    jsonrpc: '2.0',
    id,
    error: { code, message, data },
  };
  // Remove undefined data field
  if (x.error.data === undefined) {
    delete (x.error as any).data;
  }
  return x;
};
