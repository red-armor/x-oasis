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
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,
  ServerErrorStart = -32000,
  ServerErrorEnd = -32099,
}

/**
 * Structured RPC Error class.
 *
 * Inspired by tRPC's `TRPCError` — wraps any unknown error into a
 * consistent shape with `code`, `message`, `data`, and preserved `stack`.
 *
 * @example
 * ```ts
 * try {
 *   await client.someMethod();
 * } catch (err) {
 *   if (err instanceof RPCError) {
 *     console.log(err.code, err.message, err.data);
 *   }
 * }
 * ```
 */
export class RPCError extends Error {
  readonly code: number;
  readonly data?: unknown;

  constructor(opts: {
    code: number;
    message: string;
    cause?: unknown;
    data?: unknown;
  }) {
    super(opts.message);
    this.name = 'RPCError';
    this.code = opts.code;
    this.data = opts.data;

    // Preserve original stack if cause is an Error
    if (opts.cause instanceof Error && opts.cause.stack) {
      this.stack = opts.cause.stack;
    }
  }

  /**
   * Wrap any unknown value into an RPCError.
   */
  static fromUnknown(
    cause: unknown,
    code = JSONRPCErrorCode.InternalError
  ): RPCError {
    if (cause instanceof RPCError) {
      return cause;
    }

    if (cause instanceof Error) {
      return new RPCError({
        code,
        message: cause.message,
        cause,
        data: { type: cause.constructor.name, stack: cause.stack },
      });
    }

    if (typeof cause === 'string') {
      return new RPCError({ code, message: cause });
    }

    return new RPCError({
      code,
      message: 'Unknown error',
      data: cause,
    });
  }

  /**
   * Convert to a plain JSONRPC error response detail object.
   */
  toJSON(): ErrorResponseDetail {
    return {
      code: this.code,
      message: this.message,
      ...(this.data !== undefined ? { data: this.data } : {}),
    };
  }
}
