import { ID, ErrorResponse } from '../error';
import { ERROR, isArray, isFunction, isObject, UNDEFINED } from './constants';

/**
 * JSONRPC version constant
 */
export const jsonrpc = '2.0' as const;

/**
 * JSONRPC Request interface
 */
export interface Request {
  readonly jsonrpc: typeof jsonrpc;
  readonly id?: ID;
  readonly method: string;
  readonly params: readonly unknown[] | object;
  readonly remoteStack?: string;
}

/**
 * JSONRPC Success Response interface
 */
export interface SuccessResponse {
  readonly jsonrpc: typeof jsonrpc;
  readonly id?: ID;
  readonly result: unknown;
  readonly undef?: boolean; // Non-standard extension for undefined values
}

/**
 * JSONRPC Response type (success or error)
 */
export type Response = SuccessResponse | ErrorResponse<unknown>;

/**
 * Error map function type for custom error mapping
 */
export type ErrorMapFunction<T = unknown> = (
  error: unknown,
  request: Request
) => {
  code: number;
  message: string;
  data?: T;
};

/**
 * AsyncCall error detail structure
 */
export interface AsyncCallErrorDetail {
  readonly stack?: string;
  readonly type?: string;
}

/**
 * Create a JSONRPC request object
 */
export const makeRequest = (
  id: ID,
  method: string,
  params: readonly unknown[] | object,
  remoteStack?: string
): Request => {
  const x: Request = { jsonrpc, id, method, params, remoteStack };
  deleteUndefined(x, 'id');
  deleteFalsy(x, 'remoteStack');
  return x;
};

/**
 * Create a JSONRPC success response object
 */
export const makeSuccessResponse = (
  id: ID,
  result: unknown
): SuccessResponse => {
  const x: SuccessResponse = { jsonrpc, id, result };
  deleteUndefined(x, 'id');
  return x;
};

/**
 * Create a JSONRPC error response object
 * Pre-defined errors from JSONRPC 2.0 specification section 5.1
 */
export const makeErrorResponse = <T>(
  id: ID,
  code: number,
  message: string,
  data?: T
): ErrorResponse<T> => {
  if (id === UNDEFINED) id = null;
  code = Math.floor(code);
  if (Number.isNaN(code)) code = -1;
  const x: ErrorResponse<T> = {
    jsonrpc,
    id,
    error: { code, message, data },
  };
  deleteUndefined(x.error, 'data');
  return x;
};

/**
 * Parse error response (-32700)
 * Pre-defined error in JSONRPC 2.0 specification section 5.1
 */
export const ErrorResponseParseError = <T>(
  e: unknown,
  mapper: ErrorMapFunction<T>
): ErrorResponse<T> => {
  const obj = ErrorResponseMapped({} as any, e, mapper);
  const o = obj.error as Mutable<ErrorResponse['error']>;
  o.code = -32700;
  o.message = 'Parse error';
  return obj;
};

/**
 * Invalid Request error response (-32600)
 * Pre-defined error in JSONRPC 2.0 specification section 5.1
 */
export const ErrorResponseInvalidRequest = (id: ID): ErrorResponse => {
  return makeErrorResponse(id, -32600, 'Invalid Request');
};

/**
 * Method not found error response (-32601)
 * Pre-defined error in JSONRPC 2.0 specification section 5.1
 */
export const ErrorResponseMethodNotFound = (id: ID): ErrorResponse => {
  return makeErrorResponse(id, -32601, 'Method not found');
};

/**
 * Invalid params error response (-32602)
 * Pre-defined error in JSONRPC 2.0 specification section 5.1
 */
export const ErrorResponseInvalidParams = (id: ID): ErrorResponse => {
  return makeErrorResponse(id, -32602, 'Invalid params');
};

/**
 * Internal error response (-32603)
 * Pre-defined error in JSONRPC 2.0 specification section 5.1
 */
export const ErrorResponseInternalError = (id: ID): ErrorResponse => {
  return makeErrorResponse(id, -32603, 'Internal error');
};

/**
 * Map an error to a JSONRPC error response using a custom mapper
 */
export const ErrorResponseMapped = <T>(
  request: Request,
  e: unknown,
  mapper: ErrorMapFunction<T>
): ErrorResponse<T> => {
  const { id } = request;
  const { code, message, data } = mapper(e, request);
  return makeErrorResponse(id, code, message, data);
};

/**
 * Default error mapper that extracts error information
 */
export const defaultErrorMapper =
  (stack = '', code = -1): ErrorMapFunction<AsyncCallErrorDetail> =>
  (e) => {
    let message = toString('', () => (e as any).message);
    let type = toString(
      ERROR,
      (ctor = (e as any).constructor) => isFunction(ctor) && ctor.name
    );

    // Check for DOMException
    const E = globalThis.DOMException;
    if (E && e instanceof E) {
      type = `DOMException:${e.name}`;
    }

    const eType = typeof e;
    if (
      eType === 'string' ||
      eType === 'number' ||
      eType === 'boolean' ||
      eType === 'bigint'
    ) {
      type = ERROR;
      message = String(e);
    }

    const data: AsyncCallErrorDetail = stack ? { stack, type } : { type };
    return { code, message, data };
  };

/**
 * Check if an object is a valid JSONRPC request or response
 */
export const isJSONRPCObject = (data: any): data is Response | Request => {
  if (!isObject(data)) return false;
  if (!('jsonrpc' in data)) return false;
  const obj = data as { jsonrpc?: string; params?: unknown };
  if (obj.jsonrpc !== jsonrpc) return false;
  if ('params' in obj) {
    const params = obj.params;
    if (!isArray(params) && !isObject(params)) return false;
  }
  return true;
};

/**
 * Helper function to safely convert value to string
 */
const toString = (_default: string, val: () => any): string => {
  try {
    const v = val();
    if (v === UNDEFINED) return _default;
    return String(v);
  } catch {
    return _default;
  }
};

/**
 * Delete undefined property from object
 */
const deleteUndefined = <O>(x: O, key: keyof O): void => {
  if (x[key] === UNDEFINED) delete x[key];
};

/**
 * Delete falsy property from object
 */
const deleteFalsy = <T>(x: T, key: keyof T): void => {
  if (!x[key]) delete x[key];
};

/**
 * Make a type mutable
 */
type Mutable<T> = { -readonly [key in keyof T]: T[key] };
